-- ==========================================
-- DAILY SUMMARY DATABASE SETUP
-- Standalone SQL Script for DailySummaryView
-- ==========================================

/*
วิธีใช้:
1. เปิด Supabase Dashboard → SQL Editor
2. Copy-paste script นี้ทั้งหมด
3. กด Run
4. ตรวจสอบ: SELECT * FROM daily_summary_by_shift LIMIT 1;
*/

-- ==========================================
-- 1. CREATE SHIFT DETECTION FUNCTION
-- ==========================================
-- Function สำหรับแปลง time เป็น shift (ใช้ได้ทั้ง Frontend และ Backend)
DROP FUNCTION IF EXISTS get_shift_from_time(VARCHAR);
DROP FUNCTION IF EXISTS get_shift_from_time(TIMESTAMP WITH TIME ZONE);
DROP FUNCTION IF EXISTS get_shift_from_time(TIME);

CREATE OR REPLACE FUNCTION get_shift_from_time(time_input ANYELEMENT)
RETURNS VARCHAR AS $$
DECLARE
  hour INT;
  time_str VARCHAR;
BEGIN
  -- Convert any time input to VARCHAR
  time_str := CAST(time_input AS VARCHAR);
  
  IF time_str IS NULL THEN 
    RETURN 'all'; 
  END IF;
  
  hour := EXTRACT(HOUR FROM time_str::TIME);
  
  -- กะ 1: 10:00-19:00 (เช้า-เย็น)
  IF hour >= 10 AND hour < 19 THEN 
    RETURN '1';
  -- กะ 2: 19:00-01:00 (เย็น-ดึก)
  ELSIF hour >= 19 OR hour < 1 THEN 
    RETURN '2';
  -- กะ 3: 01:00-10:00 (ดึก-เช้า)
  ELSIF hour >= 1 AND hour < 10 THEN 
    RETURN '3';
  ELSE 
    RETURN 'all';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ==========================================
-- 2. AUTO-COMPUTE SHIFT TRIGGER
-- ==========================================
-- Trigger สำหรับ auto-populate shift field ก่อน insert/update
DROP TRIGGER IF EXISTS auto_compute_shift ON customers_history;
DROP FUNCTION IF EXISTS compute_shift_on_insert();

CREATE OR REPLACE FUNCTION compute_shift_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- ถ้า shift เป็น NULL หรือ 'all' ให้ auto-compute จาก start_time
  IF NEW.shift IS NULL OR NEW.shift = 'all' THEN
    NEW.shift := get_shift_from_time(NEW.start_time);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger เพื่อ auto-compute shift ก่อน INSERT/UPDATE
CREATE TRIGGER auto_compute_shift
BEFORE INSERT OR UPDATE ON customers_history
FOR EACH ROW EXECUTE FUNCTION compute_shift_on_insert();

-- ==========================================
-- RLS: Allow public (anon key) to read history
-- ==========================================
-- NOTE: If you require auth, remove this policy and use authenticated-only
DROP POLICY IF EXISTS "customers_history_public_select" ON customers_history;
CREATE POLICY "customers_history_public_select" ON customers_history
  FOR SELECT
  USING (true);

-- ==========================================
-- 3. DAILY SUMMARY VIEW (READ-ONLY)
-- ==========================================
-- View สำหรับแสดงสรุปยอดรายวันตามกะ
DROP VIEW IF EXISTS public.daily_summary_by_shift CASCADE;

CREATE OR REPLACE VIEW public.daily_summary_by_shift AS
SELECT
  customers_history.session_date,
  COALESCE(customers_history.shift, get_shift_from_time(customers_history.start_time)) as shift,
  COUNT(customers_history.id) as total_customers,
  SUM(
    CASE WHEN customers_history.payment_method = 'transfer' 
    THEN customers_history.final_cost 
    ELSE 0 
    END
  ) as transfer_total,
  SUM(
    CASE WHEN customers_history.payment_method = 'cash' 
    THEN customers_history.final_cost 
    ELSE 0 
    END
  ) as cash_total,
  SUM(customers_history.final_cost) as grand_total,
  COUNT(customers_history.id) as total_count,
  ROUND(AVG(customers_history.duration_minutes)::NUMERIC, 2) as avg_duration_minutes
FROM customers_history
WHERE customers_history.end_reason != 'in_progress'
GROUP BY customers_history.session_date, COALESCE(customers_history.shift, get_shift_from_time(customers_history.start_time))
ORDER BY customers_history.session_date DESC, shift;

ALTER VIEW public.daily_summary_by_shift OWNER TO postgres;

-- ==========================================
-- 4. DAILY SUMMARY BY SHIFT - DETAILED VIEW
-- ==========================================
-- View สำหรับแสดงรายการทั้งหมดของแต่ละกะ
DROP VIEW IF EXISTS public.vip_entries_by_shift CASCADE;

CREATE OR REPLACE VIEW public.vip_entries_by_shift AS
SELECT
  customers_history.id,
  customers_history.customer_id,
  customers_history.name,
  customers_history.room,
  customers_history.session_date,
  COALESCE(customers_history.shift, get_shift_from_time(customers_history.start_time)) as shift,
  customers_history.start_time,
  customers_history.end_time,
  ROUND(customers_history.duration_minutes::NUMERIC, 2) as duration_minutes,
  ROUND(customers_history.final_cost::NUMERIC, 2) as final_cost,
  customers_history.payment_method,
  customers_history.end_reason,
  customers_history.created_at,
  customers_history.updated_at
FROM customers_history
WHERE customers_history.end_reason != 'in_progress'
ORDER BY customers_history.session_date DESC, customers_history.start_time DESC;

ALTER VIEW public.vip_entries_by_shift OWNER TO postgres;

-- ==========================================
-- 5. COMPUTER ZONE ENTRIES BY SHIFT
-- ==========================================
-- View สำหรับแสดง Computer Zone entries ตามกะ
DROP VIEW IF EXISTS public.computer_entries_by_shift CASCADE;

CREATE OR REPLACE VIEW public.computer_entries_by_shift AS
SELECT
  computer_zone_history.id,
  computer_zone_history.session_date,
  computer_zone_history.shift,
  ROUND(computer_zone_history.transfer_amount::NUMERIC, 2) as transfer_amount,
  ROUND(computer_zone_history.cash_amount::NUMERIC, 2) as cash_amount,
  ROUND(computer_zone_history.total_cost::NUMERIC, 2) as total_cost,
  computer_zone_history.added_by,
  computer_zone_history.start_time,
  computer_zone_history.created_at,
  computer_zone_history.updated_at
FROM computer_zone_history
ORDER BY computer_zone_history.session_date DESC, computer_zone_history.start_time DESC;

ALTER VIEW public.computer_entries_by_shift OWNER TO postgres;

-- ==========================================
-- 6. DAILY SUMMARY AGGREGATED (ALL DATA)
-- ==========================================
-- View สำหรับแสดง summary รวมทั้งวัน (VIP + Computer)
DROP VIEW IF EXISTS public.daily_summary_aggregated CASCADE;

CREATE OR REPLACE VIEW public.daily_summary_aggregated AS
SELECT
  session_date,
  'vip' as type,
  shift,
  COUNT(*) as entry_count,
  SUM(CASE WHEN payment_method = 'transfer' THEN final_cost ELSE 0 END) as transfer_total,
  SUM(CASE WHEN payment_method = 'cash' THEN final_cost ELSE 0 END) as cash_total,
  SUM(final_cost) as grand_total,
  ROUND(AVG(duration_minutes)::NUMERIC, 2) as avg_duration
FROM customers_history
WHERE end_reason != 'in_progress'
GROUP BY session_date, shift
UNION ALL
SELECT
  session_date,
  'computer' as type,
  shift,
  COUNT(*) as entry_count,
  SUM(transfer_amount) as transfer_total,
  SUM(cash_amount) as cash_total,
  SUM(transfer_amount + cash_amount) as grand_total,
  NULL as avg_duration
FROM computer_zone_history
GROUP BY session_date, shift
ORDER BY session_date DESC, type DESC;

ALTER VIEW public.daily_summary_aggregated OWNER TO postgres;

-- ==========================================
-- 7. VERIFY SETUP
-- ==========================================
-- ตรวจสอบ function
SELECT 
  proname as function_name,
  pg_get_functiondef(pg_proc.oid) as definition
FROM pg_proc
WHERE proname IN ('get_shift_from_time', 'compute_shift_on_insert')
AND pg_proc.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- ตรวจสอบ triggers
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table AS table_name
FROM information_schema.triggers
WHERE event_object_table IN ('customers_history', 'computer_zone_history')
AND trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- ตรวจสอบ views
SELECT
  table_name AS view_name,
  table_schema AS schema
FROM information_schema.views
WHERE table_schema = 'public'
AND (table_name LIKE '%shift%' OR table_name LIKE '%summary%')
ORDER BY table_name;

-- ==========================================
-- 8. TEST QUERIES
-- ==========================================
-- Test 1: ดูสรุปยอดรายวันตามกะ
SELECT * FROM daily_summary_by_shift
WHERE session_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY session_date DESC, shift;

-- Test 2: ดูรายการ VIP ตามกะ
SELECT name, room, shift, duration_minutes, final_cost, payment_method
FROM vip_entries_by_shift
WHERE session_date = CURRENT_DATE
ORDER BY shift, start_time DESC;

-- Test 3: ดูรายการ Computer Zone ตามกะ
SELECT shift, transfer_amount, cash_amount, total_cost
FROM computer_entries_by_shift
WHERE session_date = CURRENT_DATE
ORDER BY shift;

-- Test 4: ตรวจสอบข้อมูล aggregate
SELECT * FROM daily_summary_aggregated
WHERE session_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY session_date DESC, type;

-- ==========================================
-- 9. SAMPLE DATA VERIFICATION
-- ==========================================
-- นับจำนวน records ที่มี shift
SELECT 
  'customers_history' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN shift IS NOT NULL AND shift != 'all' THEN 1 END) as with_shift,
  COUNT(CASE WHEN shift IS NULL OR shift = 'all' THEN 1 END) as without_shift
FROM customers_history
UNION ALL
SELECT 
  'computer_zone_history' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN shift IS NOT NULL AND shift != 'all' THEN 1 END) as with_shift,
  COUNT(CASE WHEN shift IS NULL OR shift = 'all' THEN 1 END) as without_shift
FROM computer_zone_history;

-- ==========================================
-- SUCCESS: Daily Summary Database Setup Complete!
-- ==========================================

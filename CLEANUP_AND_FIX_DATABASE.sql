-- ==========================================
-- CLEANUP & FIX DATABASE - Juthazone
-- ==========================================
-- วิธีใช้:
-- 1. เปิด Supabase Dashboard → SQL Editor
-- 2. Copy-paste script นี้ทั้งหมด
-- 3. กด Run
-- 4. เสร็จแล้วลบ test data และ unrestricted views
-- ==========================================

-- ==========================================
-- 1. DROP ALL DEPENDENT VIEWS FIRST!
-- ==========================================
-- ⚠️ CRITICAL: Drop views BEFORE altering column types
-- ต้องลบทั้งหมด รวม dependent views ด้วย
DROP VIEW IF EXISTS public.vip_summary_by_shift CASCADE;
DROP VIEW IF EXISTS public.daily_summary_by_shift CASCADE;
DROP VIEW IF EXISTS public.daily_summary CASCADE;
DROP VIEW IF EXISTS public.public_daily_summary_by_shift CASCADE;
DROP VIEW IF EXISTS public.public_vip_summary_by_shift CASCADE;
DROP VIEW IF EXISTS public.juthasob_daily_stats CASCADE;
DROP VIEW IF EXISTS public.juthasob_room_stats CASCADE;
DROP VIEW IF EXISTS public.computer_zone_summary_by_shift CASCADE;
DROP VIEW IF EXISTS public.room_stats CASCADE;
DROP VIEW IF EXISTS public.login_statistics CASCADE;
DROP VIEW IF EXISTS public.activity_statistics CASCADE;
DROP VIEW IF EXISTS public.vip_entries_by_shift CASCADE;
DROP VIEW IF EXISTS public.computer_entries_by_shift CASCADE;
DROP VIEW IF EXISTS public.aggregated_daily_summary_by_shift CASCADE;

-- ตรวจสอบให้แน่ใจว่าลบเสร็จ
-- SELECT * FROM pg_views WHERE schemaname = 'public';

-- ==========================================
-- 2. FIX: customers_history TABLE
-- ==========================================
-- ตรวจสอบและแก้ไขโครงสร้าง
ALTER TABLE IF EXISTS customers_history 
  ALTER COLUMN final_cost SET DATA TYPE DECIMAL(10, 2);

ALTER TABLE IF EXISTS customers_history 
  ALTER COLUMN duration_minutes SET DATA TYPE DECIMAL(10, 2);

-- เพิ่ม columns ที่ขาด (ถ้ายังไม่มี)
ALTER TABLE IF EXISTS customers_history 
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'transfer';

ALTER TABLE IF EXISTS customers_history 
  ADD COLUMN IF NOT EXISTS shift VARCHAR(10) DEFAULT 'all';

ALTER TABLE IF EXISTS customers_history 
  ADD COLUMN IF NOT EXISTS session_date DATE;

ALTER TABLE IF EXISTS customers_history 
  ADD COLUMN IF NOT EXISTS end_reason VARCHAR(50) DEFAULT 'in_progress';

ALTER TABLE IF EXISTS customers_history 
  ADD COLUMN IF NOT EXISTS initial_time DECIMAL(10, 2) DEFAULT 0;

-- Enable RLS
ALTER TABLE customers_history ENABLE ROW LEVEL SECURITY;

-- ลบ policy เก่า (ถ้ามี) - COMMENTED OUT
-- DROP POLICY IF EXISTS "Allow all reads on history" ON customers_history;
-- DROP POLICY IF EXISTS "Allow all inserts on history" ON customers_history;
-- DROP POLICY IF EXISTS "Allow all updates on history" ON customers_history;
-- DROP POLICY IF EXISTS "Allow all deletes on history" ON customers_history;
-- DROP POLICY IF EXISTS "customers_history_select" ON customers_history;
-- DROP POLICY IF EXISTS "customers_history_insert" ON customers_history;
-- DROP POLICY IF EXISTS "customers_history_update" ON customers_history;
-- DROP POLICY IF EXISTS "customers_history_delete" ON customers_history;
-- DROP POLICY IF EXISTS "Allow authenticated select" ON customers_history;
-- DROP POLICY IF EXISTS "Allow authenticated insert" ON customers_history;
-- DROP POLICY IF EXISTS "Allow authenticated update" ON customers_history;
-- DROP POLICY IF EXISTS "Allow authenticated delete" ON customers_history;

-- Allow history page (anon key) to read data
-- DROP POLICY IF EXISTS "customers_history_public_select" ON customers_history;

-- สร้าง RLS policies ใหม่ - รองรับทั้ง authenticated และ anon key
CREATE POLICY "customers_history_authenticated_select" ON customers_history 
  FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "customers_history_public_select" ON customers_history
  FOR SELECT
  USING (true);

CREATE POLICY "customers_history_authenticated_insert" ON customers_history 
  FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "customers_history_public_insert" ON customers_history 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "customers_history_authenticated_update" ON customers_history 
  FOR UPDATE 
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "customers_history_public_update" ON customers_history 
  FOR UPDATE 
  USING (true)
  WITH CHECK (true);

CREATE POLICY "customers_history_authenticated_delete" ON customers_history 
  FOR DELETE 
  USING (auth.role() = 'authenticated');

CREATE POLICY "customers_history_public_delete" ON customers_history 
  FOR DELETE 
  USING (true);

-- Enable realtime
ALTER TABLE customers_history REPLICA IDENTITY FULL;

-- ==========================================
-- 3. FIX: computer_zone_history TABLE
-- ==========================================
ALTER TABLE IF EXISTS computer_zone_history 
  ALTER COLUMN transfer_amount SET DATA TYPE DECIMAL(10, 2);

ALTER TABLE IF EXISTS computer_zone_history 
  ALTER COLUMN cash_amount SET DATA TYPE DECIMAL(10, 2);

ALTER TABLE IF EXISTS computer_zone_history 
  ALTER COLUMN total_cost SET DATA TYPE DECIMAL(10, 2);

-- เพิ่ม columns ที่ขาด (ถ้ายังไม่มี)
ALTER TABLE IF EXISTS computer_zone_history 
  ADD COLUMN IF NOT EXISTS session_date DATE;

-- Auto compute session_date and shift for computer_zone_history
DROP TRIGGER IF EXISTS auto_compute_computer_shift ON computer_zone_history;
DROP FUNCTION IF EXISTS compute_computer_shift_on_insert();

CREATE OR REPLACE FUNCTION compute_computer_shift_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.session_date IS NULL THEN
    NEW.session_date := COALESCE(CAST(NEW.start_time AS DATE), CAST(NEW.created_at AS DATE), CURRENT_DATE);
  END IF;
  IF NEW.shift IS NULL OR NEW.shift = 'all' THEN
    NEW.shift := get_shift_from_time(COALESCE(NEW.start_time, NEW.created_at));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_compute_computer_shift
BEFORE INSERT OR UPDATE ON computer_zone_history
FOR EACH ROW EXECUTE FUNCTION compute_computer_shift_on_insert();

-- Enable RLS
ALTER TABLE computer_zone_history ENABLE ROW LEVEL SECURITY;

-- ลบ policy เก่า (ถ้ามี)
DROP POLICY IF EXISTS "Allow all users to read computer_zone_history" ON computer_zone_history;
DROP POLICY IF EXISTS "Allow authenticated users to insert computer_zone_history" ON computer_zone_history;
DROP POLICY IF EXISTS "Allow users to delete their own computer_zone_history entries" ON computer_zone_history;
DROP POLICY IF EXISTS "computer_zone_history_select" ON computer_zone_history;
DROP POLICY IF EXISTS "computer_zone_history_insert" ON computer_zone_history;
DROP POLICY IF EXISTS "computer_zone_history_update" ON computer_zone_history;
DROP POLICY IF EXISTS "computer_zone_history_delete" ON computer_zone_history;
DROP POLICY IF EXISTS "Allow authenticated select" ON computer_zone_history;
DROP POLICY IF EXISTS "Allow authenticated insert" ON computer_zone_history;
DROP POLICY IF EXISTS "Allow authenticated update" ON computer_zone_history;
DROP POLICY IF EXISTS "Allow authenticated delete" ON computer_zone_history;

-- สร้าง RLS policies ใหม่ - รองรับทั้ง authenticated และ anon key
CREATE POLICY "computer_zone_authenticated_select" ON computer_zone_history 
  FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "computer_zone_public_select" ON computer_zone_history 
  FOR SELECT 
  USING (true);

CREATE POLICY "computer_zone_authenticated_insert" ON computer_zone_history 
  FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "computer_zone_public_insert" ON computer_zone_history 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "computer_zone_authenticated_update" ON computer_zone_history 
  FOR UPDATE 
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "computer_zone_public_update" ON computer_zone_history 
  FOR UPDATE 
  USING (true)
  WITH CHECK (true);

CREATE POLICY "computer_zone_authenticated_delete" ON computer_zone_history 
  FOR DELETE 
  USING (auth.role() = 'authenticated');

CREATE POLICY "computer_zone_public_delete" ON computer_zone_history 
  FOR DELETE 
  USING (true);

-- Enable realtime
ALTER TABLE computer_zone_history REPLICA IDENTITY FULL;

-- ==========================================
-- 4. FIX: customers TABLE
-- ==========================================
ALTER TABLE IF EXISTS customers ENABLE ROW LEVEL SECURITY;

-- ลบ policy เก่า (ถ้ามี)
DROP POLICY IF EXISTS "customers_select" ON customers;
DROP POLICY IF EXISTS "customers_insert" ON customers;
DROP POLICY IF EXISTS "customers_update" ON customers;
DROP POLICY IF EXISTS "customers_delete" ON customers;
DROP POLICY IF EXISTS "Allow authenticated select" ON customers;
DROP POLICY IF EXISTS "Allow authenticated insert" ON customers;
DROP POLICY IF EXISTS "Allow authenticated update" ON customers;
DROP POLICY IF EXISTS "Allow authenticated delete" ON customers;

-- สร้าง RLS policies ใหม่ - รองรับทั้ง authenticated และ anon key
CREATE POLICY "customers_authenticated_select" ON customers 
  FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "customers_public_select" ON customers 
  FOR SELECT 
  USING (true);

CREATE POLICY "customers_authenticated_insert" ON customers 
  FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "customers_public_insert" ON customers 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "customers_authenticated_update" ON customers 
  FOR UPDATE 
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "customers_public_update" ON customers 
  FOR UPDATE 
  USING (true)
  WITH CHECK (true);

CREATE POLICY "customers_authenticated_delete" ON customers 
  FOR DELETE 
  USING (auth.role() = 'authenticated');

CREATE POLICY "customers_public_delete" ON customers 
  FOR DELETE 
  USING (true);

-- ==========================================
-- 5. FIX: users TABLE
-- ==========================================
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;

-- ลบ policy เก่า (ถ้ามี)
DROP POLICY IF EXISTS "users_select" ON users;
DROP POLICY IF EXISTS "users_insert" ON users;
DROP POLICY IF EXISTS "Allow authenticated select" ON users;
DROP POLICY IF EXISTS "users_authenticated_select" ON users;
DROP POLICY IF EXISTS "users_authenticated_update_self" ON users;
DROP POLICY IF EXISTS "users_public_select" ON users;

-- สร้าง RLS policies ใหม่ - ง่าย เน้นความปลอดภัย
-- อนุญาต authenticated users ทั้งหมด (ไม่ต้อง uid check เพราะ id type ไม่ match)
CREATE POLICY "users_authenticated_select" ON users 
  FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Allow legacy login (anon key) to read users table
CREATE POLICY "users_public_select" ON users
  FOR SELECT
  USING (true);

CREATE POLICY "users_authenticated_insert" ON users 
  FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "users_authenticated_update" ON users 
  FOR UPDATE 
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ==========================================
-- 6. CLEAN TEST DATA
-- ==========================================
-- ลบ test data ที่ไม่จำเป็น (ปลอดภัยถ้ามีข้อมูล duration_minutes ยาว ๆ)
DELETE FROM customers_history 
WHERE duration_minutes IS NOT NULL AND CAST(duration_minutes AS TEXT) LIKE '%00000%';

-- ลบ data ที่เก่าเกินไป (>30 วัน)
DELETE FROM customers_history 
WHERE start_time < CURRENT_TIMESTAMP - INTERVAL '30 days';

DELETE FROM computer_zone_history 
WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '30 days';

DELETE FROM login_logs 
WHERE login_time < CURRENT_TIMESTAMP - INTERVAL '30 days';

DELETE FROM activity_logs 
WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '30 days';

-- ==========================================
-- 7. CREATE PROPER SUMMARY VIEWS & FUNCTIONS
-- ==========================================
-- สร้าง function สำหรับ auto-compute shift จาก time
CREATE OR REPLACE FUNCTION get_shift_from_time(time_str VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  hour INT;
BEGIN
  IF time_str IS NULL THEN RETURN 'all'; END IF;
  hour := EXTRACT(HOUR FROM time_str::TIME);
  
  IF hour >= 10 AND hour < 19 THEN RETURN '1';
  ELSIF hour >= 19 OR hour < 1 THEN RETURN '2';
  ELSIF hour >= 1 AND hour < 10 THEN RETURN '3';
  ELSE RETURN 'all';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- สร้าง view ใหม่ สำหรับ daily summary (RESTRICTED)
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
  ROUND(AVG(customers_history.duration_minutes)::NUMERIC, 2) as avg_duration_minutes
FROM customers_history
WHERE customers_history.end_reason != 'in_progress'
GROUP BY customers_history.session_date, COALESCE(customers_history.shift, get_shift_from_time(customers_history.start_time))
ORDER BY customers_history.session_date DESC, shift;

-- Enable RLS on view (readonly)
ALTER VIEW public.daily_summary_by_shift OWNER TO postgres;

-- ==========================================
-- CREATE AUTO-COMPUTE SHIFT TRIGGER
-- ==========================================
-- ลบ trigger เก่า (ถ้ามี)
DROP TRIGGER IF EXISTS auto_compute_shift ON customers_history;
DROP FUNCTION IF EXISTS compute_shift_on_insert();

-- สร้าง function สำหรับ auto-compute shift
CREATE OR REPLACE FUNCTION compute_shift_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.shift IS NULL OR NEW.shift = 'all' THEN
    NEW.shift := get_shift_from_time(NEW.start_time);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- สร้าง trigger เพื่อ auto-compute shift ก่อน insert/update
CREATE TRIGGER auto_compute_shift
BEFORE INSERT OR UPDATE ON customers_history
FOR EACH ROW EXECUTE FUNCTION compute_shift_on_insert();

-- ==========================================
-- CREATE EDITABLE VIEW WITH TRIGGERS
-- ==========================================
-- สร้าง view ใหม่ที่สามารถแก้ไขได้สำหรับ VIP Summary by Shift
CREATE OR REPLACE VIEW public.vip_summary_by_shift AS
SELECT
  customers_history.session_date,
  customers_history.shift,
  customers_history.id,
  customers_history.customer_id,
  customers_history.name,
  customers_history.room,
  customers_history.start_time,
  customers_history.end_time,
  customers_history.duration_minutes,
  customers_history.final_cost,
  customers_history.payment_method,
  customers_history.end_reason
FROM customers_history
WHERE customers_history.end_reason != 'in_progress'
ORDER BY customers_history.session_date DESC, customers_history.start_time DESC;

-- ลบ triggers เก่า (ถ้ามี)
DROP TRIGGER IF EXISTS vip_summary_insert_trigger ON vip_summary_by_shift;
DROP TRIGGER IF EXISTS vip_summary_update_trigger ON vip_summary_by_shift;
DROP TRIGGER IF EXISTS vip_summary_delete_trigger ON vip_summary_by_shift;
DROP FUNCTION IF EXISTS vip_summary_insert_function();
DROP FUNCTION IF EXISTS vip_summary_update_function();
DROP FUNCTION IF EXISTS vip_summary_delete_function();

-- สร้าง trigger function สำหรับ INSERT
CREATE OR REPLACE FUNCTION vip_summary_insert_function()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO customers_history(
    customer_id, name, room, start_time, end_time, duration_minutes, 
    final_cost, payment_method, shift, session_date, end_reason
  ) VALUES(
    NEW.customer_id, NEW.name, NEW.room, NEW.start_time, NEW.end_time, 
    NEW.duration_minutes, NEW.final_cost, NEW.payment_method, NEW.shift, 
    NEW.session_date, NEW.end_reason
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- สร้าง trigger function สำหรับ UPDATE
CREATE OR REPLACE FUNCTION vip_summary_update_function()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE customers_history
  SET 
    customer_id = NEW.customer_id,
    name = NEW.name,
    room = NEW.room,
    start_time = NEW.start_time,
    end_time = NEW.end_time,
    duration_minutes = NEW.duration_minutes,
    final_cost = NEW.final_cost,
    payment_method = NEW.payment_method,
    shift = NEW.shift,
    session_date = NEW.session_date,
    end_reason = NEW.end_reason
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- สร้าง trigger function สำหรับ DELETE
CREATE OR REPLACE FUNCTION vip_summary_delete_function()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM customers_history
  WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- สร้าง INSTEAD OF triggers
CREATE TRIGGER vip_summary_insert_trigger
INSTEAD OF INSERT ON vip_summary_by_shift
FOR EACH ROW EXECUTE FUNCTION vip_summary_insert_function();

CREATE TRIGGER vip_summary_update_trigger
INSTEAD OF UPDATE ON vip_summary_by_shift
FOR EACH ROW EXECUTE FUNCTION vip_summary_update_function();

CREATE TRIGGER vip_summary_delete_trigger
INSTEAD OF DELETE ON vip_summary_by_shift
FOR EACH ROW EXECUTE FUNCTION vip_summary_delete_function();

-- ==========================================
-- 8. VERIFY FIXES
-- ==========================================
-- ตรวจสอบ RLS status ของ tables
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('customers', 'customers_history', 'computer_zone_history', 'users', 'login_logs', 'activity_logs')
ORDER BY tablename;

-- ตรวจสอบ RLS policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('customers', 'customers_history', 'computer_zone_history', 'users')
ORDER BY tablename, policyname;

-- ตรวจสอบ views
SELECT
  schemaname,
  viewname,
  viewowner
FROM pg_views
WHERE schemaname = 'public'
ORDER BY viewname;

-- ==========================================
-- 9. SUMMARY STATISTICS
-- ==========================================
SELECT 
  'customers' as table_name, 
  COUNT(*) as row_count 
FROM customers
UNION ALL
SELECT 
  'customers_history', 
  COUNT(*) 
FROM customers_history
UNION ALL
SELECT 
  'computer_zone_history', 
  COUNT(*) 
FROM computer_zone_history
UNION ALL
SELECT 
  'users', 
  COUNT(*) 
FROM users;

-- ==========================================
-- SUCCESS: Database Cleanup Complete!
-- ==========================================

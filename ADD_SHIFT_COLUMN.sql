-- ==========================================
-- ADD SHIFT COLUMN TO ALL TABLES
-- ==========================================
-- เพิ่มคอลัมน์ "shift" (กะ) ในแต่ละตาราง
-- กะ 1: 10:00-19:00 (เช้า-เย็น)
-- กะ 2: 19:00-01:00 (เย็น-ดึก)
-- กะ 3: 01:00-10:00 (ดึก-เช้า)
-- 'all': ไม่ระบุกะ
-- ==========================================

-- 1. เพิ่ม shift column ให้ customers table (VIP Room)
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS shift VARCHAR(10) DEFAULT 'all';

COMMENT ON COLUMN customers.shift IS 'กะ: 1 (10:00-19:00), 2 (19:00-01:00), 3 (01:00-10:00), หรือ all (ไม่ระบุ)';

-- 2. เพิ่ม shift column ให้ customers_history table (VIP Room History)
ALTER TABLE customers_history 
ADD COLUMN IF NOT EXISTS shift VARCHAR(10) DEFAULT 'all';

COMMENT ON COLUMN customers_history.shift IS 'กะ: 1 (10:00-19:00), 2 (19:00-01:00), 3 (01:00-10:00), หรือ all (ไม่ระบุ)';

-- *** computer_zone_history มี shift column แล้ว (เช็คว่ามีหรือไม่) ***
-- ถ้าไม่มีให้รัน:
-- ALTER TABLE computer_zone_history 
-- ADD COLUMN IF NOT EXISTS shift VARCHAR(10) DEFAULT 'all';

-- 3. Create index สำหรับ shift column เพื่อให้ query เร็วขึ้น
CREATE INDEX IF NOT EXISTS idx_customers_shift ON customers(shift);
CREATE INDEX IF NOT EXISTS idx_customers_history_shift ON customers_history(shift);

-- 4. ตรวจสอบว่า column เพิ่มสำเร็จ
-- *** customers table ***
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'customers' AND column_name = 'shift'
ORDER BY ordinal_position;

-- *** customers_history table ***
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'customers_history' AND column_name = 'shift'
ORDER BY ordinal_position;

-- *** computer_zone_history table ***
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'computer_zone_history' AND column_name = 'shift'
ORDER BY ordinal_position;

-- ==========================================
-- UPDATE DEFAULT VALUES (ถ้าต้องการ)
-- ==========================================
-- หากต้องการ auto-calculate shift จาก start_time สำหรับ VIP customers:
-- UPDATE customers_history 
-- SET shift = CASE 
--   WHEN EXTRACT(HOUR FROM start_time) >= 10 AND EXTRACT(HOUR FROM start_time) < 19 THEN '1'
--   WHEN EXTRACT(HOUR FROM start_time) >= 19 OR EXTRACT(HOUR FROM start_time) < 1 THEN '2'
--   WHEN EXTRACT(HOUR FROM start_time) >= 1 AND EXTRACT(HOUR FROM start_time) < 10 THEN '3'
--   ELSE 'all'
-- END
-- WHERE shift = 'all' AND start_time IS NOT NULL;

-- ==========================================
-- VIEWS สำหรับ SHIFT SUMMARY
-- ==========================================

-- View: VIP Customer Summary by Shift
CREATE OR REPLACE VIEW vip_summary_by_shift AS
SELECT 
  session_date,
  shift,
  COUNT(*) as total_customers,
  SUM(CASE WHEN payment_method = 'transfer' THEN final_cost ELSE 0 END) as transfer_total,
  SUM(CASE WHEN payment_method = 'cash' THEN final_cost ELSE 0 END) as cash_total,
  SUM(final_cost) as grand_total,
  AVG(duration_minutes) as avg_duration_minutes
FROM customers_history
WHERE end_reason = 'completed'
GROUP BY session_date, shift
ORDER BY session_date DESC, shift;

-- View: Computer Zone Summary by Shift
CREATE OR REPLACE VIEW computer_zone_summary_by_shift AS
SELECT 
  session_date,
  shift,
  COUNT(*) as total_entries,
  SUM(transfer_amount) as transfer_total,
  SUM(cash_amount) as cash_total,
  SUM(total_cost) as grand_total,
  AVG(hours) as avg_hours
FROM computer_zone_history
GROUP BY session_date, shift
ORDER BY session_date DESC, shift;

-- View: Combined Daily Summary by Shift
CREATE OR REPLACE VIEW daily_summary_by_shift AS
SELECT 
  COALESCE(vh.session_date, cz.session_date) as session_date,
  COALESCE(vh.shift, cz.shift) as shift,
  COALESCE(vh.total_customers, 0) as vip_customers,
  COALESCE(vh.grand_total, 0) as vip_total,
  COALESCE(cz.total_entries, 0) as computer_entries,
  COALESCE(cz.grand_total, 0) as computer_total,
  (COALESCE(vh.grand_total, 0) + COALESCE(cz.grand_total, 0)) as total_revenue
FROM vip_summary_by_shift vh
FULL OUTER JOIN computer_zone_summary_by_shift cz 
  ON vh.session_date = cz.session_date AND vh.shift = cz.shift
ORDER BY session_date DESC, shift;

-- ==========================================
-- ตรวจสอบความถูกต้อง
-- ==========================================
SELECT 'Shift column added successfully!' as status;

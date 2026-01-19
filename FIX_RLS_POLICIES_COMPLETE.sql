-- ==========================================
-- FIX: Complete RLS Policies for Juthazone
-- ==========================================
-- วิธีใช้:
-- 1. เปิด Supabase Dashboard → SQL Editor
-- 2. Copy-paste script นี้ทั้งหมด
-- 3. กด Run
-- 4. ออกแล้วกลับเข้า app ใหม่เพื่อรีเฟรช
-- ==========================================

-- ==========================================
-- 1. FIX: customers_history table
-- ==========================================
ALTER TABLE customers_history ENABLE ROW LEVEL SECURITY;

-- ลบ policy เก่า (ถ้ามี)
DROP POLICY IF EXISTS "customers_history_select" ON customers_history;
DROP POLICY IF EXISTS "customers_history_insert" ON customers_history;
DROP POLICY IF EXISTS "customers_history_update" ON customers_history;
DROP POLICY IF EXISTS "customers_history_delete" ON customers_history;

-- สร้าง policy ใหม่ - อนุญาต authenticated users ทั้งหมด
CREATE POLICY "Allow authenticated select" ON customers_history FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated insert" ON customers_history FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated update" ON customers_history FOR UPDATE 
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated delete" ON customers_history FOR DELETE 
  USING (auth.role() = 'authenticated');

-- Enable realtime
ALTER TABLE customers_history REPLICA IDENTITY FULL;

-- ==========================================
-- 2. FIX: computer_zone_history table
-- ==========================================
ALTER TABLE computer_zone_history ENABLE ROW LEVEL SECURITY;

-- ลบ policy เก่า (ถ้ามี)
DROP POLICY IF EXISTS "computer_zone_history_select" ON computer_zone_history;
DROP POLICY IF EXISTS "computer_zone_history_insert" ON computer_zone_history;
DROP POLICY IF EXISTS "computer_zone_history_update" ON computer_zone_history;
DROP POLICY IF EXISTS "computer_zone_history_delete" ON computer_zone_history;

-- สร้าง policy ใหม่ - อนุญาต authenticated users ทั้งหมด
CREATE POLICY "Allow authenticated select" ON computer_zone_history FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated insert" ON computer_zone_history FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated update" ON computer_zone_history FOR UPDATE 
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated delete" ON computer_zone_history FOR DELETE 
  USING (auth.role() = 'authenticated');

-- Enable realtime
ALTER TABLE computer_zone_history REPLICA IDENTITY FULL;

-- ==========================================
-- 3. VERIFY: ตรวจสอบ RLS status
-- ==========================================
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('customers_history', 'computer_zone_history')
ORDER BY tablename;

-- ==========================================
-- 4. List: ดู policies ที่เพิ่งสร้าง
-- ==========================================
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('customers_history', 'computer_zone_history')
ORDER BY tablename, policyname;

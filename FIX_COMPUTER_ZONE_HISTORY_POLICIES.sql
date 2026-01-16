-- ============================================
-- FIX: COMPUTER ZONE HISTORY POLICIES
-- ให้สามารถ CRUD ได้จาก ComputerZoneManager
-- ============================================

-- 1. ลบ policies เดิมทั้งหมดก่อน (ถ้ามี)
DROP POLICY IF EXISTS "Allow authenticated users to select" ON computer_zone_history;
DROP POLICY IF EXISTS "Allow authenticated users to insert" ON computer_zone_history;
DROP POLICY IF EXISTS "Allow authenticated users to update" ON computer_zone_history;
DROP POLICY IF EXISTS "Allow authenticated users to delete" ON computer_zone_history;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON computer_zone_history;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON computer_zone_history;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON computer_zone_history;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON computer_zone_history;

-- 2. เปิด RLS (Row Level Security)
ALTER TABLE computer_zone_history ENABLE ROW LEVEL SECURITY;

-- 3. สร้าง policies ใหม่ทั้งหมด (SELECT, INSERT, UPDATE, DELETE)

-- Policy สำหรับ SELECT (อ่านข้อมูล)
CREATE POLICY "Enable read access for authenticated users"
ON computer_zone_history
FOR SELECT
TO authenticated
USING (true);

-- Policy สำหรับ INSERT (เพิ่มข้อมูล)
CREATE POLICY "Enable insert access for authenticated users"
ON computer_zone_history
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy สำหรับ UPDATE (แก้ไขข้อมูล)
CREATE POLICY "Enable update access for authenticated users"
ON computer_zone_history
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy สำหรับ DELETE (ลบข้อมูล)
CREATE POLICY "Enable delete access for authenticated users"
ON computer_zone_history
FOR DELETE
TO authenticated
USING (true);

-- 4. ตรวจสอบ policies ที่สร้าง
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'computer_zone_history'
ORDER BY cmd;

-- 5. (Optional) ถ้ายังไม่ได้ผล ให้ลอง grant permissions ตรง ๆ
GRANT ALL ON computer_zone_history TO authenticated;
GRANT USAGE ON SEQUENCE computer_zone_history_id_seq TO authenticated;

-- ============================================
-- หมายเหตุ:
-- หลังรัน SQL นี้แล้ว ให้:
-- 1. Logout แล้ว Login ใหม่
-- 2. เปิด Browser Console (F12) ดู error
-- 3. ลองแก้ไขข้อมูลอีกครั้ง
-- ============================================

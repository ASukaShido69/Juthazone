-- ==========================================
-- แก้ไขปัญหา: ไม่สามารถ UPDATE ข้อมูลใน computer_zone_history
-- ==========================================
-- วิธีใช้: Copy ทั้งหมดไปรันใน Supabase SQL Editor
-- ==========================================

-- เปิด RLS (ถ้ายังไม่ได้เปิด)
ALTER TABLE public.computer_zone_history ENABLE ROW LEVEL SECURITY;

-- ลบ policy เก่าทั้งหมดก่อน (เพื่อป้องกันความซ้ำซ้อน)
DROP POLICY IF EXISTS "Allow all users to read computer_zone_history" ON public.computer_zone_history;
DROP POLICY IF EXISTS "Allow authenticated users to insert computer_zone_history" ON public.computer_zone_history;
DROP POLICY IF EXISTS "Allow users to delete their own computer_zone_history entries" ON public.computer_zone_history;
DROP POLICY IF EXISTS "Allow authenticated users to update computer_zone_history" ON public.computer_zone_history;
DROP POLICY IF EXISTS "Allow users to update their own computer_zone_history entries" ON public.computer_zone_history;
DROP POLICY IF EXISTS "czh_select" ON public.computer_zone_history;
DROP POLICY IF EXISTS "czh_insert" ON public.computer_zone_history;
DROP POLICY IF EXISTS "czh_update" ON public.computer_zone_history;
DROP POLICY IF EXISTS "czh_delete" ON public.computer_zone_history;

-- สร้าง policy ใหม่ทั้งหมด (แบบเปิดกว้าง - เหมาะสำหรับ admin dashboard)
-- 1. SELECT - อ่านข้อมูลได้ทั้งหมด
CREATE POLICY "computer_zone_history_select"
  ON public.computer_zone_history
  FOR SELECT
  USING (true);

-- 2. INSERT - เพิ่มข้อมูลได้ทั้งหมด
CREATE POLICY "computer_zone_history_insert"
  ON public.computer_zone_history
  FOR INSERT
  WITH CHECK (true);

-- 3. UPDATE - แก้ไขข้อมูลได้ทั้งหมด (นี่คือที่ขาดหายไป!)
CREATE POLICY "computer_zone_history_update"
  ON public.computer_zone_history
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- 4. DELETE - ลบข้อมูลได้ทั้งหมด
CREATE POLICY "computer_zone_history_delete"
  ON public.computer_zone_history
  FOR DELETE
  USING (true);

-- ตั้งค่า REPLICA IDENTITY FULL สำหรับ realtime updates
ALTER TABLE public.computer_zone_history REPLICA IDENTITY FULL;

-- ตรวจสอบว่า policy ทั้งหมดถูกสร้างแล้ว
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd as operation,
  qual as using_expression,
  with_check as check_expression
FROM pg_policies 
WHERE tablename = 'computer_zone_history'
ORDER BY cmd;

-- ผลลัพธ์ควรแสดง 4 policies:
-- SELECT, INSERT, UPDATE, DELETE

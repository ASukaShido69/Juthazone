-- ==========================================
-- Policies for computer_zone_history
-- ==========================================
-- ใช้ใน Supabase SQL Editor ได้ทันที
-- ปรับ role ตามความต้องการ (ที่นี่อนุญาต authenticated ทั้งหมด)
-- ==========================================

-- เปิด RLS (ถ้ายังไม่ได้เปิด)
ALTER TABLE public.computer_zone_history ENABLE ROW LEVEL SECURITY;

-- ลบ policy เดิมที่อาจซ้ำซ้อน (เลือกใช้หากต้องการเคลียร์)
-- DROP POLICY IF EXISTS "czh_select" ON public.computer_zone_history;
-- DROP POLICY IF EXISTS "czh_insert" ON public.computer_zone_history;
-- DROP POLICY IF EXISTS "czh_update" ON public.computer_zone_history;
-- DROP POLICY IF EXISTS "czh_delete" ON public.computer_zone_history;

-- อ่าน: อนุญาตทุกคน (หรือ authenticated)
CREATE POLICY "czh_select" ON public.computer_zone_history
FOR SELECT
USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- เพิ่ม: อนุญาต authenticated
CREATE POLICY "czh_insert" ON public.computer_zone_history
FOR INSERT
WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- แก้ไข: อนุญาต authenticated
CREATE POLICY "czh_update" ON public.computer_zone_history
FOR UPDATE
USING (auth.role() = 'authenticated' OR auth.role() = 'service_role')
WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- ลบ: อนุญาต authenticated
CREATE POLICY "czh_delete" ON public.computer_zone_history
FOR DELETE
USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- ตั้งค่า REPLICA IDENTITY FULL สำหรับ realtime
ALTER TABLE public.computer_zone_history REPLICA IDENTITY FULL;

-- ตรวจสอบนับ policy
SELECT * FROM pg_policies WHERE tablename = 'computer_zone_history';

-- ==========================================
-- FIX original_cost NOT NULL violations on customers_history
-- ==========================================
-- วิธีใช้:
-- 1) เปิด Supabase Dashboard → SQL Editor
-- 2) Paste script นี้ แล้วกด Run
-- ==========================================

-- เติมค่า 0 ให้แถวที่ original_cost เป็น NULL (ป้องกัน error)
UPDATE customers_history
SET original_cost = 0
WHERE original_cost IS NULL;

-- ตั้งค่า default = 0 สำหรับ insert ใหม่
ALTER TABLE customers_history
  ALTER COLUMN original_cost SET DEFAULT 0;

-- บังคับ NOT NULL อีกครั้ง (หลังจากมี default แล้ว)
ALTER TABLE customers_history
  ALTER COLUMN original_cost SET NOT NULL;

-- ตรวจสอบผลลัพธ์
SELECT
  column_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'customers_history'
  AND column_name = 'original_cost';

-- ==========================================
-- SUCCESS
-- ==========================================

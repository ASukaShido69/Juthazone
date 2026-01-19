-- ==========================================
-- FIX RLS POLICIES FOR customers_history
-- ==========================================
-- วิธีใช้:
-- 1. เปิด Supabase Dashboard → SQL Editor
-- 2. Copy-paste script นี้
-- 3. กด Run
-- ==========================================

-- ลบ policies เก่าทั้งหมด
DROP POLICY IF EXISTS "Allow all reads on history" ON customers_history;
DROP POLICY IF EXISTS "Allow all inserts on history" ON customers_history;
DROP POLICY IF EXISTS "Allow all updates on history" ON customers_history;
DROP POLICY IF EXISTS "Allow all deletes on history" ON customers_history;
DROP POLICY IF EXISTS "customers_history_select" ON customers_history;
DROP POLICY IF EXISTS "customers_history_insert" ON customers_history;
DROP POLICY IF EXISTS "customers_history_update" ON customers_history;
DROP POLICY IF EXISTS "customers_history_delete" ON customers_history;
DROP POLICY IF EXISTS "Allow authenticated select" ON customers_history;
DROP POLICY IF EXISTS "Allow authenticated insert" ON customers_history;
DROP POLICY IF EXISTS "Allow authenticated update" ON customers_history;
DROP POLICY IF EXISTS "Allow authenticated delete" ON customers_history;
DROP POLICY IF EXISTS "customers_history_authenticated_select" ON customers_history;
DROP POLICY IF EXISTS "customers_history_authenticated_insert" ON customers_history;
DROP POLICY IF EXISTS "customers_history_authenticated_update" ON customers_history;
DROP POLICY IF EXISTS "customers_history_authenticated_delete" ON customers_history;
DROP POLICY IF EXISTS "customers_history_public_select" ON customers_history;
DROP POLICY IF EXISTS "customers_history_public_insert" ON customers_history;
DROP POLICY IF EXISTS "customers_history_public_update" ON customers_history;
DROP POLICY IF EXISTS "customers_history_public_delete" ON customers_history;

-- สร้าง RLS policies ใหม่ - รองรับ anon key (public)
CREATE POLICY "customers_history_public_select" ON customers_history
  FOR SELECT
  USING (true);

CREATE POLICY "customers_history_public_insert" ON customers_history 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "customers_history_public_update" ON customers_history 
  FOR UPDATE 
  USING (true)
  WITH CHECK (true);

CREATE POLICY "customers_history_public_delete" ON customers_history 
  FOR DELETE 
  USING (true);

-- ตรวจสอบ policies ที่สร้างแล้ว
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'customers_history'
ORDER BY policyname;

-- ==========================================
-- SUCCESS: RLS Policies Fixed!
-- ==========================================

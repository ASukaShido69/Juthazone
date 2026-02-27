-- Fix RLS policies for historyforproduct table
-- Run this against Supabase/PostgreSQL to ensure RLS is enabled

-- ensure table exists before altering
-- ALTER TABLE only works if table present

ALTER TABLE IF EXISTS historyforproduct ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to historyforproduct" ON historyforproduct;
CREATE POLICY "Allow all access to historyforproduct" 
  ON historyforproduct FOR ALL USING (true);

-- verify status
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname='historyforproduct';

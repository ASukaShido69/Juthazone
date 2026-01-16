-- Fix RLS policies for customers_history table
-- Run this in Supabase SQL Editor

-- Drop existing policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON customers_history;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON customers_history;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON customers_history;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON customers_history;

-- Enable RLS
ALTER TABLE customers_history ENABLE ROW LEVEL SECURITY;

-- Create new policies
CREATE POLICY "Enable read access for authenticated users"
ON customers_history FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable insert access for authenticated users"
ON customers_history FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users"
ON customers_history FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable delete access for authenticated users"
ON customers_history FOR DELETE
TO authenticated
USING (true);

-- Grant permissions
GRANT ALL ON customers_history TO authenticated;
GRANT USAGE ON SEQUENCE customers_history_id_seq TO authenticated;

-- Verify policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'customers_history';

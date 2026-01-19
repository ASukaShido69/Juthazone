-- =====================================================
-- DATABASE PROTECTION: Prevent Duplicate Records
-- =====================================================
-- Purpose: Add constraints to prevent the duplicate records bug
-- Run this immediately in Supabase SQL Editor!

-- =====================================================
-- Step 1: Create Unique Constraint (CRITICAL!)
-- =====================================================
-- ห้ามให้ customer_id เดียวกัน มี 'in_progress' > 1 record
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_in_progress_per_customer
ON customers_history(customer_id)
WHERE end_reason = 'in_progress';

-- =====================================================
-- Step 2: Add NOT NULL Constraint on start_time
-- =====================================================
-- บังคับให้ต้องมี start_time ทุก record (ป้องกัน NULL)
ALTER TABLE customers_history
ALTER COLUMN start_time SET NOT NULL;

-- =====================================================
-- Step 3: Add Check Constraint (ควบคุม end_reason values)
-- =====================================================
-- บังคับให้ end_reason เป็นค่าที่ถูกต้อง
ALTER TABLE customers_history
ADD CONSTRAINT check_valid_end_reason CHECK (
  end_reason IN (
    'in_progress',
    'completed',
    'expired',
    'cancelled',
    'deleted',
    'duplicate_completed',
    'duplicate_in_progress'
  )
);

-- =====================================================
-- Step 4: Add function to prevent UPDATE that creates duplicates
-- =====================================================
-- PostgreSQL function ป้องกันการ UPDATE ที่อาจทำให้ duplicate
CREATE OR REPLACE FUNCTION prevent_duplicate_in_progress()
RETURNS TRIGGER AS $$
BEGIN
  -- ถ้ามี customer_id เดียวกันมี in_progress อื่นอยู่ แล้ว try UPDATE to in_progress
  IF NEW.end_reason = 'in_progress' THEN
    IF EXISTS (
      SELECT 1 FROM customers_history
      WHERE customer_id = NEW.customer_id
      AND end_reason = 'in_progress'
      AND id != COALESCE(OLD.id, -1)
    ) THEN
      RAISE EXCEPTION 'Cannot have multiple in_progress records for customer_id %', NEW.customer_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to table
DROP TRIGGER IF EXISTS trigger_prevent_duplicate_in_progress ON customers_history;

CREATE TRIGGER trigger_prevent_duplicate_in_progress
BEFORE INSERT OR UPDATE ON customers_history
FOR EACH ROW
EXECUTE FUNCTION prevent_duplicate_in_progress();

-- =====================================================
-- Step 5: Add Columns for Tracking (Optional but Recommended)
-- =====================================================
-- เพิ่ม column เพื่อติดตาม history
ALTER TABLE customers_history
ADD COLUMN IF NOT EXISTS created_by VARCHAR(50),
ADD COLUMN IF NOT EXISTS last_updated_by VARCHAR(50),
ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- =====================================================
-- Step 6: Create View to detect inconsistencies
-- =====================================================
-- View เพื่อให้เห็น records ที่อาจเป็น duplicate
CREATE OR REPLACE VIEW v_potential_duplicates AS
SELECT 
  customer_id,
  name,
  COUNT(*) as record_count,
  COUNT(CASE WHEN end_reason = 'in_progress' THEN 1 END) as in_progress_count,
  COUNT(CASE WHEN end_reason = 'completed' THEN 1 END) as completed_count,
  array_agg(id ORDER BY created_at DESC) as record_ids,
  array_agg(end_reason ORDER BY created_at DESC) as end_reasons,
  MIN(created_at) as oldest_record,
  MAX(updated_at) as newest_update
FROM customers_history
GROUP BY customer_id, name
HAVING COUNT(*) > 1 OR COUNT(CASE WHEN end_reason = 'in_progress' THEN 1 END) > 1
ORDER BY in_progress_count DESC, record_count DESC;

-- =====================================================
-- Step 7: Create Monitoring Function
-- =====================================================
-- Function เพื่อตรวจจับ duplicate อัตโนมัติ
CREATE OR REPLACE FUNCTION check_duplicate_records()
RETURNS TABLE (
  customer_id BIGINT,
  name VARCHAR,
  issue TEXT,
  affected_records INT
) AS $$
BEGIN
  -- ตรวจสอบ: customer_id มี in_progress > 1
  RETURN QUERY
  SELECT 
    ch.customer_id,
    ch.name,
    'Multiple in_progress records detected' as issue,
    COUNT(*)::INT as affected_records
  FROM customers_history ch
  WHERE ch.end_reason = 'in_progress'
  GROUP BY ch.customer_id, ch.name
  HAVING COUNT(*) > 1;
  
  -- ตรวจสอบ: customer_id มี completed > 1 (อาจเป็น duplicate)
  RETURN QUERY
  SELECT 
    ch.customer_id,
    ch.name,
    'Multiple completed records - may be duplicate' as issue,
    COUNT(*)::INT as affected_records
  FROM customers_history ch
  WHERE ch.end_reason = 'completed'
  GROUP BY ch.customer_id, ch.name
  HAVING COUNT(*) > 1;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Step 8: Run Monthly Health Check Query
-- =====================================================
-- Query นี้ควรรัน manual every month เพื่อตรวจจับปัญหา
SELECT * FROM check_duplicate_records();

-- =====================================================
-- Verification Queries
-- =====================================================
-- ✅ Verify constraints are created
SELECT 
  constraint_name,
  table_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'customers_history'
AND constraint_type != 'FOREIGN KEY';

-- ✅ Check if trigger is active
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing
FROM information_schema.triggers
WHERE event_object_table = 'customers_history';

-- ✅ Test: Try to create duplicate (should fail)
/*
-- This should raise an error if protection works:
INSERT INTO customers_history (
  customer_id, name, room, start_time, end_reason
) VALUES
  (999, 'Test Customer', 'Test Room', NOW(), 'in_progress'),
  (999, 'Test Customer', 'Test Room', NOW(), 'in_progress');
-- ERROR: Cannot have multiple in_progress records
*/

-- =====================================================
-- Summary
-- =====================================================
SELECT 'Database protection activated!' as status,
       'All constraints and triggers are in place.' as detail,
       'The system will now prevent duplicate in_progress records.' as protection;

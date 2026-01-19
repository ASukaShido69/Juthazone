-- =====================================================
-- AUTOMATED BACKUP SYSTEM - PostgreSQL & Supabase
-- =====================================================
-- Purpose: Daily backup of critical tables
-- Schedule: Every day at 2:00 AM (UTC+7)

-- =====================================================
-- Step 1: Create Backup Table Schema
-- =====================================================
CREATE TABLE IF NOT EXISTS backup_metadata (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  backup_name VARCHAR(100) NOT NULL UNIQUE,
  table_name VARCHAR(100) NOT NULL,
  backup_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  total_rows BIGINT,
  backup_size_mb DECIMAL(10, 2),
  status VARCHAR(20) CHECK (status IN ('success', 'failed', 'pending')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_backup_time ON backup_metadata(backup_time DESC);
CREATE INDEX idx_table_name ON backup_metadata(table_name);

-- =====================================================
-- Step 2: Create Backup Tables (Shadow Tables)
-- =====================================================
-- Backup tables สำหรับเก็บข้อมูลสำรอง

CREATE TABLE IF NOT EXISTS customers_backup (
  LIKE customers INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS customers_history_backup (
  LIKE customers_history INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS activity_logs_backup (
  LIKE activity_logs INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS users_backup (
  LIKE users INCLUDING ALL
);

-- =====================================================
-- Step 3: Create Backup Function
-- =====================================================
CREATE OR REPLACE FUNCTION backup_all_tables()
RETURNS TABLE (
  table_name VARCHAR,
  backup_status VARCHAR,
  row_count BIGINT,
  backup_time TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_row_count BIGINT;
  v_backup_name VARCHAR;
BEGIN
  -- Backup: customers
  v_backup_name := 'customers_' || TO_CHAR(NOW(), 'YYYY-MM-DD_HH24-MI-SS');
  DELETE FROM customers_backup;
  INSERT INTO customers_backup SELECT * FROM customers;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  INSERT INTO backup_metadata(backup_name, table_name, total_rows, status)
  VALUES (v_backup_name, 'customers', v_row_count, 'success');
  
  RETURN QUERY SELECT
    'customers'::VARCHAR,
    'success'::VARCHAR,
    v_row_count,
    NOW()::TIMESTAMP WITH TIME ZONE;

  -- Backup: customers_history
  v_backup_name := 'customers_history_' || TO_CHAR(NOW(), 'YYYY-MM-DD_HH24-MI-SS');
  DELETE FROM customers_history_backup;
  INSERT INTO customers_history_backup SELECT * FROM customers_history;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  INSERT INTO backup_metadata(backup_name, table_name, total_rows, status)
  VALUES (v_backup_name, 'customers_history', v_row_count, 'success');
  
  RETURN QUERY SELECT
    'customers_history'::VARCHAR,
    'success'::VARCHAR,
    v_row_count,
    NOW()::TIMESTAMP WITH TIME ZONE;

  -- Backup: activity_logs
  v_backup_name := 'activity_logs_' || TO_CHAR(NOW(), 'YYYY-MM-DD_HH24-MI-SS');
  DELETE FROM activity_logs_backup;
  INSERT INTO activity_logs_backup SELECT * FROM activity_logs;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  INSERT INTO backup_metadata(backup_name, table_name, total_rows, status)
  VALUES (v_backup_name, 'activity_logs', v_row_count, 'success');
  
  RETURN QUERY SELECT
    'activity_logs'::VARCHAR,
    'success'::VARCHAR,
    v_row_count,
    NOW()::TIMESTAMP WITH TIME ZONE;

  -- Backup: users
  v_backup_name := 'users_' || TO_CHAR(NOW(), 'YYYY-MM-DD_HH24-MI-SS');
  DELETE FROM users_backup;
  INSERT INTO users_backup SELECT * FROM users;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  INSERT INTO backup_metadata(backup_name, table_name, total_rows, status)
  VALUES (v_backup_name, 'users', v_row_count, 'success');
  
  RETURN QUERY SELECT
    'users'::VARCHAR,
    'success'::VARCHAR,
    v_row_count,
    NOW()::TIMESTAMP WITH TIME ZONE;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT
    'error'::VARCHAR,
    SQLERRM::VARCHAR,
    0::BIGINT,
    NOW()::TIMESTAMP WITH TIME ZONE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Step 4: Create Restore Function
-- =====================================================
CREATE OR REPLACE FUNCTION restore_from_backup(
  p_table_name VARCHAR,
  p_backup_id BIGINT DEFAULT NULL
)
RETURNS TABLE (
  status VARCHAR,
  message VARCHAR,
  restored_rows BIGINT
) AS $$
DECLARE
  v_row_count BIGINT;
BEGIN
  CASE p_table_name
    WHEN 'customers' THEN
      DELETE FROM customers;
      INSERT INTO customers SELECT * FROM customers_backup;
      GET DIAGNOSTICS v_row_count = ROW_COUNT;
      
      RETURN QUERY SELECT
        'success'::VARCHAR,
        'Restored customers from backup'::VARCHAR,
        v_row_count;

    WHEN 'customers_history' THEN
      DELETE FROM customers_history;
      INSERT INTO customers_history SELECT * FROM customers_history_backup;
      GET DIAGNOSTICS v_row_count = ROW_COUNT;
      
      RETURN QUERY SELECT
        'success'::VARCHAR,
        'Restored customers_history from backup'::VARCHAR,
        v_row_count;

    WHEN 'activity_logs' THEN
      DELETE FROM activity_logs;
      INSERT INTO activity_logs SELECT * FROM activity_logs_backup;
      GET DIAGNOSTICS v_row_count = ROW_COUNT;
      
      RETURN QUERY SELECT
        'success'::VARCHAR,
        'Restored activity_logs from backup'::VARCHAR,
        v_row_count;

    ELSE
      RETURN QUERY SELECT
        'error'::VARCHAR,
        'Table not found or not supported'::VARCHAR,
        0::BIGINT;
  END CASE;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT
    'error'::VARCHAR,
    'Restore failed: ' || SQLERRM::VARCHAR,
    0::BIGINT;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Step 5: Create Cleanup Function (Remove Old Backups)
-- =====================================================
-- ลบ metadata ของ backup เก่า (เก็บไว้ 30 วัน)
CREATE OR REPLACE FUNCTION cleanup_old_backups(p_days_to_keep INT DEFAULT 30)
RETURNS TABLE (
  deleted_count INT,
  message VARCHAR
) AS $$
DECLARE
  v_deleted INT;
BEGIN
  DELETE FROM backup_metadata
  WHERE created_at < NOW() - (p_days_to_keep || ' days')::INTERVAL;
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  RETURN QUERY SELECT
    v_deleted::INT,
    'Deleted ' || v_deleted::VARCHAR || ' old backup records'::VARCHAR;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Step 6: Create Backup Status View
-- =====================================================
CREATE OR REPLACE VIEW v_backup_status AS
SELECT 
  table_name,
  MAX(backup_time) as latest_backup,
  MAX(total_rows) as last_row_count,
  MAX(created_at) as last_status_update,
  COUNT(*) as total_backups,
  EXTRACT(EPOCH FROM (NOW() - MAX(backup_time))) / 3600 as hours_since_backup
FROM backup_metadata
WHERE status = 'success'
GROUP BY table_name
ORDER BY latest_backup DESC;

-- =====================================================
-- Step 7: Create Alerts View (for monitoring)
-- =====================================================
CREATE OR REPLACE VIEW v_backup_alerts AS
SELECT 
  table_name,
  CASE 
    WHEN MAX(created_at) < NOW() - INTERVAL '1 day' THEN 'CRITICAL'
    WHEN MAX(created_at) < NOW() - INTERVAL '12 hours' THEN 'WARNING'
    ELSE 'OK'
  END as alert_level,
  MAX(created_at) as last_backup,
  'No backup in last ' || 
    EXTRACT(DAY FROM (NOW() - MAX(created_at)))::INT || ' days' as message
FROM backup_metadata
WHERE status = 'success'
GROUP BY table_name
HAVING MAX(created_at) < NOW() - INTERVAL '12 hours';

-- =====================================================
-- Step 8: Manual Backup Execution
-- =====================================================
-- Run this to create manual backup
SELECT * FROM backup_all_tables();

-- =====================================================
-- Step 9: Check Backup Status
-- =====================================================
SELECT * FROM v_backup_status;

-- =====================================================
-- Step 10: Monitor for Issues
-- =====================================================
SELECT * FROM v_backup_alerts;

-- =====================================================
-- Step 11: View All Backups
-- =====================================================
SELECT 
  backup_name,
  table_name,
  backup_time,
  total_rows,
  status,
  EXTRACT(DAY FROM (NOW() - backup_time)) as days_old
FROM backup_metadata
ORDER BY backup_time DESC
LIMIT 50;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- ✅ Check backup tables exist
SELECT table_name FROM information_schema.tables
WHERE table_name LIKE '%_backup'
ORDER BY table_name;

-- ✅ Check functions exist
SELECT routine_name FROM information_schema.routines
WHERE routine_name LIKE 'backup_%' OR routine_name LIKE 'restore_%'
ORDER BY routine_name;

-- ✅ Check views exist
SELECT table_name FROM information_schema.views
WHERE table_name LIKE 'v_backup%'
ORDER BY table_name;

-- =====================================================
-- TESTING: Simulate Backup & Restore
-- =====================================================
/*
-- 1. Create test backup
SELECT * FROM backup_all_tables();

-- 2. Check backup created
SELECT * FROM v_backup_status;

-- 3. Corrupt data (test)
DELETE FROM customers;  -- ⚠️ Only in testing!

-- 4. Check data is gone
SELECT COUNT(*) FROM customers;  -- Should be 0

-- 5. Restore from backup
SELECT * FROM restore_from_backup('customers');

-- 6. Verify data restored
SELECT COUNT(*) FROM customers;  -- Should have data again

-- 7. Cleanup old backups
SELECT * FROM cleanup_old_backups(30);
*/

-- =====================================================
-- DISASTER RECOVERY CHECKLIST
-- =====================================================
/*
If data loss occurs:

1. Check latest backup:
   SELECT * FROM v_backup_status;

2. Assess damage:
   SELECT COUNT(*) FROM customers;

3. Restore table:
   SELECT * FROM restore_from_backup('customers');

4. Verify restoration:
   SELECT COUNT(*) FROM customers;

5. Check if restore was successful:
   SELECT * FROM customers LIMIT 5;

6. Log incident:
   INSERT INTO backup_metadata(backup_name, table_name, status, notes)
   VALUES ('manual_restore', 'customers', 'success', 'Restored after data loss incident');
*/

SELECT 'Backup system installed successfully!' as status;

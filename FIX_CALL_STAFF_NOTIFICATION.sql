-- Fix Call Staff Notification System
-- เพิ่ม column สำหรับติดตาม resolved status ของการเรียกพนักงาน

-- Add resolved_at column to activity_logs
ALTER TABLE activity_logs 
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE;

-- Add resolved_by column (username who resolved it)
ALTER TABLE activity_logs 
ADD COLUMN IF NOT EXISTS resolved_by VARCHAR(50);

-- Add index for better performance when filtering unresolved notifications
CREATE INDEX IF NOT EXISTS idx_activity_logs_resolved 
ON activity_logs(action_type, resolved_at) 
WHERE resolved_at IS NULL;

-- Comment for documentation
COMMENT ON COLUMN activity_logs.resolved_at IS 'Timestamp when the notification was resolved/handled by staff';
COMMENT ON COLUMN activity_logs.resolved_by IS 'Username of staff who resolved the notification';

-- Update existing CALL_STAFF records to have resolved_at = created_at (optional - mark old as resolved)
-- Uncomment the line below if you want to mark all existing CALL_STAFF as already resolved
-- UPDATE activity_logs SET resolved_at = created_at WHERE action_type = 'CALL_STAFF' AND resolved_at IS NULL;

SELECT 'Fix applied successfully! Now AdminDashboard can track unresolved CALL_STAFF notifications.' AS status;

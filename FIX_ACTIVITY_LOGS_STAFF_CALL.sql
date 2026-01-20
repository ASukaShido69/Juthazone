-- Fix Activity Logs Table for Staff Call System
-- เพิ่มคอลัมน์ที่หายไปสำหรับระบบเรียกพนักงาน

-- 1. เพิ่มคอลัมน์ resolved_at และ resolved_by
ALTER TABLE activity_logs 
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS resolved_by VARCHAR(50);

-- 2. เปิด Row Level Security (RLS) และสร้าง Policy ให้อนุญาตทุกอย่าง
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- 3. ลบ Policy เก่า (ถ้ามี)
DROP POLICY IF EXISTS "Allow all access to activity_logs" ON activity_logs;

-- 4. สร้าง Policy ใหม่ที่อนุญาตให้เข้าถึงได้ทุกอย่าง
CREATE POLICY "Allow all access to activity_logs" 
  ON activity_logs FOR ALL USING (true);

-- 5. สร้าง Index สำหรับ resolved_at เพื่อประสิทธิภาพ
CREATE INDEX IF NOT EXISTS idx_activity_logs_resolved_at ON activity_logs(resolved_at);

-- 6. อัพเดต Comment
COMMENT ON TABLE activity_logs IS 'ตารางเก็บ log การทำงานของ admin/staff รวมถึงการเรียกพนักงาน';
COMMENT ON COLUMN activity_logs.resolved_at IS 'เวลาที่พนักงานได้ดำเนินการแก้ไขแจ้งเตือนแล้ว';
COMMENT ON COLUMN activity_logs.resolved_by IS 'ชื่อพนักงานที่ดำเนินการแก้ไข';

-- เรียบร้อย! ระบบเรียกพนักงานจะใช้งานได้แล้ว

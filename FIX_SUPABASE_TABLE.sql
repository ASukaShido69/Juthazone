-- ==========================================
-- FIX: Supabase Table Schema for Juthazone
-- ==========================================
-- วิธีใช้:
-- 1. เปิด Supabase Console
-- 2. ไปที่ SQL Editor
-- 3. Copy-paste script ทั้งหมดนี้
-- 4. กด Run
-- ==========================================

-- ลบ table เก่าทิ้ง (ข้อมูลทั้งหมดจะหาย!)
DROP TABLE IF EXISTS customers CASCADE;

-- สร้าง table ใหม่พร้อม columns ครบถ้วน
CREATE TABLE customers (
  id BIGINT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  room VARCHAR(100) NOT NULL,
  minutes BIGINT NOT NULL,
  cost DECIMAL(10, 2) NOT NULL,
  note TEXT,
  "timeRemaining" BIGINT NOT NULL,
  "isRunning" BOOLEAN NOT NULL DEFAULT true,
  "isPaid" BOOLEAN NOT NULL DEFAULT false,
  "startTime" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "expectedEndTime" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Policies: อนุญาตให้ทุกคนอ่าน/เขียนได้ (สำหรับ testing)
CREATE POLICY "Allow all reads" ON customers FOR SELECT USING (true);
CREATE POLICY "Allow all inserts" ON customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates" ON customers FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes" ON customers FOR DELETE USING (true);

-- Enable Realtime (สำคัญสำหรับ multi-device sync!)
ALTER TABLE customers REPLICA IDENTITY FULL;

-- ตรวจสอบว่า table สร้างสำเร็จ
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'customers'
ORDER BY ordinal_position;

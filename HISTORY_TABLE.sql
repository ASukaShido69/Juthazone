-- ==========================================
-- CREATE HISTORY TABLE for Juthazone
-- ==========================================
-- เก็บประวัติการใช้งานของลูกค้าทั้งหมด
-- ==========================================

-- สร้าง customers_history table
CREATE TABLE IF NOT EXISTS customers_history (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL,
  room VARCHAR(100) NOT NULL,
  note TEXT,
  
  -- ข้อมูลพนักงานที่บันทึก
  added_by VARCHAR(50),
  
  -- เวลาที่เริ่มและจบ
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- ระยะเวลาที่ใช้จริง (นาที)
  duration_minutes DECIMAL(10, 2) NOT NULL,
  
  -- ค่าใช้จ่าย
  original_cost DECIMAL(10, 2) NOT NULL,
  final_cost DECIMAL(10, 2) NOT NULL,
  
  -- สถานะการจ่ายเงิน
  is_paid BOOLEAN NOT NULL DEFAULT false,
  
  -- วิธีการจบ (completed, deleted, expired)
  end_reason VARCHAR(50) NOT NULL,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index สำหรับค้นหาเร็วขึ้น
CREATE INDEX IF NOT EXISTS idx_history_customer_id ON customers_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_history_name ON customers_history(name);
CREATE INDEX IF NOT EXISTS idx_history_room ON customers_history(room);
CREATE INDEX IF NOT EXISTS idx_history_added_by ON customers_history(added_by);
CREATE INDEX IF NOT EXISTS idx_history_start_time ON customers_history(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_history_created_at ON customers_history(created_at DESC);

-- Enable Row Level Security
ALTER TABLE customers_history ENABLE ROW LEVEL SECURITY;

-- Policies: อนุญาตให้ทุกคนอ่าน/เขียนได้ (สำหรับ testing)
CREATE POLICY "Allow all reads on history" ON customers_history FOR SELECT USING (true);
CREATE POLICY "Allow all inserts on history" ON customers_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates on history" ON customers_history FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes on history" ON customers_history FOR DELETE USING (true);

-- Enable Realtime
ALTER TABLE customers_history REPLICA IDENTITY FULL;

-- ตรวจสอบว่า table สร้างสำเร็จ
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'customers_history'
ORDER BY ordinal_position;

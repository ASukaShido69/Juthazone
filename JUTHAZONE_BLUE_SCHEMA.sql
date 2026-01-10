-- ========================================
-- JUTHAZONE BLUE DATABASE SCHEMA
-- ระบบคำนวณราคาตามเวลาจริง (Pro-rated)
-- ========================================

-- ตาราง juthazoneb_customers (ลูกค้า Blue Zone)
-- เก็บข้อมูลลูกค้าที่กำลังใช้บริการ
CREATE TABLE IF NOT EXISTS juthazoneb_customers (
  id INT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  room VARCHAR(100) NOT NULL,
  note TEXT,
  hourly_rate DECIMAL(10,2) NOT NULL DEFAULT 159.00,
  current_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  is_running BOOLEAN DEFAULT TRUE,
  is_paid BOOLEAN DEFAULT FALSE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  pause_time TIMESTAMP WITH TIME ZONE,
  total_pause_duration INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ตาราง juthazoneb_customers_history (ประวัติ Blue Zone)
-- เก็บประวัติการใช้บริการทั้งหมด
CREATE TABLE IF NOT EXISTS juthazoneb_customers_history (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  customer_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  room VARCHAR(100) NOT NULL,
  note TEXT,
  added_by VARCHAR(50),
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  duration_minutes DECIMAL(10,2),
  hourly_rate DECIMAL(10,2) NOT NULL,
  final_cost DECIMAL(10,2) NOT NULL,
  is_paid BOOLEAN DEFAULT FALSE,
  end_reason VARCHAR(50) CHECK (end_reason IN ('completed', 'expired', 'deleted', 'in_progress')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ตาราง juthazoneb_activity_logs (Activity logs สำหรับ Blue Zone)
-- เก็บ log การทำงานทั้งหมดของ admin/staff
CREATE TABLE IF NOT EXISTS juthazoneb_activity_logs (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  username VARCHAR(50) NOT NULL,
  action_type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  data_changed JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  customer_id INT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  ip_address VARCHAR(45),
  user_agent TEXT
);

-- ========================================
-- สร้าง INDEXES สำหรับ Performance
-- ========================================

CREATE INDEX IF NOT EXISTS idx_juthazoneb_customers_id ON juthazoneb_customers(id);
CREATE INDEX IF NOT EXISTS idx_juthazoneb_customers_start_time ON juthazoneb_customers(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_juthazoneb_customers_is_running ON juthazoneb_customers(is_running);

CREATE INDEX IF NOT EXISTS idx_juthazoneb_history_customer_id ON juthazoneb_customers_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_juthazoneb_history_start_time ON juthazoneb_customers_history(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_juthazoneb_history_end_reason ON juthazoneb_customers_history(end_reason);
CREATE INDEX IF NOT EXISTS idx_juthazoneb_history_created_at ON juthazoneb_customers_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_juthazoneb_activity_username ON juthazoneb_activity_logs(username);
CREATE INDEX IF NOT EXISTS idx_juthazoneb_activity_created_at ON juthazoneb_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_juthazoneb_activity_action_type ON juthazoneb_activity_logs(action_type);

-- ========================================
-- Enable Row Level Security (RLS)
-- ========================================

ALTER TABLE juthazoneb_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE juthazoneb_customers_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE juthazoneb_activity_logs ENABLE ROW LEVEL SECURITY;

-- สร้าง RLS policies (อนุญาตทุกคนเข้าถึงได้)
DROP POLICY IF EXISTS "Allow all access to juthazoneb_customers" ON juthazoneb_customers;
CREATE POLICY "Allow all access to juthazoneb_customers" 
  ON juthazoneb_customers FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all access to juthazoneb_customers_history" ON juthazoneb_customers_history;
CREATE POLICY "Allow all access to juthazoneb_customers_history" 
  ON juthazoneb_customers_history FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all access to juthazoneb_activity_logs" ON juthazoneb_activity_logs;
CREATE POLICY "Allow all access to juthazoneb_activity_logs" 
  ON juthazoneb_activity_logs FOR ALL USING (true);

-- ========================================
-- Create VIEWS for Statistics
-- ========================================

-- View: สถิติรายวัน
CREATE OR REPLACE VIEW juthazoneb_daily_stats AS
SELECT 
  DATE(start_time) as date,
  COUNT(*) as total_customers,
  SUM(final_cost) as total_revenue,
  AVG(duration_minutes) as avg_duration,
  AVG(hourly_rate) as avg_hourly_rate,
  COUNT(CASE WHEN is_paid = TRUE THEN 1 END) as paid_customers,
  COUNT(CASE WHEN is_paid = FALSE THEN 1 END) as unpaid_customers
FROM juthazoneb_customers_history
WHERE end_reason IN ('completed', 'expired', 'deleted')
GROUP BY DATE(start_time)
ORDER BY date DESC;

-- View: สถิติตามห้อง
CREATE OR REPLACE VIEW juthazoneb_room_stats AS
SELECT 
  room,
  COUNT(*) as total_bookings,
  SUM(final_cost) as total_revenue,
  AVG(duration_minutes) as avg_duration,
  MAX(start_time) as last_booking
FROM juthazoneb_customers_history
WHERE end_reason IN ('completed', 'expired', 'deleted')
GROUP BY room
ORDER BY total_revenue DESC;

-- ========================================
-- COMMENTS
-- ========================================

COMMENT ON TABLE juthazoneb_customers IS 'ตารางเก็บข้อมูลลูกค้าที่กำลังใช้บริการ Blue Zone (คำนวณราคาตามเวลาจริง)';
COMMENT ON TABLE juthazoneb_customers_history IS 'ตารางเก็บประวัติการใช้บริการทั้งหมดของ Blue Zone';
COMMENT ON TABLE juthazoneb_activity_logs IS 'ตารางเก็บ log การทำงานของ admin/staff ใน Blue Zone';

COMMENT ON COLUMN juthazoneb_customers.hourly_rate IS 'อัตราค่าบริการต่อชั่วโมง (บาท)';
COMMENT ON COLUMN juthazoneb_customers.current_cost IS 'ค่าบริการปัจจุบัน คำนวณตามเวลาที่ใช้จริง';
COMMENT ON COLUMN juthazoneb_customers.total_pause_duration IS 'ระยะเวลาที่หยุดพักรวม (วินาที)';

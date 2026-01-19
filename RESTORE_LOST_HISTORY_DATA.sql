-- =====================================================
-- กู้คืนข้อมูล History ที่หายไป
-- =====================================================
-- Purpose: Restore history records that were overwritten by duplicates
-- Use this if old data was replaced during the duplicate records bug

-- =====================================================
-- Step 1: ตรวจสอบว่ามีข้อมูลที่ mark เป็น duplicate ไหม
-- =====================================================
SELECT 
  id,
  customer_id,
  name,
  room,
  start_time,
  end_time,
  duration_minutes,
  final_cost,
  is_paid,
  end_reason,
  created_at
FROM customers_history
WHERE end_reason IN ('duplicate_completed', 'duplicate_in_progress')
ORDER BY created_at DESC;

-- ถ้าไม่มีข้อมูล → ข้ามไป Step 3 (ใช้ time travel)
-- ถ้ามีข้อมูล → ใช้ Step 2

-- =====================================================
-- Step 2: กู้คืนข้อมูลจาก duplicate_* records
-- =====================================================
-- A) ดูว่า record ไหนถูกต้อง (เลือกตาม created_at หรือ duration)
SELECT 
  customer_id,
  name,
  array_agg(id ORDER BY created_at) as all_ids,
  array_agg(end_reason ORDER BY created_at) as all_statuses,
  array_agg(created_at ORDER BY created_at) as all_times,
  array_agg(final_cost ORDER BY created_at) as all_costs
FROM customers_history
WHERE customer_id IN (
  SELECT DISTINCT customer_id 
  FROM customers_history 
  WHERE end_reason LIKE 'duplicate_%'
)
GROUP BY customer_id, name
ORDER BY customer_id;

-- B) กู้คืน record ที่ถูกต้อง (เปลี่ยน end_reason กลับมา)
-- ตัวอย่าง: ถ้าต้องการกู้ record id = 123
/*
UPDATE customers_history
SET end_reason = 'completed'
WHERE id = 123;  -- ใส่ ID ของ record ที่ต้องการกู้
*/

-- C) ลบ record ที่ผิด (duplicate ที่ไม่ต้องการ)
/*
DELETE FROM customers_history
WHERE id = 456;  -- ใส่ ID ของ record ที่เป็น duplicate
*/

-- =====================================================
-- Step 3: ใช้ Supabase Time Travel (ถ้ามี)
-- =====================================================
-- Note: ต้องมี Enterprise tier หรือ เปิด Point-in-Time Recovery
-- ดูข้อมูลย้อนหลัง 7 วัน (ถ้า plan รองรับ)

-- ตัวอย่าง: ดูข้อมูลเมื่อ 1 ชั่วโมงที่แล้ว (แก้ timestamp ตามต้องการ)
/*
SELECT * FROM customers_history
AS OF SYSTEM TIME '2026-01-19 12:00:00+00'
WHERE customer_id = 1
ORDER BY created_at DESC;
*/

-- =====================================================
-- Step 4: ตรวจสอบ activity_logs (ดูว่ามีการบันทึก data_changed ไหม)
-- =====================================================
-- ถ้า activity_logs เก็บ data_changed (JSONB) อาจกู้คืนจากนี่ได้
SELECT 
  id,
  username,
  action_type,
  description,
  data_changed,
  created_at
FROM activity_logs
WHERE action_type IN ('ADD_CUSTOMER', 'COMPLETE_SESSION', 'UPDATE_CUSTOMER')
AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 100;

-- ตัวอย่าง: ดูข้อมูลที่บันทึกไว้ใน data_changed
SELECT 
  created_at,
  action_type,
  data_changed->>'name' as customer_name,
  data_changed->>'room' as room,
  data_changed->>'cost' as cost,
  data_changed->>'duration' as duration
FROM activity_logs
WHERE action_type = 'COMPLETE_SESSION'
AND created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- =====================================================
-- Step 5: INSERT คืนข้อมูลด้วยตนเอง (Manual Recovery)
-- =====================================================
-- ถ้ารู้ข้อมูลเดิม สามารถ INSERT กลับเข้าไปได้
-- ตัวอย่าง:
/*
INSERT INTO customers_history (
  customer_id,
  name,
  room,
  note,
  added_by,
  start_time,
  end_time,
  duration_minutes,
  original_cost,
  final_cost,
  is_paid,
  end_reason,
  session_date,
  shift,
  payment_method
) VALUES (
  1,                          -- customer_id
  'เทส',                      -- name
  'ชั้น 2 ห้อง VIP',          -- room
  '',                         -- note
  'Leo',                      -- added_by
  '2026-01-19 13:00:00+07',  -- start_time (แก้ตามข้อมูลจริง)
  '2026-01-19 16:00:00+07',  -- end_time
  179,                        -- duration_minutes
  219,                        -- original_cost
  219,                        -- final_cost
  true,                       -- is_paid
  'completed',                -- end_reason
  '2026-01-19',              -- session_date
  'all',                      -- shift
  'transfer'                  -- payment_method
);
*/

-- =====================================================
-- Step 6: ตรวจสอบผลลัพธ์
-- =====================================================
-- ดูข้อมูลล่าสุดว่ากู้คืนแล้วหรือยัง
SELECT 
  id,
  customer_id,
  name,
  room,
  start_time,
  end_time,
  duration_minutes,
  final_cost,
  is_paid,
  end_reason,
  created_at
FROM customers_history
WHERE customer_id IN (1, 2, 3)  -- ใส่ customer_id ที่ต้องการตรวจสอบ
ORDER BY customer_id, created_at DESC;

-- =====================================================
-- IMPORTANT: Backup Before Restore
-- =====================================================
-- ก่อนกู้คืน ควร export ข้อมูลปัจจุบันก่อน!
-- ใช้ Supabase Dashboard → Table Editor → Export to CSV

-- =====================================================
-- วิธีป้องกันอนาคต
-- =====================================================
-- 1) สร้าง unique constraint (ห้าม customer_id เดียวกันมี in_progress > 1)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_in_progress_per_customer
ON customers_history(customer_id)
WHERE end_reason = 'in_progress';

-- 2) เปิด Row Level Security (RLS) เพื่อป้องกันการเขียนซ้ำ
-- 3) ใช้ history_record_id แทน customer_id filter (แก้ไขในโค้ดแล้ว)

SELECT 'Recovery script ready. Follow steps 1-6 above to restore data.' AS status;

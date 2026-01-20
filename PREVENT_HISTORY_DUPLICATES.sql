-- ปรับปรุง customers_history Table เพื่อป้องกันปัญหา Duplicate Records
-- รันหลังจากแก้ไข History Sync แล้ว

-- 1. เพิ่ม Index สำหรับ query ที่ใช้บ่อย (customer_id + end_reason)
CREATE INDEX IF NOT EXISTS idx_history_customer_end_reason 
ON customers_history(customer_id, end_reason);

-- 2. เพิ่ม Index สำหรับ session_date (ใช้ใน Daily Summary)
CREATE INDEX IF NOT EXISTS idx_history_session_date 
ON customers_history(session_date);

-- 3. เพิ่ม Index สำหรับ shift (ใช้ในการ filter รายกะ)
CREATE INDEX IF NOT EXISTS idx_history_shift 
ON customers_history(shift);

-- 4. เพิ่ม Unique Constraint เพื่อป้องกัน duplicate in_progress records
-- หมายเหตุ: Partial Unique Index ป้องกันไม่ให้มี in_progress มากกว่า 1 record ต่อ customer_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_history_unique_in_progress
ON customers_history(customer_id)
WHERE end_reason = 'in_progress';

-- 5. ลบ duplicate records ที่มีอยู่แล้ว (ถ้ามี)
-- ⚠️ ระวัง: จะลบ records ที่ซ้ำ เก็บไว้แค่ record แรก
WITH duplicates AS (
  SELECT 
    id,
    customer_id,
    end_reason,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY customer_id 
      ORDER BY created_at ASC
    ) as rn
  FROM customers_history
  WHERE end_reason IN ('completed', 'deleted', 'expired')
)
DELETE FROM customers_history
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- 6. อัพเดต comments
COMMENT ON INDEX idx_history_customer_end_reason IS 
'Index สำหรับ query โดย customer_id และ end_reason (ใช้บ่อยใน UPDATE statements)';

COMMENT ON INDEX idx_history_unique_in_progress IS 
'Unique constraint เพื่อป้องกัน duplicate in_progress records สำหรับ customer_id เดียวกัน';

-- 7. ตรวจสอบว่าไม่มี duplicate แล้ว
SELECT 
  customer_id,
  end_reason,
  COUNT(*) as count,
  STRING_AGG(id::text, ', ') as record_ids
FROM customers_history
GROUP BY customer_id, end_reason
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- ถ้า query ข้างบนไม่มีผลลัพธ์ แสดงว่าไม่มี duplicate แล้ว ✅

COMMENT ON TABLE customers_history IS 
'ตาราง History สำหรับบันทึกการใช้งานห้อง VIP - แต่ละ customer_id จะมี record เดียว
- สร้างด้วย end_reason = in_progress เมื่อเริ่มใช้งาน
- อัพเดตเป็น completed/expired/deleted เมื่อสิ้นสุด
- ไม่สร้าง record ใหม่ เพื่อป้องกัน duplicate';

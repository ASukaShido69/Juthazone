# 🚑 วิธีกู้คืนข้อมูล History ที่หายไปอย่างเร่งด่วน

## 📸 สถานการณ์: ข้อมูลถูกแทนที่โดย Duplicate Records

### ⚡ Quick Steps (ทำเลย!)

---

## 🔍 Step 1: ตรวจสอบว่ามีข้อมูลที่ "mark" ไว้ไหม

เปิด **Supabase SQL Editor** และรัน:

```sql
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
```

### ผลลัพธ์:

#### ✅ ถ้ามีข้อมูล → ไป **Step 2** (กู้ได้ง่าย!)
#### ❌ ถ้าไม่มีข้อมูล → ไป **Step 3** (ยากขึ้น)

---

## ✅ Step 2A: กู้คืนจาก Marked Records (วิธีง่าย)

### 2.1 ดูข้อมูลทั้งหมดของลูกค้าที่มีปัญหา

```sql
SELECT 
  id,
  customer_id,
  name,
  room,
  start_time,
  end_time,
  duration_minutes,
  final_cost,
  end_reason,
  created_at
FROM customers_history
WHERE customer_id = 1  -- แก้ตาม customer_id ที่ต้องการ
ORDER BY created_at DESC;
```

### 2.2 เลือกว่า record ไหนถูกต้อง

ดูจาก:
- `created_at` - record ไหนเป็นของเดิม (เก่ากว่า)
- `duration_minutes` - เวลาใช้จริง
- `final_cost` - ราคาที่ถูกต้อง
- `start_time` - เวลาเริ่มที่ถูกต้อง

### 2.3 กู้คืน record ที่ถูกต้อง

```sql
-- แก้ end_reason กลับเป็น 'completed'
UPDATE customers_history
SET end_reason = 'completed'
WHERE id = 123;  -- ใส่ ID ของ record ที่ต้องการกู้
```

### 2.4 ลบ record ที่ผิด (duplicate)

```sql
DELETE FROM customers_history
WHERE id = 456;  -- ใส่ ID ของ record ที่เป็น duplicate
```

---

## 🔎 Step 2B: กู้คืนจาก Activity Logs

### 3.1 ตรวจสอบ activity_logs

```sql
SELECT 
  id,
  username,
  action_type,
  description,
  data_changed,
  created_at
FROM activity_logs
WHERE action_type IN ('ADD_CUSTOMER', 'COMPLETE_SESSION')
AND created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 50;
```

### 3.2 ดูข้อมูลใน data_changed (JSONB)

```sql
SELECT 
  created_at,
  username,
  action_type,
  data_changed->>'name' as customer_name,
  data_changed->>'room' as room,
  data_changed->>'duration' as duration_minutes,
  data_changed->>'cost' as final_cost,
  data_changed->>'is_paid' as is_paid
FROM activity_logs
WHERE action_type = 'COMPLETE_SESSION'
AND created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

### 3.3 ถ้าเจอข้อมูล → INSERT คืน

```sql
-- ตัวอย่าง: กู้คืนด้วยข้อมูลจาก activity_logs
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
  'ลูกค้า A',                 -- name (จาก data_changed)
  'ชั้น 2 ห้อง VIP',          -- room
  '',                         -- note
  'Leo',                      -- added_by (จาก username)
  '2026-01-19 13:00:00+07',  -- start_time (คำนวณจาก end_time - duration)
  '2026-01-19 16:00:00+07',  -- end_time (จาก logs หรือคำนวณ)
  179,                        -- duration_minutes (จาก data_changed)
  219,                        -- original_cost
  219,                        -- final_cost (จาก data_changed)
  true,                       -- is_paid (จาก data_changed)
  'completed',                -- end_reason
  '2026-01-19',              -- session_date (วันที่เริ่ม)
  'all',                      -- shift
  'transfer'                  -- payment_method
);
```

---

## 📊 Step 3: ตรวจสอบผลลัพธ์

```sql
-- ดูข้อมูลล่าสุด
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
  end_reason
FROM customers_history
WHERE customer_id = 1  -- แก้ตาม customer_id
ORDER BY created_at DESC;
```

**คาดหวัง:**
- ✅ มี 1 record สำหรับแต่ละ customer_id
- ✅ `end_reason = 'completed'`
- ✅ ข้อมูล duration, cost, payment ถูกต้อง

---

## 🎯 กรณีพิเศษ: ใช้ Screenshot/Photo กู้คืน

### ถ้ามี Screenshot หน้า History View:

1. ดูข้อมูลจากภาพ:
   - ชื่อลูกค้า
   - ห้อง
   - เวลาเริ่ม - จบ
   - ระยะเวลา
   - ราคา
   - สถานะการจ่าย

2. INSERT ด้วยมือ (Manual):

```sql
INSERT INTO customers_history (
  customer_id,
  name,
  room,
  start_time,
  end_time,
  duration_minutes,
  final_cost,
  is_paid,
  end_reason,
  session_date
) VALUES
  (1, 'เทส', 'ชั้น 2 ห้อง VIP', '2026-01-19 13:00:00+07', '2026-01-19 16:00:00+07', 179, 219, true, 'completed', '2026-01-19'),
  (2, 'เพชร', 'ห้อง 1', '2026-01-19 14:00:00+07', '2026-01-19 15:00:00+07', 60, 101, true, 'completed', '2026-01-19');
  -- เพิ่มได้เรื่อยๆ
```

---

## 🛡️ ป้องกันอนาคต (ทำทันที!)

```sql
-- สร้าง unique constraint ป้องกัน duplicate
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_in_progress_per_customer
ON customers_history(customer_id)
WHERE end_reason = 'in_progress';
```

---

## ⚠️ คำเตือน

### ก่อนทำอะไร ให้ Backup ก่อน!

1. เปิด Supabase Dashboard
2. ไปที่ Table Editor → `customers_history`
3. คลิก **Export** → **Download as CSV**
4. เก็บไฟล์ไว้ก่อนทำอะไร

---

## 📞 ถ้ายังไม่ได้

### Option 1: ดึงจาก Browser Console (ถ้ายังเปิดอยู่)

ถ้าหน้า Admin Dashboard ยังเปิดอยู่:

1. กด `F12` (Developer Tools)
2. ไปที่ Console
3. พิมพ์:
```javascript
// ดูข้อมูลที่ load ล่าสุด
console.log(JSON.stringify(localStorage))
```

### Option 2: ติดต่อ Supabase Support

ถ้ามี **Paid Plan** (Pro/Enterprise):
- Supabase มี Point-in-Time Recovery
- สามารถ restore ย้อนหลังได้ถึง 7-30 วัน
- ติดต่อ support@supabase.io

---

## ✅ Checklist

- [ ] รัน Step 1 - ตรวจสอบ duplicate_* records
- [ ] รัน Step 2A - กู้คืนจาก marked records (ถ้ามี)
- [ ] รัน Step 2B - ตรวจสอบ activity_logs
- [ ] รัน Step 3 - ตรวจสอบผลลัพธ์
- [ ] Export backup ก่อนทำอะไร
- [ ] สร้าง unique constraint ป้องกันอนาคต
- [ ] ทดสอบ add customer ใหม่ → สิ้นสุด → ตรวจสอบ history

---

**Status:** 🚨 Emergency Recovery Guide  
**Last Updated:** 2026-01-19  
**Related:** [RESTORE_LOST_HISTORY_DATA.sql](RESTORE_LOST_HISTORY_DATA.sql), [FIX_DUPLICATE_HISTORY_RECORDS.md](FIX_DUPLICATE_HISTORY_RECORDS.md)

# 🔧 Database Cleanup & Fix Guide

## ⚠️ ปัญหาที่พบในฐานข้อมูล

จากการตรวจสอบ screenshot Supabase dashboard พบปัญหาดังนี้:

### 1. **RLS Policies ไม่ถูกต้อง** 🔴
- Tables ถูก mark เป็น `UNRESTRICTED` = **ใครก็เข้าได้**
- ควรตั้ง `RESTRICTED` = เฉพาะ authenticated users

### 2. **Views ไม่มี Schema** 🟡
- `daily_summary_by_shift` UNSTRUCTURED
- `daily_summary` UNSTRUCTURED
- ควรลบแล้วสร้าง view ใหม่ที่ถูก

### 3. **Column Data Types ผิด** 🟡
- `avg_duration_minutes` แสดงตัวเลขยาว ๆ (60.000000000000000 ฯลฯ)
- ควรเป็น DECIMAL(10, 2)

### 4. **Test Data เก่า** 🟡
- มี data ที่ไม่ใช้งาน
- ควรลบ data > 30 วัน

### 5. **Duplicate Policies** 🟡
- บางตารางมี policies ชื่อเดียวกันหลายอัน
- ทำให้ confusing

---

## ✅ วิธี Fix (Step by Step)

### **Step 1: รัน SQL Cleanup Script**
1. เปิด **Supabase Dashboard** → **SQL Editor**
2. Copy ทั้งหมดจากไฟล์: `CLEANUP_AND_FIX_DATABASE.sql`
3. Paste ลง SQL Editor
4. กด **Run** (สีเขียว)
5. รอจนเสร็จ (จะใช้เวลา 10-30 วินาที)

### **Step 2: ตรวจสอบผลลัพธ์**
Script จะแสดง output 3 ส่วน:

#### A. ตรวจสอบ RLS Status
```
schemaname | tablename             | rowsecurity
public     | customers             | t
public     | customers_history     | t
public     | computer_zone_history | t
public     | users                 | t
```
✅ ต้องเป็น **t** (true = enabled)

#### B. ตรวจสอบ Policies
```
tablename            | policyname                          | cmd
customers_history    | customers_history_authenticated_... | SELECT
customers_history    | customers_history_authenticated_... | INSERT
...
```
✅ ต้องมี 4 policies ต่อ table (SELECT, INSERT, UPDATE, DELETE)

#### C. Summary Statistics
```
table_name            | row_count
customers             | X
customers_history     | Y
computer_zone_history | Z
users                 | A
```
✅ ตรวจดูว่า row_count สมเหตุสมผล

---

## 🔍 ตรวจสอบแต่ละ Table

### **1. customers_history**
**ต้องมี columns:**
- ✅ id, customer_id, name, room
- ✅ start_time, end_time, duration_minutes
- ✅ original_cost, final_cost
- ✅ payment_method (transfer/cash)
- ✅ shift (1/2/3/all)
- ✅ session_date (DATE)
- ✅ end_reason (completed/in_progress/deleted)
- ✅ added_by, created_at

**Column Types:**
```sql
duration_minutes: DECIMAL(10, 2)        -- NOT numeric with 60.000000...
final_cost: DECIMAL(10, 2)              -- NOT numeric
payment_method: VARCHAR(20)
shift: VARCHAR(10)
session_date: DATE
```

### **2. computer_zone_history**
**ต้องมี columns:**
- ✅ id, customer_name
- ✅ transfer_amount, cash_amount, total_cost
- ✅ session_date, shift
- ✅ start_time, end_time
- ✅ added_by, created_at

**Column Types:**
```sql
transfer_amount: DECIMAL(10, 2)
cash_amount: DECIMAL(10, 2)
total_cost: DECIMAL(10, 2)
```

### **3. Views ต้องลบและสร้างใหม่**
❌ ลบ:
- `daily_summary_by_shift` (UNSTRUCTURED)
- `daily_summary` (UNSTRUCTURED)
- `public_daily_summary_by_shift`
- `public_vip_summary_by_shift`
- `juthasob_daily_stats`
- `juthasob_room_stats`

✅ สร้างใหม่:
```sql
CREATE OR REPLACE VIEW daily_summary_by_shift AS
SELECT
  session_date,
  shift,
  COUNT(*) as total_customers,
  SUM(CASE WHEN payment_method = 'transfer' THEN final_cost ELSE 0 END) as transfer_total,
  SUM(CASE WHEN payment_method = 'cash' THEN final_cost ELSE 0 END) as cash_total,
  SUM(final_cost) as grand_total,
  ROUND(AVG(duration_minutes)::NUMERIC, 2) as avg_duration_minutes
FROM customers_history
WHERE end_reason != 'in_progress'
GROUP BY session_date, shift
ORDER BY session_date DESC, shift;
```

---

## 🛡️ RLS Policies - ต้องมี

### **customers_history**
```sql
-- 4 policies
customers_history_authenticated_select    → SELECT
customers_history_authenticated_insert    → INSERT
customers_history_authenticated_update    → UPDATE
customers_history_authenticated_delete    → DELETE
```

### **computer_zone_history**
```sql
-- 4 policies
computer_zone_authenticated_select        → SELECT
computer_zone_authenticated_insert        → INSERT
computer_zone_authenticated_update        → UPDATE
computer_zone_authenticated_delete        → DELETE
```

### **customers**
```sql
-- 3 policies
customers_authenticated_select            → SELECT
customers_authenticated_insert            → INSERT
customers_authenticated_update            → UPDATE
customers_authenticated_delete            → DELETE
```

### **users**
```sql
-- 2 policies
users_authenticated_select                → SELECT
users_authenticated_update_self           → UPDATE
```

---

## 🧹 Clean Up Test Data

Script จะอัตโนมัติ:
1. ✅ ลบ data ที่มี `avg_duration_minutes` เป็นตัวเลขยาว ๆ
2. ✅ ลบ data > 30 วัน
3. ✅ ทำความสะอาด activity logs เก่า

**ถ้าต้องการลบ ALL test data:**
```sql
-- ⚠️ ระวัง! จะลบทั้งหมด
DELETE FROM customers_history;
DELETE FROM computer_zone_history;
DELETE FROM login_logs;
DELETE FROM activity_logs;
```

---

## 📋 Verification Checklist

หลังจากรัน script ให้ตรวจสอบ:

- [ ] Supabase Dashboard → Table Editor
- [ ] `customers_history` มี 🔒 (RLS enabled)
- [ ] `computer_zone_history` มี 🔒
- [ ] `customers` มี 🔒
- [ ] `users` มี 🔒
- [ ] ไม่มี UNRESTRICTED tables
- [ ] ไม่มี UNSTRUCTURED views
- [ ] `avg_duration_minutes` แสดง 60.00 (ไม่ใช่ 60.000000...)
- [ ] Daily Summary view กลับมาทำงาน
- [ ] Frontend ยังเข้า app ได้ปกติ

---

## 🐛 Troubleshooting

### ❌ Error: "Policy already exists"
**วิธีแก้:** Script มี `DROP POLICY IF EXISTS` อยู่แล้ว ลองรัน SQL ใหม่อีกครั้ง

### ❌ Error: "Column does not exist"
**วิธีแก้:** ไปที่ Table Editor ตรวจสอบ column มีจริงมั้ย ถ้าไม่มี ต้องเพิ่มด้วย ALTER TABLE

### ❌ Error: "Cannot drop view"
**วิธีแก้:** Views ที่ dependent กับ view อื่นต้องลบก่อน ทำได้โดย `CASCADE`

### ❌ Frontend ไม่เข้าได้หลังจากรัน SQL
**วิทยา:**
1. ลบ localStorage: `localStorage.clear()`
2. Logout แล้วลองเข้าใหม่
3. ตรวจสอบ `firebase.js` มี VITE_SUPABASE_URL ถูก

---

## ✨ หลังจากเสร็จ

1. ✅ Close SQL Editor
2. ✅ Refresh Browser (Ctrl+R)
3. ✅ Logout แล้ว Login ใหม่
4. ✅ ตรวจสอบ DailySummaryView ทำงาน
5. ✅ ตรวจสอบ AdminDashboard ทำงาน
6. ✅ Test เพิ่มลูกค้า → สิ้นสุด → ข้อมูลเข้า history

---

## 📞 ติดต่อ

ถ้าเกิดปัญหา ให้เก็บ error message แล้วอ่านดู:
1. ข้อความ error แบบไหน?
2. หลังจากสั่งอะไร?
3. Table ไหนที่มีปัญหา?

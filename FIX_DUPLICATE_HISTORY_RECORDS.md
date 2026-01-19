# 🔧 แก้ไข: ปัญหาข้อมูล History ซ้ำ (Duplicate Records)

## 🐛 ปัญหาที่เกิดขึ้น

### อาการ:
- เมื่อกดปุ่ม "✅ สิ้นสุด" ใน Admin Dashboard
- ข้อมูลซ้ำใน `customers_history` table
- ข้อมูลเดิมหายหรือถูกแทนที่

### สาเหตุ:
```javascript
// ❌ ปัญหา: ใช้ customer_id + end_reason filter
.update({...})
.eq('customer_id', realtimeCustomer.id)
.eq('end_reason', 'in_progress')  // ถ้ามีหลาย record → UPDATE ทั้งหมด!
```

**Scenario ที่เกิดปัญหา:**
```
1. เพิ่มลูกค้า A → INSERT history (id=100, customer_id=1, end_reason='in_progress')
2. ลูกค้า A หมดเวลา → AUTO: INSERT history (id=101, customer_id=1, end_reason='in_progress') ❌
3. กด "สิ้นสุด" → UPDATE WHERE customer_id=1 AND end_reason='in_progress'
   ➜ UPDATE ทั้ง id=100 และ id=101 พร้อมกัน! ❌
   ➜ ทำให้มี 2 records ที่ end_reason='completed' สำหรับลูกค้าเดียวกัน
```

---

## ✅ วิธีแก้ไข

### 1. เก็บ `history_record_id` ใน Customer Object

**Before:**
```javascript
const newCustomer = {
  id: nextId,
  name: 'ลูกค้า A',
  // ... other fields
}
```

**After:**
```javascript
const newCustomer = {
  id: nextId,
  name: 'ลูกค้า A',
  history_record_id: 123,  // ✅ เก็บ ID ของ history record
  // ... other fields
}
```

### 2. ใช้ `history_record_id` สำหรับ UPDATE (Exact Match)

**Before (ผิด):**
```javascript
await supabase
  .from('customers_history')
  .update({...})
  .eq('customer_id', customer.id)        // ❌ อาจ match หลาย records
  .eq('end_reason', 'in_progress')       // ❌ UPDATE ทั้งหมด!
```

**After (ถูก):**
```javascript
let query = supabase
  .from('customers_history')
  .update({...})

if (customer.history_record_id) {
  query = query.eq('id', customer.history_record_id)  // ✅ UPDATE เฉพาะ record เดียว
} else {
  query = query.eq('customer_id', customer.id).eq('end_reason', 'in_progress')  // Fallback
}

await query
```

---

## 🔄 การเปลี่ยนแปลงในโค้ด

### File: `src/App.jsx`

#### 1. `addCustomer()` - เก็บ history_record_id
```javascript
// Create initial history record and store its ID
if (supabase && isSupabaseReady) {
  const { data: historyData, error: historyError } = await supabase
    .from('customers_history')
    .insert([{...}])
    .select('id')      // ✅ ขอ ID กลับมา
    .single()          // ✅ รับ 1 record
  
  // ✅ เก็บ history_record_id ใน customer object
  if (historyData && !historyError) {
    newCustomer.history_record_id = historyData.id
    newCustomers[newCustomers.length - 1].history_record_id = historyData.id
  }
}
```

#### 2. `saveToHistory()` - ใช้ history_record_id
```javascript
// Use history_record_id if available, otherwise fallback
let query = supabase
  .from('customers_history')
  .update({...})

if (customer.history_record_id) {
  query = query.eq('id', customer.history_record_id)  // ✅ Exact match
} else {
  query = query.eq('customer_id', customer.id).eq('end_reason', 'in_progress')
}

await query
```

### File: `src/components/AdminDashboard.jsx`

#### 3. `handleCompleteSession()` - ใช้ history_record_id
```javascript
let query = supabase
  .from('customers_history')
  .update({
    // ... realtime data
  })

if (realtimeCustomer.history_record_id) {
  query = query.eq('id', realtimeCustomer.history_record_id)  // ✅ Exact
} else {
  query = query.eq('customer_id', realtimeCustomer.id).eq('end_reason', 'in_progress')
}

const { data, error } = await query.select()
```

---

## 🗄️ ทำความสะอาดข้อมูลซ้ำ (Database)

### Step 1: รัน SQL Script
รัน script [CLEANUP_DUPLICATE_HISTORY_RECORDS.sql](CLEANUP_DUPLICATE_HISTORY_RECORDS.sql) ใน Supabase SQL Editor

### Step 2: ตรวจสอบข้อมูลซ้ำ
```sql
-- ดู duplicates
SELECT 
  customer_id,
  name,
  end_reason,
  COUNT(*) as count
FROM customers_history
WHERE end_reason IN ('completed', 'in_progress')
GROUP BY customer_id, name, end_reason
HAVING COUNT(*) > 1;
```

### Step 3: Mark Duplicates (ไม่ลบทันที)
```sql
-- Mark เป็น 'duplicate_completed' (เก็บ record ล่าสุด)
UPDATE customers_history
SET end_reason = 'duplicate_completed'
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY created_at DESC) as rn
    FROM customers_history
    WHERE end_reason = 'completed'
  ) ranked WHERE rn > 1
);
```

### Step 4: ตรวจสอบผลลัพธ์
```sql
SELECT end_reason, COUNT(*) as count
FROM customers_history
GROUP BY end_reason;
```

### Step 5: ลบข้อมูลซ้ำ (ถ้าแน่ใจ)
```sql
-- ⚠️ ระวัง: ลบถาวร!
DELETE FROM customers_history 
WHERE end_reason IN ('duplicate_completed', 'duplicate_in_progress');
```

### Step 6: สร้าง Unique Constraint (ป้องกันอนาคต)
```sql
-- ป้องกัน: แต่ละ customer_id มี 'in_progress' ได้แค่ 1 record
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_in_progress_per_customer
ON customers_history(customer_id)
WHERE end_reason = 'in_progress';
```

---

## 🧪 ทดสอบหลังแก้ไข

### Test Case 1: Customer ปกติ
```
1. ✅ เพิ่มลูกค้า → history (id=X, end_reason='in_progress')
2. ✅ กด "สิ้นสุด" → UPDATE id=X → end_reason='completed'
3. ✅ ตรวจสอบ: มี 1 record เท่านั้น
```

### Test Case 2: Customer ต่อเวลา
```
1. ✅ เพิ่มลูกค้า → history (id=X, customer_id=1)
2. ✅ ต่อเวลา → UPDATE id=X (ไม่ INSERT ใหม่)
3. ✅ เปลี่ยนราคา → UPDATE id=X
4. ✅ กด "สิ้นสุด" → UPDATE id=X
5. ✅ ตรวจสอบ: มี 1 record เท่านั้น
```

### Test Case 3: Customer หมดเวลาอัตโนมัติ
```
1. ✅ เพิ่มลูกค้า → history (id=X)
2. ✅ หมดเวลาอัตโนมัติ → UPDATE id=X (end_reason='expired')
3. ✅ ตรวจสอบ: มี 1 record เท่านั้น
```

---

## 📊 ผลลัพธ์ที่คาดหวัง

| สถานการณ์ | Before (ผิด) | After (ถูก) |
|-----------|-------------|------------|
| เพิ่มลูกค้า | 1 record | 1 record ✅ |
| กด "สิ้นสุด" | 2+ records ❌ | 1 record ✅ |
| ต่อเวลา + สิ้นสุด | 2+ records ❌ | 1 record ✅ |
| หมดเวลาอัตโนมัติ | 2 records ❌ | 1 record ✅ |

---

## 🔐 ป้องกันปัญหาอนาคต

### 1. Database Constraint
```sql
-- ป้องกัน: customer_id เดียวกัน มี 'in_progress' ได้แค่ 1 record
CREATE UNIQUE INDEX idx_unique_in_progress_per_customer
ON customers_history(customer_id)
WHERE end_reason = 'in_progress';
```

### 2. Application Logic
- ✅ เก็บ `history_record_id` ตอน INSERT
- ✅ ใช้ `history_record_id` ตอน UPDATE (exact match)
- ✅ Fallback ไป `customer_id + end_reason` ถ้าไม่มี `history_record_id`

---

## 💡 วิธีกู้คืนข้อมูล (ถ้ามีปัญหา)

### ถ้าข้อมูลหาย:
```sql
-- ดู records ที่ mark เป็น duplicate
SELECT * FROM customers_history
WHERE end_reason IN ('duplicate_completed', 'duplicate_in_progress')
ORDER BY created_at DESC;

-- กู้คืน (unmark)
UPDATE customers_history
SET end_reason = 'completed'
WHERE end_reason = 'duplicate_completed'
AND id = <specific_id>;  -- ใส่ ID ที่ต้องการกู้
```

### ถ้ามี records ซ้ำ:
```sql
-- ลบ duplicates ที่ไม่ต้องการ (เลือกเอา)
DELETE FROM customers_history
WHERE id IN (SELECT id FROM duplicates_list);
```

---

## 📝 สรุป

**ปัญหา:** 
- ใช้ `customer_id` filter → UPDATE หลาย records พร้อมกัน → ข้อมูลซ้ำ

**แก้ไข:**
- เก็บ `history_record_id` ตอน INSERT
- ใช้ `history_record_id` (exact ID) ตอน UPDATE
- สร้าง unique constraint ป้องกันอนาคต

**Status:** ✅ แก้ไขเสร็จสมบูรณ์


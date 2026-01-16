# 📊 Daily Summary View - Installation Guide

## คำอธิบาย
หน้า **Daily Summary** ใช้สำหรับสรุปยอดรายวัน (Daily Report) ที่เจ้าของร้าน Juthazone สามารถ:
- 👀 ดูยอดขายจาก Game Zone (อัตโนมัติจากระบบ)
- ➕ เพิ่มยอดขาย Computer Zone ด้วย Manual Entry (เช่น 1 ชม. 39 บาท, 3 ชั่วโมง 100 บาท)
- 💰 ดูยอดรวมทั้งหมดในวันนั้น

---

## ✅ Step-by-Step Installation

### 1. สร้าง Database Table ใน Supabase

ไปที่ **Supabase Dashboard** > **SQL Editor** > Copy-Paste SQL code ต่อไปนี้:

```sql
-- Create computer_zone_summary table for daily manual entries
CREATE TABLE IF NOT EXISTS public.computer_zone_summary (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  summary_date DATE NOT NULL,
  hours DECIMAL(10, 2) NOT NULL,
  cost DECIMAL(10, 2) NOT NULL,
  description TEXT,
  added_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries by date
CREATE INDEX IF NOT EXISTS idx_computer_zone_summary_date 
ON public.computer_zone_summary(summary_date);

-- Create index for added_by for user activity tracking
CREATE INDEX IF NOT EXISTS idx_computer_zone_summary_user 
ON public.computer_zone_summary(added_by);

-- Enable RLS (Row Level Security)
ALTER TABLE public.computer_zone_summary ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to read all records
CREATE POLICY "Allow all users to read computer_zone_summary"
  ON public.computer_zone_summary
  FOR SELECT
  USING (true);

-- Create policy to allow authenticated users to insert
CREATE POLICY "Allow authenticated users to insert computer_zone_summary"
  ON public.computer_zone_summary
  FOR INSERT
  WITH CHECK (true);

-- Create policy to allow users to delete their own entries
CREATE POLICY "Allow users to delete their own computer_zone_summary entries"
  ON public.computer_zone_summary
  FOR DELETE
  USING (added_by = current_user_name());
```

### 2. ตรวจสอบว่า Installation สำเร็จ

หลังจากสร้าง Table แล้ว ให้ทำดังนี้:

1. ไปที่ Admin Dashboard (`/admin`)
2. คลิกปุ่ม **💰 สรุปยอดรายวัน**
3. ควรเห็นหน้า Daily Summary พร้อมฟีเจอร์:
   - 📊 แสดงยอดจาก Game Zone
   - 📊 แสดงยอดจาก Computer Zone
   - 💰 แสดงยอดรวมทั้งสิ้น
   - ➕ ฟอร์มเพิ่มรายการ Computer Zone

---

## 🎯 วิธีใช้งาน

### ✅ สำหรับเจ้าของร้าน/Admin

#### 📅 Mode: สรุปยอดรายวัน (Daily)
1. **เข้าไปที่ Admin Dashboard** → `/admin`
2. **คลิกปุ่ม "💰 สรุปยอดรายวัน"**
3. **เลือกวันที่** ด้วย Date Picker
4. **ดูยอดสรุป:**
   - 🎮 Game Zone - ยอดจากลูกค้าที่จ่ายเงินแล้ว
   - 💻 Computer Zone - ยอดจากรายการ Manual Entry
   - 💰 รวมทั้งสิ้น - ยอดรวมประจำวัน
5. **เพิ่มรายการ Computer Zone:**
   - ใส่ชั่วโมง (เช่น 1, 3, 2.5)
   - ใส่ค่าใช้จ่าย (เช่น 39, 100)
   - ใส่หมายเหตุ (ไม่บังคับ)
   - คลิก **➕ เพิ่มรายการ**
6. **ส่งออก Excel:** คลิก **📥 ส่งออก Excel**

#### 📈 Mode: สรุปยอดช่วงวัน (Range)
1. **คลิกแท็บ "📈 สรุปยอดช่วงวัน"**
2. **เลือก Date Range:**
   - วันที่เริ่มต้น
   - วันที่สิ้นสุด
3. **ดูสรุปยอดสะสม** ของทั้ง Game Zone และ Computer Zone
4. **ส่งออก Excel** เพื่อใช้ในรายงาน

---

## 📋 ตารางรายการ Computer Zone

ตารางแสดงรายละเอียดทั้งหมดของรายการที่เพิ่มแล้ว:

| # | ⏱️ ชั่วโมง | 💰 ค่าใช้จ่าย | 📝 หมายเหตุ | 👤 เพิ่มโดย | 🗑️ ลบ |
|---|-----------|-----------|----------|-----------|-------|
| 1 | 1 ชม. | ฿39.00 | - | admin | ลบ |
| 2 | 3 ชม. | ฿100.00 | VIP | admin | ลบ |

---

## 🔧 โครงสร้าง Component

**File:** `src/components/DailySummaryView.jsx`

### Props
```jsx
{
  user: { username, displayName },  // ข้อมูล User ที่เข้าสิ่งระบบ
  onLogout: () => void              // Function ออกจากระบบ
}
```

### State
```javascript
{
  viewMode: 'daily' | 'range',      // โหมดการดู (รายวัน หรือ ช่วงวัน)
  summaryData: {
    date,                           // วันที่เลือก
    gameZoneTotal,                  // ยอด Game Zone
    computerZoneEntries,            // รายการ Computer Zone
    computerZoneTotal,              // ยอด Computer Zone
    grandTotal                      // ยอดรวม
  },
  rangeData: {
    startDate, endDate,             // วันที่เริ่มต้นและสิ้นสุด
    entries,                        // รายการทั้งหมด
    totalGameZone,                  // ยอด Game Zone ในช่วงวัน
    totalComputerZone,              // ยอด Computer Zone ในช่วงวัน
    grandTotal                      // ยอดรวมในช่วงวัน
  }
}
```

### Features
- ✅ **Date Picker** - เลือกวันที่สำหรับดูสรุปยอด
- ✅ **Date Range Picker** - เลือกช่วงวันเพื่อดูสรุปยอดหลายวัน
- ✅ **Load Game Zone data** จาก `customers_history` table
- ✅ **Load Computer Zone data** จาก `computer_zone_summary` table
- ✅ **Add Manual Entry** สำหรับ Computer Zone
- ✅ **Delete Computer Zone entries** ที่ไม่ต้องการ
- ✅ **Export to Excel** รายงาน Daily Summary หรือ Range Summary
- ✅ **Real-time calculate** grand total
- ✅ **Two View Modes:**
  - 📅 Daily View - สรุปยอดรายวัน
  - 📈 Range View - สรุปยอดช่วงวัน

---

## 🔐 Supabase RLS Policies

Table **computer_zone_summary** ใช้ RLS สำหรับ Security:

1. **SELECT** - ทุกคนสามารถอ่านได้
2. **INSERT** - ผู้ใช้ที่ authenticated สามารถเพิ่มได้
3. **DELETE** - เฉพาะคนที่เพิ่มรายการนั้นสามารถลบได้

---

## ⚠️ Troubleshooting

### ❌ ปัญหา: ไม่สามารถเข้าหน้า Daily Summary ได้
**วิธีแก้:**
- ตรวจสอบว่า Login แล้ว (route `/daily-summary` ใช้ `<ProtectedRoute>`)
- ตรวจสอบ localStorage มี `juthazone_user` ไหม

### ❌ ปัญหา: ไม่สามารถเพิ่มรายการได้ (Error)
**วิธีแก้:**
1. ตรวจสอบ Supabase connection
2. ตรวจสอบว่า table `computer_zone_summary` สร้างแล้ว
3. ตรวจสอบ RLS policies ถูกต้องหรือไม่
4. ดู Browser Console สำหรับ error messages

### ❌ ปัญหา: ยอด Game Zone ไม่แสดง
**วิธีแก้:**
- ตรวจสอบว่ามีลูกค้าในระบบ และจ่ายเงินแล้ว (`isPaid = true`)
- ตรวจสอบ `customers_history` table มีข้อมูลไหม

---

## 📊 Database Schema

### `computer_zone_summary` Table

```sql
Column          Type              Description
─────────────────────────────────────────────
id              BIGINT            Primary Key (Auto-generated)
summary_date    DATE              วันที่บันทึก
hours           DECIMAL(10, 2)    จำนวนชั่วโมง
cost            DECIMAL(10, 2)    ค่าใช้จ่าย (บาท)
description     TEXT              หมายเหตุ
added_by        VARCHAR(255)      ชื่อ User ที่เพิ่ม
created_at      TIMESTAMP         เวลาสร้าง (Auto)
updated_at      TIMESTAMP         เวลาแก้ไข (Auto)
```

---

## 🚀 Integration Points

### ใน Admin Dashboard
- ✅ เพิ่มลิงค์ **💰 สรุปยอดรายวัน** ที่ header
- ✅ เชื่อมไปที่ route `/daily-summary`

### ใน App.jsx
- ✅ Import `DailySummaryView` component
- ✅ เพิ่ม route `/daily-summary` ด้วย `<ProtectedRoute>`

---

## ✨ Tips & Best Practices

1. **📅 Date Picker - เลือกวันที่**
   - ใส่วันที่ที่ต้องการดูสรุปยอด
   - ข้อมูลจะโหลดใหม่อัตโนมัติ

2. **📈 Date Range Picker - ดูหลายวัน**
   - เลือก "สรุปยอดช่วงวัน"
   - ใส่วันที่เริ่มต้นและสิ้นสุด
   - ดูสรุปยอด 7 วัน, 30 วัน, หรือช่วงใดๆ ที่ต้องการ

3. **📥 Export to Excel**
   - คลิกปุ่ม "📥 ส่งออก Excel"
   - ไฟล์ Excel จะดาวน์โหลดอัตโนมัติ
   - ประกอบด้วยรายละเอียดทั้งหมดและสรุปยอด
   - สามารถนำไปใช้ใน PowerPoint, Print, หรือ Share กับคนอื่น

4. **📊 Trends Analysis**
   - ใช้ Date Range Picker เพื่อเปรียบเทียบยอดขาย
   - เช่น เทียบช่วง 7 วันที่แล้ว กับ 7 วันนี้
   - จะเห็นว่า Computer Zone และ Game Zone เพิ่มขึ้นหรือลดลง

5. **Multi-Zone Analytics**
   - หน้า Daily Summary แยกแสดง Game Zone และ Computer Zone
   - ง่ายต่อการเปรียบเทียบรายได้จากแต่ละ Zone
   - สามารถนำข้อมูลไปใน Analytics View เพื่อดู Trends ระยะยาว

---

## 📞 Support

หากมีปัญหา ให้ตรวจสอบ:
1. Supabase connection status
2. Network console สำหรับ API errors
3. Supabase Dashboard > Logs สำหรับ database errors

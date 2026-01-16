# 🔧 Troubleshooting Guide - Juthazone

## ⚠️ ปัญหา: จอขาวเมื่อกดเพิ่มลูกค้า

### ✅ วิธีแก้ (3 ขั้นตอน)

#### **ขั้นที่ 1️⃣: ตรวจเช็ค Console เพื่อดู Error**
1. เปิด Chrome DevTools (กด **F12** บนคีย์บอร์ด)
2. ไปที่ tab **Console**
3. ดู error message ที่ปรากฏ

---

#### **ขั้นที่ 2️⃣: สร้าง .env.local file (ถ้ายังไม่มี)**

ถ้า error บอก "VITE_SUPABASE_URL is not defined" แสดงว่าไม่มี `.env.local`

**แนวทางแก้:**

1. ไปที่ **root folder** ของ project (เดียวกับที่มี `package.json`, `index.html`)
2. สร้าง **file ใหม่** ชื่อ `.env.local`
3. ใส่ข้อมูล Supabase:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**วิธีหา URL และ Key:**
- ไปที่ https://app.supabase.com/
- เลือก project ของคุณ
- ไปที่ **Settings** → **API**
- Copy **Project URL** กับ **anon public** key

---

#### **ขั้นที่ 3️⃣: ตรวจสอบ Supabase Table**

1. ไปที่ https://app.supabase.com/
2. เลือก project ของคุณ
3. ไปที่ **SQL Editor** (ด้านซ้าย)
4. คลิก **New Query**
5. Copy-paste SQL script นี้:

```sql
-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id INT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  room VARCHAR(255) NOT NULL,
  minutes INT NOT NULL,
  cost DECIMAL(10, 2) NOT NULL,
  note TEXT,
  timeRemaining INT NOT NULL,
  isRunning BOOLEAN NOT NULL DEFAULT true,
  isPaid BOOLEAN NOT NULL DEFAULT false,
  startTime TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Enable RLS (Row Level Security)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Allow all reads and writes (for development)
CREATE POLICY "Allow all" ON customers
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

6. กด **Run** (ปุ่มสีเขียว)
7. ตรวจสอบว่า table ถูกสร้างสำเร็จ

---

### 🔍 Step-by-step Debugging

**ถ้ายังเห็นจอขาว หลังจากทำ 3 ขั้นข้างบน:**

1. เปิด **F12** → **Console**
2. ดู error message
3. ถ้า error บอก: 
   - `"VITE_SUPABASE_URL"` → ตรวจสอบ `.env.local` ว่า save แล้ว + reload browser (Ctrl+Shift+R)
   - `"table customers does not exist"` → สร้าง table ตาม ขั้นที่ 3
   - `"permission denied"` → ตรวจสอบ RLS policies
   - อื่นๆ → ลองเช็ค F12 console message

---

## 📱 ทดสอบ App ทั้ง Desktop และ Mobile

**ถ้าเพิ่มลูกค้าสำเร็จแล้ว:**

1. **Tab 1 - Admin Dashboard**: http://localhost:5173/admin
   - พิมพ์ชื่อ, ห้อง, เวลา, ค่าใช้จ่าย
   - กด **เพิ่มลูกค้า**
   - ควรเห็นลูกค้าปรากฏในตาราง

2. **Tab 2 - Customer View**: http://localhost:5173/customer
   - ควรเห็นการ์ดลูกค้าปรากฏ
   - Timer ควรนับถอยหลังทุกวินาที

3. **สแกน QR บน Mobile**
   - ที่ Tab 1 (Admin) มี QR code
   - เปิด mobile, เข้า: `http://<คุณ-IP>:5173/customer`
   - ควรเห็นข้อมูลลูกค้าตัวเดียวกับ Tab 2

---

## ❓ FAQs

**Q: ทำไมถึงจำเป็นต้องมี `.env.local`?**  
A: ป้องกัน API Key ไม่ให้โชว์ใน source code บน GitHub

**Q: ต้อง Restart Server หลังจากสร้าง `.env.local` ไหม?**  
A: ใช่ จำเป็น
- กด **Ctrl+C** ที่ terminal
- รัน `npm run dev` อีกครั้ง

**Q: Supabase Table ต้องสร้างซ้ำทีหลังไหม?**  
A: ไม่ สร้างแค่ครั้งเดียว ข้อมูลจะเก็บถาวร

**Q: มี Network Error จากหลายอุปกรณ์?**  
A: ตรวจสอบว่า:
- Supabase project ไม่ได้ pause
- Internet connection เชื่อมต่อปกติ
- API Key ถูกต้อง

---

## 🆘 ยังติดปัญหา?

ลอง:
1. เปิด F12 console → screenshot error
2. ลอง refresh page (Ctrl+R หรือ Cmd+R)
3. ลอง clear cache: **Ctrl+Shift+Delete** → ล้าง All time
4. ปิด DevTools ลอง Ctrl+Shift+R (hard refresh)

---

**Version:** 1.0  
**Last Updated:** 2024

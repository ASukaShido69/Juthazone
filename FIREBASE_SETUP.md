# � Supabase Setup - Juthazone

## สำคัญ: เพื่อให้หลาย devices sync ข้อมูลได้แบบ Real-time

เอกสารนี้จะสอนคุณวิธีตั้งค่า **Supabase PostgreSQL Database** เพื่อให้ Admin dashboard และ Customer view สามารถ sync ข้อมูลแบบ real-time ได้ ไม่ว่าจะใช้โทรศัพท์คนละเครื่องหรือแล็ปท็อปคนละเครื่อง

**ข้อดีของ Supabase:**
- ✅ PostgreSQL Database (แข็งแกร่ง)
- ✅ Realtime subscriptions
- ✅ REST API มาตรฐาน
- ✅ ฟรี 500MB storage
- ✅ ง่ายต่อการใช้งาน

---

## ขั้นตอนที่ 1: สร้าง Supabase Project

### 1.1 เข้า Supabase Console

1. ไปที่ https://supabase.com/
2. คลิก **"Start your project"** หรือ Sign in ถ้ามีบัญชีแล้ว
3. ไปที่ https://app.supabase.com/

### 1.2 สร้าง Project ใหม่

1. คลิก **"New Project"**
2. **Project name**: `juthazone`
3. **Database Password**: สร้าง password ที่ปลอดภัย (เก็บไว้!)
4. **Region**: `Southeast Asia (Singapore)` หรือที่ใกล้กับคุณ
5. คลิก **"Create new project"**

รอ 1-2 นาทีให้ project สร้างเสร็จ

---

## ขั้นตอนที่ 2: สร้าง Table สำหรับลูกค้า

### 2.1 ไปที่ Table Editor

1. ใน Supabase Console ด้านซ้าย ไปแท็บ **"SQL Editor"**
2. คลิก **"New query"**

### 2.2 วาง SQL script

คัดลอก SQL นี้แล้ววาง:

```sql
CREATE TABLE customers (
  id BIGINT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  room VARCHAR(100) NOT NULL,
  minutes BIGINT NOT NULL,
  cost DECIMAL(10, 2) NOT NULL,
  note TEXT,
  timeRemaining BIGINT NOT NULL,
  isRunning BOOLEAN NOT NULL DEFAULT true,
  isPaid BOOLEAN NOT NULL DEFAULT false,
  startTime TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read and write (for testing)
CREATE POLICY "Allow all reads" ON customers FOR SELECT USING (true);
CREATE POLICY "Allow all inserts" ON customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates" ON customers FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes" ON customers FOR DELETE USING (true);

-- Enable Realtime
ALTER TABLE customers REPLICA IDENTITY FULL;
```

3. คลิก **"Run"** (ต้องรัน SQL ก่อน)

---

## ขั้นตอนที่ 3: ดึงข้อมูล API Keys

### 3.1 ไปที่ Project Settings

1. คลิก **Settings** (ไอคอน ⚙️) มุมล่างซ้าย
2. ไปแท็บ **"API"**

### 3.2 คัดลอก Keys

หา **Project URL** และ **Anon Key** (public):

```
Project URL: https://xxxxxxxxxxxxx.supabase.co
Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**คัดลอก** ค่าเหล่านี้ เราจะใช้ต่อ

---

## ขั้นตอนที่ 4: ตั้งค่า Environment Variables

### 4.1 สร้างไฟล์ `.env.local`

ในโฟลเดอร์ root ของโปรเจค (เคียงกับ `index.html`) สร้างไฟล์:

```
.env.local
```

### 4.2 เพิ่ม Supabase Config

ใส่ค่า API keys:

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4.3 ตรวจสอบ .gitignore

ตรวจสอบว่า `.gitignore` มีบรรทัด:

```
.env.local
```

(ไม่ให้เก็บ keys ใน Git!)

---

## ขั้นตอนที่ 5: ติดตั้ง Supabase Package

รันคำสั่งในเทอร์มินัล:

```bash
npm install
```

Package `@supabase/supabase-js` จะติดตั้งจากไฟล์ `package.json`

---

## ขั้นตอนที่ 6: ทดสอบ

### 6.1 รันโปรเจค

```bash
npm run dev
```

### 6.2 ทดสอบการทำงาน

**Desktop (Admin):**
```
http://localhost:5173/admin
```

**Mobile (Customer):**
- เปิด QR Code จากหน้า Admin สแกนด้วยมือถือ
- หรือเข้า: `http://192.168.x.x:5173/customer`

### 6.3 ทดสอบ Sync

1. **เพิ่มลูกค้า** จากหน้า Admin
2. **ดูหน้าลูกค้า** ที่ mobile ควรเห็นทันที! ✨
3. **หยุด/เริ่มเวลา** หรือ **เปลี่ยนสถานะจ่าย** ทุกอย่าง sync real-time

---

## ✔️ ตรวจสอบ Data ใน Supabase

### ไปที่ Table Editor

1. ใน Supabase Console ด้านซ้าย ไปแท็บ **"Table Editor"**
2. เลือก **"customers"**
3. ควรเห็น data ที่เพิ่มมา:

```
id | name      | room        | cost | timeRemaining | isPaid | isRunning
1  | ลูกค้า 1  | ห้องชั้น 2  | 100  | 300           | false  | true
2  | ลูกค้า 2  | ห้องชั้น 3  | 150  | 600           | false  | true
```

---

## 🚀 Deploy ขึ้น Vercel

เมื่อ deploy ต้องเพิ่ม environment variables:

### Vercel Dashboard → Project → Settings → Environment Variables

เพิ่มตัวแปร:

```
VITE_SUPABASE_URL = https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 🔐 Security (Production)

ปัจจุบันใช้ "Allow all reads/writes" ก็ได้สำหรับ prototype

สำหรับ production ให้เปลี่ยน policy เป็น:

```sql
-- Authenticated users only
CREATE POLICY "Authenticated users can read" 
  ON customers FOR SELECT 
  USING (auth.role() = 'authenticated_user');

CREATE POLICY "Authenticated users can modify" 
  ON customers FOR ALL 
  USING (auth.role() = 'authenticated_user');
```

---

## ❓ Troubleshooting

### ❌ "Supabase is undefined"

**วิธีแก้**: ตรวจสอบ `.env.local`:
```bash
echo $VITE_SUPABASE_URL
```

### ❌ "Cannot insert/update"

**วิธีแก้**: ตรวจสอบ RLS policies:
1. Supabase Console → Table Editor → customers
2. คลิก **RLS** ตรวจสอบ policies ถูกต้องไหม

### ❌ "Data not syncing"

**วิธีแก้**:
1. ตรวจสอบ `.env.local` ถูกต้องไหม
2. ตรวจสอบ Network tab (F12) มี error ไหม
3. ลอง refresh page

### ❌ "Realtime not working"

**วิธีแก้**:
1. ไปที่ Supabase Console
2. ไปแท็บ **Realtime** ตรวจสอบว่า enabled
3. ตรวจสอบ customers table มี checkmark หรือไม่

---

## 📊 ดู Logs

### ใน Supabase Console

1. ไปแท็บ **Logs**
2. เลือก **Edge Logs** หรือ **Postgres Logs**
3. ดู errors ที่เกิดขึ้น

---

## 💾 Export/Import Data

### Export

```bash
# ใช้ supabase CLI
supabase db dump --local -f backup.sql
```

### Import

```bash
supabase db pull
```

---

## 🎉 เสร็จแล้ว!

ตอนนี้ Juthazone ของคุณ sync ได้ทั้ง:
- ✅ หลาย tabs/windows บนเครื่องเดียว (BroadcastChannel)
- ✅ หลาย devices ต่างกัน (Supabase Realtime)
- ✅ Real-time countdown sync ทุกวินาที
- ✅ Database PostgreSQL ที่ปลอดภัย

---

**อ้างอิง:**
- Supabase Docs: https://supabase.com/docs
- Supabase Console: https://app.supabase.com
- Realtime: https://supabase.com/docs/realtime/overview


---

## ขั้นตอนที่ 1: สร้าง Firebase Project

### 1.1 เข้า Firebase Console

1. ไปที่ https://console.firebase.google.com/
2. คลิก **"Create Project"** (ถ้ายังไม่มี)

### 1.2 ตั้งชื่อโปรเจค

1. **Project name**: `juthazone` (หรือชื่อที่ต้องการ)
2. **Analytics**: ไม่ต้อง (ปิดได้)
3. คลิก **"Create Project"**

รอ 1-2 นาทีให้ project สร้างเสร็จ

---

## ขั้นตอนที่ 2: สร้าง Realtime Database

### 2.1 ไปที่ Realtime Database

1. ใน Firebase Console ไปด้านซ้าย
2. หา **"Build"** → เลือก **"Realtime Database"**
3. คลิก **"Create Database"**

### 2.2 ตั้งค่า Database

1. **Database Location**: เลือก **"asia-southeast1"** (เซิร์ฟเวอร์ประเทศไทย)
2. **Security Rules**: เลือก **"Start in test mode"** (ได้ใช้ทั้งอ่านและเขียน)
3. คลิก **"Create"**

⚠️ **หมายเหตุ**: Test mode มี expiration date 30 วัน แต่เพียงพอสำหรับการทดสอบ

---

## ขั้นตอนที่ 3: ดึงข้อมูล Config Firebase

### 3.1 ไปที่ Project Settings

1. คลิกไอคอน **⚙️** (Settings) มุมขวาบน
2. เลือก **"Project settings"**

### 3.2 หา Web App Config

1. ลงไปหาส่วน **"Your apps"**
2. ถ้ายังไม่มี Web app ให้คลิก **"</>""** (Web icon)
3. ป้อนชื่อ app: `juthazone-web`
4. คลิก **"Register app"**

### 3.3 คัดลอก Config

หลังจากสมัครเสร็จจะเห็น JavaScript config:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyD...",
  authDomain: "juthazone-xxxxx.firebaseapp.com",
  databaseURL: "https://juthazone-xxxxx.firebaseio.com",
  projectId: "juthazone-xxxxx",
  storageBucket: "juthazone-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123def456"
};
```

**คัดลอกค่าเหล่านี้** เราจะใช้ต่อ

---

## ขั้นตอนที่ 4: ตั้งค่า Environment Variables

### 4.1 สร้างไฟล์ `.env.local`

ในโฟลเดอร์ root ของโปรเจค (เคียงกับ `index.html`) สร้างไฟล์:

```
.env.local
```

### 4.2 เพิ่ม Firebase Config

ใส่ค่า config จาก Firebase Console:

```
VITE_FIREBASE_API_KEY=AIzaSyD...
VITE_FIREBASE_AUTH_DOMAIN=juthazone-xxxxx.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://juthazone-xxxxx.firebaseio.com
VITE_FIREBASE_PROJECT_ID=juthazone-xxxxx
VITE_FIREBASE_STORAGE_BUCKET=juthazone-xxxxx.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123def456
```

⚠️ **สำคัญ**: อย่าแชร์ไฟล์นี้บน GitHub เพราะมี API key!

ตรวจสอบว่า `.gitignore` มีบรรทัด `.env.local`:

```
.env.local
```

---

## ขั้นตอนที่ 5: ติดตั้ง Firebase Package

รันคำสั่งนี้ใน Terminal:

```bash
npm install
```

Firebase package อยู่ใน `package.json` แล้ว ติดตั้งแค่ครั้งเดียว

---

## ขั้นตอนที่ 6: ทดสอบ

### 6.1 รันโปรเจค

```bash
npm run dev
```

### 6.2 ทดสอบการทำงาน

**Desktop (Admin):**
```
http://localhost:5173/admin
```

**Mobile (Customer):**
- เปิด QR Code จากหน้า Admin สแกนด้วยมือถือ
- หรือเข้า: `http://192.168.x.x:5173/customer` (แทน x.x ด้วย IP ของ PC)

### 6.3 ทดสอบ Sync

1. **เพิ่มลูกค้า** จากหน้า Admin
2. **ดูหน้าลูกค้า** ที่ mobile ควรเห็นทันที!
3. **หยุด/เริ่มเวลา** หรือ **เปลี่ยนสถานะจ่าย** ทั้งหมดจะ sync ทันที ✨

---

## 🔐 Firebase Security Rules (Production)

ตอนนี้ใช้ "test mode" ได้อ่าน/เขียน ก่อนจะ deploy ให้ตั้งค่า security rules:

### ไปที่ Realtime Database → Rules

เปลี่ยนเป็น:

```json
{
  "rules": {
    "customers": {
      ".read": true,
      ".write": true,
      ".validate": true
    }
  }
}
```

หรือปลอดภัยกว่า (เฉพาะ Vercel deployment):

```json
{
  "rules": {
    "customers": {
      ".read": true,
      ".write": true
    }
  }
}
```

---

## 🚀 Deploy ขึ้น Vercel

เมื่อ deploy ขึ้น Vercel ต้องเพิ่ม environment variables:

### Vercel Dashboard → Project → Settings → Environment Variables

เพิ่มตัวแปรเดียวกับที่ใน `.env.local`:

```
VITE_FIREBASE_API_KEY = AIzaSyD...
VITE_FIREBASE_AUTH_DOMAIN = juthazone-xxxxx.firebaseapp.com
VITE_FIREBASE_DATABASE_URL = https://juthazone-xxxxx.firebaseio.com
VITE_FIREBASE_PROJECT_ID = juthazone-xxxxx
VITE_FIREBASE_STORAGE_BUCKET = juthazone-xxxxx.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID = 123456789
VITE_FIREBASE_APP_ID = 1:123456789:web:abc123def456
```

---

## ❓ Troubleshooting

### ❌ "Firebase not configured"

**วิธีแก้**: ตรวจสอบว่ามีไฟล์ `.env.local` และค่า VITE_FIREBASE_* ถูกต้อง

```bash
# ตรวจสอบ environment variables
echo $VITE_FIREBASE_API_KEY
```

### ❌ "No rules"

**วิธีแก้**: 
1. ไปที่ Firebase Console → Realtime Database
2. ไปแท็บ **"Rules"**
3. ตั้งค่า rules ให้อ่านเขียนได้

### ❌ "Sync not working"

**วิธีแก้**:
1. ตรวจสอบว่า database ได้สร้างแล้ว
2. ตรวจสอบว่ามี Internet connection
3. เปิด Chrome DevTools (F12) ดู console มีข้อมูลอะไร
4. ลองรีเฟรช page

### ❌ "Data not showing in Database"

**วิธีแก้**:
1. ตรวจสอบ `.env.local` ค่า `VITE_FIREBASE_DATABASE_URL`
2. ลองเพิ่มลูกค้าใหม่ ดูว่ามี data ขึ้นใน Firebase Console ไหม

---

## 📊 ดู Data ใน Firebase

### ไปที่ Firebase Console

1. Realtime Database → ไปแท็บ **"Data"**
2. ควรเห็น structure:

```
juthazone-xxxxx
└── customers
    ├── 1
    │   ├── name: "ลูกค้า 1"
    │   ├── room: "ห้องชั้น 2"
    │   ├── timeRemaining: 300
    │   ├── cost: 100
    │   ├── isPaid: false
    │   └── isRunning: true
    └── 2
        └── ...
```

---

## 💾 Backup Data

Firebase จัดเก็บข้อมูลให้อัตโนมัติ แต่ก็ควรทำ backup:

### Export Data

```bash
firebase database:get / --json > backup.json
```

### Import Data

```bash
firebase database:set / < backup.json
```

---

## 🎉 เสร็จแล้ว!

ตอนนี้ Juthazone ของคุณ sync ได้ทั้ง:
- ✅ หลาย tabs/windows บนเครื่องเดียว (BroadcastChannel)
- ✅ หลาย devices ต่างกัน (Firebase)
- ✅ Real-time countdown sync ทุกวินาที

**สิ่งที่เกิดขึ้น:**
1. เพิ่มลูกค้าจาก Admin
2. Data บันทึกใน Firebase
3. Mobile สแกน QR ดูข้อมูลทันที
4. ทั้งหมดอัพเดท real-time! 🎮

---

**อ้างอิง:**
- Firebase Console: https://console.firebase.google.com
- Firebase Documentation: https://firebase.google.com/docs/database
- Vite Environment Variables: https://vitejs.dev/guide/env-and-modes.html


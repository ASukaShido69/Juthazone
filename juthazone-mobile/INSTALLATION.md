# 🚀 คู่มือการติดตั้งและใช้งาน Juthazone Mobile

## 📋 ข้อกำหนดระบบ

- Node.js 18+ 
- npm หรือ yarn
- Expo CLI
- Expo Go app (สำหรับทดสอบบนมือถือ)
- Android Studio / Xcode (optional, สำหรับ emulator)

## 📦 ขั้นตอนการติดตั้ง

### 1. ติดตั้ง Dependencies

```bash
cd juthazone-mobile
npm install
```

### 2. ตั้งค่า Supabase

1. สร้างโปรเจกต์ใหม่ที่ [supabase.com](https://supabase.com)
2. คัดลอก URL และ anon key
3. แก้ไขไฟล์ `src/services/supabase.ts`:

```typescript
const SUPABASE_URL = 'https://xxxxx.supabase.co'  // ใส่ URL ของคุณ
const SUPABASE_ANON_KEY = 'eyJxxx...'  // ใส่ anon key ของคุณ
```

### 3. สร้าง Database Tables

รันคำสั่ง SQL ใน Supabase SQL Editor:

```sql
-- สร้างตาราง customers
CREATE TABLE customers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  room TEXT NOT NULL,
  phone TEXT,
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expected_end_time TIMESTAMPTZ,
  actual_end_time TIMESTAMPTZ,
  duration_minutes INTEGER NOT NULL,
  cost NUMERIC(10,2) NOT NULL,
  is_paid BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  payment_method TEXT CHECK (payment_method IN ('cash', 'transfer', 'credit')),
  staff_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- สร้างตาราง customers_history
CREATE TABLE customers_history (
  LIKE customers INCLUDING ALL
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE customers;

-- RLS Policies (ถ้าต้องการความปลอดภัย)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers_history ENABLE ROW LEVEL SECURITY;

-- อนุญาตให้ทุกคนอ่าน (ปรับตามความต้องการ)
CREATE POLICY "Allow read for all" ON customers FOR SELECT USING (true);
CREATE POLICY "Allow insert for all" ON customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update for all" ON customers FOR UPDATE USING (true);
CREATE POLICY "Allow delete for all" ON customers FOR DELETE USING (true);
```

### 4. รันแอปพลิเคชัน

```bash
# เริ่ม Expo Dev Server
npm start
```

จากนั้นเลือกวิธีรัน:
- กด `a` - รันบน Android emulator
- กด `i` - รันบน iOS simulator
- สแกน QR code ด้วย Expo Go app

## 📱 การทดสอบบนมือถือจริง

### Android

1. ติดตั้ง **Expo Go** จาก Play Store
2. เปิดกล้อง สแกน QR code จาก terminal
3. แอปจะเปิดใน Expo Go

### iOS

1. ติดตั้ง **Expo Go** จาก App Store
2. เปิดกล้อง สแกน QR code
3. กด notification ที่ปรากฏขึ้น

## 🔔 การเปิดใช้งาน Notifications

### ใน Emulator/Simulator
- Notifications จะแสดงเป็น Toast/Banner
- ไม่มีเสียงแจ้งเตือน

### บนมือถือจริง
1. แอปจะขออนุญาตเมื่อเปิดครั้งแรก
2. กด "Allow" เพื่อเปิดใช้งาน
3. ตรวจสอบ Settings > Notifications > Juthazone

## 🧪 การทดสอบระบบแจ้งเตือน

ในไฟล์ `src/services/notifications.ts` ลองเปลี่ยนเงื่อนไข:

```typescript
// จาก
if ([15, 10, 5, 1].includes(minutesLeft)) {

// เป็น (สำหรับทดสอบ)
if ([15, 10, 5, 2, 1].includes(minutesLeft)) {
```

## 📝 การเพิ่มลูกค้าทดสอบ

ใช้ Supabase Table Editor หรือรันคำสั่ง SQL:

```sql
INSERT INTO customers (name, room, phone, duration_minutes, cost, start_time, expected_end_time, is_active)
VALUES (
  'ทดสอบ นะจ๊ะ',
  'ห้อง A1',
  '0812345678',
  60,
  100,
  NOW(),
  NOW() + INTERVAL '60 minutes',
  true
);
```

## 🐛 แก้ไขปัญหาที่พบบ่อย

### 1. "Cannot find module"
```bash
rm -rf node_modules
npm install
npx expo start -c
```

### 2. Notifications ไม่แสดง
```bash
# ตรวจสอบ permission
npx expo install expo-notifications
# Restart app
```

### 3. Supabase connection error
- ตรวจสอบ URL และ key
- เช็ค RLS policies
- ดู Network tab ใน DevTools

### 4. Timer ไม่อัพเดท
- ตรวจสอบว่ามี `expected_end_time` ใน database
- Refresh หน้า Customer View
- เช็ค console logs

## 🔧 คำสั่งที่มีประโยชน์

```bash
# ล้าง cache
npx expo start -c

# Reset Metro bundler
npx expo start --reset-cache

# ติดตั้ง dependencies ใหม่
rm -rf node_modules package-lock.json
npm install

# Build APK
eas build --platform android

# Build IPA
eas build --platform ios
```

## 📊 การดูข้อมูล Realtime

เปิด Supabase Dashboard > Table Editor > customers
- เมื่อเพิ่ม/แก้ไข/ลบข้อมูล แอปจะอัพเดททันที
- ไม่ต้อง refresh หน้า

## 🎨 การปรับแต่ง

### เปลี่ยนสี Theme
แก้ไขไฟล์ `app.json`:

```json
{
  "splash": {
    "backgroundColor": "#9333ea"  // เปลี่ยนสีตรงนี้
  },
  "android": {
    "adaptiveIcon": {
      "backgroundColor": "#9333ea"  // และตรงนี้
    }
  }
}
```

### เปลี่ยนเวลาแจ้งเตือน
แก้ไขไฟล์ `src/services/notifications.ts`:

```typescript
// แจ้งที่ 20, 15, 10, 5 นาที
if ([20, 15, 10, 5].includes(minutesLeft)) {
```

## 📚 เอกสารเพิ่มเติม

- [Expo Documentation](https://docs.expo.dev/)
- [Supabase Documentation](https://supabase.com/docs)
- [React Native Documentation](https://reactnative.dev/)

## 💡 Tips

1. ใช้ `expo start --tunnel` ถ้าเชื่อมต่อผ่าน network ไม่ได้
2. เปิด Debug mode: เขย่ามือถือ > เลือก "Debug"
3. ดู logs: `npx expo start` แล้วกด `Shift + m`

## 🆘 ต้องการความช่วยเหลือ?

- เปิด Issue ใน GitHub
- ตรวจสอบ Console logs
- ลองรัน `expo doctor` เพื่อเช็คปัญหา

---

Made with ❤️ for Juthazone | Happy Coding! 🚀

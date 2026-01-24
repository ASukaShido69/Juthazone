# 🚀 Juthazone Flutter App

แอปพลิเคชัน Flutter สำหรับจัดการลูกค้าและเวลาใช้บริการ พร้อมระบบแจ้งเตือนอัตโนมัติ

## ✨ Features

- 📊 **Admin Dashboard** - จัดการลูกค้า เพิ่ม/แก้ไข/ลบ
- 🏠 **Customer View** - แสดงลูกค้าปัจจุบัน พร้อม Timer realtime
- 📈 **Analytics** - สถิติรายได้และกราฟ
- ⏰ **Push Notifications** - แจ้งเตือนเมื่อเวลาใกล้หมด
- 🔄 **Realtime Sync** - อัพเดทจาก Supabase แบบ realtime
- 📱 **Cross-Platform** - รองรับ iOS และ Android

## 🛠️ Tech Stack

- **Flutter** 3.2+ 
- **Dart** 3.0+
- **Supabase** - Backend & Database
- **FL Chart** - Graphs & Charts
- **Local Notifications** - Push notifications

## 📦 Installation

### 1. ติดตั้ง Flutter

```bash
# ตรวจสอบ Flutter
flutter doctor

# ถ้ายังไม่มี ดาวน์โหลดจาก
https://flutter.dev/docs/get-started/install
```

### 2. Clone และติดตั้ง Dependencies

```bash
cd juthazone-flutter
flutter pub get
```

### 3. ตั้งค่า Supabase

แก้ไขไฟล์ `lib/services/supabase_service.dart`:

```dart
static const String supabaseUrl = 'https://your-project.supabase.co';
static const String supabaseAnonKey = 'your-anon-key';
```

### 4. รันแอพ

```bash
# รันบน iOS Simulator
flutter run -d ios

# รันบน Android Emulator
flutter run -d android

# รันบนมือถือจริง (เชื่อมต่อ USB)
flutter run

# Build APK
flutter build apk --release

# Build iOS
flutter build ios --release
```

## 🔔 การตั้งค่า Notifications

### Android
- Permissions ถูกตั้งค่าแล้วใน `AndroidManifest.xml`
- จะขออนุญาตอัตโนมัติเมื่อเปิดแอพครั้งแรก

### iOS
- Permissions ถูกตั้งค่าแล้วใน `Info.plist`
- ต้อง Sign app ด้วย Apple Developer Account

## 📱 การใช้งาน

### Admin Tab (👨‍💼)
1. กดปุ่ม "เพิ่มลูกค้า" (+)
2. กรอกข้อมูล: ชื่อ, ห้อง, เวลา, ค่าบริการ
3. ระบบเริ่มนับเวลาอัตโนมัติ
4. รับ notification เมื่อเวลาใกล้หมด

### Customer Tab (🏠)
- แสดงลูกค้าที่กำลังใช้บริการ
- Timer นับถอยหลังแบบ realtime
- Pull to refresh

### Analytics Tab (📊)
- ดูรายได้รวม
- จำนวนลูกค้าทั้งหมด
- กราฟรายได้

## 🎨 Customization

### เปลี่ยนสี Theme
แก้ไขใน `lib/main.dart`:

```dart
primaryColor: const Color(0xFF9333ea),
```

### ปรับเวลาแจ้งเตือน
แก้ไขใน `lib/services/notification_service.dart`:

```dart
if ([15, 10, 5, 1].contains(minutesLeft)) {
  // เปลี่ยนตัวเลขตามต้องการ
}
```

## 🐛 Troubleshooting

### ปัญหา: Build failed
```bash
flutter clean
flutter pub get
flutter run
```

### ปัญหา: Notifications ไม่แสดง
- Android: ตรวจสอบ Settings > Apps > Juthazone > Notifications
- iOS: ตรวจสอบ Settings > Notifications > Juthazone

### ปัญหา: Supabase ไม่เชื่อมต่อ
- ตรวจสอบ URL และ Key
- เช็ค internet connection
- ตรวจสอบ RLS policies ใน Supabase

## 📂 โครงสร้างโปรเจกต์

```
juthazone-flutter/
├── lib/
│   ├── main.dart                 # Entry point
│   ├── models/
│   │   └── customer.dart         # Customer model
│   ├── services/
│   │   ├── supabase_service.dart # Supabase API
│   │   └── notification_service.dart # Notifications
│   ├── screens/
│   │   ├── admin_dashboard_screen.dart
│   │   ├── customer_view_screen.dart
│   │   └── analytics_screen.dart
│   └── widgets/
│       ├── customer_card.dart
│       └── timer_widget.dart
├── android/                      # Android config
├── ios/                          # iOS config
└── pubspec.yaml                  # Dependencies
```

## 🚀 Build สำหรับ Production

### Android (APK)
```bash
flutter build apk --release
# ไฟล์จะอยู่ที่: build/app/outputs/flutter-apk/app-release.apk
```

### Android (App Bundle - สำหรับ Play Store)
```bash
flutter build appbundle --release
```

### iOS
```bash
flutter build ios --release
# เปิด Xcode แล้ว Archive
```

## 📝 Database Schema

```sql
CREATE TABLE customers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  room TEXT NOT NULL,
  phone TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  expected_end_time TIMESTAMPTZ,
  duration_minutes INTEGER NOT NULL,
  cost NUMERIC(10,2) NOT NULL,
  is_paid BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  payment_method TEXT,
  staff_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 📚 เอกสารเพิ่มเติม

- [Flutter Documentation](https://flutter.dev/docs)
- [Dart Documentation](https://dart.dev/guides)
- [Supabase Flutter](https://supabase.com/docs/reference/dart/introduction)

## 🎯 Tips

- ใช้ `flutter run --release` สำหรับทดสอบ performance
- ใช้ Hot Reload (กด `r`) ขณะพัฒนา
- ใช้ Hot Restart (กด `R`) เมื่อเปลี่ยน state หลัก
- ใช้ `flutter analyze` เพื่อเช็ค code quality

## 📄 License

MIT License

---

Made with ❤️ for Juthazone | Happy Coding! 🚀

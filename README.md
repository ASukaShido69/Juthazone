# Juthazone - ระบบจัดการเวลา

## คำอธิบาย
เว็บแอพพลิเคชัน Juthazone สำหรับจัดการเวลาลูกค้าในธุรกิจเครื่องเล่น/ห้องเล่นเกม มีระบบจับเวลาแบบ real-time และการจัดการข้อมูลลูกค้า

## ฟีเจอร์หลัก

### 1. หน้าแอดมิน (/admin)
- ➕ เพิ่มลูกค้าใหม่ (ชื่อ, ห้อง, เวลา, ค่าใช้จ่าย)
- 📋 ตารางแสดงรายการลูกค้าทั้งหมด
- ⏰ Countdown timer แบบ real-time
- 🎮 ควบคุมเวลา (เริ่ม/หยุด, เพิ่มเวลา)
- 💰 จัดการสถานะการจ่ายเงิน
- 🗑️ ลบรายการลูกค้า
- 📱 QR Code สำหรับลูกค้าสแกน

### 2. หน้าลูกค้า (/customer)
- 👀 ดูรายการลูกค้าทั้งหมดแบบ Card
- ⏱️ Countdown timer ขนาดใหญ่
- 🚨 แจ้งเตือนเมื่อเวลาเหลือน้อยกว่า 5 นาที
- ✅ แสดงสถานะการจ่ายเงิน
- 🔄 อัพเดทข้อมูลอัตโนมัติทุกวินาที

## เทคโนโลยีที่ใช้
- ⚛️ React 18
- ⚡ Vite
- 🎨 Tailwind CSS
- 🛣️ React Router
- 📱 QR Code (qrcode.react)
- 🔤 Font Mali (Thai)

## การติดตั้ง

### ข้อกำหนดเบื้องต้น
ต้องติดตั้ง Node.js และ npm ก่อน

### ขั้นตอนการติดตั้ง

1. ติดตั้ง dependencies:
```bash
npm install
```

2. รันโปรเจค:
```bash
npm run dev
```

3. เปิดเบราว์เซอร์ไปที่ `http://localhost:5173`

## การใช้งาน

### สำหรับแอดมิน
1. เปิดหน้า `/admin` เพื่อจัดการระบบ
2. เพิ่มลูกค้าใหม่ผ่านฟอร์ม
3. ควบคุมเวลาและสถานะการจ่ายเงินของแต่ละลูกค้า
4. แสดง QR Code ให้ลูกค้าสแกน

### สำหรับลูกค้า
1. สแกน QR Code หรือเปิด `/customer`
2. ดูเวลาที่เหลือและสถานะการจ่ายเงิน
3. จะได้รับการแจ้งเตือนเมื่อเวลาเหลือน้อย

## โครงสร้างโปรเจค
```
NewProject/
├── src/
│   ├── components/
│   │   ├── AdminDashboard.jsx    # หน้าแอดมิน
│   │   └── CustomerView.jsx      # หน้าลูกค้า
│   ├── App.jsx                   # Main app component
│   ├── main.jsx                  # Entry point
│   └── index.css                 # Global styles
├── index.html
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## คุณสมบัติพิเศษ
- 📱 **Mobile-First Responsive Design** - ออกแบบสำหรับมือถือเป็นหลัก
- 🎯 **QR Code Optimized** - สแกน QR แล้วดูข้อมูลได้อย่างสวยงามพอดีหน้าจอ
- 🎨 UI สวยงามพร้อม animations, gradients, และ effects
- 🌈 Animated gradients และ floating effects
- ✨ Glass morphism และ backdrop blur
- 💫 Touch-friendly interactions สำหรับมือถือ
- 📊 Adaptive layouts สำหรับทุกขนาดหน้าจอ (mobile, tablet, desktop)
- ⚡ Real-time countdown ทุกวินาที
- 🚨 Alert animation เมื่อเวลาใกล้หมด
- 🔤 ใช้ฟอนต์ Mali ที่อ่านง่ายทุกขนาด
- 🎯 State management ด้วย React useState
- 🚀 พร้อม deploy บน Vercel

## Responsive Breakpoints
- **Mobile**: < 640px (1 column)
- **Tablet**: 640px - 1024px (2 columns)
- **Desktop**: > 1024px (3 columns)
- **Admin Table**: ซ่อนคอลัมน์บางส่วนบนมือถือเพื่อความสวยงาม

## การ Deploy

ดูคู่มือการ deploy แบบละเอียดได้ที่ [DEPLOY_GUIDE.md](DEPLOY_GUIDE.md)

### Quick Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/juthazone)

1. Push โค้ดไปยัง GitHub
2. เชื่อมต่อ repository กับ Vercel
3. Deploy อัตโนมัติ!

## License
MIT

# 🏗️ JUTHAZONE - สถาปัตยกรรมระบบและการทำงาน

## 📋 สารบัญ
1. [ภาพรวมระบบ](#ภาพรวมระบบ)
2. [สถาปัตยกรรม](#สถาปัตยกรรม)
3. [ขั้นตอนการทำงาน](#ขั้นตอนการทำงาน)
4. [โครงสร้างข้อมูล](#โครงสร้างข้อมูล)
5. [ลำดับการคำนวณเวลา](#ลำดับการคำนวณเวลา)
6. [การซิงค์ข้อมูล](#การซิงค์ข้อมูล)
7. [ระบบสองโซน](#ระบบสองโซน)

---

## ภาพรวมระบบ

### 🎯 วัตถุประสงค์
จัดการการเล่นของลูกค้าในธุรกิจเครื่องเล่น/ห้องเกมส์ โดยมี:
- ⏰ ระบบจับเวลา Real-time (นับลง)
- 💰 การจัดการค่าใช้จ่าย
- 📱 QR Code สำหรับลูกค้า
- 👤 แยกระหว่าง Admin (จัดการ) และ Customer (ดู)
- 🔵🔴 ระบบสองโซน (Red Zone + Blue Zone)

---

## สถาปัตยกรรม

```
┌─────────────────────────────────────────────────────┐
│                   FRONTEND (React)                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────────────────────────────────┐     │
│  │  BrowserRouter (React Router)             │     │
│  │  ├─ /login → LoginPage                   │     │
│  │  ├─ /admin → AdminDashboard              │     │
│  │  ├─ /customer → CustomerView             │     │
│  │  ├─ /history → HistoryView               │     │
│  │  ├─ /analytics → AnalyticsView           │     │
│  │  ├─ /daily-summary → DailySummaryView    │     │
│  │  └─ /blue/* → AppBlue (Alternative)     │     │
│  └──────────────────────────────────────────┘     │
│                                                     │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│        State Management (App.jsx)                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  useState:                                          │
│  ├─ customers[] → ข้อมูลลูกค้าทั้งหมด                │
│  ├─ nextId → ID ถัดไป                              │
│  ├─ user → ข้อมูล user ที่ login                    │
│  ├─ isSupabaseReady → การเชื่อมต่อ DB              │
│  └─ channel → BroadcastChannel เพื่อซิงค์            │
│                                                     │
│  Timers:                                            │
│  ├─ setInterval(100ms) → Update countdown          │
│  ├─ setInterval(30s) → Sync to Supabase            │
│  └─ Realtime subscription → Listen DB changes      │
│                                                     │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│         LOCAL STORAGE (Browser)                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ├─ juthazone_user → {id, username, role}         │
│  └─ selected_zone → 'red' | 'blue'                 │
│                                                     │
│  (⚠️ No localStorage sync for customers)           │
│                                                     │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│    BACKEND: Supabase (PostgreSQL + Realtime)       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Tables:                                            │
│  ├─ customers (Red Zone)                           │
│  │  └─ id, name, room, minutes, cost, isPaid, ...  │
│  ├─ juthazoneb_customers (Blue Zone)               │
│  ├─ customers_history (สำหรับ Red)                 │
│  ├─ juthazoneb_customers_history (สำหรับ Blue)     │
│  ├─ users (สำหรับ authentication)                  │
│  ├─ login_logs (สำหรับ audit)                      │
│  ├─ user_activity_logs (สำหรับ activity)           │
│  ├─ computer_zone_history (ห้องคอมพิวเตอร์)        │
│  └─ computer_zones (ตั้งค่าห้อง)                   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## ขั้นตอนการทำงาน

### 📍 ลำดับ 1: User Login
```
Browser
   ↓
User visits http://localhost:5173/
   ↓
[ZoneSelection] → เลือก Red หรือ Blue Zone
   ↓
[LoginPage] → กรอกชื่อผู้ใช้และรหัสผ่าน
   ↓
authenticateUser() → Query Supabase users table
   ↓
Password check (⚠️ plain text - security issue)
   ↓
Save to localStorage: juthazone_user
   ↓
Navigate to /admin (ProtectedRoute)
   ↓
App.jsx: setUser(userData)
```

### 📍 ลำดับ 2: Add Customer
```
Admin fills form:
├─ ชื่อลูกค้า
├─ ห้อง (จากรายการ dropdown)
├─ จำนวนนาที
├─ ค่าใช้จ่าย
└─ หมายเหตุ

   ↓
[Add Customer Button]
   ↓
addCustomer(customerData) in App.jsx:
├─ Generate expectedEndTime = now + minutes
├─ Set timeRemaining = minutes * 60 (seconds)
├─ isRunning = true
├─ isPaid = false
   ↓
setCustomers([...customers, newCustomer])
   ↓
Insert to Supabase customers table
   ↓
logActivity() → บันทึกการกระทำ
   ↓
Create customers_history record (start_time = now, end_reason = 'in_progress')
```

### 📍 ลำดังการ 3: Countdown Timer
```
Every 100ms:
   ↓
Check: elapsed time >= 950ms && <= 1050ms (1 second tolerance)
   ↓
Filter expired customers:
├─ Find: customer.expectedEndTime <= now
├─ Action: saveToHistory(customer, 'expired')
├─ Remove from list
   ↓
Update state:
   setCustomers(filtered) 
   ↓
Every 30 seconds (if changes):
   └─ updateFirebase(filtered) → Supabase upsert
   
   ↓
Broadcast to other tabs via BroadcastChannel:
   └─ channel.postMessage({type: 'UPDATE_CUSTOMERS', data: {...}})
```

### 📍 ลำดับ 4: Data Sync (Realtime)
```
Two mechanisms:
   ↓
1. Realtime Subscription (WebSocket):
   ├─ supabase.channel('customers-channel').on('postgres_changes', ...)
   ├─ Listen for INSERT, UPDATE, DELETE in customers table
   └─ Action: fetchCustomers() → refresh all data
   
2. Polling (Fallback):
   ├─ setInterval(30000) → every 30 seconds
   └─ fetchCustomers() → if Supabase still responsive
```

### 📍 ลำดับ 5: Customer View (QR Scan)
```
Customer scans QR or visits /customer
   ↓
[CustomerView] component
   ↓
props.customers (from parent App.jsx)
   ↓
Display all customers as Cards:
├─ Customer name
├─ Room
├─ Countdown timer (updates every 100ms)
├─ Payment status (icon: ✅ or ❌)
└─ Blinking effect if time < 5 minutes
```

---

## โครงสร้างข้อมูล

### 📊 Customer Object
```javascript
{
  id: 1,                              // Auto increment
  name: "สมชาย",                       // ชื่อลูกค้า
  room: "ชั้น 2 ห้อง VIP",            // ห้อง
  minutes: 120,                       // นาทีที่จอง
  cost: 300,                          // ค่าใช้จ่าย
  note: "VIP customer",               // หมายเหตุ
  paymentMethod: "transfer",          // transfer | cash
  shift: "1",                         // กะที่เลือก
  
  // Runtime computed
  timeRemaining: 7200,                // seconds (computed)
  isRunning: true,                    // กำลังนับเวลา
  isPaid: false,                      // จ่ายเงินแล้ว
  
  // Timestamps
  startTime: "2026-01-19T10:00:00Z",  // เวลาเริ่มต้น
  expectedEndTime: "2026-01-19T12:00:00Z",
  created_at: "2026-01-19T10:00:00Z", // Supabase auto
  updated_at: "2026-01-19T10:00:00Z"  // Supabase auto
}
```

### 📊 History Record
```javascript
{
  id: 1,
  customer_id: 1,
  name: "สมชาย",
  room: "ชั้น 2 ห้อง VIP",
  note: "VIP customer",
  added_by: "admin_user",
  start_time: "2026-01-19T10:00:00Z",
  end_time: "2026-01-19T12:00:00Z",
  duration_minutes: 120,
  original_cost: 300,
  final_cost: 300,    // อาจเปลี่ยนจากการปรับเวลา
  is_paid: true,      // จ่ายเงินแล้ว
  end_reason: "expired" | "manual" | "in_progress", // เหตุผลสิ้นสุด
  session_date: "2026-01-19",
  payment_method: "transfer",
  shift: "1"
}
```

### 📊 User Object
```javascript
{
  id: 1,
  username: "admin01",
  password: "123456",     // ⚠️ Plain text - bad!
  role: "admin",          // admin | staff
  display_name: "Admin User",
  is_active: true,
  created_at: "2026-01-19T00:00:00Z"
}
```

---

## ลำดับการคำนวณเวลา

### 🔢 การคำนวณ timeRemaining

```javascript
// CURRENT LOGIC (from App.jsx)

// 1. เมื่อ Add Customer:
const expectedEndTime = new Date(now.getTime() + customerData.minutes * 60 * 1000)
// Example: now = 10:00, minutes = 2
//         expectedEndTime = 10:02

// 2. Display ใช้ calculateTimeRemaining():
const now = Date.now()
const endTimeMs = new Date(expectedEndTime).getTime()
const timeRemainingMs = endTimeMs - now
const timeRemainingSeconds = Math.max(0, Math.ceil(timeRemainingMs / 1000))

// 3. Format display:
const hours = Math.floor(timeRemainingSeconds / 3600)
const minutes = Math.floor((timeRemainingSeconds % 3600) / 60)
const seconds = timeRemainingSeconds % 60

// Display: "02:00" or "1 ชม 30 นาที"

// 4. Expiration check:
if (timeRemainingSeconds <= 0) {
  // Move to history
  // Remove from customers list
  // Alert user
}
```

### ✅ Advantages:
- No need to update timeRemaining every second
- Computed on-demand from expectedEndTime
- Accurate across page reloads
- No drift over time

---

## การซิงค์ข้อมูล

### 🔄 3 Levels of Sync

```
Level 1: Client-to-Client (Same Browser)
┌─────────────┐  BroadcastChannel  ┌─────────────┐
│   Tab 1     │◄─────────────────►│   Tab 2     │
│ (Admin)     │                   │ (Customer)  │
└─────────────┘                   └─────────────┘
  Updates share real-time state

Level 2: Client-to-Server (Supabase)
┌──────────────┐                  ┌──────────────┐
│ React App    │──30-second───────│  Supabase    │
│ (setInterval)│     polling      │ (PostgreSQL) │
└──────────────┘                  └──────────────┘

Level 3: Server-to-Client (Realtime Subscription)
┌──────────────┐                  ┌──────────────┐
│ React App    │◄──WebSocket─────│  Supabase    │
│ (listener)   │  (Realtime)      │ (Real-time)  │
└──────────────┘                  └──────────────┘
  When ANY user updates database
  Trigger: fetchCustomers() in all connected clients
```

### 🔀 Race Condition Risk
```
Scenario: User A adds customer while User B adds customer

User A:                          User B:
setCustomers([...])             setCustomers([...])
   ↓ (100ms)                        ↓ (100ms)
updateFirebase()                updateFirebase()
   ↓                               ↓
Supabase upsert                 Supabase upsert
   ↓                               ↓
Data might conflict!

Solution: Supabase uses onConflict: 'id' 
→ Last write wins
→ Acceptable for this use case (not critical data)
```

---

## ระบบสองโซน

### 🔴 RED ZONE (Fixed-time pricing)
```
Files:
├─ App.jsx (main app)
├─ AdminDashboard.jsx
├─ CustomerView.jsx
└─ HistoryView.jsx

Database:
├─ customers (Red Zone)
└─ customers_history

Pricing Logic:
├─ Input: name, room, minutes, cost
└─ Charge: fixed cost regardless of actual usage
```

### 🔵 BLUE ZONE (Pro-rated pricing)
```
Files:
├─ AppBlue.jsx (alternative app)
├─ AdminDashboardBlue.jsx
├─ CustomerViewBlue.jsx
└─ AnalyticsViewBlue.jsx

Database:
├─ juthazoneb_customers (Blue Zone)
└─ juthazoneb_customers_history

Pricing Logic:
├─ Input: hours, transferAmount, cashAmount
└─ Charge: based on actual time used (auto-calc)

Duration Calculation:
start_time → end_time → duration → auto-charge
```

### 🔀 Switch Zone Flow
```
User at /
   ↓
[ZoneSelection]
├─ Button Red Zone  → localStorage.selected_zone = 'red'
│                   → /login (App.jsx)
│
└─ Button Blue Zone → localStorage.selected_zone = 'blue'
                    → /login (LoginPage)
                    → navigate('/blue/admin')
                    → AppBlue.jsx (renders)
```

---

## 🔐 Authentication Flow

```
1. Visit /login
   ↓
2. [LoginPage] → Enter username & password
   ↓
3. authenticateUser(username, password)
   ├─ Query: SELECT * FROM users WHERE username = ?
   ├─ Check: plain text password match
   ├─ Check: is_active = true
   ↓
4. If success:
   ├─ logLoginAttempt(username, true) → login_logs table
   ├─ logActivity() → user_activity_logs
   ├─ localStorage.juthazone_user = {id, username, role, ...}
   └─ navigate('/admin')
   ↓
5. App.jsx checks localStorage on mount
   └─ If found: setUser(userData)

6. ProtectedRoute wraps /admin, /history, /analytics
   ├─ If user → render component
   └─ If !user → navigate('/login')

7. Logout:
   ├─ logLogout() → update login_logs with logout_time
   ├─ localStorage.removeItem('juthazone_user')
   ├─ setUser(null)
   └─ navigate('/login')
```

---

## 📱 Components Hierarchy

```
App.jsx (Main state holder)
├─ state: customers, user, nextId, isSupabaseReady
├─ functions: addCustomer, toggleTimer, addTime, ...
│
├─ [Route /]
│  └─ ZoneSelection
│
├─ [Route /login]
│  └─ LoginPage (handles login)
│
├─ [Route /admin]
│  └─ ProtectedRoute
│     └─ AdminDashboard (receives customers, callbacks)
│        ├─ CustomerList (table)
│        ├─ AddCustomerForm
│        ├─ ComputerZoneEntry (separate zone)
│        └─ ComputerZoneManager (modal)
│
├─ [Route /customer]
│  └─ CustomerView (public page)
│     └─ CustomerCard (repeated for each customer)
│
├─ [Route /history]
│  └─ ProtectedRoute
│     └─ HistoryView (query customers_history)
│
├─ [Route /analytics]
│  └─ ProtectedRoute
│     └─ AnalyticsView (recharts dashboard)
│
├─ [Route /daily-summary]
│  └─ ProtectedRoute
│     └─ DailySummaryView (daily stats)
│
└─ [Route /blue/*]
   └─ AppBlue (alternative app for Blue Zone)
```

---

## 🔄 Update Mechanisms

### How changes propagate:

```
User clicks "Add Customer" in Admin
   ↓
AdminDashboard.jsx calls addCustomer(data)
   ↓
App.jsx:
├─ setCustomers([...customers, new])
├─ Insert to Supabase
├─ logActivity()
├─ BroadcastChannel.postMessage()
   ↓
Updates propagate:
├─ Local state immediately
├─ Supabase within 100ms
├─ Other tabs via BroadcastChannel within 100ms
├─ CustomerView re-renders
└─ Timer starts counting down
```

---

## ⚙️ Performance Optimizations

1. **Timestamp-based countdown** (not recompute every second)
2. **Polling interval: 30 seconds** (not every second)
3. **Realtime subscription** (not pull-only)
4. **useCallback memoization** in DailySummaryView
5. **BroadcastChannel** for tab sync (not API calls)
6. **Selective field sync** (not entire customer object)

---

## 📊 Summary Table

| Feature | Red Zone | Blue Zone |
|---------|----------|-----------|
| Pricing | Fixed | Pro-rated |
| Files | App.jsx | AppBlue.jsx |
| Table | `customers` | `juthazoneb_customers` |
| History | `customers_history` | `juthazoneb_customers_history` |
| Auth | Shared | Shared |
| Billing | Manual | Auto-calculated |

---

**Last Updated:** Jan 19, 2026

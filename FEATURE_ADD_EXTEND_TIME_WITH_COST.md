# ✨ Feature: Add/Extend Time with Cost Update

## 🎯 ฟีเจอร์ใหม่

เพิ่มความสามารถให้ admin สามารถ:
1. **เพิ่มเวลา + เปลี่ยนยอดเงิน** พร้อมกันในคลิกเดียว
2. **ขยายเวลา + เปลี่ยนยอดเงิน** เมื่อลูกค้าหมดเวลา
3. **บันทึก History อย่างถูกต้อง** ตามข้อมูล realtime

---

## 📋 ตัวอย่างการใช้งาน

### Scenario: ลูกค้าเล่น 120 นาที ราคา 300 บาท
```
1. เริ่มต้น: 120 นาที, 300 บาท
   ↓
2. Admin กดปุ่ม "➕ เวลา"
   ↓
3. Modal เปิดขึ้น:
   ├─ จำนวนนาที: [60] ← input
   ├─ ยอดเงิน: [150] ← input (เปลี่ยนจาก 300)
   └─ [✅ ยืนยัน] [❌ ยกเลิก]
   ↓
4. บันทึก:
   ├─ expectedEndTime อัปเดต (+60 นาที)
   ├─ cost เปลี่ยนเป็น 150 บาท
   └─ history.final_cost = 150 บาท ✓
```

---

## 🔧 Technical Changes

### 1. App.jsx - Updated Function Signatures

#### addTime()
```javascript
// OLD: addTime(id, minutesToAdd)
// NEW: addTime(id, minutesToAdd, newCost = null)

const addTime = async (id, minutesToAdd, newCost = null) => {
  const newCustomers = customers.map(customer => {
    if (customer.id === id) {
      return {
        ...customer,
        expectedEndTime: newEnd.toISOString(),
        cost: newCost !== null ? newCost : customer.cost  // ✅ Update cost
      }
    }
    return customer
  })
  
  // Update history with new end_time + duration + cost
  await supabase.from('customers_history').update({
    end_time: updatedCustomer.expectedEndTime,  // ✅ NEW
    duration_minutes: durationMinutes.toFixed(2),  // ✅ RECALC
    final_cost: updatedCustomer.cost,  // ✅ UPDATE
  })
}
```

#### extendTime()
```javascript
// OLD: extendTime(id, minutesToExtend = 30)
// NEW: extendTime(id, minutesToExtend = 30, newCost = null)

const extendTime = async (id, minutesToExtend = 30, newCost = null) => {
  const newCustomers = customers.map(customer => {
    if (customer.id === id) {
      return {
        ...customer,
        expectedEndTime: newEnd.toISOString(),
        cost: newCost !== null ? newCost : customer.cost  // ✅ Update cost
      }
    }
    return customer
  })
  
  // Update history with new end_time + duration + cost
  await supabase.from('customers_history').update({
    end_time: updatedCustomer.expectedEndTime,  // ✅ NEW
    duration_minutes: durationMinutes.toFixed(2),  // ✅ RECALC
    final_cost: updatedCustomer.cost,  // ✅ UPDATE
  })
}
```

### 2. AdminDashboard.jsx - New Modal

#### State Management
```javascript
const [timeModal, setTimeModal] = useState({
  isOpen: false,
  customerId: null,
  minutes: '',
  newCost: '',
  mode: 'add' // 'add' or 'extend'
})
```

#### Handler Functions
```javascript
// Open modal for add time
const openTimeModal = (customerId, mode = 'add') => {
  const customer = customers.find(c => c.id === customerId)
  setTimeModal({
    isOpen: true,
    customerId,
    minutes: '',
    newCost: customer?.cost?.toString() || '',
    mode
  })
}

// Close modal
const closeTimeModal = () => {
  setTimeModal({
    isOpen: false,
    customerId: null,
    minutes: '',
    newCost: '',
    mode: 'add'
  })
}

// Submit
const handleTimeModalSubmit = async () => {
  const { customerId, minutes, newCost, mode } = timeModal
  
  if (!minutes || parseInt(minutes) <= 0) {
    alert('❌ กรุณากรอกจำนวนนาที')
    return
  }

  try {
    if (mode === 'extend') {
      await extendTime(customerId, parseInt(minutes), newCost ? parseFloat(newCost) : null)
    } else {
      await addTime(customerId, parseInt(minutes), newCost ? parseFloat(newCost) : null)
    }
    alert(`✅ ${mode === 'extend' ? 'ขยายเวลา' : 'เพิ่มเวลา'} สำเร็จ`)
    closeTimeModal()
  } catch (error) {
    alert(`❌ เกิดข้อผิดพลาด: ${error.message}`)
  }
}
```

#### Button Changes
```javascript
// OLD: await addTime(customer.id, 5)
// NEW: await openTimeModal(customer.id, 'add')

// OLD: await extendTime(customer.id, parseInt(minutes))
// NEW: await openTimeModal(customer.id, 'extend')

<button onClick={() => openTimeModal(customer.id, 'add')}>
  ➕ เวลา
</button>
```

#### Modal UI
```javascript
{timeModal.isOpen && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
      <h2>{timeModal.mode === 'extend' ? '🔄 ขยายเวลา' : '➕ เพิ่มเวลา'}</h2>
      
      <div className="space-y-4">
        {/* Minutes Input */}
        <input type="number" value={timeModal.minutes} ... />
        
        {/* Cost Input */}
        <input type="number" value={timeModal.newCost} ... />
        
        {/* Summary */}
        <div className="bg-purple-50">
          <div>⏱️ เพิ่มเวลา: {timeModal.minutes} นาที</div>
          <div>💰 ยอดเงิน: ฿{timeModal.newCost}</div>
        </div>
        
        {/* Buttons */}
        <button onClick={handleTimeModalSubmit}>✅ ยืนยัน</button>
        <button onClick={closeTimeModal}>❌ ยกเลิก</button>
      </div>
    </div>
  </div>
)}
```

---

## ✅ Data Flow

```
User clicks "➕ เวลา"
   ↓
openTimeModal(id, 'add') opens modal
   ↓
User enters:
├─ minutes: 60
└─ newCost: 150
   ↓
User clicks "✅ ยืนยัน"
   ↓
handleTimeModalSubmit() calls:
├─ addTime(id, 60, 150)  OR
└─ extendTime(id, 60, 150)
   ↓
Updates customer state:
├─ expectedEndTime += 60 minutes
└─ cost = 150
   ↓
Updates Supabase:
├─ customers table (upsert)
├─ customers_history (update):
│  ├─ end_time = new expectedEndTime
│  ├─ duration_minutes = recalculated
│  └─ final_cost = 150 ✓
   ↓
closeTimeModal()
   ↓
Alert: "✅ เพิ่มเวลา 60 นาที สำเร็จ"
```

---

## 🎨 UI Features

✅ **Modal Design**
- Clean, centered modal
- Input for minutes (required)
- Input for cost (optional)
- Summary shows: minutes + cost
- Confirm/Cancel buttons

✅ **User Experience**
- autofocus on minutes input
- Placeholder values
- Helper text ("ปล่อยว่างไว้เพื่อใช้ยอดเงินเดิม")
- Real-time summary display

✅ **Error Handling**
- Validates minutes > 0
- Shows error alerts
- Prevents empty submission

---

## 📊 Summary

| ด้าน | ก่อน | หลัง |
|------|------|------|
| **เพิ่มเวลา** | prompt (basic) | Modal (advanced) |
| **เปลี่ยนยอดเงิน** | ❌ ไม่ได้ | ✅ ได้ |
| **ยอดเงิน in history** | ❌ ไม่อัปเดต | ✅ บันทึกถูกต้อง |
| **Duration** | ❌ ผิด | ✅ ถูกต้อง |
| **UI/UX** | Simple | Professional |

---

## 🧪 Testing Checklist

- [ ] Click "➕ เวลา" → Modal opens
- [ ] Enter minutes: 60, cost: 150 → Click "✅ ยืนยัน"
- [ ] Check customers table → expectedEndTime updated
- [ ] Check customers_history → final_cost = 150
- [ ] Check customers_history → duration_minutes updated
- [ ] Click "🔄 ขยาย" (expired) → Modal opens (extend mode)
- [ ] Verify cost updates correctly
- [ ] Leave cost empty → Use old cost
- [ ] Cancel modal → No changes

---

**Status:** ✅ COMPLETE  
**Files Modified:**
- src/App.jsx (addTime, extendTime)
- src/components/AdminDashboard.jsx (modal UI + handlers)

**No breaking changes** - Old API still works with default null cost


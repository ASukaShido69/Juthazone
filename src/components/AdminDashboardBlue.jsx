import { useState, useEffect, useRef, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { formatTimeDisplay } from '../utils/timeFormat'
import supabase from '../firebase'
import { logActivityBlue, calculateCostBlue, formatElapsedTime } from '../utils/authUtilsBlue'
import { useTheme } from '../contexts/ThemeContext'
import ThemePicker from './ThemePicker'
import ZoneManagementModal from './ZoneManagementModal'
import ProductManagementModal from './ProductManagementModal'

// Zone configurations with pricing
const ZONES = {
  'board-game': {
    label: '🎲 บอร์ดเกม',
    items: [
      { id: 'board-game-big', label: 'โต๊ะใหญ่', defaultPrice: 100 },
      { id: 'board-game-small', label: 'โต๊ะเล็ก', defaultPrice: 50 }
    ]
  },
  'sim': {
    label: '🏎️ Sim',
    items: [
      { id: 'sim-1', label: '1 ตัวพื้นฐาน', defaultPrice: 120 },
      { id: 'sim-2', label: '2 ตัวพื้นฐาน', defaultPrice: 120 },
      { id: 'sim-3', label: '3 ตัวสมจริง', defaultPrice: 160 },
      { id: 'sim-4', label: '4 ตัวสมจริง', defaultPrice: 160 }
    ]
  },
  'ps': {
    label: '🎮 PS',
    items: [
      { id: 'ps-5', label: '5', defaultPrice: 100 },
      { id: 'ps-6', label: '6', defaultPrice: 100 },
      { id: 'ps-7', label: '7', defaultPrice: 100 },
      { id: 'ps-8', label: '8', defaultPrice: 100 },
      { id: 'ps-9', label: '9', defaultPrice: 100 },
      { id: 'ps-10', label: '10', defaultPrice: 100 }
    ]
  },
  'PS5-VIP': {
    label: '🎮 PS5 VIP First Floor',
    items: [
      { id: 'ps5-2joy', label: '2 จอย', defaultPrice: 120 },
      { id: 'ps5-4joy', label: '4 จอย', defaultPrice: 160 }
    ]
  },
  'VIPZONE': {
    label: '🎮 VIP ZONE',
    items: [
      { id: 'VIP-Karaoke', label: 'ห้อง VIP คาราโอเกะ', defaultPrice: 219 },
      { id: 'VIP-บอร์ดเกม', label: 'ห้อง VIP บอร์ดเกม', defaultPrice: 219 },
      { id: 'VIP-PS5', label: 'ห้อง VIP PS5', defaultPrice: 219 },
      { id: 'VIP-Nintendo', label: 'ห้อง VIP Nintendo', defaultPrice: 219 }
    ]
  },
  'nintendo': {
    label: '🎯 Nintendo',
    items: [
      { id: 'nintendo-main', label: 'Nintendo', defaultPrice: 80 }
    ]
  }
}

// ═══════════════════════════════════════════════════════════
// SPECIAL PRICING RULES
// ═══════════════════════════════════════════════════════════

// --- บอร์ดเกม: เล่น >= 2 ชม. ลด 50% ---
const BOARD_GAME_ZONE_IDS = ['board-game-big', 'board-game-small']

// --- PS (ปกติ): โปร ทุก 2 ชม. = 189 บาท ส่วนที่เกิน คิด hourlyRate/ชม. ---
const PS_ZONE_IDS = ['ps-5', 'ps-6', 'ps-7', 'ps-8', 'ps-9', 'ps-10']
const PS_PACKAGE_HOURS = 2        // ทุกๆ 2 ชั่วโมง
const PS_PACKAGE_PRICE = 189      // ราคาโปร 2 ชั่วโมง

/**
 * คำนวณเวลาที่เล่นจริง (ชั่วโมง) หลังหักเวลา pause
 */
const getElapsedHours = (startTime, totalPauseDuration, pauseTime, isRunning) => {
  const now = Date.now()
  const start = new Date(startTime).getTime()
  let elapsedMs = now - start
  if (totalPauseDuration) elapsedMs -= totalPauseDuration * 1000
  if (!isRunning && pauseTime) elapsedMs -= (now - new Date(pauseTime).getTime())
  return Math.max(0, elapsedMs) / 1000 / 60 / 60
}

/**
 * คำนวณราคา PS พร้อมโปรโมชั่น:
 * - ทุก 2 ชม. = 189 บาท
 * - เศษที่เกิน คิด hourlyRate/ชม. (pro-rated)
 * เช่น 2:30 ชม. = 189 + 0.5×100 = 239
 *      4:00 ชม. = 189×2 = 378
 *      4:30 ชม. = 189×2 + 0.5×100 = 428
 */
const calcPSPackageCost = (elapsedHours, hourlyRate) => {
  const fullPackages = Math.floor(elapsedHours / PS_PACKAGE_HOURS)
  const remainderHours = elapsedHours % PS_PACKAGE_HOURS
  const packageCost = fullPackages * PS_PACKAGE_PRICE
  const remainderCost = remainderHours * hourlyRate
  return { total: packageCost + remainderCost, fullPackages, remainderHours, packageCost, remainderCost }
}

/**
 * ฟังก์ชันหลัก: คืนค่า pricing info ที่ถูกต้องตาม zone
 */
const applySpecialPricing = (room, rawCost, startTime, totalPauseDuration, pauseTime, isRunning, hourlyRate) => {
  const elapsedHours = getElapsedHours(startTime, totalPauseDuration, pauseTime, isRunning)

  // ── PS Package Pricing ──
  if (PS_ZONE_IDS.includes(room)) {
    if (elapsedHours < PS_PACKAGE_HOURS) {
      // ยังไม่ถึง 2 ชม. คิดปกติ
      return {
        finalCost: rawCost,
        originalCost: rawCost,
        hasSpecialPrice: false,
        promoType: null,
        promoLabel: null,
        discountAmount: 0
      }
    }
    const ps = calcPSPackageCost(elapsedHours, hourlyRate)
    const saving = rawCost - ps.total
    return {
      finalCost: ps.total,
      originalCost: rawCost,
      hasSpecialPrice: true,
      promoType: 'ps_package',
      promoLabel: `🎮 โปร PS ${ps.fullPackages}×2ชม. = ${ps.fullPackages}×฿${PS_PACKAGE_PRICE}`,
      discountAmount: saving > 0 ? saving : 0,
      fullPackages: ps.fullPackages,
      remainderHours: ps.remainderHours
    }
  }

  // ── Board Game: ≥2 ชม. ลด 50% ──
  if (BOARD_GAME_ZONE_IDS.includes(room)) {
    if (elapsedHours >= 2) {
      const discounted = rawCost * 0.5
      return {
        finalCost: discounted,
        originalCost: rawCost,
        hasSpecialPrice: true,
        promoType: 'boardgame_discount',
        promoLabel: '🎲 ลด 50% บอร์ดเกม (≥ 2 ชม.)',
        discountAmount: rawCost - discounted
      }
    }
  }

  // ── ไม่มีโปร ──
  return {
    finalCost: rawCost,
    originalCost: rawCost,
    hasSpecialPrice: false,
    promoType: null,
    promoLabel: null,
    discountAmount: 0
  }
}

// legacy alias สำหรับ AppBlue.jsx (saveToHistory)
const applyBoardGameDiscount = (room, rawCost, startTime, totalPauseDuration, pauseTime, isRunning, hourlyRate) => {
  const result = applySpecialPricing(room, rawCost, startTime, totalPauseDuration, pauseTime, isRunning, hourlyRate || 0)
  return {
    discountedCost: result.finalCost,
    hasDiscount: result.hasSpecialPrice,
    originalCost: result.originalCost,
    discountAmount: result.discountAmount
  }
}

// Default product list
const DEFAULT_PRODUCTS = [
  { id: 'snack-large', name: 'ขนมห่อใหญ่', price: 30 },
  { id: 'snack-small', name: 'ขนมห่อเล็ก', price: 10 },
  { id: 'cheeseball', name: 'ชีสบอล', price: 59 },
  { id: 'nugget', name: 'นักเก็ต', price: 59 },
  { id: 'water', name: 'น้ำเปล่า', price: 15 },
  { id: 'mamaok', name: 'มาม่าOk', price: 25 },
  { id: 'mamatub', name: 'มาม่าถ้วย', price: 25 },
  { id: 'mamakorea', name: 'มาม่าเกาหลี', price: 50 },
  { id: 'fries', name: 'เฟรนช์ฟรายส์', price: 59 },
  { id: 'chicken-tendon', name: 'เอ็นข้อไก่', price: 79 },
  { id: 'fanta', name: 'แฟนต้า', price: 25 },
  { id: 'coke', name: 'โค๊ก', price: 25 },
  { id: 'oishi', name: 'โออิชิ', price: 25 },
  { id: 'chicken-pop', name: 'ไก่ป๊อป', price: 59 },
  { id: 'cup-ice', name: 'แก้ว+น้ำแข็ง', price: 5 }
]



function AdminDashboardBlue({
  customers,
  addCustomer,
  toggleTimer,
  togglePayment,
  completeCustomer,
  deleteCustomer,
  user,
  onLogout
}) {
  const [formData, setFormData] = useState({
    selectedZone: '', // For Blue mode - zone selection
    selectedItem: '', // For Blue mode - specific item
    hourlyRate: '',
    note: ''
  })
  const [zones, setZones] = useState(ZONES)
  const [showZoneModal, setShowZoneModal] = useState(false)
  const [products, setProducts] = useState(DEFAULT_PRODUCTS)
  const [showProductModal, setShowProductModal] = useState(false)
  const [salesForm, setSalesForm] = useState({ productId: '', quantity: 1, added_by: '', note: '' })
  const [productHistory, setProductHistory] = useState([])
  const { setActiveZone } = useTheme()
  const [, setUpdateTrigger] = useState(0)
  const [notifications, setNotifications] = useState([])
  const [notifOpen, setNotifOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const audioRef = useRef(null)
  const alarmTimeoutRef = useRef(null)
  const notificationsRef = useRef([])

  // Set active zone for theme
  useEffect(() => { setActiveZone('blue') }, [setActiveZone])

  // Pre-fill added_by from logged-in user
  useEffect(() => {
    if (user?.displayName) {
      setSalesForm(prev => ({ ...prev, added_by: user.displayName }))
    }
  }, [user])

  // Keep notifications ref in sync
  useEffect(() => {
    notificationsRef.current = notifications
  }, [notifications])

  // Force re-render every 500ms for real-time cost calculation
  useEffect(() => {
    const interval = setInterval(() => {
      setUpdateTrigger(prev => prev + 1)
    }, 500)
    return () => clearInterval(interval)
  }, [])

  const playBeep = useCallback(() => {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('/Voice.mp3')
        audioRef.current.volume = 1.0
      }
      // Stop any current playback and restart
      audioRef.current.currentTime = 0
      const playPromise = audioRef.current.play()
      if (playPromise !== undefined) {
        playPromise.catch(err => console.warn('Play failed', err))
      }
    } catch (err) {
      console.warn('Audio play failed', err)
    }
  }, [])

  // Pre-load audio on first user interaction
  useEffect(() => {
    const preloadAudio = () => {
      try {
        if (!audioRef.current) {
          audioRef.current = new Audio('/Voice.mp3')
          audioRef.current.volume = 1.0
          audioRef.current.load()
        }
      } catch (err) {
        console.warn('Audio preload failed', err)
      }
    }

    window.addEventListener('click', preloadAudio, { once: true })
    return () => window.removeEventListener('click', preloadAudio)
  }, [])

  // Fetch CALL_STAFF notifications
  useEffect(() => {
    let channel
    let pollTimer
    let active = true

    const fetchNotifications = async () => {
      if (!supabase || !active) return
      const { data, error } = await supabase
        .from('juthazoneb_activity_logs')
        .select('*')
        .eq('action_type', 'CALL_STAFF')
        .is('resolved_at', null)
        .order('created_at', { ascending: false })
        .limit(20)
      if (!error && data && active) {
        setNotifications(data)
      }
    }

    const handleUpsert = (record) => {
      if (!record) return
      if (record.resolved_at) {
        setNotifications(prev => prev.filter(n => n.id !== record.id))
        return
      }
      setNotifications(prev => [record, ...prev.filter(n => n.id !== record.id)].slice(0, 20))
      playBeep()
    }

    fetchNotifications()
    pollTimer = setInterval(fetchNotifications, 5000)

    if (supabase) {
      channel = supabase
        .channel('call-staff-notify-blue')
        .on('postgres_changes', {
          event: 'insert',
          schema: 'public',
          table: 'juthazoneb_activity_logs',
          filter: 'action_type=eq.CALL_STAFF'
        }, (payload) => handleUpsert(payload.new))
        .on('postgres_changes', {
          event: 'update',
          schema: 'public',
          table: 'juthazoneb_activity_logs',
          filter: 'action_type=eq.CALL_STAFF'
        }, (payload) => handleUpsert(payload.new))
        .subscribe()
    }

    return () => {
      active = false
      if (pollTimer) clearInterval(pollTimer)
      if (channel) channel.unsubscribe()
    }
  }, [playBeep])

  // Keep alarm sounding while there are pending notifications
  useEffect(() => {
    if (notifications.length === 0) {
      // Stop audio when no notifications
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
      if (alarmTimeoutRef.current) {
        clearTimeout(alarmTimeoutRef.current)
        alarmTimeoutRef.current = null
      }
      return
    }

    const scheduleNextBeep = () => {
      if (!audioRef.current) {
        playBeep()
        return
      }

      const duration = audioRef.current.duration || 2
      const delay = (duration + 2.5) * 1000 // Wait for sound to finish + 2.5s

      alarmTimeoutRef.current = setTimeout(() => {
        // Use ref to check current notifications state
        if (notificationsRef.current.length > 0) {
          playBeep()
          scheduleNextBeep()
        }
      }, delay)
    }

    playBeep()
    scheduleNextBeep()

    return () => {
      if (alarmTimeoutRef.current) {
        clearTimeout(alarmTimeoutRef.current)
        alarmTimeoutRef.current = null
      }
    }
  }, [notifications.length, playBeep])

  const handleResolveNotification = async (notif) => {
    try {
      setNotifications(prev => prev.filter(n => n.id !== notif.id))
      if (supabase) {
        await supabase
          .from('juthazoneb_activity_logs')
          .update({
            resolved_at: new Date().toISOString()
          })
          .eq('id', notif.id)
      }
      if (user?.username) {
        await logActivityBlue(
          user.username,
          'CALL_STAFF_HANDLED',
          `ดำเนินการเรียกพนักงานแล้ว: ${notif.description || ''}`,
          { source: 'admin_dashboard_blue', ref_id: notif.id }
        )
      }
    } catch (err) {
      console.error('Failed to resolve notification', err)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    // Blue mode only
    if (formData.selectedZone && formData.selectedItem && formData.hourlyRate) {
      const zone = ZONES[formData.selectedZone]
      const item = zone.items.find(i => i.id === formData.selectedItem)
      const roomName = `${zone.label} - ${item.label}`

      addCustomer({
        name: roomName,
        room: formData.selectedItem,
        hourlyRate: parseFloat(formData.hourlyRate),
        note: formData.note
      })
      setFormData({ selectedZone: '', selectedItem: '', hourlyRate: '', note: '' })
    }
  }

  // Calculate real-time cost for each customer (Blue-only)
  const displayCustomers = customers.map(customer => {
    const rawCost = calculateCostBlue(
      customer.start_time,
      customer.hourly_rate,
      customer.total_pause_duration,
      customer.pause_time,
      customer.is_running
    )
    const pricing = applySpecialPricing(
      customer.room,
      rawCost,
      customer.start_time,
      customer.total_pause_duration,
      customer.pause_time,
      customer.is_running,
      customer.hourly_rate
    )
    const elapsedTime = formatElapsedTime(
      customer.start_time,
      customer.total_pause_duration,
      customer.pause_time,
      customer.is_running
    )
    return {
      ...customer,
      currentCost: pricing.finalCost,
      originalCost: pricing.originalCost,
      hasDiscount: pricing.hasSpecialPrice,
      discountAmount: pricing.discountAmount,
      promoLabel: pricing.promoLabel,
      elapsedTime
    }
  })

  const customerViewUrl = `${window.location.origin}/blue/customer`

  // Handle edit mode
  const startEdit = (customer) => {
    setEditingId(customer.id)
    setEditForm({
      hourlyRate: customer.hourly_rate || 0,
      note: customer.note || ''
    })
  }

  const saveEdit = async (customerId) => {
    const customer = customers.find(c => c.id === customerId)
    if (!customer) return

    try {
      const updateData = {
        note: editForm.note || '',
        hourly_rate: parseFloat(editForm.hourlyRate) || 0
      }

      if (supabase) {
        const { error: updateError } = await supabase
          .from('juthazoneb_customers')
          .update(updateData)
          .eq('id', customerId)

        if (updateError) {
          console.error('Error updating customer:', updateError)
          alert('ไม่สามารถบันทึกได้: ' + updateError.message)
          return
        }

        const historyUpdateData = {
          ...updateData,
          updated_at: new Date().toISOString()
        }

        const { error: historyError } = await supabase
          .from('juthazoneb_customers_history')
          .update(historyUpdateData)
          .eq('id', customerId)

        if (historyError) {
          console.warn('Warning: History table update failed', historyError)
        }

        if (user?.username) {
          await logActivityBlue(
            user.username,
            'UPDATE_CUSTOMER',
            `อัปเดตลูกค้า: ${customer.name}`,
            { customer_id: customerId, updates: updateData }
          )
        }
      }

      alert('บันทึกสำเร็จ')
      setEditingId(null)
      setEditForm({})
    } catch (err) {
      console.error('Save edit error:', err)
      alert('เกิดข้อผิดพลาด: ' + err.message)
    }
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({})
  }

  // ปรับเวลาเริ่ม +/- นาที
  const adjustTime = async (customerId, minutesDelta) => {
    if (!supabase) return
    const customer = customers.find(c => c.id === customerId)
    if (!customer) return

    const newStartTime = new Date(
      new Date(customer.start_time).getTime() - minutesDelta * 60 * 1000
    ).toISOString()

    try {
      const { error } = await supabase
        .from('juthazoneb_customers')
        .update({ start_time: newStartTime, updated_at: new Date().toISOString() })
        .eq('id', customerId)
      if (error) throw error

      await supabase
        .from('juthazoneb_customers_history')
        .update({ start_time: newStartTime, updated_at: new Date().toISOString() })
        .eq('customer_id', customerId)
        .eq('end_reason', 'in_progress')
    } catch (err) {
      console.error('adjustTime error:', err)
      alert('ไม่สามารถปรับเวลาได้: ' + err.message)
    }
  }

  // Handle zone update
  const handleZoneUpdate = (updatedZones) => {
    setZones(updatedZones)
    console.log('Zones updated:', updatedZones)
    // In a real app, you'd save this to database
  }

  // Handle customer update
  const handleCustomerUpdate = (customerId, updates) => {
    console.log('Customer update:', customerId, updates)
    // In a real app, you'd update the database and refresh the customer
    // For now, just show that it's logged
  }

  // Handle customer delete
  const handleCustomerDelete = (customerId) => {
    const customer = customers.find(c => c.id === customerId)
    if (customer) {
      deleteCustomer(customerId)
    }
  }

  // PRODUCT MANAGEMENT
  const handleProductUpdate = (updated) => {
    setProducts(updated)
  }

  const recordSale = async () => {
    const prod = products.find(p => p.id === salesForm.productId)
    if (!prod) return
    try {
      const quantity = salesForm.quantity || 1
      const total = prod.price * quantity
      if (supabase) {
        await supabase.from('historyforproduct').insert([{ 
          product_name: prod.name,
          product_price: prod.price,
          quantity,
          total_price: total,
          added_by: salesForm.added_by || user?.displayName || null,
          note: salesForm.note || null
        }])
      }
      alert(`บันทึกการขาย ${prod.name} x${quantity}`)
      setSalesForm(prev => ({ productId: '', quantity: 1, added_by: prev.added_by, note: '' }))
      fetchProductHistory()
    } catch (err) {
      console.error('Record sale error', err)
      alert('ไม่สามารถบันทึกการขายได้')
    }
  }

  const fetchProductHistory = async () => {
    if (!supabase) return
    try {
      const { data, error } = await supabase
        .from('historyforproduct')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      setProductHistory(data || [])
    } catch (err) {
      console.error('Error fetching product history', err)
    }
  }

  useEffect(() => {
    fetchProductHistory()
  }, [])

  return (
    <div className="min-h-screen jz-bg p-3 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6 md:mb-8 relative">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white drop-shadow-2xl mb-2 slide-up">
            🔵 JUTHAZONE BLUE 🔵
          </h1>
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-white/90 drop-shadow-lg font-semibold">
            ระบบคำนวณราคาตามเวลาจริง (Pro-rated)
          </p>
          {user && (
            <div className="absolute top-0 right-0 flex items-center gap-3">
              <div className="bg-white/10 text-white font-bold px-4 py-2 rounded-xl text-xs md:text-sm shadow-lg border border-white/20">
                👤 {user.displayName}
              </div>
              <button
                onClick={onLogout}
                className="bg-red-500 hover:bg-red-600 text-white font-bold px-4 py-2 rounded-xl text-xs md:text-sm shadow-lg transform hover:scale-105 active:scale-95 transition-all duration-300"
              >
                🚪 ออกจากระบบ
              </button>
            </div>
          )}
          {/* Notification badge */}
          <div className="absolute top-0 left-0 flex items-center gap-2">
            <button
              onClick={() => setNotifOpen(prev => !prev)}
              className="bg-white/90 text-blue-700 font-bold px-3 py-2 rounded-xl text-xs md:text-sm shadow-lg flex items-center gap-2 hover:shadow-xl transform hover:scale-105 active:scale-95 transition-all duration-300"
            >
              🛎️ การแจ้งเตือน
              {notifications.length > 0 && (
                <span className="bg-red-500 text-white rounded-full px-2 py-0.5 text-xs font-bold">{notifications.length}</span>
              )}
            </button>
          </div>
          <div className="mt-4 flex flex-col sm:flex-row justify-center gap-3 flex-wrap">
            <button
              onClick={() => setShowZoneModal(true)}
              className="inline-block bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-6 rounded-xl shadow-lg jz-glow-hover transform hover:scale-105 transition-all duration-300 border border-purple-300"
            >
              ⚙️ จัดการโซน
            </button>
            <button
              onClick={() => setShowProductModal(true)}
              className="inline-block bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-6 rounded-xl shadow-lg jz-glow-hover transform hover:scale-105 transition-all duration-300 border border-yellow-300"
            >
              📦 จัดการสินค้า
            </button>
            <a
              href="/blue/history"
              className="inline-block bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-6 rounded-xl shadow-lg jz-glow-hover transform hover:scale-105 transition-all duration-300 border border-white/20"
            >
              📊 ดูประวัติการใช้งาน
            </a>
            <a
              href="/blue/product-history"
              className="inline-block bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-6 rounded-xl shadow-lg jz-glow-hover transform hover:scale-105 transition-all duration-300 border border-white/20"
            >
              🛒 ประวัติการขาย
            </a>
            <a
              href="/blue/analytics"
              className="inline-block bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-6 rounded-xl shadow-lg jz-glow-hover transform hover:scale-105 transition-all duration-300 border border-white/20"
            >
              📈 Analytics
            </a>
            <a
              href="/"
              className="inline-block bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-6 rounded-xl shadow-lg jz-glow-hover transform hover:scale-105 transition-all duration-300 border border-white/20"
            >
              🏠 กลับหน้าหลัก
            </a>
          </div>
        </div>

        {/* Notification panel */}
        {notifOpen && (
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-4 md:p-6 mb-6 border-3 jz-card-border" style={{ borderColor: 'var(--jz-card-border)' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg md:text-xl font-bold jz-text-primary">📞 การเรียกพนักงาน</h2>
              <button
                onClick={() => setNotifications([])}
                className="text-sm text-gray-500 hover:text-gray-700 font-semibold"
              >
                เคลียร์ทั้งหมด
              </button>
            </div>
            {notifications.length === 0 ? (
              <p className="text-gray-500">ไม่มีการแจ้งเตือน</p>
            ) : (
              <div className="grid gap-3">
                {notifications.map(notif => {
                  const created = notif.created_at ? new Date(notif.created_at) : null
                  const data = notif.data_changed || {}
                  return (
                    <div key={notif.id} className="border-2 rounded-xl p-3 flex flex-col gap-1 jz-row-alt" style={{ borderColor: 'var(--jz-card-border)' }}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold jz-text-primary">{data.room || 'ห้องไม่ระบุ'}</span>
                        <span className="text-xs text-gray-500">{created ? created.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                      </div>
                      <div className="text-sm text-gray-800 font-semibold">{notif.description || 'เรียกพนักงาน'}</div>
                      {data.note && <div className="text-sm text-gray-600">📝 {data.note}</div>}
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleResolveNotification(notif)}
                          className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-bold"
                        >ทำแล้ว</button>
                        <button
                          onClick={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))}
                          className="px-3 py-1.5 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg text-sm font-bold"
                        >ปิด</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
          {/* Add Customer Form */}
          <div className="lg:col-span-2 bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl shadow-card p-4 md:p-6 transform hover:scale-[1.01] transition-all duration-300 jz-card-border slide-up">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg md:text-2xl lg:text-3xl font-bold jz-text-gradient">
                ➕ เพิ่มลูกค้า
              </h2>
              <div className="flex gap-2">
                <div className="px-3 py-1.5 rounded-lg text-sm font-bold bg-blue-500 text-white">🔵 โหมด Blue</div>
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
              {/* Zone Selection */}
              <div>
                <label className="block text-gray-700 font-semibold mb-1.5 md:mb-2 text-sm md:text-base">🎯 เลือกโซน</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {Object.entries(ZONES).map(([key, zone]) => (
                    <label key={key} className="flex items-center gap-2 p-2 border-2 rounded-lg cursor-pointer hover:bg-blue-50 transition-all"
                           style={{ borderColor: formData.selectedZone === key ? 'var(--jz-primary)' : '#e5e7eb' }}>
                      <input
                        type="radio"
                        name="zone"
                        value={key}
                        checked={formData.selectedZone === key}
                        onChange={(e) => {
                          setFormData({ ...formData, selectedZone: e.target.value, selectedItem: '' })
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-semibold">{zone.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Item Selection */}
              {formData.selectedZone && (
                <div>
                  <label className="block text-gray-700 font-semibold mb-1.5 md:mb-2 text-sm md:text-base">📍 เลือกรายการ</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ZONES[formData.selectedZone].items.map(item => (
                      <label key={item.id} className="flex items-center gap-2 p-2 border-2 rounded-lg cursor-pointer hover:bg-blue-50 transition-all"
                             style={{ borderColor: formData.selectedItem === item.id ? 'var(--jz-primary)' : '#e5e7eb' }}>
                        <input
                          type="radio"
                          name="item"
                          value={item.id}
                          checked={formData.selectedItem === item.id}
                            onChange={(e) => {
                              setFormData({ 
                                ...formData, 
                                selectedItem: e.target.value,
                                hourlyRate: item.defaultPrice // Auto-fill hourly rate with default price
                              })
                            }}
                          className="w-4 h-4"
                        />
                        <span className="text-sm font-semibold">{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Blue Mode Fields */}
              <>
                <div>
                  <label className="block text-gray-700 font-semibold mb-1.5 md:mb-2 text-sm md:text-base">
                    💰 ราคาต่อชั่วโมง (บาท)
                  </label>
                  <input
                    type="number"
                    value={formData.hourlyRate}
                    onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                    className="w-full px-3 py-2 md:px-4 md:py-2 border-2 jz-input rounded-lg focus:outline-none text-sm md:text-base"
                    placeholder={formData.selectedItem ? `ราคาเริ่มต้น: ${formData.hourlyRate}` : "เลือกรายการก่อน"}
                    min="0"
                    step="0.01"
                  />
                  <p className="text-xs md:text-sm text-gray-500 mt-1">
                    💡 ระบบจะคำนวณตามเวลาจริง (Pro-rated)
                  </p>
                </div>
              </>

              {/* (Red mode removed) */}

              {/* Common Note Field */}
              <div>
                <label className="block text-gray-700 font-semibold mb-1.5 md:mb-2 text-sm md:text-base">📝 Note (ไม่บังคับ)</label>
                <textarea
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="w-full px-3 py-2 md:px-4 md:py-2 border-2 jz-input rounded-lg focus:outline-none text-sm md:text-base h-20 resize-none"
                  placeholder="เช่น เล่นแบดมินตัน, ร้อนจัด ฯลฯ"
                />
              </div>

              <button
                type="submit"
                className="w-full jz-btn font-bold py-3 md:py-4 px-6 rounded-xl transform hover:scale-105 active:scale-95 transition-all duration-300 shadow-2xl text-sm md:text-base"
              >
                เพิ่มลูกค้า 🎯
              </button>
            </form>
          </div>

          {/* QR Code Section */}
          <div className="bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl shadow-card p-4 md:p-6 flex flex-col items-center justify-center jz-card-border transform hover:scale-105 jz-glow-hover transition-all duration-300 slide-up-1">
            <h2 className="text-lg md:text-xl font-bold jz-text-gradient mb-3 md:mb-4 text-center">
              📱 QR Code สำหรับลูกค้า
            </h2>
            <div className="bg-white p-3 md:p-4 rounded-xl border-3 md:border-4 shadow-lg hover:shadow-2xl transition-all duration-300" style={{ borderColor: 'var(--jz-primary)' }}>
              <QRCodeSVG value={customerViewUrl} size={150} level="H" className="md:w-[180px] md:h-[180px]" />
            </div>
            <p className="text-xs md:text-sm text-gray-600 mt-3 md:mt-4 text-center font-semibold">สแกนเพื่อดูราคาตามเวลาจริง</p>
          </div>
        </div>
        {/* Sale Product Form */}
        <div className="lg:col-span-2 bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl shadow-card p-4 md:p-6 transform hover:scale-[1.01] transition-all duration-300 jz-card-border slide-up">
          <h2 className="text-lg md:text-2xl font-bold jz-text-gradient mb-4">🛒 บันทึกการขายสินค้า</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select
              value={salesForm.productId}
              onChange={e => setSalesForm({ ...salesForm, productId: e.target.value })}
              className="col-span-2 px-3 py-2 border-2 rounded-lg"
            >
              <option value="">เลือกสินค้า</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} - ฿{p.price}</option>
              ))}
            </select>
            <input
              type="number"
              value={salesForm.quantity}
              onChange={e => setSalesForm({ ...salesForm, quantity: parseInt(e.target.value) || 1 })}
              className="px-3 py-2 border-2 rounded-lg w-full"
              min="1"
              placeholder="จำนวน"
            />
            <div className="col-span-3">
              <label className="block text-gray-600 font-semibold mb-1 text-sm">👤 พนักงาน</label>
              <input
                type="text"
                value={salesForm.added_by}
                onChange={e => setSalesForm({ ...salesForm, added_by: e.target.value })}
                className="w-full px-3 py-2 border-2 rounded-lg focus:outline-none focus:border-blue-400"
                placeholder="ชื่อพนักงาน"
              />
            </div>
            <div className="col-span-3">
              <label className="block text-gray-600 font-semibold mb-1 text-sm">📝 หมายเหตุ (ไม่บังคับ)</label>
              <input
                type="text"
                value={salesForm.note}
                onChange={e => setSalesForm({ ...salesForm, note: e.target.value })}
                className="w-full px-3 py-2 border-2 rounded-lg focus:outline-none focus:border-blue-400"
                placeholder="หมายเหตุ"
              />
            </div>
            <button
              onClick={recordSale}
              className="col-span-3 bg-green-500 hover:bg-green-600 text-white font-bold py-2 rounded-xl w-full"
            >บันทึกการขาย</button>
          </div>
        </div>

        {/* Customer List */}
        <div className="bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl shadow-card p-4 md:p-6 jz-card-border slide-up-2">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3 md:mb-4">
            <h2 className="text-xl md:text-2xl font-bold jz-text-gradient flex items-center gap-2">
              📋 รายการลูกค้าทั้งหมด
              <span className="inline-flex items-center justify-center jz-badge text-sm font-bold px-2.5 py-0.5 rounded-full">{customers.length}</span>
            </h2>
          </div>
          
          {customers.length === 0 ? (
            <div className="text-center py-8 md:py-12 text-gray-400">
              <div className="text-5xl md:text-6xl mb-3 md:mb-4 animate-bounce-slow">🔵</div>
              <p className="text-xl md:text-2xl font-bold">ยังไม่มีลูกค้า</p>
              <p className="text-xs md:text-sm mt-2">เพิ่มลูกค้าใหม่เพื่อเริ่มจับเวลา</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 md:mx-0">
              <div className="inline-block min-w-full align-middle">
                <div className="overflow-hidden">
                  <table className="min-w-full border-separate border-spacing-y-1">
                    <thead>
                      <tr className="jz-table-header text-white shadow-lg">
                        <th className="px-2 md:px-4 py-2.5 md:py-3.5 text-left rounded-tl-xl text-xs md:text-sm font-bold tracking-wide">ชื่อ</th>
                        <th className="px-2 md:px-4 py-2.5 md:py-3.5 text-left text-xs md:text-sm font-bold tracking-wide">ห้อง</th>
                        <th className="px-2 md:px-4 py-2.5 md:py-3.5 text-center text-xs md:text-sm font-bold tracking-wide">🕐 เริ่ม</th>
                        <th className="px-2 md:px-4 py-2.5 md:py-3.5 text-center text-xs md:text-sm font-bold tracking-wide">⏱️ เวลาใช้</th>
                        <th className="px-2 md:px-4 py-2.5 md:py-3.5 text-center text-xs md:text-sm font-bold tracking-wide">💰 ราคา</th>
                        <th className="px-2 md:px-4 py-2.5 md:py-3.5 text-center text-xs md:text-sm font-bold tracking-wide hidden md:table-cell">📝 Note</th>
                        <th className="px-2 md:px-4 py-2.5 md:py-3.5 text-center text-xs md:text-sm font-bold tracking-wide hidden lg:table-cell">สถานะ</th>
                        <th className="px-2 md:px-4 py-2.5 md:py-3.5 text-center rounded-tr-xl text-xs md:text-sm font-bold tracking-wide">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayCustomers.map((customer, index) => (
                        <tr
                          key={customer.id}
                          className={`fade-in rounded-lg ${
                            index % 2 === 0 ? 'jz-row-alt' : 'bg-white'
                          } jz-row-hover transition-all duration-200`}
                          style={{ animationDelay: `${index * 0.05}s` }}
                        >
                          <td className="px-2 md:px-4 py-2 md:py-3 font-semibold text-xs md:text-base">{customer.name}</td>
                          <td className="px-2 md:px-4 py-2 md:py-3">
                            <span className="inline-block jz-badge px-2 md:px-3 py-0.5 md:py-1 rounded-full text-xs md:text-sm">
                              {customer.room}
                            </span>
                          </td>
                          <td className="px-2 md:px-4 py-2 md:py-3 text-center text-xs md:text-sm">
                            <div className="rounded-lg p-1.5 inline-block jz-badge border-2" style={{ borderColor: 'var(--jz-primary)' }}>
                              <p className="font-semibold jz-text-primary">{formatTimeDisplay(customer.start_time)}</p>
                            </div>
                          </td>
                          <td className="px-2 md:px-4 py-2 md:py-3 text-center">
                            <div>
                              <span className="inline-block font-bold text-lg md:text-xl text-cyan-600">
                                {customer.elapsedTime}
                              </span>
                              {customer.hourly_rate && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {customer.hourly_rate} บาท/ชม.
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-2 md:px-4 py-2 md:py-3 text-center">
                            {editingId === customer.id ? (
                              <div className="flex gap-2 justify-center items-center">
                                  <input
                                    type="number"
                                    value={editForm.hourlyRate || 0}
                                    onChange={(e) => setEditForm({ ...editForm, hourlyRate: e.target.value })}
                                    className="w-20 px-2 py-1 border rounded text-sm"
                                    step="0.01"
                                    min="0"
                                  />
                              </div>
                            ) : (
                              <div className={`inline-block rounded-xl px-3 py-2 border-2 ${
                                customer.hasDiscount
                                  ? 'bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-400'
                                  : 'bg-gradient-to-r from-green-100 to-emerald-100 border-green-400'
                              }`}>
                                {customer.hasDiscount && (
                                  <div className="text-[10px] text-orange-600 font-bold mb-0.5 whitespace-nowrap">
                                    {customer.promoLabel}
                                  </div>
                                )}
                                <span className={`font-bold text-xl md:text-2xl ${customer.hasDiscount ? 'text-orange-600' : 'text-green-700'}`}>
                                  ฿{customer.currentCost.toFixed(2)}
                                </span>
                                {customer.hasDiscount && (
                                  <div className="text-[10px] text-gray-400 line-through">
                                    ฿{customer.originalCost.toFixed(2)}
                                  </div>
                                )}
                                {customer.is_running === false && (
                                  <div className="text-xs text-orange-600 font-semibold mt-1">⏸️ หยุดชั่วคราว</div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-2 md:px-4 py-2 md:py-3 text-center hidden md:table-cell">
                            {editingId === customer.id ? (
                              <input
                                type="text"
                                value={editForm.note || ''}
                                onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                                className="w-full px-2 py-1 border rounded text-xs"
                                placeholder="Note"
                              />
                            ) : (
                              <span className="inline-block jz-badge px-2 py-1 rounded text-xs max-w-[100px] truncate" title={customer.note || 'ไม่มี'}>
                                {customer.note || '-'}
                              </span>
                            )}
                          </td>
                          <td className="px-2 md:px-4 py-2 md:py-3 text-center hidden lg:table-cell">
                            <span
                              className={`inline-block px-2 md:px-3 py-0.5 md:py-1 rounded-full text-xs md:text-sm font-bold ${
                                customer.is_paid
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {customer.is_paid ? '✅ จ่ายแล้ว' : '❌ ยังไม่จ่าย'}
                            </span>
                          </td>
                          <td className="px-2 md:px-4 py-2 md:py-3">
                            <div className="flex flex-wrap gap-1 md:gap-2 justify-center">
                              {editingId === customer.id ? (
                                <>
                                  <button
                                    onClick={() => saveEdit(customer.id)}
                                    className="px-2 md:px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold text-xs md:text-sm"
                                  >
                                    ✅ บันทึก
                                  </button>
                                  <button
                                    onClick={cancelEdit}
                                    className="px-2 md:px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold text-xs md:text-sm"
                                  >
                                    ❌ ยกเลิก
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => startEdit(customer)}
                                    className="px-2 md:px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold text-xs md:text-sm"
                                    title="แก้ไขราคาและหมายเหตุ"
                                  >
                                    ✏️ แก้ไข
                                  </button>
                                  <button
                                    onClick={() => adjustTime(customer.id, -5)}
                                    className="px-2 md:px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-semibold text-xs md:text-sm"
                                    title="ลดเวลา 5 นาที"
                                  >
                                    −5
                                  </button>
                                  <button
                                    onClick={() => adjustTime(customer.id, 5)}
                                    className="px-2 md:px-3 py-1 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-semibold text-xs md:text-sm"
                                    title="เพิ่มเวลา 5 นาที"
                                  >
                                    +5
                                  </button>
                                  <button
                                    onClick={() => toggleTimer(customer.id)}
                                    className={`px-2 md:px-3 py-1 rounded-lg text-white font-semibold text-xs md:text-sm ${
                                      customer.is_running
                                        ? 'bg-orange-500 hover:bg-orange-600'
                                        : 'bg-green-500 hover:bg-green-600'
                                    }`}
                                    title={customer.is_running ? 'หยุดชั่วคราว' : 'เริ่มต่อ'}
                                  >
                                    {customer.is_running ? '⏸️ หยุด' : '▶️ เริ่ม'}
                                  </button>
                                  <button
                                    onClick={() => togglePayment(customer.id)}
                                    className={`px-2 md:px-3 py-1 rounded-lg text-white font-semibold text-xs md:text-sm ${
                                      customer.is_paid
                                        ? 'bg-gray-500 hover:bg-gray-600'
                                        : 'bg-green-500 hover:bg-green-600'
                                    }`}
                                    title="สลับสถานะการชำระเงิน"
                                  >
                                    💰
                                  </button>
                                  <button
                                    onClick={() => {
                                      const discountNote = customer.hasDiscount
                                        ? `\n🎉 ส่วนลดบอร์ดเกม 50%: -฿${customer.discountAmount.toFixed(2)}\nราคาเต็ม: ฿${customer.originalCost.toFixed(2)}`
                                        : ''
                                      if (confirm(`✅ เสร็จสิ้นการใช้งานของ "${customer.name}"?\n\nราคารวม: ฿${customer.currentCost.toFixed(2)}${discountNote}\nจะบันทึกไว้ในประวัติ`)) {
                                        completeCustomer(customer.id)
                                      }
                                    }}
                                    className="px-2 md:px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold text-xs md:text-sm"
                                    title="เสร็จสิ้นและบันทึกประวัติ"
                                  >
                                    ✅
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm(`ต้องการลบ "${customer.name}" ใช่หรือไม่?\nจะบันทึกไว้ในประวัติ`)) {
                                        deleteCustomer(customer.id)
                                      }
                                    }}
                                    className="px-2 md:px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold text-xs md:text-sm"
                                    title="ลบลูกค้า"
                                  >
                                    🗑️
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Modals */}
      <ZoneManagementModal
        isOpen={showZoneModal}
        onClose={() => setShowZoneModal(false)}
        zones={zones}
        onUpdate={handleZoneUpdate}
      />
      <ProductManagementModal
        isOpen={showProductModal}
        onClose={() => setShowProductModal(false)}
        products={products}
        onUpdate={handleProductUpdate}
      />
      
      <ThemePicker zone="blue" />
    </div>
  )
}

export default AdminDashboardBlue

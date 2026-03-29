import { useState, useEffect, useRef, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { formatTimeDisplay, getDurationText, calculateTimeRemaining } from '../utils/timeFormat'
import supabase from '../firebase'
import { logActivity } from '../utils/authUtils'
import ComputerZoneEntry from './ComputerZoneEntry'
import ComputerZoneManager from './ComputerZoneManager'
import { useTheme } from '../contexts/ThemeContext'
import ThemePicker from './ThemePicker'

function AdminDashboard({
  customers,
  addCustomer,
  toggleTimer,
  addTime,
  subtractTime,
  extendTime,
  togglePayment,
  deleteCustomer,
  user,
  onLogout
}) {
  const [formData, setFormData] = useState({
    name: '',
    room: 'ชั้น 2 ห้อง VIP',
    minutes: '',
    cost: '',
    note: '',
    paymentMethod: 'transfer', // เพิ่ม payment method (transfer หรือ cash)
    shift: 'all' // เพิ่มกะ
  })
  const [, setUpdateTrigger] = useState(0) // Trigger to refresh display
  const [notifications, setNotifications] = useState([])
  const [notifOpen, setNotifOpen] = useState(false)
  const [showComputerZoneManager, setShowComputerZoneManager] = useState(false) // Modal state
  const [completionConfirm, setCompletionConfirm] = useState(null) // Modal state สำหรับยืนยันสิ้นสุด
  const [computerEntries, setComputerEntries] = useState([]) // รายการคอมพิวเตอร์วันนี้
  const [selectedComputerShift, setSelectedComputerShift] = useState('all') // กะที่เลือก
  const [loadingComputer, setLoadingComputer] = useState(false)
  const [showComputerTable, setShowComputerTable] = useState(false) // Toggle Computer Zone Table
  const [vipEntries, setVipEntries] = useState([]) // รายการห้อง VIP วันนี้
  const [selectedVipShift, setSelectedVipShift] = useState('all') // กะที่เลือกสำหรับ VIP
  const [loadingVip, setLoadingVip] = useState(false)
  const audioRef = useRef(null)
  const alarmTimeoutRef = useRef(null)
  const notificationsRef = useRef([])
  const { setActiveZone } = useTheme()

  // Set active zone on mount
  useEffect(() => { setActiveZone('red') }, [])

  // Keep notifications ref in sync
  useEffect(() => {
    notificationsRef.current = notifications
  }, [notifications])

  // Load today's computer entries
  useEffect(() => {
    loadComputerEntries()
    
    // Subscribe to realtime changes
    if (!supabase) return
    
    const channel = supabase
      .channel('computer_zone_admin_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'computer_zone_history' },
        () => loadComputerEntries()
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Load today's VIP room entries
  useEffect(() => {
    loadVipEntries()
    
    // Subscribe to realtime changes
    if (!supabase) return
    
    const channel = supabase
      .channel('vip_room_admin_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customers_history' },
        () => loadVipEntries()
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const loadComputerEntries = async () => {
    if (!supabase) return
    
    try {
      setLoadingComputer(true)
      const today = new Date().toISOString().split('T')[0]
      
      const { data, error } = await supabase
        .from('computer_zone_history')
        .select('*')
        .eq('session_date', today)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setComputerEntries(data || [])
    } catch (error) {
      console.error('Error loading computer entries:', error)
    } finally {
      setLoadingComputer(false)
    }
  }

  const getFilteredComputerEntries = () => {
    if (selectedComputerShift === 'all') return computerEntries
    return computerEntries.filter(entry => entry.shift === selectedComputerShift)
  }

  const loadVipEntries = async () => {
    if (!supabase) return
    
    try {
      setLoadingVip(true)
      const today = new Date().toISOString().split('T')[0]
      
      const { data, error } = await supabase
        .from('customers_history')
        .select('*')
        .eq('session_date', today)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setVipEntries(data || [])
    } catch (error) {
      console.error('Error loading VIP entries:', error)
    } finally {
      setLoadingVip(false)
    }
  }

  const getShiftFromTime = (timeStr) => {
    if (!timeStr) return 'all'
    const hour = parseInt(timeStr.split(':')[0])
    if (hour >= 10 && hour < 19) return '1'
    if (hour >= 19 || hour < 1) return '2'
    if (hour >= 1 && hour < 10) return '3'
    return 'all'
  }

  const getFilteredVipEntries = () => {
    if (selectedVipShift === 'all') return vipEntries
    return vipEntries.filter(entry => {
      const shift = getShiftFromTime(entry.start_time)
      return shift === selectedVipShift
    })
  }

  const shifts = {
    1: { name: 'เช้า-เย็น', start: '10:00', end: '19:00', color: 'bg-green-100 text-green-700' },
    2: { name: 'เย็น-ดึก', start: '19:00', end: '01:00', color: 'bg-orange-100 text-orange-700' },
    3: { name: 'ดึก-เช้า', start: '01:00', end: '10:00', color: 'bg-purple-100 text-purple-700' }
  }

  // Force re-render every 500ms to keep timer updated
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

  // Fetch CALL_STAFF logs, poll as fallback, and subscribe realtime
  useEffect(() => {
    let channel
    let pollTimer
    let active = true

    const fetchNotifications = async () => {
      if (!supabase || !active) return
      const { data, error } = await supabase
        .from('activity_logs')
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
        .channel('call-staff-notify')
        .on('postgres_changes', {
          event: 'insert',
          schema: 'public',
          table: 'activity_logs',
          filter: 'action_type=eq.CALL_STAFF'
        }, (payload) => handleUpsert(payload.new))
        .on('postgres_changes', {
          event: 'update',
          schema: 'public',
          table: 'activity_logs',
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
    // Stop audio immediately
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    if (alarmTimeoutRef.current) {
      clearTimeout(alarmTimeoutRef.current)
      alarmTimeoutRef.current = null
    }
    // Optimistic UI remove
    setNotifications(prev => prev.filter(n => n.id !== notif.id))
    try {
      if (supabase) {
        await supabase
          .from('activity_logs')
          .update({
            resolved_by: user?.username || 'admin',
            resolved_at: new Date().toISOString()
          })
          .eq('id', notif.id)
      }

      if (user?.username) {
        await logActivity(
          user.username,
          'CALL_STAFF_HANDLED',
          `ดำเนินการเรียกพนักงานแล้ว: ${notif.description || ''}`,
          { source: 'admin_dashboard', ref_id: notif.id }
        )
      }
    } catch (err) {
      console.error('Failed to resolve notification', err)
    }
  }

  const handleCompleteSession = async (customer) => {
    try {
      // Calculate actual duration
      const startTime = new Date(customer.startTime)
      const endTime = new Date()
      const durationMs = endTime - startTime
      const durationMinutes = (durationMs / (1000 * 60)).toFixed(2)

      // Get session_date from start_time
      const sessionDate = customer.startTime.split('T')[0]

      // Update existing history record from 'in_progress' to 'completed'
      if (supabase) {
        // อัพเดต record ที่มีอยู่แล้วแทนการสร้างใหม่
        const { error } = await supabase
          .from('customers_history')
          .update({
            end_time: endTime.toISOString(),
            duration_minutes: parseFloat(durationMinutes),
            is_paid: customer.isPaid,
            final_cost: customer.cost,
            note: customer.note || '',
            end_reason: 'completed',
            shift: customer.shift || 'all',
            payment_method: customer.payment_method || 'transfer',
            updated_at: endTime.toISOString()
          })
          .eq('customer_id', customer.id)
          .eq('end_reason', 'in_progress')

        if (error) {
          console.error('Error updating history:', error)
          alert('⚠️ ไม่สามารถอัพเดต history ได้: ' + error.message)
          return
        }
      }

      // Log activity
      if (user?.username) {
        await logActivity(
          user.username,
          'COMPLETE_SESSION',
          `สิ้นสุดเซสชั่น: ${customer.name} ใช้เวลา ${durationMinutes} นาที`,
          { 
            name: customer.name,
            room: customer.room,
            duration: durationMinutes,
            cost: customer.cost,
            is_paid: customer.isPaid
          },
          customer.id
        )
      }

      // Delete customer from active list
      await deleteCustomer(customer.id)
      
      console.log('✅ Customer removed from active list after completion')
      
      // Close modal
      setCompletionConfirm(null)
      
      alert(`✅ สิ้นสุด "${customer.name}" และบันทึกลง History แล้ว`)
    } catch (error) {
      console.error('Error completing session:', error)
      alert('❌ เกิดข้อผิดพลาด: ' + error.message)
    }
  }

  const openCompletionConfirm = (customer) => {
    const startTime = new Date(customer.startTime)
    const endTime = new Date()
    const durationMs = endTime - startTime
    const durationMinutes = Math.floor(durationMs / (1000 * 60))
    const durationSeconds = Math.floor((durationMs / 1000) % 60)

    setCompletionConfirm({
      customer,
      durationMinutes,
      durationSeconds
    })
  }

  const closeCompletionConfirm = () => {
    setCompletionConfirm(null)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (formData.name && formData.minutes && formData.cost) {
      addCustomer({
        name: formData.name,
        room: formData.room,
        minutes: parseInt(formData.minutes),
        cost: parseFloat(formData.cost),
        note: formData.note,
        payment_method: formData.paymentMethod, // เพิ่ม payment method
        shift: formData.shift || 'all' // เพิ่มกะ
      })
      setFormData({ name: '', room: 'ชั้น 2 ห้อง VIP', minutes: '', cost: '', note: '', paymentMethod: 'transfer', shift: 'all' })
    }
  }

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  // Calculate display time for each customer
  const displayCustomers = customers.map(customer => {
    const remaining = customer.isRunning && customer.expectedEndTime
      ? calculateTimeRemaining(customer.startTime, customer.expectedEndTime)
      : customer.timeRemaining || 0

    return {
      ...customer,
      displayTimeRemaining: remaining
    }
  })

  const customerViewUrl = `${window.location.origin}/customer`

  return (
    <div className="min-h-screen jz-bg p-3 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header with animation */}
        <div className="text-center mb-6 md:mb-8 animate-float relative">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white drop-shadow-2xl mb-2 slide-up">
            🔴 JUTHAZONE RED 🔴
          </h1>
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-white/90 drop-shadow-lg font-semibold">
            ระบบจัดการเวลาลูกค้า
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
          <div className="mt-4 flex flex-col sm:flex-row justify-center gap-3">
            <a
              href="/history"
              className="inline-block bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-6 rounded-xl shadow-lg jz-glow-hover transform hover:scale-105 transition-all duration-300 border border-white/20"
            >
              📊 ดูประวัติการใช้งาน
            </a>
            <a
              href="/analytics"
              className="inline-block bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-6 rounded-xl shadow-lg jz-glow-hover transform hover:scale-105 transition-all duration-300 border border-white/20"
            >
              📈 Analytics
            </a>
            <a
              href="/daily-summary"
              className="inline-block bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-6 rounded-xl shadow-lg jz-glow-hover transform hover:scale-105 transition-all duration-300 border border-white/20"
            >
              💰 สรุปยอดรายวัน
            </a>
          </div>
        </div>

        {/* Notification panel */}
        {notifOpen && (
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-4 md:p-6 mb-6 border-3 border-blue-300">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg md:text-xl font-bold text-blue-700">📞 การเรียกพนักงาน</h2>
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
                    <div key={notif.id} className="border-2 border-blue-200 rounded-xl p-3 flex flex-col gap-1 bg-blue-50">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-blue-700">{data.room || 'ห้องไม่ระบุ'}</span>
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

        {/* Completion Confirmation Modal */}
        {completionConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-3 z-50">
            <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 max-w-md w-full border-4 modal-in" style={{borderColor: 'var(--jz-primary)'}}>
              {/* Header */}
              <div className="text-center mb-6">
                <div className="text-5xl mb-4">🎯</div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
                  ยืนยันการสิ้นสุด
                </h2>
                <p className="text-gray-600 font-semibold">กรุณายืนยันว่าต้องการสิ้นสุดเซสชั่นนี้</p>
              </div>

              {/* Summary Info */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 md:p-6 mb-6 border-2 border-blue-200 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 font-semibold">👤 ชื่อลูกค้า:</span>
                  <span className="text-lg font-bold text-blue-600">{completionConfirm.customer.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 font-semibold">🏠 ห้อง:</span>
                  <span className="text-lg font-bold text-purple-600">{completionConfirm.customer.room}</span>
                </div>
                <div className="border-t border-blue-200 pt-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-700 font-semibold">⏱️ เวลาที่ใช้:</span>
                    <span className="text-lg font-bold text-orange-600">
                      {completionConfirm.durationMinutes} นาที {completionConfirm.durationSeconds} วินาที
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 font-semibold">💰 ค่าใช้จ่าย:</span>
                    <span className="text-lg font-bold text-green-600">฿{completionConfirm.customer.cost}</span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-gray-700 font-semibold">💳 สถานะ:</span>
                    <span className={`text-lg font-bold ${completionConfirm.customer.isPaid ? 'text-green-600' : 'text-red-600'}`}>
                      {completionConfirm.customer.isPaid ? '✅ จ่ายแล้ว' : '❌ ยังไม่จ่าย'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Warning Message */}
              <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-3 mb-6 text-center">
                <p className="text-yellow-800 font-semibold text-sm">
                  ⚠️ การกระทำนี้จะบันทึกลง History และลบออกจากรายการลูกค้าปัจจุบัน ไม่สามารถย้อนกลับได้!
                </p>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={closeCompletionConfirm}
                  className="px-4 py-3 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg font-bold text-sm md:text-base transition-all transform hover:scale-105 active:scale-95"
                >
                  ❌ ยกเลิก
                </button>
                <button
                  onClick={async () => {
                    try {
                      await handleCompleteSession(completionConfirm.customer)
                    } catch (error) {
                      console.error('Error completing session:', error)
                      alert('❌ เกิดข้อผิดพลาด: ' + error.message)
                    }
                  }}
                  className="px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-lg font-bold text-sm md:text-base transition-all transform hover:scale-105 active:scale-95 shadow-lg"
                >
                  ✅ ยืนยัน
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
          {/* Add Customer Form */}
          <div className="lg:col-span-2 bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl shadow-card p-4 md:p-6 transform hover:scale-[1.01] transition-all duration-300 border jz-card-border slide-up">
            <h2 className="text-lg md:text-2xl lg:text-3xl font-bold jz-text-gradient mb-3 md:mb-4">
              ➕ เพิ่มลูกค้าใหม่
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
              <div>
                <label className="block text-gray-700 font-semibold mb-1.5 md:mb-2 text-sm md:text-base">ชื่อลูกค้า</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 md:px-4 md:py-2 border-2 jz-input rounded-lg focus:outline-none text-sm md:text-base"
                  placeholder="กรอกชื่อลูกค้า"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1.5 md:mb-2 text-sm md:text-base">เลือกห้อง</label>
                <select
                  value={formData.room}
                  onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                  className="w-full px-3 py-2 md:px-4 md:py-2 border-2 jz-input rounded-lg focus:outline-none text-sm md:text-base"
                >
                  <option value="ชั้น 2 ห้อง VIP">ชั้น 2 ห้อง VIP</option>
                  <option value="ชั้น 3 ห้อง VIP KARAOKE">ชั้น 3 ห้อง VIP KARAOKE</option>
                  <option value="ชั้น 3 ห้อง Golf">ชั้น 3 Golf</option>
                  <option value="ชั้น 3 ห้อง Golf">ชั้น 4 VIP KARAOKE</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1.5 md:mb-2 text-sm md:text-base">ตั้งเวลา (นาที)</label>
                  <input
                    type="number"
                    value={formData.minutes}
                    onChange={(e) => setFormData({ ...formData, minutes: e.target.value })}
                    className="w-full px-3 py-2 md:px-4 md:py-2 border-2 jz-input rounded-lg focus:outline-none text-sm md:text-base"
                    placeholder="เช่น 60"
                    min="1"
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1.5 md:mb-2 text-sm md:text-base">ค่าใช้จ่าย (บาท)</label>
                  <input
                    type="number"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                    className="w-full px-3 py-2 md:px-4 md:py-2 border-2 jz-input rounded-lg focus:outline-none text-sm md:text-base"
                    placeholder="เช่น 100"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1.5 md:mb-2 text-sm md:text-base">💸 วิธีชำระเงิน</label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 md:px-4 md:py-2 border-2 jz-input rounded-lg focus:outline-none text-sm md:text-base"
                >
                  <option value="transfer">💸 เงินโอน (Transfer)</option>
                  <option value="cash">💸 เงินสด (Cash)</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1.5 md:mb-2 text-sm md:text-base">🔄 เลือกกะ (จำเป็น)</label>
                <select
                  value={formData.shift || 'all'}
                  onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                  className="w-full px-3 py-2 md:px-4 md:py-2 border-2 jz-input rounded-lg focus:outline-none text-sm md:text-base bg-white"
                >
                  <option value="all">ไม่ระบุกะ</option>
                  <option value="1">กะ 1 (10:00-19:00)</option>
                  <option value="2">กะ 2 (19:00-01:00)</option>
                  <option value="3">กะ 3 (01:00-10:00)</option>
                </select>
              </div>

              <div>
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
          <div className="bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl shadow-card p-4 md:p-6 flex flex-col items-center justify-center border jz-card-border transform hover:scale-105 jz-glow-hover transition-all duration-300 slide-up-1">
            <h2 className="text-lg md:text-xl font-bold jz-text-gradient mb-3 md:mb-4 animate-bounce-slow text-center">
              📱 QR Code สำหรับลูกค้า
            </h2>
            <div className="bg-white p-3 md:p-4 rounded-xl border-2 shadow-lg hover:shadow-2xl transition-all duration-300" style={{borderColor: 'var(--jz-primary)'}}>
              <QRCodeSVG value={customerViewUrl} size={150} level="H" className="md:w-[180px] md:h-[180px]" />
            </div>
            <p className="text-xs md:text-sm text-gray-600 mt-3 md:mt-4 text-center font-semibold">สแกนเพื่อดูข้อมูลเวลา</p>
          </div>
        </div>

        {/* 🎮 รายการลูกค้าห้อง VIP ทั้งหมด */}
        <div className="bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl shadow-card p-4 md:p-6 border jz-card-border mb-6 slide-up-2">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3 md:mb-4">
            <h2 className="text-xl md:text-2xl font-bold jz-text-gradient flex items-center gap-2">
              🎮 รายการลูกค้าทั้งหมด
              <span className="inline-flex items-center justify-center jz-badge text-sm font-bold px-2.5 py-0.5 rounded-full">{customers.length}</span>
            </h2>
          </div>
          
          {customers.length === 0 ? (
            <div className="text-center py-8 md:py-12 text-gray-400">
              <div className="text-5xl md:text-6xl mb-3 md:mb-4 animate-bounce-slow">🎮</div>
              <p className="text-xl md:text-2xl font-bold">ยังไม่มีลูกค้า</p>
              <p className="text-xs md:text-sm mt-2">เพิ่มลูกค้าใหม่เพื่อเริ่มจับเวลา</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 md:mx-0">
              <div className="inline-block min-w-full align-middle">
                <div className="overflow-hidden">
                  <table className="min-w-full border-separate border-spacing-y-1">
                    <thead>
                      <tr className="jz-table-header shadow-lg">
                        <th className="px-2 md:px-4 py-2.5 md:py-3.5 text-left rounded-tl-xl text-xs md:text-sm font-bold tracking-wide">ชื่อ</th>
                        <th className="px-2 md:px-4 py-2.5 md:py-3.5 text-left text-xs md:text-sm font-bold tracking-wide">ห้อง</th>
                        <th className="px-2 md:px-4 py-2.5 md:py-3.5 text-center text-xs md:text-sm font-bold tracking-wide hidden md:table-cell">🕐 เริ่ม</th>
                        <th className="px-2 md:px-4 py-2.5 md:py-3.5 text-center text-xs md:text-sm font-bold tracking-wide hidden md:table-cell">🕑 จบ</th>
                        <th className="px-2 md:px-4 py-2.5 md:py-3.5 text-center text-xs md:text-sm font-bold tracking-wide">⏱ เวลาเหลือ</th>
                        <th className="px-2 md:px-4 py-2.5 md:py-3.5 text-center text-xs md:text-sm font-bold tracking-wide hidden sm:table-cell">💰 ราคา</th>
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
                            <span className="inline-block bg-blue-100 text-blue-700 px-2 md:px-3 py-0.5 md:py-1 rounded-full text-xs md:text-sm">
                              {customer.room}
                            </span>
                          </td>
                          <td className="px-2 md:px-4 py-2 md:py-3 text-center text-xs md:text-sm hidden md:table-cell">
                            <div className="bg-blue-100 border-2 border-blue-400 rounded-lg p-1.5 inline-block">
                              <p className="font-semibold text-blue-700">{formatTimeDisplay(customer.startTime)}</p>
                            </div>
                          </td>
                          <td className="px-2 md:px-4 py-2 md:py-3 text-center text-xs md:text-sm hidden md:table-cell">
                            <div className="bg-orange-100 border-2 border-orange-400 rounded-lg p-1.5 inline-block">
                              <p className="font-semibold text-orange-700">{formatTimeDisplay(customer.expectedEndTime)}</p>
                            </div>
                          </td>
                          <td className="px-2 md:px-4 py-2 md:py-3 text-center">
                            <div>
                              <span
                                className={`inline-block font-bold text-xl md:text-2xl ${
                                  customer.displayTimeRemaining < 300
                                    ? 'text-red-600 animate-pulse'
                                    : 'text-green-600'
                                }`}
                              >
                                {formatTime(customer.displayTimeRemaining)}
                              </span>
                              <div className="text-xs md:text-sm text-gray-500 mt-1">
                                ({getDurationText(customer.displayTimeRemaining)})
                              </div>
                            </div>
                          </td>
                          <td className="px-2 md:px-4 py-2 md:py-3 text-center font-semibold text-base md:text-lg hidden sm:table-cell">
                            ฿{customer.cost}
                          </td>
                          <td className="px-2 md:px-4 py-2 md:py-3 text-center hidden md:table-cell">
                            <span className="inline-block bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs max-w-[100px] truncate" title={customer.note || 'ไม่มี'}>
                              {customer.note || '-'}
                            </span>
                          </td>
                          <td className="px-2 md:px-4 py-2 md:py-3 text-center hidden lg:table-cell">
                            <span
                              className={`inline-block px-2 md:px-3 py-0.5 md:py-1 rounded-full text-xs md:text-sm font-bold ${
                                customer.isPaid
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {customer.isPaid ? '✅ จ่ายแล้ว' : '❌ ยังไม่จ่าย'}
                            </span>
                          </td>
                          <td className="px-2 md:px-4 py-2 md:py-3">
                            <div className="flex flex-wrap gap-1 md:gap-2 justify-center">
                              <button
                                onClick={async () => {
                                  try {
                                    console.log('Toggle timer for customer:', customer.id, 'Current isRunning:', customer.isRunning)
                                    await toggleTimer(customer.id)
                                    // Force refresh after toggle
                                    setUpdateTrigger(prev => prev + 1)
                                  } catch (error) {
                                    console.error('Error toggling timer:', error)
                                    alert('❌ เกิดข้อผิดพลาด: ' + error.message)
                                  }
                                }}
                                className={`px-2 md:px-3 py-1 rounded-lg text-white font-semibold text-xs md:text-sm ${
                                  customer.isRunning
                                    ? 'bg-orange-500 hover:bg-orange-600'
                                    : 'bg-green-500 hover:bg-green-600'
                                }`}
                                title={customer.isRunning ? 'หยุดเวลา' : 'เริ่มเวลา'}
                              >
                                {customer.isRunning ? '⏸️' : '▶️'}
                              </button>
                              {customer.displayTimeRemaining <= 0 ? (
                                <button
                                  onClick={async () => {
                                    const minutes = prompt('ขยายเวลา (นาที):', '30')
                                    if (minutes && parseInt(minutes) > 0) {
                                      try {
                                        await extendTime(customer.id, parseInt(minutes))
                                      } catch (error) {
                                        console.error('Error extending time:', error)
                                        alert('❌ เกิดข้อผิดพลาด: ' + error.message)
                                      }
                                    }
                                  }}
                                  className="px-2 md:px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-xs md:text-sm animate-pulse"
                                  title="หมดเวลา - คลิกเพื่อขยายเวลา"
                                >
                                  🔄 ขยาย
                                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={async () => {
                                      try {
                                        await addTime(customer.id, 5)
                                      } catch (error) {
                                        console.error('Error adding time:', error)
                                        alert('❌ เกิดข้อผิดพลาด: ' + error.message)
                                      }
                                    }}
                                    className="px-2 md:px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold text-xs md:text-sm"
                                    title="เพิ่มเวลา 5 นาที"
                                  >
                                    ➕5
                                  </button>
                                  <button
                                    onClick={async () => {
                                      try {
                                        await subtractTime(customer.id, 5)
                                      } catch (error) {
                                        console.error('Error subtracting time:', error)
                                        alert('❌ เกิดข้อผิดพลาด: ' + error.message)
                                      }
                                    }}
                                    className="px-2 md:px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold text-xs md:text-sm"
                                    title="ลดเวลา 5 นาที"
                                  >
                                    ➖5
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => openCompletionConfirm(customer)}
                                className="px-2 md:px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs md:text-sm"
                                title="สิ้นสุด + บันทึก History + ลบออก"
                              >
                                ✅ สิ้นสุด
                              </button>
                              <button
                                onClick={async () => {
                                  try {
                                    await togglePayment(customer.id)
                                  } catch (error) {
                                    console.error('Error toggling payment:', error)
                                    alert('❌ เกิดข้อผิดพลาด: ' + error.message)
                                  }
                                }}
                                className={`px-2 md:px-3 py-1 rounded-lg text-white font-semibold text-xs md:text-sm ${
                                  customer.isPaid
                                    ? 'bg-gray-500 hover:bg-gray-600'
                                    : 'bg-green-500 hover:bg-green-600'
                                }`}
                                title={customer.isPaid ? 'ยังไม่จ่าย' : 'จ่ายแล้ว'}
                              >
                                💰
                              </button>
                              <button
                                onClick={async () => {
                                  if (confirm(`ต้องการลบ "${customer.name}" ใช่หรือไม่?`)) {
                                    try {
                                      await deleteCustomer(customer.id)
                                    } catch (error) {
                                      console.error('Error deleting customer:', error)
                                      alert('❌ เกิดข้อผิดพลาด: ' + error.message)
                                    }
                                  }
                                }}
                                className="px-2 md:px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold text-xs md:text-sm"
                                title="ลบลูกค้า"
                              >
                                🗑️
                              </button>
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

        {/* Computer Zone Entry */}
        <ComputerZoneEntry user={user} />

        {/* Computer Zone Manager Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowComputerZoneManager(true)}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-all shadow-lg transform hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            🎮💻 จัดการรายการ Computer Zone
          </button>
        </div>

        {/* 💻 รายการลูกค้าคอมพิวเตอร์วันนี้ */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-card p-6 md:p-8 mb-6 border border-slate-200/50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-800">
                💻 รายการลูกค้าคอมพิวเตอร์วันนี้
              </h2>
              <button
                onClick={() => setShowComputerTable(!showComputerTable)}
                className={`px-3 py-2 rounded-lg font-bold text-sm transition-all ${
                  showComputerTable
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                }`}
                title={showComputerTable ? 'ซ่อน' : 'แสดง'}
              >
                {showComputerTable ? '▼' : '▶'}
              </button>
            </div>
            
            {/* Shift Filter - Only show when table is visible */}
            {showComputerTable && (
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setSelectedComputerShift('all')}
                  className={`px-4 py-2 rounded-lg font-bold transition-all ${
                    selectedComputerShift === 'all'
                      ? 'bg-blue-600 text-white shadow-lg scale-105'
                      : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                  }`}
                >
                  📊 ทั้งหมด
                </button>
                {Object.entries(shifts).map(([shiftNum, shiftInfo]) => (
                  <button
                    key={shiftNum}
                    onClick={() => setSelectedComputerShift(shiftNum)}
                    className={`px-4 py-2 rounded-lg font-bold transition-all ${
                      selectedComputerShift === shiftNum
                        ? 'bg-blue-600 text-white shadow-lg scale-105'
                        : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                    }`}
                  >
                    กะ {shiftNum}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Table Content - Collapsible */}
          {showComputerTable && (
            <div className="mt-6">

          {loadingComputer ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2 animate-spin">⏳</div>
              <p className="text-gray-600">กำลังโหลด...</p>
            </div>
          ) : getFilteredComputerEntries().length === 0 ? (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">💻</div>
              <p className="text-gray-600 text-lg">
                {selectedComputerShift === 'all' 
                  ? 'ยังไม่มีรายการคอมพิวเตอร์วันนี้' 
                  : `ยังไม่มีรายการในกะ ${selectedComputerShift}`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                    <th className="px-4 py-3 text-left font-bold">#</th>
                    <th className="px-4 py-3 text-left font-bold">ชื่อลูกค้า</th>
                    <th className="px-4 py-3 text-center font-bold">👤 พนักงาน</th>
                    <th className="px-4 py-3 text-center font-bold">🔄 กะ</th>
                    <th className="px-4 py-3 text-right font-bold">💸 เงินโอน</th>
                    <th className="px-4 py-3 text-right font-bold">💳 เงินสด</th>
                    <th className="px-4 py-3 text-right font-bold">📊 รวม</th>
                    <th className="px-4 py-3 text-center font-bold">🕐 เวลา</th>
                  </tr>
                </thead>
                <tbody>
                  {getFilteredComputerEntries().map((entry, index) => {
                    const shiftColor = shifts[entry.shift]?.color || 'bg-gray-100 text-gray-700'
                    
                    return (
                      <tr key={entry.id} className="border-b border-gray-200 hover:bg-blue-50 transition-colors">
                        <td className="px-4 py-3 text-gray-700 font-semibold">{index + 1}</td>
                        <td className="px-4 py-3 text-gray-800 font-medium">{entry.customer_name || '-'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-block bg-blue-200 text-blue-800 px-3 py-1 rounded-full font-bold text-xs">
                            {entry.added_by || 'ไม่ระบุ'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-3 py-1 rounded-lg font-bold text-xs ${shiftColor}`}>
                            กะ {entry.shift || 'all'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-blue-600 font-bold">
                          ฿{(parseFloat(entry.transfer_amount) || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-orange-600 font-bold">
                          ฿{(parseFloat(entry.cash_amount) || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700 font-bold text-lg">
                          ฿{(parseFloat(entry.total_cost) || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-600 text-xs">
                          {entry.start_time || '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gradient-to-r from-green-100 to-blue-100 border-t-2 border-gray-300 font-bold">
                    <td colSpan="4" className="px-4 py-3 text-gray-800">
                      รวม {selectedComputerShift === 'all' ? 'ทั้งหมด' : `กะ ${selectedComputerShift}`}
                    </td>
                    <td className="px-4 py-3 text-right text-blue-600">
                      ฿{getFilteredComputerEntries().reduce((sum, e) => sum + (parseFloat(e.transfer_amount) || 0), 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-orange-600">
                      ฿{getFilteredComputerEntries().reduce((sum, e) => sum + (parseFloat(e.cash_amount) || 0), 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-800 text-lg">
                      ฿{getFilteredComputerEntries().reduce((sum, e) => sum + (parseFloat(e.total_cost) || 0), 0).toFixed(2)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
            </div>
          )}
        </div>

        {/* 🎮 รายการห้อง VIP วันนี้ */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-card p-6 md:p-8 mb-6 border border-slate-200/50">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-800">
              🎮 รายการห้อง VIP วันนี้
            </h2>
            <button
              onClick={() => setSelectedVipShift(selectedVipShift === 'hidden' ? 'all' : 'hidden')}
              className={`px-3 py-2 rounded-lg font-bold text-sm transition-all ${
                selectedVipShift !== 'hidden'
                  ? 'bg-green-600 text-white shadow-lg'
                  : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
              }`}
              title={selectedVipShift !== 'hidden' ? 'ซ่อน' : 'แสดง'}
            >
              {selectedVipShift !== 'hidden' ? '▼' : '▶'}
            </button>
          </div>

          {/* Table Content - Collapsible */}
          {selectedVipShift !== 'hidden' && (
            <div className="mt-6">
              {/* Shift Filter */}
              <div className="flex gap-2 flex-wrap mb-6">
                <button
                  onClick={() => setSelectedVipShift('all')}
                  className={`px-4 py-2 rounded-lg font-bold transition-all ${
                    selectedVipShift === 'all'
                      ? 'bg-green-600 text-white shadow-lg scale-105'
                      : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                  }`}
                >
                  📊 ทั้งหมด
                </button>
                {Object.entries(shifts).map(([shiftNum, shiftInfo]) => (
                  <button
                    key={shiftNum}
                    onClick={() => setSelectedVipShift(shiftNum)}
                    className={`px-4 py-2 rounded-lg font-bold transition-all ${
                      selectedVipShift === shiftNum
                        ? 'bg-green-600 text-white shadow-lg scale-105'
                        : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                    }`}
                  >
                    กะ {shiftNum}
                  </button>
                ))}
              </div>

              {loadingVip ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2 animate-spin">⏳</div>
                  <p className="text-gray-600">กำลังโหลด...</p>
                </div>
              ) : getFilteredVipEntries().length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-6xl mb-4">🎮</div>
                  <p className="text-gray-600 text-lg">
                    {selectedVipShift === 'all' 
                      ? 'ยังไม่มีรายการห้อง VIP วันนี้' 
                      : `ยังไม่มีรายการในกะ ${selectedVipShift}`}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gradient-to-r from-green-500 to-emerald-600 text-white">
                        <th className="px-4 py-3 text-left font-bold">#</th>
                        <th className="px-4 py-3 text-left font-bold">ชื่อลูกค้า</th>
                        <th className="px-4 py-3 text-left font-bold">🚪 ห้อง</th>
                        <th className="px-4 py-3 text-center font-bold">🔄 กะ</th>
                        <th className="px-4 py-3 text-center font-bold">⏱️ ระยะเวลา</th>
                        <th className="px-4 py-3 text-center font-bold">💰 วิธีชำระ</th>
                        <th className="px-4 py-3 text-right font-bold">📊 ยอดเงิน</th>
                        <th className="px-4 py-3 text-center font-bold">🕐 เวลาเริ่ม</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getFilteredVipEntries().map((entry, index) => {
                        const shift = getShiftFromTime(entry.start_time)
                        const shiftColor = shifts[shift]?.color || 'bg-gray-100 text-gray-700'
                        const paymentBadge = entry.payment_method === 'cash' 
                          ? 'bg-orange-200 text-orange-800' 
                          : 'bg-blue-200 text-blue-800'
                        const paymentText = entry.payment_method === 'cash' ? '💳 เงินสด' : '💸 โอน'
                        
                        return (
                          <tr key={entry.id} className="border-b border-gray-200 hover:bg-green-50 transition-colors">
                            <td className="px-4 py-3 text-gray-700 font-semibold">{index + 1}</td>
                            <td className="px-4 py-3 text-gray-800 font-medium">{entry.customer_name || '-'}</td>
                            <td className="px-4 py-3 text-gray-700">{entry.room || '-'}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-block px-3 py-1 rounded-lg font-bold text-xs ${shiftColor}`}>
                                กะ {shift}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-gray-700 font-medium">
                              {entry.duration_minutes ? `${entry.duration_minutes} นาที` : '-'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-block px-3 py-1 rounded-full font-bold text-xs ${paymentBadge}`}>
                                {paymentText}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-green-600 font-bold text-lg">
                              ฿{(parseFloat(entry.final_cost) || 0).toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-600 text-xs">
                              {entry.start_time || '-'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gradient-to-r from-green-100 to-emerald-100 border-t-2 border-gray-300 font-bold">
                        <td colSpan="6" className="px-4 py-3 text-gray-800">
                          รวม {selectedVipShift === 'all' ? 'ทั้งหมด' : `กะ ${selectedVipShift}`}
                        </td>
                        <td className="px-4 py-3 text-right text-green-700 text-lg">
                          ฿{getFilteredVipEntries().reduce((sum, e) => sum + (parseFloat(e.final_cost) || 0), 0).toFixed(2)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Computer Zone Manager Modal */}
        <ComputerZoneManager 
          isOpen={showComputerZoneManager}
          onClose={() => setShowComputerZoneManager(false)}
          user={user}
        />
      </div>

      {/* Theme Picker */}
      <ThemePicker zone="red" />
    </div>
  )
}

export default AdminDashboard

import { useState, useEffect, useRef, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { formatTimeDisplay, formatDateTimeThai } from '../utils/timeFormat'
import supabase from '../firebase'
import { logActivityBlue, calculateCostBlue, formatElapsedTime } from '../utils/authUtilsBlue'
import { useTheme } from '../contexts/ThemeContext'
import ThemePicker from './ThemePicker'

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
    name: '',
    room: '',
    hourlyRate: '',
    note: ''
  })
  const { setActiveZone } = useTheme()
  const [, setUpdateTrigger] = useState(0)
  const [notifications, setNotifications] = useState([])
  const [notifOpen, setNotifOpen] = useState(false)
  const audioRef = useRef(null)
  const alarmTimeoutRef = useRef(null)
  const notificationsRef = useRef([])

  // Set active zone for theme
  useEffect(() => { setActiveZone('blue') }, [setActiveZone])

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
    if (formData.name && formData.room && formData.hourlyRate) {
      addCustomer({
        name: formData.name,
        room: formData.room,
        hourlyRate: parseFloat(formData.hourlyRate),
        note: formData.note
      })
      setFormData({ name: '', room: '', hourlyRate: '', note: '' })
    }
  }

  // Calculate real-time cost for each customer
  const displayCustomers = customers.map(customer => {
    const currentCost = calculateCostBlue(
      customer.start_time,
      customer.hourly_rate,
      customer.total_pause_duration,
      customer.pause_time,
      customer.is_running
    )
    const elapsedTime = formatElapsedTime(
      customer.start_time,
      customer.total_pause_duration,
      customer.pause_time,
      customer.is_running
    )
    return {
      ...customer,
      currentCost,
      elapsedTime
    }
  })

  const customerViewUrl = `${window.location.origin}/blue/customer`

  return (
    <div className="min-h-screen jz-bg p-3 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6 md:mb-8 animate-float relative">
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
          <div className="mt-4 flex flex-col sm:flex-row justify-center gap-3">
            <a
              href="/blue/history"
              className="inline-block bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-6 rounded-xl shadow-lg jz-glow-hover transform hover:scale-105 transition-all duration-300 border border-white/20"
            >
              📊 ดูประวัติการใช้งาน
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
            <h2 className="text-lg md:text-2xl lg:text-3xl font-bold jz-text-gradient mb-3 md:mb-4">
              ➕
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
                <label className="block text-gray-700 font-semibold mb-1.5 md:mb-2 text-sm md:text-base">ชื่อห้อง/สถานที่</label>
                <input
                  type="text"
                  value={formData.room}
                  onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                  className="w-full px-3 py-2 md:px-4 md:py-2 border-2 jz-input rounded-lg focus:outline-none text-sm md:text-base"
                  placeholder="เช่น ชั้น 2 ห้อง VIP, ห้อง A1, Golf Zone ฯลฯ"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1.5 md:mb-2 text-sm md:text-base">
                  💰 ราคาต่อชั่วโมง (บาท)
                </label>
                <input
                  type="number"
                  value={formData.hourlyRate}
                  onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                  className="w-full px-3 py-2 md:px-4 md:py-2 border-2 jz-input rounded-lg focus:outline-none text-sm md:text-base"
                  placeholder="กรอกราคาต่อชั่วโมง เช่น 159, 200, 150 ฯลฯ"
                  min="0"
                  step="0.01"
                  required
                />
                <p className="text-xs md:text-sm text-gray-500 mt-1">
                  💡 สามารถกรอกราคาอะไรก็ได้ ระบบจะคำนวณตามเวลาจริง (Pro-rated)
                </p>
              </div>

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
            <h2 className="text-lg md:text-xl font-bold jz-text-gradient mb-3 md:mb-4 animate-bounce-slow text-center">
              📱 QR Code สำหรับลูกค้า
            </h2>
            <div className="bg-white p-3 md:p-4 rounded-xl border-3 md:border-4 shadow-lg hover:shadow-2xl transition-all duration-300" style={{ borderColor: 'var(--jz-primary)' }}>
              <QRCodeSVG value={customerViewUrl} size={150} level="H" className="md:w-[180px] md:h-[180px]" />
            </div>
            <p className="text-xs md:text-sm text-gray-600 mt-3 md:mt-4 text-center font-semibold">สแกนเพื่อดูราคาตามเวลาจริง</p>
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
                              <div className="text-xs text-gray-500 mt-1">
                                {customer.hourly_rate} บาท/ชม.
                              </div>
                            </div>
                          </td>
                          <td className="px-2 md:px-4 py-2 md:py-3 text-center">
                            <div className="inline-block bg-gradient-to-r from-green-100 to-emerald-100 border-2 border-green-400 rounded-xl px-3 py-2">
                              <span className="font-bold text-xl md:text-2xl text-green-700">
                                ฿{customer.currentCost.toFixed(2)}
                              </span>
                              {!customer.is_running && (
                                <div className="text-xs text-orange-600 font-semibold mt-1">⏸️ หยุดชั่วคราว</div>
                              )}
                            </div>
                          </td>
                          <td className="px-2 md:px-4 py-2 md:py-3 text-center hidden md:table-cell">
                            <span className="inline-block jz-badge px-2 py-1 rounded text-xs max-w-[100px] truncate" title={customer.note || 'ไม่มี'}>
                              {customer.note || '-'}
                            </span>
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
                                  if (confirm(`✅ เสร็จสิ้นการใช้งานของ "${customer.name}"?\n\nราคารวม: ฿${customer.currentCost.toFixed(2)}\nจะบันทึกไว้ในประวัติ`)) {
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
      <ThemePicker zone="blue" />
    </div>
  )
}

export default AdminDashboardBlue

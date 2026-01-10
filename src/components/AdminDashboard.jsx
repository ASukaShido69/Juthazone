import { useState, useEffect, useRef, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { formatTimeDisplay, getDurationText, calculateTimeRemaining } from '../utils/timeFormat'
import supabase from '../firebase'
import { logActivity } from '../utils/authUtils'

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
    note: ''
  })
  const [, setUpdateTrigger] = useState(0) // Trigger to refresh display
  const [notifications, setNotifications] = useState([])
  const [notifOpen, setNotifOpen] = useState(false)
  const audioRef = useRef(null)
  const alarmTimeoutRef = useRef(null)
  const notificationsRef = useRef([])

  // Keep notifications ref in sync
  useEffect(() => {
    notificationsRef.current = notifications
  }, [notifications])

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

  const handleSubmit = (e) => {
    e.preventDefault()
    if (formData.name && formData.minutes && formData.cost) {
      addCustomer({
        name: formData.name,
        room: formData.room,
        minutes: parseInt(formData.minutes),
        cost: parseFloat(formData.cost),
        note: formData.note
      })
      setFormData({ name: '', room: 'ชั้น 2 ห้อง VIP', minutes: '', cost: '', note: '' })
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
  const displayCustomers = customers.map(customer => ({
    ...customer,
    displayTimeRemaining: customer.expectedEndTime 
      ? calculateTimeRemaining(customer.startTime, customer.expectedEndTime)
      : customer.timeRemaining
  }))

  const customerViewUrl = `${window.location.origin}/customer`

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-orange-500 animate-gradient p-3 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header with animation */}
        <div className="text-center mb-6 md:mb-8 animate-float relative">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white drop-shadow-2xl mb-2">
            🎮 JUTHAZONE 🎮
          </h1>
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-white/90 drop-shadow-lg font-semibold">
            ระบบจัดการเวลาลูกค้า
          </p>
          {user && (
            <div className="absolute top-0 right-0 flex items-center gap-3">
              <div className="bg-white/90 text-purple-600 font-bold px-4 py-2 rounded-xl text-xs md:text-sm shadow-lg">
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
              className="inline-block bg-white/90 hover:bg-white text-purple-600 font-bold py-2 px-6 rounded-xl shadow-lg hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
            >
              📊 ดูประวัติการใช้งาน
            </a>
            <a
              href="/analytics"
              className="inline-block bg-white/90 hover:bg-white text-purple-600 font-bold py-2 px-6 rounded-xl shadow-lg hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
            >
              📈 Analytics
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
          {/* Add Customer Form */}
          <div className="lg:col-span-2 bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl shadow-2xl p-4 md:p-6 transform hover:scale-[1.01] transition-all duration-300 border-3 md:border-4 border-purple-300">
            <h2 className="text-lg md:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-3 md:mb-4">
              ➕ เพิ่มลูกค้าใหม่
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
              <div>
                <label className="block text-gray-700 font-semibold mb-1.5 md:mb-2 text-sm md:text-base">ชื่อลูกค้า</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 md:px-4 md:py-2 border-2 border-purple-300 rounded-lg focus:outline-none focus:border-purple-500 text-sm md:text-base"
                  placeholder="กรอกชื่อลูกค้า"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1.5 md:mb-2 text-sm md:text-base">เลือกห้อง</label>
                <select
                  value={formData.room}
                  onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                  className="w-full px-3 py-2 md:px-4 md:py-2 border-2 border-purple-300 rounded-lg focus:outline-none focus:border-purple-500 text-sm md:text-base"
                >
                  <option value="ชั้น 2 ห้อง VIP">ชั้น 2 ห้อง VIP</option>
                  <option value="ชั้น 3 ห้อง VIP KARAOKE">ชั้น 3 ห้อง VIP KARAOKE</option>
                  <option value="ชั้น 3 ห้อง Golf">ชั้น 3 Golf</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1.5 md:mb-2 text-sm md:text-base">ตั้งเวลา (นาที)</label>
                  <input
                    type="number"
                    value={formData.minutes}
                    onChange={(e) => setFormData({ ...formData, minutes: e.target.value })}
                    className="w-full px-3 py-2 md:px-4 md:py-2 border-2 border-purple-300 rounded-lg focus:outline-none focus:border-purple-500 text-sm md:text-base"
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
                    className="w-full px-3 py-2 md:px-4 md:py-2 border-2 border-purple-300 rounded-lg focus:outline-none focus:border-purple-500 text-sm md:text-base"
                    placeholder="เช่น 100"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1.5 md:mb-2 text-sm md:text-base">📝 Note (ไม่บังคับ)</label>
                <textarea
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="w-full px-3 py-2 md:px-4 md:py-2 border-2 border-purple-300 rounded-lg focus:outline-none focus:border-purple-500 text-sm md:text-base h-20 resize-none"
                  placeholder="เช่น เล่นแบดมินตัน, ร้อนจัด ฯลฯ"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white font-bold py-3 md:py-4 px-6 rounded-xl hover:from-purple-700 hover:via-pink-700 hover:to-orange-600 transform hover:scale-105 active:scale-95 transition-all duration-300 shadow-2xl hover:shadow-purple-500/50 animate-gradient text-sm md:text-base"
              >
                เพิ่มลูกค้า 🎯
              </button>
            </form>
          </div>

          {/* QR Code Section */}
          <div className="bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl shadow-2xl p-4 md:p-6 flex flex-col items-center justify-center border-3 md:border-4 border-pink-300 transform hover:scale-105 transition-all duration-300">
            <h2 className="text-lg md:text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-3 md:mb-4 animate-bounce-slow text-center">
              📱 QR Code สำหรับลูกค้า
            </h2>
            <div className="bg-white p-3 md:p-4 rounded-xl border-3 md:border-4 border-purple-400 shadow-lg hover:shadow-2xl hover:border-pink-400 transition-all duration-300">
              <QRCodeSVG value={customerViewUrl} size={150} level="H" className="md:w-[180px] md:h-[180px]" />
            </div>
            <p className="text-xs md:text-sm text-gray-600 mt-3 md:mt-4 text-center font-semibold">สแกนเพื่อดูข้อมูลเวลา</p>
          </div>
        </div>

        {/* Customer List */}
        <div className="bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl shadow-2xl p-4 md:p-6 border-3 md:border-4 border-orange-300">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3 md:mb-4">
            <h2 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-purple-600 to-orange-600 bg-clip-text text-transparent">
              📋 รายการลูกค้าทั้งหมด ({customers.length})
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
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white">
                        <th className="px-2 md:px-4 py-2 md:py-3 text-left rounded-tl-xl text-xs md:text-base">ชื่อ</th>
                        <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs md:text-base">ห้อง</th>
                        <th className="px-2 md:px-4 py-2 md:py-3 text-center text-xs md:text-base hidden md:table-cell">🕐 เริ่ม</th>
                        <th className="px-2 md:px-4 py-2 md:py-3 text-center text-xs md:text-base hidden md:table-cell">🕑 จบ</th>
                        <th className="px-2 md:px-4 py-2 md:py-3 text-center text-xs md:text-base">เวลาที่เหลือ</th>
                        <th className="px-2 md:px-4 py-2 md:py-3 text-center text-xs md:text-base hidden sm:table-cell">ค่าใช้จ่าย</th>
                        <th className="px-2 md:px-4 py-2 md:py-3 text-center text-xs md:text-base hidden md:table-cell">Note</th>
                        <th className="px-2 md:px-4 py-2 md:py-3 text-center text-xs md:text-base hidden lg:table-cell">สถานะการจ่าย</th>
                        <th className="px-2 md:px-4 py-2 md:py-3 text-center rounded-tr-xl text-xs md:text-base">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayCustomers.map((customer, index) => (
                        <tr
                          key={customer.id}
                          className={`border-b ${
                            index % 2 === 0 ? 'bg-purple-50' : 'bg-white'
                          } hover:bg-gradient-to-r hover:from-purple-100 hover:to-pink-100 transition-all duration-300 transform hover:scale-[1.01]`}
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
                                onClick={() => toggleTimer(customer.id)}
                                className={`px-2 md:px-3 py-1 rounded-lg text-white font-semibold text-xs md:text-sm ${
                                  customer.isRunning
                                    ? 'bg-orange-500 hover:bg-orange-600'
                                    : 'bg-green-500 hover:bg-green-600'
                                }`}
                              >
                                {customer.isRunning ? '⏸️' : '▶️'}
                              </button>
                              {customer.displayTimeRemaining <= 0 ? (
                                <button
                                  onClick={() => {
                                    const minutes = prompt('ขยายเวลา (นาที):', '30')
                                    if (minutes && parseInt(minutes) > 0) {
                                      extendTime(customer.id, parseInt(minutes))
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
                                    onClick={() => addTime(customer.id, 5)}
                                    className="px-2 md:px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold text-xs md:text-sm"
                                  >
                                    ➕5
                                  </button>
                                  <button
                                    onClick={() => subtractTime(customer.id, 5)}
                                    className="px-2 md:px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold text-xs md:text-sm"
                                  >
                                    ➖5
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => togglePayment(customer.id)}
                                className={`px-2 md:px-3 py-1 rounded-lg text-white font-semibold text-xs md:text-sm ${
                                  customer.isPaid
                                    ? 'bg-gray-500 hover:bg-gray-600'
                                    : 'bg-green-500 hover:bg-green-600'
                                }`}
                              >
                                💰
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`ต้องการลบ "${customer.name}" ใช่หรือไม่?`)) {
                                    deleteCustomer(customer.id)
                                  }
                                }}
                                className="px-2 md:px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold text-xs md:text-sm"
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
    </div>
  )
}

export default AdminDashboard

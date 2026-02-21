
import { useMemo, useState } from 'react'
import { formatTimeDisplay, getDurationText, calculateTimeRemaining } from '../utils/timeFormat'
import { logActivity } from '../utils/authUtils'

function CustomerView({ customers }) {
  const [floorFilter, setFloorFilter] = useState('all')
  const [roomFilter, setRoomFilter] = useState('all')
  const [showRoomPicker, setShowRoomPicker] = useState(true)

  const extractFloor = (room = '') => {
    // รองรับรูปแบบ: "ชั้น2", "ชั้น 3", "2F", "2-01", "2/01"
    const thaiFloor = room.match(/ชั้น\s*(\d+)/i)
    if (thaiFloor) return `ชั้น ${thaiFloor[1]}`
    const numericLead = room.match(/^(\d+)/)
    if (numericLead) return `ชั้น ${numericLead[1]}`
    const fx = room.match(/(\d+)f/i)
    if (fx) return `ชั้น ${fx[1]}`
    return 'อื่นๆ'
  }

  const floorOptions = useMemo(() => {
    const set = new Set()
    customers.forEach((c) => set.add(extractFloor(c.room)))
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'th'))
  }, [customers])

  const roomOptions = useMemo(() => {
    const set = new Set()
    customers.forEach((c) => c.room && set.add(c.room))
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'th'))
  }, [customers])

  const floorSections = useMemo(() => {
    const map = new Map()
    customers.forEach((c) => {
      const floor = extractFloor(c.room)
      if (!map.has(floor)) {
        map.set(floor, { floor, rooms: new Map() })
      }
      const roomMap = map.get(floor).rooms
      roomMap.set(c.room, (roomMap.get(c.room) || 0) + 1)
    })
    return Array.from(map.values())
      .map((section) => ({
        floor: section.floor,
        rooms: Array.from(section.rooms.entries()).map(([room, count]) => ({ room, count }))
      }))
      .sort((a, b) => a.floor.localeCompare(b.floor, 'th'))
  }, [customers])

  // OPTIMIZATION: Calculate real-time remaining for each customer based on expectedEndTime
  const displayCustomers = useMemo(() => {
    return customers.map(customer => ({
      ...customer,
      displayTimeRemaining: customer.expectedEndTime 
        ? calculateTimeRemaining(customer.startTime, customer.expectedEndTime)
        : customer.timeRemaining
    }))
  }, [customers])

  const filteredCustomers = useMemo(() => {
    return displayCustomers.filter((customer) => {
      const floor = extractFloor(customer.room)
      const byFloor = floorFilter === 'all' || floor === floorFilter
      const byRoom = roomFilter === 'all' || customer.room === roomFilter
      return byFloor && byRoom
    })
  }, [displayCustomers, floorFilter, roomFilter])

  const handleCallStaff = async (customer) => {
    const note = window.prompt('ระบุโน้ตสำหรับพนักงาน (เช่น สิ่งที่ต้องการให้ช่วย)', '')
    if (note === null) return
    try {
      await logActivity(
        customer.name || 'customer',
        'CALL_STAFF',
        `เรียกพนักงานจากหน้าลูกค้า: ${customer.name || ''}`,
        { note: note || '-', room: customer.room }
      )
      alert('เรียกพนักงานแล้ว')
    } catch (error) {
      console.error('Call staff error:', error)
      alert('ไม่สามารถบันทึกการเรียกพนักงานได้')
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-700 via-pink-600 to-orange-500 animate-gradient p-3 md:p-4 lg:p-6">
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 0 5px rgba(139,92,246,0.3); }
          50% { box-shadow: 0 0 20px rgba(139,92,246,0.6), 0 0 40px rgba(139,92,246,0.2); }
        }
        @keyframes urgent-glow {
          0%, 100% { box-shadow: 0 0 5px rgba(239,68,68,0.3); }
          50% { box-shadow: 0 0 25px rgba(239,68,68,0.7), 0 0 50px rgba(239,68,68,0.3); }
        }
        .card-glow { animation: glow-pulse 3s ease-in-out infinite; }
        .card-urgent { animation: urgent-glow 1.5s ease-in-out infinite; }
        .shimmer-bg {
          background: linear-gradient(90deg, transparent 25%, rgba(255,255,255,0.3) 50%, transparent 75%);
          background-size: 200% 100%;
          animation: shimmer 2s infinite;
        }
        .progress-bar-inner {
          transition: width 1s linear;
        }
      `}</style>

      <div className="max-w-6xl mx-auto relative">
        {showRoomPicker && customers.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowRoomPicker(false)} />
            <div className="relative w-full h-[90vh] max-w-6xl bg-gradient-to-br from-blue-50 via-white to-purple-50 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 md:px-10 py-6 md:py-8 flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-semibold">🎮 เลือกห้องเพื่อดูรายการ</p>
                  <h2 className="text-3xl md:text-4xl font-bold text-white">Room Selector</h2>
                </div>
                <button
                  onClick={() => setShowRoomPicker(false)}
                  className="bg-white/20 hover:bg-white/30 text-white p-3 rounded-full transition"
                >
                  ✕
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8">
                {/* Show All Rooms Button */}
                <div className="mb-8">
                  <button
                    onClick={() => { setFloorFilter('all'); setRoomFilter('all'); setShowRoomPicker(false) }}
                    className="w-full group relative overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white rounded-2xl p-6 shadow-lg transition transform hover:scale-[1.02]"
                  >
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition" />
                    <div className="relative flex items-center justify-between">
                      <div className="text-left">
                        <p className="text-sm font-semibold opacity-90">ดูทั้งหมด</p>
                        <p className="text-2xl md:text-3xl font-bold">📊 ทุกห้องในระบบ</p>
                      </div>
                      <div className="text-5xl">👁️</div>
                    </div>
                    <p className="text-sm mt-2 opacity-90">รวม {customers.length} รายการ</p>
                  </button>
                </div>

                {/* Rooms Grid */}
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">แบ่งตามชั้น</h3>
                  <div className="space-y-6">
                    {floorSections.map((section) => (
                      <div key={section.floor}>
                        {/* Floor Header */}
                        <div className="flex items-center gap-3 mb-3">
                          <h4 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                            {section.floor}
                          </h4>
                          <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-bold">
                            {section.rooms.length} ห้อง • {section.rooms.reduce((acc, r) => acc + r.count, 0)} รายการ
                          </span>
                        </div>

                        {/* Rooms Grid for Floor */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {section.rooms.map(({ room, count }) => (
                            <button
                              key={room}
                              onClick={() => {
                                setFloorFilter(section.floor)
                                setRoomFilter(room)
                                setShowRoomPicker(false)
                              }}
                              className="group relative overflow-hidden bg-white border-2 border-gray-200 hover:border-purple-400 rounded-2xl p-5 shadow-md hover:shadow-xl transition transform hover:scale-[1.02] text-left"
                            >
                              <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-pink-50 opacity-0 group-hover:opacity-100 transition" />
                              <div className="relative">
                                <div className="flex items-start justify-between mb-2">
                                  <div>
                                    <p className="text-2xl font-bold text-gray-900">{room}</p>
                                  </div>
                                  <span className="bg-gradient-to-br from-purple-100 to-pink-100 text-purple-700 px-3 py-1 rounded-full text-sm font-bold">
                                    {count}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-600 mt-3 pt-3 border-t border-gray-100">
                                  <span className="animate-pulse">👉</span>
                                  <span className="font-semibold">กดเพื่อดู</span>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {floorSections.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="text-6xl mb-4">📭</div>
                    <p className="text-gray-600 font-semibold">ยังไม่มีข้อมูลห้องให้เลือก</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="text-center mb-6 md:mb-8 pt-2 md:pt-4">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white drop-shadow-2xl mb-2 md:mb-3 animate-float">
            🎮 JUTHAZONE 🎮
          </h1>
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-white drop-shadow-lg font-semibold bg-white/20 backdrop-blur-sm inline-block px-4 py-2 md:px-6 md:py-2 rounded-full border-2 border-white/40">
            รายการทั้งหมด: {customers.length} รายการ | แสดง {filteredCustomers.length}
          </p>
        </div>

        <div className="flex justify-end mb-3 md:mb-4">
          <button
            onClick={() => setShowRoomPicker(true)}
            className="px-4 py-2 rounded-xl bg-white/20 border border-white/40 text-white font-semibold shadow hover:bg-white/30 transition"
          >
            🔎 เลือกห้องด่วน
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl md:rounded-3xl shadow-xl p-4 md:p-5 mb-4 md:mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-white font-semibold drop-shadow">ชั้น:</span>
              <button
                onClick={() => setFloorFilter('all')}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-all ${floorFilter === 'all' ? 'bg-white text-purple-700 shadow-lg' : 'bg-white/10 text-white border-white/40 hover:bg-white/20'}`}
              >
                ทั้งหมด ({customers.length})
              </button>
              {floorOptions.map((floor) => {
                const count = customers.filter((c) => extractFloor(c.room) === floor).length
                return (
                  <button
                    key={floor}
                    onClick={() => setFloorFilter((prev) => (prev === floor ? 'all' : floor))}
                    className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-all ${floorFilter === floor ? 'bg-white text-purple-700 shadow-lg' : 'bg-white/10 text-white border-white/40 hover:bg-white/20'}`}
                  >
                    {floor} ({count})
                  </button>
                )
              })}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-white font-semibold drop-shadow">ห้อง:</span>
              <select
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
                className="bg-white text-purple-700 font-semibold px-3 py-2 rounded-xl shadow focus:outline-none border border-purple-200"
              >
                <option value="all">ทุกห้อง</option>
                {roomOptions.map((room) => (
                  <option key={room} value={room}>{room}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {customers.length === 0 ? (
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl md:rounded-3xl shadow-2xl p-8 md:p-12 text-center border-4 border-white/50">
            <div className="text-6xl md:text-8xl mb-4 md:mb-6 animate-bounce-slow">🎯</div>
            <p className="text-2xl md:text-3xl text-gray-700 font-bold mb-2">ยังไม่มีรายการ</p>
            <p className="text-gray-500 text-base md:text-lg">รอลูกค้าเข้าใช้งาน</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl md:rounded-3xl shadow-2xl p-8 md:p-12 text-center border-4 border-white/50">
            <div className="text-6xl md:text-8xl mb-4 md:mb-6">🔍</div>
            <p className="text-2xl md:text-3xl text-gray-700 font-bold mb-2">
              {floorFilter !== 'all'
                ? `${floorFilter} ไม่มีลูกค้า`
                : 'ไม่พบรายการในตัวกรองนี้'}
            </p>
            <p className="text-gray-500 text-base md:text-lg">ลองเลือกชั้นหรือห้องอื่น</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {filteredCustomers.map((customer) => {
              const isLowTime = customer.displayTimeRemaining < 300 // Less than 5 minutes
              const totalDuration = customer.expectedEndTime && customer.startTime
                ? (new Date(customer.expectedEndTime) - new Date(customer.startTime)) / 1000
                : 1
              const elapsed = totalDuration - customer.displayTimeRemaining
              const progressPercent = Math.max(0, Math.min(100, (elapsed / totalDuration) * 100))

              return (
                <div
                  key={customer.id}
                  className={`relative overflow-hidden rounded-2xl md:rounded-3xl shadow-2xl p-4 md:p-6 border-2 transform transition-all duration-300 active:scale-95 ${
                    isLowTime
                      ? 'bg-gradient-to-br from-red-50 via-red-100 to-orange-50 border-red-400 card-urgent'
                      : 'bg-gradient-to-br from-white via-purple-50 to-indigo-50 border-purple-300/60 card-glow hover:border-purple-400'
                  }`}
                >
                  {/* Top shimmer accent */}
                  <div className={`absolute top-0 left-0 right-0 h-1 ${isLowTime ? 'bg-gradient-to-r from-red-500 via-orange-400 to-red-500' : 'bg-gradient-to-r from-purple-500 via-pink-400 to-purple-500'} shimmer-bg`} />

                  {/* Customer Name */}
                  <div className="mb-3 md:mb-4">
                    <h2 className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-purple-700 to-pink-600 bg-clip-text text-transparent mb-2">
                      👤 {customer.name}
                    </h2>
                    <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs sm:text-sm font-bold shadow-lg">
                      <span>📍</span> {customer.room}
                    </div>
                  </div>

                  {/* Note Section */}
                  {customer.note && (
                    <div className="mb-3 md:mb-4">
                      <div className="bg-amber-50 border border-amber-300 rounded-xl p-2.5 md:p-3">
                        <p className="text-xs text-amber-600 font-bold mb-0.5">📝 Note</p>
                        <p className="text-sm md:text-base text-gray-800 break-words">{customer.note}</p>
                      </div>
                    </div>
                  )}

                  {/* Countdown Timer */}
                  <div className={`mb-3 md:mb-4 ${isLowTime ? 'countdown-alert' : ''}`}>
                    <p className="text-xs sm:text-sm text-gray-500 mb-1.5 font-bold tracking-wide uppercase">⏰ เวลาที่เหลือ</p>
                    <div
                      className={`text-4xl sm:text-5xl md:text-6xl font-bold text-center py-4 md:py-5 rounded-2xl shadow-inner relative overflow-hidden ${
                        isLowTime
                          ? 'bg-gradient-to-br from-red-200 to-orange-200 text-red-800 border-2 border-red-300'
                          : 'bg-gradient-to-br from-emerald-100 to-green-100 text-emerald-800 border-2 border-emerald-300'
                      }`}
                    >
                      {formatTime(customer.displayTimeRemaining)}
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-2.5 bg-gray-200 rounded-full h-2.5 overflow-hidden shadow-inner">
                      <div
                        className={`progress-bar-inner h-full rounded-full ${
                          isLowTime
                            ? 'bg-gradient-to-r from-red-500 to-orange-500'
                            : 'bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500'
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-400 text-right mt-0.5 font-medium">{Math.round(progressPercent)}%</div>

                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-2 text-center">
                        <p className="text-[10px] text-blue-500 font-bold uppercase">เริ่ม</p>
                        <p className="text-sm md:text-base font-bold text-blue-700">
                          {formatTimeDisplay(customer.startTime)}
                        </p>
                      </div>
                      <div className="bg-orange-50 border border-orange-200 rounded-xl p-2 text-center">
                        <p className="text-[10px] text-orange-500 font-bold uppercase">จบ</p>
                        <p className="text-sm md:text-base font-bold text-orange-700">
                          {formatTimeDisplay(customer.expectedEndTime)}
                        </p>
                      </div>
                    </div>

                    {isLowTime && (
                      <p className="text-red-700 text-center mt-2 font-bold animate-pulse text-sm md:text-base bg-red-100 py-1.5 rounded-xl border border-red-300">
                        ⚠️ เวลาใกล้หมดแล้ว!
                      </p>
                    )}
                  </div>

                  {/* Cost */}
                  <div className="mb-3 md:mb-4">
                    <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-300 rounded-2xl p-3 md:p-4 shadow-sm">
                      <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">💰 ค่าใช้จ่าย</p>
                      <p className="text-2xl sm:text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                        ฿{customer.cost}
                      </p>
                    </div>
                  </div>

                  {/* Payment Status + Timer Status */}
                  <div className="grid grid-cols-2 gap-2">
                    <div
                      className={`rounded-xl p-2.5 text-center border ${
                        customer.isPaid
                          ? 'bg-emerald-50 border-emerald-300'
                          : 'bg-red-50 border-red-300'
                      }`}
                    >
                      <p className="text-[10px] text-gray-500 font-bold uppercase">การจ่ายเงิน</p>
                      <p className={`text-sm font-bold ${customer.isPaid ? 'text-emerald-600' : 'text-red-600'}`}>
                        {customer.isPaid ? '✅ จ่ายแล้ว' : '❌ ยังไม่จ่าย'}
                      </p>
                    </div>
                    <div className={`rounded-xl p-2.5 text-center border ${customer.isRunning ? 'bg-purple-50 border-purple-300' : 'bg-gray-50 border-gray-300'}`}>
                      <p className="text-[10px] text-gray-500 font-bold uppercase">สถานะ</p>
                      <p className={`text-sm font-bold ${customer.isRunning ? 'text-purple-600' : 'text-gray-500'}`}>
                        {customer.isRunning ? '⏳ กำลังจับเวลา' : '⏸️ หยุดแล้ว'}
                      </p>
                    </div>
                  </div>

                  {/* Call staff button */}
                  <div className="mt-3">
                    <button
                      onClick={() => handleCallStaff(customer)}
                      className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-2.5 md:py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.01] active:scale-95 transition-all duration-200"
                    >
                      📞 เรียกพนักงาน
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Auto-refresh indicator */}
        <div className="mt-6 md:mt-8 text-center">
          <p className="text-white text-sm sm:text-base md:text-lg drop-shadow-lg bg-white/20 backdrop-blur-sm inline-block px-4 py-2 md:px-6 md:py-3 rounded-full border-2 border-white/40 font-semibold animate-pulse">
            🔄 อัพเดทอัตโนมัติทุกวินาที
          </p>
        </div>
      </div>
    </div>
  )
}

export default CustomerView

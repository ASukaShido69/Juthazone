import { useMemo, useState } from 'react'
import { formatTimeDisplay, getDurationText, calculateTimeRemaining } from '../utils/timeFormat'
import { logActivity } from '../utils/authUtils'

function CustomerView({ customers }) {
  const [floorFilter, setFloorFilter] = useState('all')
  const [roomFilter, setRoomFilter] = useState('all')
  const [showRoomPicker, setShowRoomPicker] = useState(true)

  const extractFloor = (room = '') => {
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
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 animate-gradient p-3 md:p-4 lg:p-6 relative overflow-hidden">
      {/* Animated background shapes */}
      <div className="absolute -top-40 -left-40 w-80 h-80 bg-white/5 rounded-full blur-3xl animate-pulse" />
      <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-white/5 rounded-full blur-3xl animate-pulse" />
      
      <div className="max-w-6xl mx-auto relative z-10">
        {/* ROOM PICKER MODAL */}
        {showRoomPicker && customers.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
            <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={() => setShowRoomPicker(false)} />
            <div className="relative w-full h-[90vh] max-w-6xl bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-purple-500/30">
              {/* Animated Background */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
              <div className="absolute bottom-0 left-0 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
              
              {/* Header */}
              <div className="relative bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 px-6 md:px-10 py-8 md:py-10 flex items-center justify-between shadow-xl border-b border-white/10">
                <div>
                  <p className="text-blue-100 text-sm font-bold tracking-widest">🎮 เลือกห้องเพื่อดูรายการ</p>
                  <h2 className="text-4xl md:text-5xl font-black text-white mt-3 drop-shadow-lg">Room Selector</h2>
                </div>
                <button
                  onClick={() => setShowRoomPicker(false)}
                  className="bg-white/20 hover:bg-white/40 text-white p-4 rounded-full transition transform hover:scale-110 shadow-lg border border-white/20"
                >
                  ✕
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 md:p-10 relative z-10 scrollbar-hide">
                {/* Show All Rooms Button */}
                <div className="mb-12">
                  <button
                    onClick={() => { setFloorFilter('all'); setRoomFilter('all'); setShowRoomPicker(false) }}
                    className="w-full group relative overflow-hidden bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 hover:from-emerald-500 hover:via-teal-600 hover:to-cyan-700 text-white rounded-3xl p-8 md:p-10 shadow-2xl transition transform hover:scale-105 border-2 border-white/20 hover:border-white/40"
                  >
                    <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition" />
                    <div className="relative flex items-center justify-between">
                      <div className="text-left">
                        <p className="text-sm font-bold opacity-95 tracking-wide">ดูทั้งหมด</p>
                        <p className="text-4xl md:text-5xl font-black mt-2">📊 ทุกห้องในระบบ</p>
                      </div>
                      <div className="text-7xl animate-bounce">👁️</div>
                    </div>
                    <p className="text-sm md:text-base mt-4 opacity-95 font-semibold">รวม {customers.length} รายการ • กดเพื่อดูทั้งหมด</p>
                  </button>
                </div>

                {/* Rooms Grid by Floor */}
                <div className="mb-6">
                  <h3 className="text-3xl font-black text-white mb-8 drop-shadow-lg flex items-center gap-3">
                    🏢 แบ่งตามชั้น
                  </h3>
                  <div className="space-y-10">
                    {floorSections.map((section, idx) => (
                      <div key={section.floor} className="animate-fadeInUp" style={{ animationDelay: `${idx * 0.1}s` }}>
                        {/* Floor Header */}
                        <div className="flex items-center gap-4 mb-5">
                          <div className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-black shadow-lg text-2xl border-2 border-white/20">
                            {section.floor.match(/\d+/) ? section.floor.match(/\d+/)[0] : '1'}
                          </div>
                          <div className="flex-1">
                            <h4 className="text-3xl font-black text-white drop-shadow-lg">{section.floor}</h4>
                          </div>
                          <span className="px-5 py-3 rounded-full bg-gradient-to-r from-blue-400/30 to-purple-400/30 border-2 border-white/30 text-white text-sm font-bold">
                            {section.rooms.length} ห้อง • {section.rooms.reduce((acc, r) => acc + r.count, 0)} รายการ
                          </span>
                        </div>

                        {/* Rooms Grid for Floor */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 ml-0 md:ml-4">
                          {section.rooms.map(({ room, count }, roomIdx) => (
                            <button
                              key={room}
                              onClick={() => {
                                setFloorFilter(section.floor)
                                setRoomFilter(room)
                                setShowRoomPicker(false)
                              }}
                              className="group relative overflow-hidden bg-gradient-to-br from-white/95 to-blue-50/95 border-2 border-white/60 hover:border-purple-400 rounded-3xl p-7 shadow-xl hover:shadow-2xl transition transform hover:scale-105 hover:-translate-y-1 text-left backdrop-blur-sm"
                              style={{ animationDelay: `${idx * 0.1 + roomIdx * 0.05}s` }}
                            >
                              {/* Background Animation */}
                              <div className="absolute inset-0 bg-gradient-to-br from-purple-200/40 to-pink-200/40 opacity-0 group-hover:opacity-100 transition duration-300" />
                              <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-300 rounded-full opacity-0 group-hover:opacity-20 transition blur-2xl" />
                              
                              <div className="relative z-10">
                                <div className="flex items-start justify-between mb-5">
                                  <div>
                                    <p className="text-xs font-bold text-purple-600 uppercase tracking-widest">ห้องเลขที่</p>
                                    <p className="text-4xl font-black text-gray-900 mt-2 drop-shadow-sm">{room}</p>
                                  </div>
                                  <span className="bg-gradient-to-br from-purple-400 to-pink-500 text-white px-5 py-3 rounded-full text-2xl font-black shadow-lg border-2 border-white/20">
                                    {count}
                                  </span>
                                </div>
                                <div className="h-1.5 bg-gradient-to-r from-purple-300 to-pink-300 rounded-full mb-5" />
                                <div className="flex items-center gap-3 text-sm text-gray-700 font-bold">
                                  <span className="animate-bounce text-xl">👉</span>
                                  <span>กดเพื่อดูรายการ</span>
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
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="text-8xl mb-6 animate-bounce">📭</div>
                    <p className="text-white/70 font-bold text-xl">ยังไม่มีข้อมูลห้องให้เลือก</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MAIN CONTENT */}
        <div className="text-center mb-10 md:mb-12 pt-4 md:pt-6">
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-7xl font-black text-white drop-shadow-2xl mb-5 md:mb-6 animate-float">
            🎮 JUTHAZONE 🎮
          </h1>
          <p className="text-xl sm:text-2xl md:text-2xl text-white drop-shadow-lg font-black bg-gradient-to-r from-white/40 to-white/20 backdrop-blur-md inline-block px-8 py-4 md:px-10 md:py-5 rounded-2xl border-2 border-white/50 shadow-xl">
            📊 {customers.length} รายการ • 👁️ แสดง {filteredCustomers.length}
          </p>
        </div>

        {/* Quick Room Selector Button */}
        <div className="flex justify-end mb-6 md:mb-8">
          <button
            onClick={() => setShowRoomPicker(true)}
            className="px-7 py-4 rounded-2xl bg-gradient-to-r from-white/30 to-white/15 border-2 border-white/60 text-white font-black shadow-lg hover:from-white/40 hover:to-white/25 hover:border-white/80 transition transform hover:scale-110 backdrop-blur-md text-lg"
          >
            🔎 เลือกห้องด่วน
          </button>
        </div>

        {/* FILTER BAR */}
        <div className="bg-white/15 backdrop-blur-lg border-2 border-white/30 rounded-3xl shadow-xl p-5 md:p-7 mb-6 md:mb-8 border-purple-400/30">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-white font-black drop-shadow text-lg">ชั้น:</span>
              <button
                onClick={() => setFloorFilter('all')}
                className={`px-4 py-2.5 rounded-full text-sm font-bold border-2 transition-all ${floorFilter === 'all' ? 'bg-white text-purple-700 shadow-lg border-white' : 'bg-white/10 text-white border-white/40 hover:bg-white/20'}`}
              >
                ทั้งหมด ({customers.length})
              </button>
              {floorOptions.map((floor) => {
                const count = customers.filter((c) => extractFloor(c.room) === floor).length
                return (
                  <button
                    key={floor}
                    onClick={() => setFloorFilter((prev) => (prev === floor ? 'all' : floor))}
                    className={`px-4 py-2.5 rounded-full text-sm font-bold border-2 transition-all ${floorFilter === floor ? 'bg-white text-purple-700 shadow-lg border-white' : 'bg-white/10 text-white border-white/40 hover:bg-white/20'}`}
                  >
                    {floor} ({count})
                  </button>
                )
              })}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-white font-black drop-shadow text-lg">ห้อง:</span>
              <select
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
                className="bg-white text-purple-700 font-bold px-4 py-2.5 rounded-xl shadow-lg focus:outline-none border-2 border-purple-300"
              >
                <option value="all">ทุกห้อง</option>
                {roomOptions.map((room) => (
                  <option key={room} value={room}>{room}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* EMPTY STATE */}
        {customers.length === 0 ? (
          <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl p-10 md:p-16 text-center border-4 border-white/50">
            <div className="text-8xl md:text-9xl mb-6 md:mb-8 animate-bounce-slow">🎯</div>
            <p className="text-3xl md:text-4xl text-gray-800 font-black mb-3">ยังไม่มีรายการ</p>
            <p className="text-gray-500 text-lg md:text-xl font-semibold">รอลูกค้าเข้าใช้งาน</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl p-10 md:p-16 text-center border-4 border-white/50">
            <div className="text-8xl md:text-9xl mb-6 md:mb-8">🔍</div>
            <p className="text-3xl md:text-4xl text-gray-800 font-black mb-3">
              {floorFilter !== 'all'
                ? `${floorFilter} ไม่มีลูกค้า`
                : 'ไม่พบรายการในตัวกรองนี้'}
            </p>
            <p className="text-gray-500 text-lg md:text-xl font-semibold">ลองเลือกชั้นหรือห้องอื่น</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-7">
            {filteredCustomers.map((customer) => {
              const isLowTime = customer.displayTimeRemaining < 300
              const cardBgColor = isLowTime
                ? 'bg-gradient-to-br from-red-100 via-red-50 to-orange-100 border-red-500'
                : 'bg-gradient-to-br from-white via-purple-50 to-pink-50 border-purple-400'

              return (
                <div
                  key={customer.id}
                  className={`${cardBgColor} rounded-3xl shadow-2xl p-5 md:p-8 border-4 transform transition-all duration-300 hover:shadow-2xl hover:scale-105 active:scale-95`}
                >
                  {/* Customer Name */}
                  <div className="mb-5 md:mb-6">
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-black bg-gradient-to-r from-purple-700 to-pink-600 bg-clip-text text-transparent mb-3">
                      👤 {customer.name}
                    </h2>
                    <div className="inline-block bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-4 py-2 md:px-6 md:py-3 rounded-full text-sm sm:text-base font-black shadow-lg">
                      📍 {customer.room}
                    </div>
                  </div>

                  {/* Note Section */}
                  {customer.note && (
                    <div className="mb-5 md:mb-6">
                      <div className="bg-yellow-100 border-3 border-yellow-400 rounded-2xl p-3 md:p-4">
                        <p className="text-sm md:text-base text-gray-700 font-black mb-2">📝 หมายเหตุ</p>
                        <p className="text-base md:text-lg text-gray-800 break-words font-semibold">{customer.note}</p>
                      </div>
                    </div>
                  )}

                  {/* Countdown Timer */}
                  <div className={`mb-5 md:mb-6 ${isLowTime ? 'countdown-alert' : ''}`}>
                    <p className="text-sm md:text-base text-gray-600 mb-2 font-black">⏰ เวลาที่เหลือ</p>
                    <div
                      className={`text-5xl sm:text-6xl md:text-7xl font-black text-center py-6 md:py-8 rounded-2xl md:rounded-3xl shadow-inner ${
                        isLowTime
                          ? 'bg-gradient-to-br from-red-300 to-red-200 text-red-800 animate-pulse border-4 md:border-5 border-red-400'
                          : 'bg-gradient-to-br from-green-200 to-emerald-200 text-green-800 border-4 md:border-5 border-green-400'
                      }`}
                    >
                      {formatTime(customer.displayTimeRemaining)}
                    </div>
                    <div className="grid grid-cols-2 gap-3 md:gap-4 mt-4 md:mt-5">
                      <div className="bg-blue-100 border-3 border-blue-400 rounded-xl md:rounded-2xl p-3 md:p-4 text-center">
                        <p className="text-xs md:text-sm text-gray-600 font-black">🕐 เริ่ม</p>
                        <p className="text-base md:text-lg font-black text-blue-700">
                          {formatTimeDisplay(customer.startTime)}
                        </p>
                      </div>
                      <div className="bg-orange-100 border-3 border-orange-400 rounded-xl md:rounded-2xl p-3 md:p-4 text-center">
                        <p className="text-xs md:text-sm text-gray-600 font-black">🕑 จบ</p>
                        <p className="text-base md:text-lg font-black text-orange-700">
                          {formatTimeDisplay(customer.expectedEndTime)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 md:mt-5 text-center text-sm md:text-base text-gray-600 font-black">
                      ⏱️ เหลือ: {getDurationText(customer.displayTimeRemaining)}
                    </div>
                    {isLowTime && (
                      <p className="text-red-700 text-center mt-4 md:mt-5 font-black animate-pulse text-lg md:text-xl bg-red-200 py-3 md:py-4 rounded-xl md:rounded-2xl">
                        ⚠️ เวลาใกล้หมดแล้ว!
                      </p>
                    )}
                  </div>

                  {/* Cost */}
                  <div className="mb-5 md:mb-6">
                    <div className="bg-gradient-to-br from-yellow-200 to-orange-200 border-4 md:border-5 border-yellow-500 rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-lg">
                      <p className="text-sm md:text-base text-gray-700 font-black">💰 ค่าใช้จ่าย</p>
                      <p className="text-3xl sm:text-4xl md:text-5xl font-black bg-gradient-to-r from-yellow-700 to-orange-700 bg-clip-text text-transparent">
                        ฿{customer.cost}
                      </p>
                    </div>
                  </div>

                  {/* Status Section */}
                  <div className="mb-5 md:mb-6 grid grid-cols-2 gap-3 md:gap-4">
                    <div
                      className={`rounded-2xl md:rounded-3xl p-4 md:p-5 text-center border-3 font-black ${
                        customer.isPaid
                          ? 'bg-green-100 border-green-500 text-green-700'
                          : 'bg-red-100 border-red-500 text-red-700'
                      }`}
                    >
                      <p className="text-xs md:text-sm text-gray-600 font-black mb-2">💰 สถานะการจ่าย</p>
                      <p className="text-lg md:text-xl">
                        {customer.isPaid ? '✅ จ่ายแล้ว' : '❌ ยังไม่จ่าย'}
                      </p>
                    </div>
                    <div className="bg-purple-100 border-3 border-purple-400 rounded-2xl md:rounded-3xl p-4 md:p-5 text-center font-black">
                      <p className="text-xs md:text-sm text-gray-600 mb-2">🎯 สถานะ</p>
                      <p className="text-lg md:text-xl text-purple-700">
                        {customer.isRunning ? '⏳ กำลังจับเวลา' : '⏸️ หยุดแล้ว'}
                      </p>
                    </div>
                  </div>

                  {/* Payment Badge */}
                  <div className="flex justify-center mb-5 md:mb-6">
                    <span
                      className={`inline-block px-6 md:px-8 py-3 md:py-4 rounded-2xl md:rounded-3xl text-lg md:text-2xl font-black shadow-xl transform active:scale-95 transition-all duration-300 ${
                        customer.isPaid
                          ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                          : 'bg-gradient-to-r from-red-500 to-pink-500 text-white animate-pulse'
                      }`}
                    >
                      {customer.isPaid ? '✅ จ่ายเงินแล้ว' : '❌ ยังไม่ได้จ่าย'}
                    </span>
                  </div>

                  {/* Call Staff Button */}
                  <div>
                    <button
                      onClick={() => handleCallStaff(customer)}
                      className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-black py-4 md:py-5 px-4 rounded-2xl md:rounded-3xl shadow-xl hover:shadow-2xl transform hover:scale-105 active:scale-95 transition-all duration-300 text-lg md:text-xl"
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
        <div className="mt-10 md:mt-12 text-center">
          <p className="text-white text-base sm:text-lg md:text-xl drop-shadow-lg bg-white/20 backdrop-blur-md inline-block px-6 py-3 md:px-8 md:py-4 rounded-2xl border-2 border-white/40 font-black animate-pulse">
            🔄 อัพเดทอัตโนมัติทุกวินาที
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out forwards;
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out forwards;
        }
        
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  )
}

export default CustomerView

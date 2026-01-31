import { useMemo, useState, useEffect } from 'react'
import { formatTimeDisplay, getDurationText, calculateTimeRemaining } from '../utils/timeFormat'
import { logActivity } from '../utils/authUtils'

// Constants
const LOW_TIME_THRESHOLD = 300 // 5 minutes
const CRITICAL_TIME_THRESHOLD = 60 // 1 minute
const UPDATE_INTERVAL = 1000 // 1 second

// Helper function
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

// Sub-components
const TimeCard = ({ label, time, icon, colorClass }) => (
  <div className={`${colorClass} rounded-xl p-3 text-center shadow-md`}>
    <p className="text-xs text-gray-600 font-semibold flex items-center justify-center gap-1">
      <span>{icon}</span>
      <span>{label}</span>
    </p>
    <p className="text-lg font-bold mt-1">{formatTimeDisplay(time)}</p>
  </div>
)

const StatusBadge = ({ isPaid, isRunning }) => {
  if (isPaid) {
    return (
      <div className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 rounded-full shadow-lg">
        <span className="text-xl">✅</span>
        <span className="font-bold">ชำระเงินแล้ว</span>
      </div>
    )
  }
  
  return (
    <div className="flex items-center gap-2">
      <div className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg ${
        isRunning 
          ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
          : 'bg-gradient-to-r from-gray-400 to-gray-500 text-white'
      }`}>
        <span className="text-xl">{isRunning ? '⏳' : '⏸️'}</span>
        <span className="font-bold">{isRunning ? 'กำลังใช้งาน' : 'หยุดชั่วคราว'}</span>
      </div>
      <div className="flex items-center gap-2 bg-gradient-to-r from-red-500 to-pink-500 text-white px-4 py-2 rounded-full shadow-lg animate-pulse">
        <span className="text-xl">💳</span>
        <span className="font-bold">รอชำระเงิน</span>
      </div>
    </div>
  )
}

const CountdownDisplay = ({ timeRemaining, startTime, endTime, formatTime }) => {
  const isLowTime = timeRemaining < LOW_TIME_THRESHOLD
  const isCritical = timeRemaining < CRITICAL_TIME_THRESHOLD
  
  const getTimerColor = () => {
    if (isCritical) return 'from-red-500 to-pink-500 border-red-600'
    if (isLowTime) return 'from-orange-400 to-red-400 border-orange-600'
    return 'from-emerald-400 to-green-400 border-green-600'
  }
  
  const getTextColor = () => {
    if (isCritical) return 'text-white'
    if (isLowTime) return 'text-white'
    return 'text-white'
  }
  
  return (
    <div className="space-y-3">
      {/* Main Timer */}
      <div className={`relative overflow-hidden bg-gradient-to-br ${getTimerColor()} rounded-2xl p-6 border-4 shadow-2xl ${isCritical ? 'animate-pulse' : ''}`}>
        {isCritical && (
          <div className="absolute inset-0 bg-white/20 animate-ping" />
        )}
        <div className="relative">
          <p className="text-sm font-semibold text-white/90 mb-2 flex items-center justify-center gap-2">
            <span className="text-2xl">⏰</span>
            <span>เวลาที่เหลือ</span>
          </p>
          <div className={`text-6xl md:text-7xl font-black text-center ${getTextColor()} tracking-wider`}>
            {formatTime(timeRemaining)}
          </div>
          <p className="text-sm text-white/90 text-center mt-3 font-semibold">
            {getDurationText(timeRemaining)}
          </p>
        </div>
      </div>
      
      {/* Warning Messages */}
      {isCritical && (
        <div className="bg-red-600 text-white rounded-xl p-4 text-center shadow-lg border-2 border-red-700 animate-bounce">
          <p className="font-black text-lg flex items-center justify-center gap-2">
            <span className="text-2xl">🚨</span>
            <span>เวลาใกล้หมดแล้ว!</span>
            <span className="text-2xl">🚨</span>
          </p>
        </div>
      )}
      {isLowTime && !isCritical && (
        <div className="bg-orange-500 text-white rounded-xl p-3 text-center shadow-lg">
          <p className="font-bold flex items-center justify-center gap-2">
            <span className="text-xl">⚠️</span>
            <span>เหลือเวลาไม่มาก</span>
          </p>
        </div>
      )}
      
      {/* Time Details */}
      <div className="grid grid-cols-2 gap-3">
        <TimeCard 
          label="เริ่มเวลา" 
          time={startTime} 
          icon="🕐"
          colorClass="bg-gradient-to-br from-blue-100 to-blue-200 border-2 border-blue-400"
        />
        <TimeCard 
          label="เวลาสิ้นสุด" 
          time={endTime} 
          icon="🕑"
          colorClass="bg-gradient-to-br from-purple-100 to-purple-200 border-2 border-purple-400"
        />
      </div>
    </div>
  )
}

const CustomerCard = ({ customer, onCallStaff, formatTime }) => {
  const isLowTime = customer.displayTimeRemaining < LOW_TIME_THRESHOLD
  const isCritical = customer.displayTimeRemaining < CRITICAL_TIME_THRESHOLD
  
  const getCardStyle = () => {
    if (isCritical) return 'bg-gradient-to-br from-red-50 via-pink-50 to-red-100 border-red-400 shadow-red-200'
    if (isLowTime) return 'bg-gradient-to-br from-orange-50 via-yellow-50 to-orange-100 border-orange-400 shadow-orange-200'
    return 'bg-gradient-to-br from-white via-blue-50 to-purple-50 border-purple-300 shadow-purple-200'
  }
  
  return (
    <div className={`${getCardStyle()} rounded-3xl shadow-xl p-6 border-4 transform transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl relative overflow-hidden`}>
      {/* Background Pattern */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12" />
      
      <div className="relative space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-2xl shadow-lg">
                👤
              </div>
              <div>
                <h3 className="text-2xl font-black bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  {customer.name}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-md">
                    📍 {customer.room}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Note */}
        {customer.note && (
          <div className="bg-gradient-to-br from-yellow-100 to-amber-100 border-2 border-yellow-400 rounded-xl p-4 shadow-md">
            <div className="flex items-start gap-2">
              <span className="text-2xl">📝</span>
              <div className="flex-1">
                <p className="text-xs font-bold text-gray-600 mb-1">หมายเหตุ</p>
                <p className="text-sm text-gray-800 font-medium leading-relaxed">{customer.note}</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Countdown */}
        <CountdownDisplay 
          timeRemaining={customer.displayTimeRemaining}
          startTime={customer.startTime}
          endTime={customer.expectedEndTime}
          formatTime={formatTime}
        />
        
        {/* Cost */}
        <div className="bg-gradient-to-br from-amber-200 via-yellow-200 to-orange-200 border-4 border-yellow-500 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-4xl">💰</span>
              <div>
                <p className="text-xs font-bold text-gray-700">ค่าใช้จ่าย</p>
                <p className="text-4xl font-black bg-gradient-to-r from-yellow-700 to-orange-700 bg-clip-text text-transparent">
                  ฿{customer.cost.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Status */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <StatusBadge isPaid={customer.isPaid} isRunning={customer.isRunning} />
        </div>
        
        {/* Actions */}
        <button
          onClick={() => onCallStaff(customer)}
          className="w-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white font-bold py-4 px-6 rounded-2xl shadow-xl hover:shadow-2xl transform hover:scale-[1.02] active:scale-95 transition-all duration-300 flex items-center justify-center gap-3"
        >
          <span className="text-2xl">📞</span>
          <span className="text-lg">เรียกพนักงาน</span>
        </button>
      </div>
    </div>
  )
}

const RoomPickerModal = ({ 
  show, 
  onClose, 
  floorSections, 
  customers,
  onSelectRoom,
  onSelectAll 
}) => {
  if (!show) return null
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-md" 
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-7xl h-[90vh] bg-gradient-to-br from-slate-50 via-white to-blue-50 rounded-3xl shadow-2xl overflow-hidden flex flex-col border-4 border-white/50">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-4xl">🎮</span>
                <h2 className="text-4xl font-black text-white">เลือกห้อง</h2>
              </div>
              <p className="text-blue-100 font-semibold">เลือกห้องที่ต้องการดูรายละเอียด</p>
            </div>
            <button
              onClick={onClose}
              className="w-12 h-12 bg-white/20 hover:bg-white/30 text-white rounded-full flex items-center justify-center text-2xl font-bold transition-all duration-300 hover:rotate-90"
            >
              ✕
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {/* View All Button */}
          <button
            onClick={onSelectAll}
            className="w-full group relative overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.01] mb-8"
          >
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex items-center justify-between text-white">
              <div className="flex items-center gap-4">
                <span className="text-6xl">👁️</span>
                <div className="text-left">
                  <p className="text-sm font-semibold opacity-90">ดูทั้งหมด</p>
                  <p className="text-3xl font-black">ทุกห้องในระบบ</p>
                  <p className="text-sm opacity-90 mt-1">รวม {customers.length} รายการ</p>
                </div>
              </div>
              <span className="text-5xl">📊</span>
            </div>
          </button>
          
          {/* Floors */}
          <div className="space-y-8">
            {floorSections.map((section) => (
              <div key={section.floor}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-5 py-2 rounded-full shadow-lg">
                    <span className="text-2xl">🏢</span>
                    <h3 className="text-xl font-black">{section.floor}</h3>
                  </div>
                  <div className="bg-blue-100 text-blue-700 px-4 py-2 rounded-full font-bold text-sm shadow">
                    {section.rooms.length} ห้อง • {section.rooms.reduce((acc, r) => acc + r.count, 0)} รายการ
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {section.rooms.map(({ room, count }) => (
                    <button
                      key={room}
                      onClick={() => onSelectRoom(section.floor, room)}
                      className="group relative overflow-hidden bg-white hover:bg-gradient-to-br hover:from-purple-50 hover:to-pink-50 border-3 border-gray-200 hover:border-purple-400 rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.05] text-left"
                    >
                      <div className="relative">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-3xl">🚪</span>
                            <p className="text-2xl font-black text-gray-900">{room}</p>
                          </div>
                          <span className="bg-gradient-to-br from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-md">
                            {count}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600 pt-3 border-t border-gray-200 group-hover:border-purple-300">
                          <span className="group-hover:animate-pulse">👉</span>
                          <span className="font-bold">คลิกเพื่อดูรายการ</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          {floorSections.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="text-8xl mb-4">📭</div>
              <p className="text-2xl text-gray-600 font-bold">ยังไม่มีข้อมูลห้องให้เลือก</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const FilterBar = ({ 
  floorFilter, 
  roomFilter, 
  floorOptions, 
  roomOptions, 
  floorCounts,
  totalCount,
  onFloorChange, 
  onRoomChange,
  onOpenRoomPicker
}) => (
  <div className="bg-white/95 backdrop-blur-lg border-2 border-white/50 rounded-3xl shadow-2xl p-6 mb-6">
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      {/* Floor Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-gray-700 font-bold flex items-center gap-2">
          <span className="text-xl">🏢</span>
          <span>ชั้น:</span>
        </span>
        <button
          onClick={() => onFloorChange('all')}
          className={`px-4 py-2 rounded-full text-sm font-bold border-2 transition-all duration-300 ${
            floorFilter === 'all' 
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border-purple-600 shadow-lg scale-105' 
              : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400 hover:shadow-md'
          }`}
        >
          ทั้งหมด ({totalCount})
        </button>
        {floorOptions.map((floor) => (
          <button
            key={floor}
            onClick={() => onFloorChange(floor === floorFilter ? 'all' : floor)}
            className={`px-4 py-2 rounded-full text-sm font-bold border-2 transition-all duration-300 ${
              floorFilter === floor 
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white border-blue-600 shadow-lg scale-105' 
                : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:shadow-md'
            }`}
          >
            {floor} ({floorCounts[floor] || 0})
          </button>
        ))}
      </div>
      
      {/* Room Filter & Quick Picker */}
      <div className="flex items-center gap-3">
        <span className="text-gray-700 font-bold flex items-center gap-2">
          <span className="text-xl">🚪</span>
          <span>ห้อง:</span>
        </span>
        <select
          value={roomFilter}
          onChange={(e) => onRoomChange(e.target.value)}
          className="bg-white text-gray-700 font-bold px-4 py-2 rounded-xl shadow-md focus:outline-none focus:ring-4 focus:ring-purple-300 border-2 border-gray-300 hover:border-purple-400 transition-all"
        >
          <option value="all">ทุกห้อง</option>
          {roomOptions.map((room) => (
            <option key={room} value={room}>{room}</option>
          ))}
        </select>
        <button
          onClick={onOpenRoomPicker}
          className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold px-5 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2"
        >
          <span className="text-xl">🔍</span>
          <span>เลือกห้องด่วน</span>
        </button>
      </div>
    </div>
  </div>
)

function CustomerView({ customers }) {
  const [floorFilter, setFloorFilter] = useState('all')
  const [roomFilter, setRoomFilter] = useState('all')
  const [showRoomPicker, setShowRoomPicker] = useState(false)
  const [currentTime, setCurrentTime] = useState(Date.now())
  
  // Update time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now())
    }, UPDATE_INTERVAL)
    
    return () => clearInterval(interval)
  }, [])
  
  // Keyboard support
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && showRoomPicker) {
        setShowRoomPicker(false)
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [showRoomPicker])
  
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
  
  const floorCounts = useMemo(() => {
    const counts = {}
    customers.forEach(c => {
      const floor = extractFloor(c.room)
      counts[floor] = (counts[floor] || 0) + 1
    })
    return counts
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
        ? calculateTimeRemaining(customer.startTime, customer.expectedEndTime, currentTime)
        : customer.timeRemaining
    }))
  }, [customers, currentTime])
  
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
      alert('เรียกพนักงานแล้ว ✅')
    } catch (error) {
      console.error('Call staff error:', error)
      alert(`เกิดข้อผิดพลาด: ${error.message || 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์'}`)
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
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Room Picker Modal */}
        <RoomPickerModal 
          show={showRoomPicker}
          onClose={() => setShowRoomPicker(false)}
          floorSections={floorSections}
          customers={customers}
          onSelectRoom={(floor, room) => {
            setFloorFilter(floor)
            setRoomFilter(room)
            setShowRoomPicker(false)
          }}
          onSelectAll={() => {
            setFloorFilter('all')
            setRoomFilter('all')
            setShowRoomPicker(false)
          }}
        />
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-block bg-white/10 backdrop-blur-lg rounded-3xl px-8 py-6 mb-4 border-2 border-white/30 shadow-2xl">
            <h1 className="text-5xl lg:text-7xl font-black text-white drop-shadow-2xl mb-3 flex items-center justify-center gap-4">
              <span className="animate-bounce">🎮</span>
              <span>JUTHAZONE</span>
              <span className="animate-bounce">🎮</span>
            </h1>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <div className="bg-white/90 text-purple-700 px-6 py-3 rounded-full font-black text-lg shadow-lg flex items-center gap-2">
                <span className="text-2xl">📊</span>
                <span>ทั้งหมด: {customers.length}</span>
              </div>
              <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-6 py-3 rounded-full font-black text-lg shadow-lg flex items-center gap-2">
                <span className="text-2xl">👁️</span>
                <span>กำลังแสดง: {filteredCustomers.length}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Filter Bar */}
        <FilterBar 
          floorFilter={floorFilter}
          roomFilter={roomFilter}
          floorOptions={floorOptions}
          roomOptions={roomOptions}
          floorCounts={floorCounts}
          totalCount={customers.length}
          onFloorChange={setFloorFilter}
          onRoomChange={setRoomFilter}
          onOpenRoomPicker={() => setShowRoomPicker(true)}
        />
        
        {/* Content */}
        {customers.length === 0 ? (
          <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-20 text-center border-4 border-white/50">
            <div className="text-9xl mb-6 animate-bounce">🎯</div>
            <p className="text-4xl text-gray-700 font-black mb-3">ยังไม่มีรายการ</p>
            <p className="text-gray-500 text-xl">รอลูกค้าเข้าใช้งาน</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-20 text-center border-4 border-white/50">
            <div className="text-9xl mb-6">🔍</div>
            <p className="text-4xl text-gray-700 font-black mb-3">
              {floorFilter !== 'all' ? `${floorFilter} ไม่มีลูกค้า` : 'ไม่พบรายการในตัวกรองนี้'}
            </p>
            <p className="text-gray-500 text-xl">ลองเลือกชั้นหรือห้องอื่น</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredCustomers.map((customer) => (
              <CustomerCard 
                key={customer.id}
                customer={customer}
                onCallStaff={handleCallStaff}
                formatTime={formatTime}
              />
            ))}
          </div>
        )}
        
        {/* Footer */}
        <div className="mt-8 text-center">
          <div className="inline-block bg-white/20 backdrop-blur-lg border-2 border-white/40 px-6 py-3 rounded-full shadow-xl">
            <p className="text-white font-bold flex items-center gap-3">
              <span className="text-2xl animate-spin">🔄</span>
              <span>อัพเดทอัตโนมัติทุกวินาที</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CustomerView
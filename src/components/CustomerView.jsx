import { useMemo, useState, useEffect, useCallback } from 'react'
import { formatTimeDisplay, getDurationText, calculateTimeRemaining } from '../utils/timeFormat'
import { logActivity } from '../utils/authUtils'

// Constants
const LOW_TIME_THRESHOLD = 300
const CRITICAL_TIME_THRESHOLD = 60
const UPDATE_INTERVAL = 1000

// Helper function
const extractFloor = (room = '') => {
  const thaiFloor = room.match(/ชั้น\s*(\d+)/i)
  if (thaiFloor) return `ชั้น ${thaiFloor[1]}`
  const numericLead = room.match(/^(\d+)/)
  if (numericLead) return `ชั้น ${numericLead[1]}`
  const fx = room.match(/(\d+)f/i)
  if (fx) return `ชั้น ${fx[1]}`
  return 'อื่นๆ'
}

// ============================================
// 🎨 FUTURISTIC SUB-COMPONENTS
// ============================================

// Animated Particles Background
const ParticleBackground = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
    {[...Array(20)].map((_, i) => (
      <div
        key={i}
        className="absolute rounded-full bg-white/10 animate-float-particle"
        style={{
          width: `${Math.random() * 20 + 5}px`,
          height: `${Math.random() * 20 + 5}px`,
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          animationDelay: `${Math.random() * 5}s`,
          animationDuration: `${Math.random() * 10 + 10}s`,
        }}
      />
    ))}
  </div>
)

// Neon Glow Text
const NeonTitle = ({ children }) => (
  <h1 className="relative">
    <span className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 animate-gradient-x drop-shadow-2xl">
      {children}
    </span>
    <span className="absolute inset-0 text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 blur-xl opacity-50 animate-pulse">
      {children}
    </span>
  </h1>
)

// Holographic Badge
const HoloBadge = ({ icon, value, label, color = 'purple' }) => {
  const colors = {
    purple: 'from-purple-500/20 to-pink-500/20 border-purple-400/50 text-purple-100',
    cyan: 'from-cyan-500/20 to-blue-500/20 border-cyan-400/50 text-cyan-100',
    emerald: 'from-emerald-500/20 to-teal-500/20 border-emerald-400/50 text-emerald-100',
  }
  return (
    <div className={`relative group backdrop-blur-xl bg-gradient-to-br ${colors[color]} border rounded-2xl px-6 py-4 shadow-2xl hover:scale-105 transition-all duration-500`}>
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative flex items-center gap-3">
        <span className="text-3xl">{icon}</span>
        <div>
          <p className="text-sm opacity-80">{label}</p>
          <p className="text-2xl font-black">{value}</p>
        </div>
      </div>
    </div>
  )
}

// Futuristic Timer Display
const CyberTimer = ({ timeRemaining, formatTime }) => {
  const isCritical = timeRemaining < CRITICAL_TIME_THRESHOLD
  const isLow = timeRemaining < LOW_TIME_THRESHOLD
  
  const getGradient = () => {
    if (isCritical) return 'from-red-600 via-pink-600 to-red-600'
    if (isLow) return 'from-orange-500 via-amber-500 to-orange-500'
    return 'from-emerald-500 via-cyan-500 to-emerald-500'
  }
  
  const getBorderColor = () => {
    if (isCritical) return 'border-red-400 shadow-red-500/50'
    if (isLow) return 'border-orange-400 shadow-orange-500/50'
    return 'border-emerald-400 shadow-emerald-500/50'
  }

  return (
    <div className={`relative overflow-hidden rounded-3xl border-2 ${getBorderColor()} shadow-2xl`}>
      {/* Animated background */}
      <div className={`absolute inset-0 bg-gradient-to-r ${getGradient()} animate-gradient-x opacity-90`} />
      
      {/* Scan line effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/10 to-transparent animate-scan" />
      
      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), 
                          linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
        backgroundSize: '20px 20px'
      }} />
      
      <div className="relative p-8">
        <div className="text-center">
          <p className="text-white/80 text-sm font-bold mb-2 tracking-widest uppercase flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            เวลาคงเหลือ
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          </p>
          
          <div className={`font-mono text-6xl md:text-8xl font-black text-white tracking-wider ${isCritical ? 'animate-pulse' : ''}`}>
            {formatTime(timeRemaining)}
          </div>
          
          <p className="text-white/70 text-sm mt-3 font-medium">
            {getDurationText(timeRemaining)}
          </p>
        </div>
      </div>
      
      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white/50 rounded-tl-xl" />
      <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white/50 rounded-tr-xl" />
      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white/50 rounded-bl-xl" />
      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white/50 rounded-br-xl" />
    </div>
  )
}

// Status Pills
const StatusPill = ({ isPaid, isRunning }) => (
  <div className="flex flex-wrap items-center justify-center gap-3">
    <div className={`
      relative overflow-hidden px-6 py-3 rounded-full font-bold text-sm
      ${isPaid 
        ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-emerald-500/50' 
        : 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-red-500/50 animate-pulse'
      } shadow-lg
    `}>
      <span className="relative z-10 flex items-center gap-2">
        {isPaid ? '✅' : '💳'}
        {isPaid ? 'ชำระแล้ว' : 'รอชำระเงิน'}
      </span>
    </div>
    
    <div className={`
      px-6 py-3 rounded-full font-bold text-sm text-white shadow-lg
      ${isRunning 
        ? 'bg-gradient-to-r from-blue-500 to-purple-500 shadow-blue-500/50' 
        : 'bg-gradient-to-r from-gray-500 to-slate-500 shadow-gray-500/50'
      }
    `}>
      <span className="flex items-center gap-2">
        {isRunning ? '⏳' : '⏸️'}
        {isRunning ? 'กำลังใช้งาน' : 'หยุดชั่วคราว'}
      </span>
    </div>
  </div>
)

// Futuristic Customer Card
const FuturisticCard = ({ customer, onCallStaff, formatTime }) => {
  const isCritical = customer.displayTimeRemaining < CRITICAL_TIME_THRESHOLD
  const isLow = customer.displayTimeRemaining < LOW_TIME_THRESHOLD
  
  const cardGlow = isCritical 
    ? 'shadow-red-500/30 hover:shadow-red-500/50' 
    : isLow 
      ? 'shadow-orange-500/30 hover:shadow-orange-500/50'
      : 'shadow-purple-500/30 hover:shadow-purple-500/50'

  return (
    <div className={`
      group relative overflow-hidden
      bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90
      backdrop-blur-xl border border-white/10
      rounded-3xl shadow-2xl ${cardGlow}
      transition-all duration-500 hover:scale-[1.02] hover:-translate-y-2
    `}>
      {/* Animated border gradient */}
      <div className="absolute inset-0 rounded-3xl p-[1px] bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className="absolute inset-[1px] rounded-3xl bg-slate-900" />
      </div>
      
      {/* Glow effect */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl group-hover:bg-purple-500/40 transition-all duration-500" />
      <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-cyan-500/20 rounded-full blur-3xl group-hover:bg-cyan-500/40 transition-all duration-500" />
      
      <div className="relative p-6 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-3xl shadow-lg shadow-purple-500/30">
                👤
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-900 animate-pulse" />
            </div>
            <div>
              <h3 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-200 to-pink-200">
                {customer.name}
              </h3>
              <div className="flex items-center gap-2 mt-2">
                <span className="px-4 py-1.5 rounded-full bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-400/30 text-cyan-300 text-sm font-bold">
                  📍 {customer.room}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Note */}
        {customer.note && (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-400/30 p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">📝</span>
              <div>
                <p className="text-amber-400 text-xs font-bold tracking-wider uppercase mb-1">หมายเหตุ</p>
                <p className="text-amber-100/90 text-sm leading-relaxed">{customer.note}</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Timer */}
        <CyberTimer timeRemaining={customer.displayTimeRemaining} formatTime={formatTime} />
        
        {/* Time Details */}
        <div className="grid grid-cols-2 gap-4">
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-400/30 p-4 text-center">
            <p className="text-blue-400 text-xs font-bold tracking-wider uppercase mb-1">🕐 เริ่ม</p>
            <p className="text-white text-lg font-bold">{formatTimeDisplay(customer.startTime)}</p>
          </div>
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-400/30 p-4 text-center">
            <p className="text-purple-400 text-xs font-bold tracking-wider uppercase mb-1">🕑 สิ้นสุด</p>
            <p className="text-white text-lg font-bold">{formatTimeDisplay(customer.expectedEndTime)}</p>
          </div>
        </div>
        
        {/* Cost Display */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500/20 via-yellow-500/20 to-orange-500/20 border border-amber-400/50 p-6">
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/20 rounded-full blur-3xl" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-5xl">💰</span>
              <div>
                <p className="text-amber-400/80 text-xs font-bold tracking-wider uppercase">ค่าใช้จ่าย</p>
                <p className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-300 to-orange-300">
                  ฿{customer.cost?.toLocaleString() || 0}
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Status */}
        <StatusPill isPaid={customer.isPaid} isRunning={customer.isRunning} />
        
        {/* Call Staff Button */}
        <button
          onClick={() => onCallStaff(customer)}
          className="
            w-full relative overflow-hidden group/btn
            bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600
            hover:from-blue-500 hover:via-purple-500 hover:to-pink-500
            text-white font-bold py-5 px-8 rounded-2xl
            shadow-xl shadow-purple-500/30 hover:shadow-purple-500/50
            transition-all duration-300 transform hover:scale-[1.02] active:scale-95
          "
        >
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000" />
          <span className="relative flex items-center justify-center gap-3 text-lg">
            <span className="text-2xl">📞</span>
            เรียกพนักงาน
          </span>
        </button>
      </div>
    </div>
  )
}

// Room Picker Modal
const RoomPickerModal = ({ show, onClose, floorSections, customers, onSelectRoom, onSelectAll }) => {
  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={onClose} />
      
      <div className="relative w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/95 via-purple-900/95 to-slate-900/95 shadow-2xl">
        {/* Animated background */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" />
        </div>
        
        {/* Header */}
        <div className="relative bg-gradient-to-r from-blue-600/90 via-purple-600/90 to-pink-600/90 backdrop-blur-xl px-8 py-8 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center text-4xl backdrop-blur-sm border border-white/20">
                🎮
              </div>
              <div>
                <h2 className="text-4xl font-black text-white">Room Selector</h2>
                <p className="text-white/70 mt-1">เลือกห้องที่ต้องการดู</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-14 h-14 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center text-2xl transition-all duration-300 hover:rotate-90 hover:scale-110"
            >
              ✕
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="relative overflow-y-auto max-h-[calc(90vh-140px)] p-8">
          {/* View All Button */}
          <button
            onClick={onSelectAll}
            className="w-full group relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600/80 to-cyan-600/80 hover:from-emerald-500 hover:to-cyan-500 border border-emerald-400/30 p-8 mb-8 transition-all duration-500 hover:scale-[1.02]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            <div className="relative flex items-center justify-between text-white">
              <div className="flex items-center gap-5">
                <span className="text-6xl">👁️</span>
                <div className="text-left">
                  <p className="text-emerald-200 text-sm font-bold tracking-wider uppercase">ดูทั้งหมด</p>
                  <p className="text-4xl font-black">ทุกห้องในระบบ</p>
                  <p className="text-emerald-200/80 mt-1">รวม {customers.length} รายการ</p>
                </div>
              </div>
              <span className="text-6xl opacity-50 group-hover:opacity-100 group-hover:scale-110 transition-all">→</span>
            </div>
          </button>
          
          {/* Floor Sections */}
          <div className="space-y-8">
            {floorSections.map((section, idx) => (
              <div key={section.floor} className="animate-fadeInUp" style={{ animationDelay: `${idx * 0.1}s` }}>
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600/80 to-purple-600/80 border border-blue-400/30">
                    <span className="text-2xl">🏢</span>
                    <h3 className="text-2xl font-black text-white">{section.floor}</h3>
                  </div>
                  <span className="px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white/80 text-sm font-bold">
                    {section.rooms.length} ห้อง • {section.rooms.reduce((acc, r) => acc + r.count, 0)} รายการ
                  </span>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {section.rooms.map(({ room, count }) => (
                    <button
                      key={room}
                      onClick={() => onSelectRoom(section.floor, room)}
                      className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/5 to-white/10 hover:from-purple-500/20 hover:to-pink-500/20 border border-white/10 hover:border-purple-400/50 p-6 transition-all duration-300 hover:scale-105"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-pink-500/0 group-hover:from-purple-500/10 group-hover:to-pink-500/10 transition-all duration-300" />
                      <div className="relative">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-3xl">🚪</span>
                          <span className="px-3 py-1 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-bold">
                            {count}
                          </span>
                        </div>
                        <p className="text-2xl font-black text-white">{room}</p>
                        <p className="text-white/50 text-sm mt-2 group-hover:text-white/80 transition-colors">
                          คลิกเพื่อดู →
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          {floorSections.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20">
              <span className="text-8xl mb-4">📭</span>
              <p className="text-2xl text-white/60 font-bold">ยังไม่มีข้อมูลห้อง</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Filter Bar Component
const FilterBar = ({ floorFilter, roomFilter, floorOptions, roomOptions, floorCounts, totalCount, onFloorChange, onRoomChange, onOpenRoomPicker }) => (
  <div className="relative overflow-hidden backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl shadow-2xl p-6 mb-8">
    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-transparent to-cyan-500/5" />
    
    <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      {/* Floor Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-white/70 font-bold flex items-center gap-2">
          <span className="text-xl">🏢</span>
          ชั้น:
        </span>
        <button
          onClick={() => onFloorChange('all')}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
            floorFilter === 'all'
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30 scale-105'
              : 'bg-white/10 text-white/70 hover:bg-white/20 border border-white/10'
          }`}
        >
          ทั้งหมด ({totalCount})
        </button>
        {floorOptions.map((floor) => (
          <button
            key={floor}
            onClick={() => onFloorChange(floor === floorFilter ? 'all' : floor)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
              floorFilter === floor
                ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/30 scale-105'
                : 'bg-white/10 text-white/70 hover:bg-white/20 border border-white/10'
            }`}
          >
            {floor} ({floorCounts[floor] || 0})
          </button>
        ))}
      </div>
      
      {/* Room Filter & Quick Picker */}
      <div className="flex items-center gap-3">
        <span className="text-white/70 font-bold flex items-center gap-2">
          <span className="text-xl">🚪</span>
          ห้อง:
        </span>
        <select
          value={roomFilter}
          onChange={(e) => onRoomChange(e.target.value)}
          className="bg-white/10 text-white font-bold px-5 py-2.5 rounded-xl border border-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
        >
          <option value="all" className="bg-slate-900">ทุกห้อง</option>
          {roomOptions.map((room) => (
            <option key={room} value={room} className="bg-slate-900">{room}</option>
          ))}
        </select>
        <button
          onClick={onOpenRoomPicker}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-bold shadow-lg shadow-cyan-500/30 transition-all duration-300 hover:scale-105 flex items-center gap-2"
        >
          <span>🔍</span>
          เลือกห้องด่วน
        </button>
      </div>
    </div>
  </div>
)

// ============================================
// 🚀 MAIN COMPONENT
// ============================================

function CustomerView({ customers }) {
  const [floorFilter, setFloorFilter] = useState('all')
  const [roomFilter, setRoomFilter] = useState('all')
  const [showRoomPicker, setShowRoomPicker] = useState(false)
  const [currentTime, setCurrentTime] = useState(Date.now())

  // Update time every second
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), UPDATE_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  // Keyboard support
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && showRoomPicker) setShowRoomPicker(false)
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
      if (!map.has(floor)) map.set(floor, { floor, rooms: new Map() })
      map.get(floor).rooms.set(c.room, (map.get(floor).rooms.get(c.room) || 0) + 1)
    })
    return Array.from(map.values())
      .map((s) => ({ floor: s.floor, rooms: Array.from(s.rooms.entries()).map(([room, count]) => ({ room, count })) }))
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
      return (floorFilter === 'all' || floor === floorFilter) && (roomFilter === 'all' || customer.room === roomFilter)
    })
  }, [displayCustomers, floorFilter, roomFilter])

  const handleCallStaff = useCallback(async (customer) => {
    const note = window.prompt('ระบุโน้ตสำหรับพนักงาน (เช่น สิ่งที่ต้องการให้ช่วย)', '')
    if (note === null) return
    try {
      await logActivity(customer.name || 'customer', 'CALL_STAFF', `เรียกพนักงานจากหน้าลูกค้า: ${customer.name || ''}`, { note: note || '-', room: customer.room })
      alert('เรียกพนักงานแล้ว ✅')
    } catch (error) {
      console.error('Call staff error:', error)
      alert(`เกิดข้อผิดพลาด: ${error.message || 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์'}`)
    }
  }, [])

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return h > 0
      ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      : `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 relative overflow-hidden">
      {/* Particle Background */}
      <ParticleBackground />
      
      {/* Gradient Orbs */}
      <div className="fixed top-0 left-0 w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[200px] animate-pulse" />
      <div className="fixed bottom-0 right-0 w-[600px] h-[600px] bg-cyan-600/20 rounded-full blur-[200px] animate-pulse" />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-pink-600/10 rounded-full blur-[200px]" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        {/* Room Picker Modal */}
        <RoomPickerModal
          show={showRoomPicker}
          onClose={() => setShowRoomPicker(false)}
          floorSections={floorSections}
          customers={customers}
          onSelectRoom={(floor, room) => { setFloorFilter(floor); setRoomFilter(room); setShowRoomPicker(false) }}
          onSelectAll={() => { setFloorFilter('all'); setRoomFilter('all'); setShowRoomPicker(false) }}
        />

        {/* Header */}
        <div className="text-center mb-12">
          <NeonTitle>🎮 JUTHAZONE 🎮</NeonTitle>
          
          <div className="flex items-center justify-center gap-4 mt-6 flex-wrap">
            <HoloBadge icon="📊" value={customers.length} label="ทั้งหมด" color="purple" />
            <HoloBadge icon="👁️" value={filteredCustomers.length} label="กำลังแสดง" color="cyan" />
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
          <div className="relative overflow-hidden backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-20 text-center">
            <span className="text-9xl mb-6 block animate-bounce">🎯</span>
            <p className="text-4xl text-white font-black mb-3">ยังไม่มีรายการ</p>
            <p className="text-white/50 text-xl">รอลูกค้าเข้าใช้งาน</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="relative overflow-hidden backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-20 text-center">
            <span className="text-9xl mb-6 block">🔍</span>
            <p className="text-4xl text-white font-black mb-3">
              {floorFilter !== 'all' ? `${floorFilter} ไม่มีลูกค้า` : 'ไม่พบรายการ'}
            </p>
            <p className="text-white/50 text-xl">ลองเลือกชั้นหรือห้องอื่น</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
            {filteredCustomers.map((customer) => (
              <FuturisticCard
                key={customer.id}
                customer={customer}
                onCallStaff={handleCallStaff}
                formatTime={formatTime}
              />
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-white/70 font-bold">อัพเดทอัตโนมัติทุกวินาที</span>
          </div>
        </div>
      </div>

      {/* Custom Styles */}
      <style>{`
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        @keyframes float-particle {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
          50% { transform: translateY(-100px) translateX(50px); opacity: 0.8; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-gradient-x {
          background-size: 200% 200%;
          animation: gradient-x 3s ease infinite;
        }
        .animate-scan {
          animation: scan 2s linear infinite;
        }
        .animate-float-particle {
          animation: float-particle 10s ease-in-out infinite;
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out forwards;
        }
      `}</style>
    </div>
  )
}

export default CustomerView

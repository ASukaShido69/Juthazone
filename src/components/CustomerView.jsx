import { useMemo, useState, useEffect, useCallback } from 'react'
import { formatTimeDisplay, getDurationText, calculateTimeRemaining } from '../utils/timeFormat'
import { logActivity } from '../utils/authUtils'

// Constants
const LOW_TIME_THRESHOLD = 300
const CRITICAL_TIME_THRESHOLD = 60
const UPDATE_INTERVAL = 1000

// Helper
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
// COMPONENTS
// ============================================

// Timer Display
const TimerDisplay = ({ seconds, isRunning }) => {
  const isCritical = seconds < CRITICAL_TIME_THRESHOLD
  const isLow = seconds < LOW_TIME_THRESHOLD

  const formatTime = (s) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return h > 0
      ? `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
      : `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className={`
      rounded-xl p-6 text-center transition-colors duration-300
      ${isCritical 
        ? 'bg-red-50 border border-red-200' 
        : isLow 
          ? 'bg-amber-50 border border-amber-200' 
          : 'bg-emerald-50 border border-emerald-200'
      }
    `}>
      <p className={`text-xs font-medium uppercase tracking-wider mb-2
        ${isCritical ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-emerald-600'}
      `}>
        {isRunning ? 'เวลาคงเหลือ' : 'หยุดชั่วคราว'}
      </p>
      <p className={`
        font-mono text-4xl md:text-5xl font-semibold tabular-nums
        ${isCritical ? 'text-red-700' : isLow ? 'text-amber-700' : 'text-emerald-700'}
        ${isCritical ? 'animate-pulse' : ''}
      `}>
        {formatTime(seconds)}
      </p>
      <p className={`text-sm mt-2 ${isCritical ? 'text-red-500' : isLow ? 'text-amber-500' : 'text-emerald-500'}`}>
        {getDurationText(seconds)}
      </p>
    </div>
  )
}

// Status Badge
const StatusBadge = ({ isPaid }) => (
  <span className={`
    inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
    ${isPaid 
      ? 'bg-emerald-100 text-emerald-700' 
      : 'bg-red-100 text-red-700'
    }
  `}>
    <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
    {isPaid ? 'ชำระแล้ว' : 'รอชำระ'}
  </span>
)

// Customer Card
const CustomerCard = ({ customer, onCallStaff }) => {
  const isCritical = customer.displayTimeRemaining < CRITICAL_TIME_THRESHOLD

  return (
    <div className={`
      bg-white rounded-2xl border transition-all duration-200
      hover:shadow-lg hover:shadow-gray-200/50 hover:-translate-y-0.5
      ${isCritical ? 'border-red-200' : 'border-gray-200'}
    `}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 border border-gray-200 flex items-center justify-center">
              <span className="text-xl">👤</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{customer.name}</h3>
              <p className="text-sm text-gray-500 mt-0.5">{customer.room}</p>
            </div>
          </div>
          <StatusBadge isPaid={customer.isPaid} />
        </div>

        {/* Note */}
        {customer.note && (
          <div className="mb-5 p-3 rounded-lg bg-amber-50 border border-amber-100">
            <p className="text-sm text-amber-800">{customer.note}</p>
          </div>
        )}

        {/* Timer */}
        <TimerDisplay 
          seconds={customer.displayTimeRemaining} 
          isRunning={customer.isRunning} 
        />

        {/* Time Info */}
        <div className="grid grid-cols-2 gap-3 mt-5">
          <div className="p-3 rounded-lg bg-gray-50">
            <p className="text-xs text-gray-500 mb-1">เริ่ม</p>
            <p className="text-sm font-medium text-gray-900">{formatTimeDisplay(customer.startTime)}</p>
          </div>
          <div className="p-3 rounded-lg bg-gray-50">
            <p className="text-xs text-gray-500 mb-1">สิ้นสุด</p>
            <p className="text-sm font-medium text-gray-900">{formatTimeDisplay(customer.expectedEndTime)}</p>
          </div>
        </div>

        {/* Cost */}
        <div className="mt-5 p-4 rounded-xl bg-gray-900 text-white">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">ค่าใช้จ่าย</span>
            <span className="text-2xl font-semibold">฿{customer.cost?.toLocaleString() || 0}</span>
          </div>
        </div>

        {/* Action */}
        <button
          onClick={() => onCallStaff(customer)}
          className="
            mt-5 w-full py-3 px-4 rounded-xl
            bg-gray-900 hover:bg-gray-800 
            text-white text-sm font-medium
            transition-colors duration-200
            focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2
          "
        >
          เรียกพนักงาน
        </button>
      </div>
    </div>
  )
}

// Room Modal
const RoomModal = ({ show, onClose, floorSections, customers, onSelectRoom, onSelectAll }) => {
  if (!show) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative h-full flex items-center justify-center p-4">
        <div className="w-full max-w-3xl max-h-[85vh] bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">เลือกห้อง</h2>
              <p className="text-sm text-gray-500 mt-0.5">{customers.length} รายการทั้งหมด</p>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(85vh-80px)]">
            {/* View All */}
            <button
              onClick={onSelectAll}
              className="w-full p-4 rounded-xl border-2 border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-colors mb-6 text-left"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">ดูทั้งหมด</p>
                  <p className="text-sm text-gray-500 mt-0.5">{customers.length} รายการ</p>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>

            {/* Floors */}
            <div className="space-y-6">
              {floorSections.map((section) => (
                <div key={section.floor}>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
                    {section.floor}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {section.rooms.map(({ room, count }) => (
                      <button
                        key={room}
                        onClick={() => onSelectRoom(section.floor, room)}
                        className="p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors text-left"
                      >
                        <p className="font-medium text-gray-900 text-sm">{room}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{count} รายการ</p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {floorSections.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">ไม่มีข้อมูลห้อง</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Filter Bar
const FilterBar = ({ floorFilter, roomFilter, floorOptions, roomOptions, floorCounts, totalCount, onFloorChange, onRoomChange, onOpenModal }) => (
  <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
      {/* Floor Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-gray-500">ชั้น:</span>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => onFloorChange('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              floorFilter === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            ทั้งหมด ({totalCount})
          </button>
          {floorOptions.map((floor) => (
            <button
              key={floor}
              onClick={() => onFloorChange(floor === floorFilter ? 'all' : floor)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                floorFilter === floor
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {floor} ({floorCounts[floor] || 0})
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="hidden sm:block w-px h-6 bg-gray-200" />

      {/* Room Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">ห้อง:</span>
        <select
          value={roomFilter}
          onChange={(e) => onRoomChange(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          <option value="all">ทุกห้อง</option>
          {roomOptions.map((room) => (
            <option key={room} value={room}>{room}</option>
          ))}
        </select>
        <button
          onClick={onOpenModal}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          เลือกห้อง
        </button>
      </div>
    </div>
  </div>
)

// Empty State
const EmptyState = ({ title, subtitle }) => (
  <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
    </div>
    <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
    <p className="text-gray-500">{subtitle}</p>
  </div>
)

// ============================================
// MAIN COMPONENT
// ============================================

function CustomerView({ customers }) {
  const [floorFilter, setFloorFilter] = useState('all')
  const [roomFilter, setRoomFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [currentTime, setCurrentTime] = useState(Date.now())

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), UPDATE_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && showModal) setShowModal(false)
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [showModal])

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
    const note = window.prompt('ระบุสิ่งที่ต้องการ (ถ้ามี)', '')
    if (note === null) return
    try {
      await logActivity(customer.name || 'customer', 'CALL_STAFF', `เรียกพนักงาน: ${customer.name || ''}`, { note: note || '-', room: customer.room })
      alert('เรียกพนักงานแล้ว')
    } catch (error) {
      console.error('Call staff error:', error)
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่')
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Modal */}
        <RoomModal
          show={showModal}
          onClose={() => setShowModal(false)}
          floorSections={floorSections}
          customers={customers}
          onSelectRoom={(floor, room) => { setFloorFilter(floor); setRoomFilter(room); setShowModal(false) }}
          onSelectAll={() => { setFloorFilter('all'); setRoomFilter('all'); setShowModal(false) }}
        />

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Customer View</h1>
          <p className="text-gray-500 mt-1">
            {filteredCustomers.length} รายการ
            {floorFilter !== 'all' && ` · ${floorFilter}`}
            {roomFilter !== 'all' && ` · ${roomFilter}`}
          </p>
        </div>

        {/* Filter */}
        {customers.length > 0 && (
          <FilterBar
            floorFilter={floorFilter}
            roomFilter={roomFilter}
            floorOptions={floorOptions}
            roomOptions={roomOptions}
            floorCounts={floorCounts}
            totalCount={customers.length}
            onFloorChange={setFloorFilter}
            onRoomChange={setRoomFilter}
            onOpenModal={() => setShowModal(true)}
          />
        )}

        {/* Content */}
        {customers.length === 0 ? (
          <EmptyState title="ยังไม่มีรายการ" subtitle="รอลูกค้าเข้าใช้งาน" />
        ) : filteredCustomers.length === 0 ? (
          <EmptyState 
            title="ไม่พบรายการ" 
            subtitle={`ไม่มีลูกค้าใน${floorFilter !== 'all' ? floorFilter : ''}${roomFilter !== 'all' ? ` ${roomFilter}` : ''}`} 
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredCustomers.map((customer) => (
              <CustomerCard
                key={customer.id}
                customer={customer}
                onCallStaff={handleCallStaff}
              />
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-400 flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            อัพเดทอัตโนมัติ
          </p>
        </div>
      </div>
    </div>
  )
}

export default CustomerView

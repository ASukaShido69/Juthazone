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
// 🎮 GAMING COMPONENTS
// ============================================

// Animated Background
const GamingBackground = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none">
    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-900" />
    <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px]" />
    <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[120px]" />
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-[150px]" />
  </div>
)

// Gaming Button
const GamingButton = ({ children, variant = 'primary', size = 'md', className = '', ...props }) => {
  const variants = {
    primary: 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-400/40',
    secondary: 'bg-slate-800 hover:bg-slate-700 text-gray-300 hover:text-white border border-slate-700 hover:border-cyan-500/50',
    danger: 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-400 hover:to-pink-400 text-white shadow-lg shadow-red-500/25',
    ghost: 'bg-transparent hover:bg-white/5 text-gray-400 hover:text-cyan-400',
    glow: 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-400/40',
  }
  
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  }

  return (
    <button
      className={`
        ${variants[variant]} ${sizes[size]}
        font-medium rounded-xl transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-cyan-500/50
        active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  )
}

// Status Badge with Glow
const StatusBadge = ({ isPaid, isRunning }) => (
  <div className="flex items-center gap-2">
    <span className={`
      inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium
      ${isPaid 
        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
        : 'bg-red-500/20 text-red-400 border border-red-500/30'
      }
    `}>
      <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'}`} />
      {isPaid ? 'PAID' : 'UNPAID'}
    </span>
    {isRunning !== undefined && (
      <span className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium
        ${isRunning 
          ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
          : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
        }
      `}>
        <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-cyan-400 animate-pulse' : 'bg-gray-400'}`} />
        {isRunning ? 'LIVE' : 'PAUSED'}
      </span>
    )}
  </div>
)

// Timer Display - Gaming Style
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

  const getColors = () => {
    if (isCritical) return { bg: 'from-red-500/20 to-pink-500/20', border: 'border-red-500/50', text: 'text-red-400', glow: 'shadow-red-500/20' }
    if (isLow) return { bg: 'from-amber-500/20 to-orange-500/20', border: 'border-amber-500/50', text: 'text-amber-400', glow: 'shadow-amber-500/20' }
    return { bg: 'from-emerald-500/20 to-cyan-500/20', border: 'border-emerald-500/50', text: 'text-emerald-400', glow: 'shadow-emerald-500/20' }
  }

  const colors = getColors()

  return (
    <div className={`
      relative overflow-hidden rounded-2xl p-5 text-center
      bg-gradient-to-br ${colors.bg} border ${colors.border}
      shadow-lg ${colors.glow}
    `}>
      {/* Scan line effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-transparent opacity-50" />
      
      <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${colors.text} opacity-80`}>
        {isRunning ? '⏱ TIME REMAINING' : '⏸ PAUSED'}
      </p>
      <p className={`
        font-mono text-4xl md:text-5xl font-black tabular-nums tracking-tight
        ${colors.text} ${isCritical ? 'animate-pulse' : ''}
      `}>
        {formatTime(seconds)}
      </p>
      <p className={`text-xs mt-2 ${colors.text} opacity-60`}>
        {getDurationText(seconds)}
      </p>
    </div>
  )
}

// Timeline Progress - Gaming Style
const TimelineProgress = ({ startTime, endTime, currentTime }) => {
  const start = new Date(startTime).getTime()
  const end = new Date(endTime).getTime()
  const now = currentTime
  
  const total = end - start
  const elapsed = Math.min(Math.max(now - start, 0), total)
  const progress = total > 0 ? (elapsed / total) * 100 : 0
  
  const formatTime = (date) => {
    if (!date) return '--:--'
    const d = new Date(date)
    return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  }

  const getProgressColor = () => {
    if (progress > 90) return 'from-red-500 to-pink-500'
    if (progress > 70) return 'from-amber-500 to-orange-500'
    return 'from-cyan-500 to-emerald-500'
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500 font-medium">SESSION PROGRESS</span>
        <span className={`font-mono font-bold ${progress > 90 ? 'text-red-400' : progress > 70 ? 'text-amber-400' : 'text-cyan-400'}`}>
          {Math.round(progress)}%
        </span>
      </div>
      
      {/* Progress Bar */}
      <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
        <div 
          className={`absolute inset-y-0 left-0 bg-gradient-to-r ${getProgressColor()} rounded-full transition-all duration-1000`}
          style={{ width: `${progress}%` }}
        />
        {/* Glow effect */}
        <div 
          className={`absolute inset-y-0 left-0 bg-gradient-to-r ${getProgressColor()} rounded-full blur-sm opacity-50 transition-all duration-1000`}
          style={{ width: `${progress}%` }}
        />
      </div>
      
      {/* Time Labels */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-500" />
          <span className="font-mono font-medium text-gray-400">{formatTime(startTime)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono font-medium text-gray-400">{formatTime(endTime)}</span>
          <div className="w-2 h-2 rounded-full border-2 border-gray-500" />
        </div>
      </div>
    </div>
  )
}

// Quick Stats - Gaming Style
const QuickStats = ({ customer }) => {
  const stats = [
    { label: 'STATION', value: customer.room || '-', color: 'cyan' },
    { label: 'TYPE', value: customer.type || 'Standard', color: 'purple' },
    { label: 'STATUS', value: customer.isRunning ? 'Active' : 'Idle', color: customer.isRunning ? 'emerald' : 'gray' },
  ]

  const colorClasses = {
    cyan: 'from-cyan-500/20 to-blue-500/20 border-cyan-500/30 text-cyan-400',
    purple: 'from-purple-500/20 to-pink-500/20 border-purple-500/30 text-purple-400',
    emerald: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-400',
    gray: 'from-gray-500/20 to-slate-500/20 border-gray-500/30 text-gray-400',
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {stats.map((stat, i) => (
        <div 
          key={i} 
          className={`
            text-center p-3 rounded-xl bg-gradient-to-br border
            ${colorClasses[stat.color]}
          `}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">{stat.label}</p>
          <p className="text-sm font-bold mt-0.5 truncate">{stat.value}</p>
        </div>
      ))}
    </div>
  )
}

// Customer Card - Gaming Style
const CustomerCard = ({ customer, onCallStaff, currentTime }) => {
  const [expanded, setExpanded] = useState(false)
  const isCritical = customer.displayTimeRemaining < CRITICAL_TIME_THRESHOLD
  const isLow = customer.displayTimeRemaining < LOW_TIME_THRESHOLD

  const sessionDuration = useMemo(() => {
    if (!customer.startTime || !customer.expectedEndTime) return null
    const start = new Date(customer.startTime)
    const end = new Date(customer.expectedEndTime)
    const diffMs = end - start
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }, [customer.startTime, customer.expectedEndTime])

  const getBorderGlow = () => {
    if (isCritical) return 'border-red-500/50 shadow-lg shadow-red-500/10'
    if (isLow) return 'border-amber-500/50 shadow-lg shadow-amber-500/10'
    return 'border-slate-700/50 hover:border-cyan-500/30 hover:shadow-lg hover:shadow-cyan-500/5'
  }

  return (
    <div className={`
      relative overflow-hidden rounded-2xl border bg-slate-800/50 backdrop-blur-sm
      transition-all duration-300 ${getBorderGlow()}
    `}>
      {/* Top Glow Line */}
      <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r 
        ${isCritical ? 'from-transparent via-red-500 to-transparent' : 
          isLow ? 'from-transparent via-amber-500 to-transparent' : 
          'from-transparent via-cyan-500/50 to-transparent'}`} 
      />
      
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`
              relative w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black
              bg-gradient-to-br ${isCritical ? 'from-red-500 to-pink-500' : isLow ? 'from-amber-500 to-orange-500' : 'from-cyan-500 to-blue-500'}
              shadow-lg ${isCritical ? 'shadow-red-500/30' : isLow ? 'shadow-amber-500/30' : 'shadow-cyan-500/30'}
            `}>
              <span className="text-white">{customer.name?.charAt(0)?.toUpperCase() || '?'}</span>
              {customer.isRunning && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-800 animate-pulse" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">{customer.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-500 font-mono">{customer.room}</span>
                {sessionDuration && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="text-xs text-cyan-500 font-medium">{sessionDuration}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <StatusBadge isPaid={customer.isPaid} isRunning={customer.isRunning} />
        </div>

        {/* Quick Stats */}
        <QuickStats customer={customer} />

        {/* Timeline */}
        <div className="mt-4 p-4 rounded-xl bg-slate-900/50 border border-slate-700/50">
          <TimelineProgress 
            startTime={customer.startTime}
            endTime={customer.expectedEndTime}
            currentTime={currentTime}
          />
        </div>

        {/* Timer Display */}
        <div className="mt-4">
          <TimerDisplay 
            seconds={customer.displayTimeRemaining} 
            isRunning={customer.isRunning} 
          />
        </div>

        {/* Expand Toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-4 py-2 flex items-center justify-center gap-2 text-xs text-gray-500 hover:text-cyan-400 transition-colors rounded-lg hover:bg-slate-700/30"
        >
          <span>{expanded ? 'HIDE DETAILS' : 'VIEW DETAILS'}</span>
          <svg 
            className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} 
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Expanded Content */}
        {expanded && (
          <div className="mt-3 pt-4 border-t border-slate-700/50 space-y-3 animate-fadeIn">
            {/* Note */}
            {customer.note && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <p className="text-xs font-bold text-amber-500 mb-1">📝 NOTE</p>
                <p className="text-sm text-amber-200">{customer.note}</p>
              </div>
            )}

            {/* Cost Breakdown */}
            <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-700/50">
              <p className="text-xs font-bold text-gray-500 mb-2">💰 COST BREAKDOWN</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Service</span>
                  <span className="font-mono font-medium text-white">฿{customer.cost?.toLocaleString() || 0}</span>
                </div>
                {customer.extraCost > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Extra</span>
                    <span className="font-mono font-medium text-white">฿{customer.extraCost?.toLocaleString()}</span>
                  </div>
                )}
                <div className="pt-2 mt-2 border-t border-slate-700 flex justify-between">
                  <span className="font-bold text-gray-300">TOTAL</span>
                  <span className="font-mono font-black text-cyan-400">฿{((customer.cost || 0) + (customer.extraCost || 0)).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Session Times */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-700/50">
                <p className="text-[10px] font-bold text-gray-500 uppercase">CHECK-IN</p>
                <p className="text-sm font-mono font-bold text-white mt-1">{formatTimeDisplay(customer.startTime)}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-700/50">
                <p className="text-[10px] font-bold text-gray-500 uppercase">CHECK-OUT</p>
                <p className="text-sm font-mono font-bold text-white mt-1">{formatTimeDisplay(customer.expectedEndTime)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Cost Display */}
        <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Total</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                customer.isPaid 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                  : 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse'
              }`}>
                {customer.isPaid ? '✓ PAID' : '⚠ UNPAID'}
              </span>
            </div>
            <span className="text-2xl font-black text-white font-mono tabular-nums">
              ฿{customer.cost?.toLocaleString() || 0}
            </span>
          </div>
        </div>

        {/* Action Button */}
        <GamingButton
          onClick={() => onCallStaff(customer)}
          variant="secondary"
          className="w-full mt-4 flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          CALL STAFF
        </GamingButton>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  )
}

// Room Modal - Gaming Style
const RoomModal = ({ show, onClose, floorSections, customers, onSelectRoom, onSelectAll }) => {
  if (!show) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative h-full flex items-center justify-center p-4">
        <div className="w-full max-w-3xl max-h-[85vh] bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl shadow-cyan-500/10 overflow-hidden">
          {/* Top Glow */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
          
          {/* Header */}
          <div className="relative px-6 py-5 border-b border-slate-800 bg-gradient-to-b from-slate-800/50 to-transparent">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                  <span className="text-2xl">🎮</span>
                </div>
                <div>
                  <h2 className="text-xl font-black text-white">SELECT STATION</h2>
                  <p className="text-sm text-gray-500">{customers.length} total sessions</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-red-500/50 flex items-center justify-center text-gray-400 hover:text-red-400 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(85vh-100px)]">
            {/* View All Button */}
            <button
              onClick={onSelectAll}
              className="w-full p-4 rounded-xl border-2 border-dashed border-cyan-500/30 hover:border-cyan-500/60 bg-cyan-500/5 hover:bg-cyan-500/10 transition-all mb-6 text-left group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="text-white text-lg">👁</span>
                  </div>
                  <div>
                    <p className="font-bold text-white">VIEW ALL STATIONS</p>
                    <p className="text-sm text-gray-500">{customers.length} active sessions</p>
                  </div>
                </div>
                <svg className="w-5 h-5 text-cyan-500 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>

            {/* Floors */}
            <div className="space-y-6">
              {floorSections.map((section) => (
                <div key={section.floor}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="px-3 py-1.5 rounded-lg bg-purple-500/20 border border-purple-500/30">
                      <span className="text-sm font-bold text-purple-400">{section.floor}</span>
                    </div>
                    <div className="flex-1 h-px bg-gradient-to-r from-purple-500/30 to-transparent" />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {section.rooms.map(({ room, count }) => (
                      <button
                        key={room}
                        onClick={() => onSelectRoom(section.floor, room)}
                        className="p-4 rounded-xl border border-slate-700 hover:border-cyan-500/50 bg-slate-800/50 hover:bg-slate-800 transition-all text-left group"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-lg">🖥️</span>
                          <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-400 text-xs font-bold border border-cyan-500/30">
                            {count}
                          </span>
                        </div>
                        <p className="font-bold text-white text-sm group-hover:text-cyan-400 transition-colors">{room}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {floorSections.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">📭</span>
                </div>
                <p className="text-gray-500">No stations available</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Filter Bar - Gaming Style
const FilterBar = ({ floorFilter, roomFilter, floorOptions, roomOptions, floorCounts, totalCount, onFloorChange, onRoomChange, onOpenModal }) => (
  <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 mb-6 backdrop-blur-sm">
    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
      {/* Floor Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">FLOOR:</span>
        <div className="flex gap-1.5 flex-wrap">
          <GamingButton
            onClick={() => onFloorChange('all')}
            variant={floorFilter === 'all' ? 'primary' : 'secondary'}
            size="sm"
          >
            ALL ({totalCount})
          </GamingButton>
          {floorOptions.map((floor) => (
            <GamingButton
              key={floor}
              onClick={() => onFloorChange(floor === floorFilter ? 'all' : floor)}
              variant={floorFilter === floor ? 'primary' : 'secondary'}
              size="sm"
            >
              {floor} ({floorCounts[floor] || 0})
            </GamingButton>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="hidden lg:block w-px h-8 bg-slate-700" />

      {/* Room Filter */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">STATION:</span>
        <select
          value={roomFilter}
          onChange={(e) => onRoomChange(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
        >
          <option value="all">All Stations</option>
          {roomOptions.map((room) => (
            <option key={room} value={room}>{room}</option>
          ))}
        </select>
        <GamingButton onClick={onOpenModal} variant="glow" size="sm">
          🎯 Quick Select
        </GamingButton>
      </div>
    </div>
  </div>
)

// Stats Bar
const StatsBar = ({ total, filtered, activeCount }) => (
  <div className="grid grid-cols-3 gap-4 mb-6">
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
          <span className="text-white text-lg">📊</span>
        </div>
        <div>
          <p className="text-xs text-gray-500 font-medium">TOTAL</p>
          <p className="text-2xl font-black text-white">{total}</p>
        </div>
      </div>
    </div>
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
          <span className="text-white text-lg">👁</span>
        </div>
        <div>
          <p className="text-xs text-gray-500 font-medium">SHOWING</p>
          <p className="text-2xl font-black text-white">{filtered}</p>
        </div>
      </div>
    </div>
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
          <span className="text-white text-lg">🎮</span>
        </div>
        <div>
          <p className="text-xs text-gray-500 font-medium">ACTIVE</p>
          <p className="text-2xl font-black text-emerald-400">{activeCount}</p>
        </div>
      </div>
    </div>
  </div>
)

// Empty State
const EmptyState = ({ title, subtitle }) => (
  <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-12 text-center backdrop-blur-sm">
    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center mx-auto mb-4 border border-slate-600">
      <span className="text-4xl">🎮</span>
    </div>
    <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
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

  const activeCount = useMemo(() => {
    return customers.filter(c => c.isRunning).length
  }, [customers])

  const handleCallStaff = useCallback(async (customer) => {
    const note = window.prompt('What do you need? (optional)', '')
    if (note === null) return
    try {
      await logActivity(customer.name || 'customer', 'CALL_STAFF', `Staff called: ${customer.name || ''}`, { note: note || '-', room: customer.room })
      alert('Staff has been notified! ✓')
    } catch (error) {
      console.error('Call staff error:', error)
      alert('Error: Please try again')
    }
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 relative">
      {/* Background */}
      <GamingBackground />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/30">
              <span className="text-2xl">🎮</span>
            </div>
            <div>
              <h1 className="text-3xl font-black text-white">CUSTOMER VIEW</h1>
              <p className="text-gray-500 text-sm">
                Real-time session monitoring
                {floorFilter !== 'all' && <span className="text-cyan-400"> • {floorFilter}</span>}
                {roomFilter !== 'all' && <span className="text-purple-400"> • {roomFilter}</span>}
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <StatsBar total={customers.length} filtered={filteredCustomers.length} activeCount={activeCount} />

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
          <EmptyState title="NO ACTIVE SESSIONS" subtitle="Waiting for customers..." />
        ) : filteredCustomers.length === 0 ? (
          <EmptyState 
            title="NO RESULTS" 
            subtitle={`No customers in ${floorFilter !== 'all' ? floorFilter : ''} ${roomFilter !== 'all' ? roomFilter : ''}`} 
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredCustomers.map((customer) => (
              <CustomerCard
                key={customer.id}
                customer={customer}
                onCallStaff={handleCallStaff}
                currentTime={currentTime}
              />
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-slate-800/50 border border-slate-700/50">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-gray-500 font-medium">LIVE • Auto-refresh every second</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CustomerView

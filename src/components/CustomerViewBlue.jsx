import { useMemo, useState } from 'react'
import { formatTimeDisplay } from '../utils/timeFormat'
import { calculateCostBlue, formatElapsedTime } from '../utils/authUtilsBlue'
import { logActivityBlue } from '../utils/authUtilsBlue'

// ═══════════════════════════════════════════════════════════
// SPECIAL PRICING RULES (ต้องตรงกับ AdminDashboardBlue)
// ═══════════════════════════════════════════════════════════
const BOARD_GAME_ZONE_IDS = ['board-game-big', 'board-game-small']
const PS_ZONE_IDS = ['ps-5', 'ps-6', 'ps-7', 'ps-8', 'ps-9', 'ps-10']
const PS_PACKAGE_HOURS = 2
const PS_DISCOUNT_PER_PACKAGE = 11  // หัก 11 บาท ต่อทุก 2 ชม. ที่ครบ

const SIM_BASIC_IDS = ['sim-1', 'sim-2']
const SIM_BASIC_PACKAGE_HOURS = 2
const SIM_BASIC_PACKAGE_PRICE = 179

const SIM_PRO_IDS = ['sim-3', 'sim-4']
const SIM_PRO_PACKAGE_HOURS = 2
const SIM_PRO_PACKAGE_PRICE = 259

const NINTENDO_IDS = ['nintendo-main']
const NINTENDO_PACKAGE_2H_PRICE = 129
const NINTENDO_PACKAGE_4H_PRICE = 249

const PS5_REGULAR_IDS = ['VIP-PS5']
const PS5_REGULAR_PACKAGE_2H_PRICE = 169
const PS5_REGULAR_PACKAGE_4H_PRICE = 299

const getElapsedHours = (startTime, totalPauseDuration, pauseTime, isRunning) => {
  const now = Date.now()
  const start = new Date(startTime).getTime()
  let elapsedMs = now - start
  if (totalPauseDuration) elapsedMs -= totalPauseDuration * 1000
  if (!isRunning && pauseTime) elapsedMs -= (now - new Date(pauseTime).getTime())
  return Math.max(0, elapsedMs) / 1000 / 60 / 60
}

const applySpecialPricing = (room, rawCost, startTime, totalPauseDuration, pauseTime, isRunning, hourlyRate) => {
  const elapsedHours = getElapsedHours(startTime, totalPauseDuration, pauseTime, isRunning)

  if (PS_ZONE_IDS.includes(room)) {
    const fullPackages = Math.floor(elapsedHours / PS_PACKAGE_HOURS)
    if (fullPackages === 0) {
      return { finalCost: rawCost, originalCost: rawCost, hasSpecialPrice: false, promoLabel: null, discountAmount: 0 }
    }
    const totalDiscount = fullPackages * PS_DISCOUNT_PER_PACKAGE
    const finalCost = Math.max(0, rawCost - totalDiscount)
    return {
      finalCost,
      originalCost: rawCost,
      hasSpecialPrice: true,
      promoLabel: '🎮 ราคาโปรโมชั่น',
      discountAmount: totalDiscount
    }
  }

  if (BOARD_GAME_ZONE_IDS.includes(room) && elapsedHours > 2) {
    const first2HoursCost = 2 * hourlyRate
    const extraHours = elapsedHours - 2
    const extraCost = extraHours * hourlyRate * 0.5
    const finalCost = first2HoursCost + extraCost
    return {
      finalCost,
      originalCost: rawCost,
      hasSpecialPrice: true,
      promoLabel: '🎲 ลด 50% บอร์ดเกม (หลัง 2 ชม.)',
      discountAmount: rawCost - finalCost
    }
  }

  if (SIM_BASIC_IDS.includes(room) && elapsedHours >= SIM_BASIC_PACKAGE_HOURS) {
    const fullPackages = Math.floor(elapsedHours / SIM_BASIC_PACKAGE_HOURS)
    const remainderHours = elapsedHours % SIM_BASIC_PACKAGE_HOURS
    const total = fullPackages * SIM_BASIC_PACKAGE_PRICE + remainderHours * hourlyRate
    return {
      finalCost: total,
      originalCost: rawCost,
      hasSpecialPrice: true,
      promoLabel: `🏎️ โปร Sim พื้นฐาน ${fullPackages}×2ชม. = ${fullPackages}×฿${SIM_BASIC_PACKAGE_PRICE}`,
      discountAmount: Math.max(0, rawCost - total)
    }
  }

  if (NINTENDO_IDS.includes(room)) {
    if (elapsedHours >= 4) {
      const fullPackages = Math.floor(elapsedHours / 4)
      const remainderHours = elapsedHours % 4
      let total = fullPackages * NINTENDO_PACKAGE_4H_PRICE
      if (remainderHours >= 2) {
        total += NINTENDO_PACKAGE_2H_PRICE
      } else if (remainderHours > 0) {
        total += remainderHours * hourlyRate
      }
      return {
        finalCost: total,
        originalCost: rawCost,
        hasSpecialPrice: true,
        promoLabel: `🎯 โปร Nintendo - ฿${total.toFixed(2)}`,
        discountAmount: Math.max(0, rawCost - total)
      }
    } else if (elapsedHours >= 2) {
      const fullPackages = Math.floor(elapsedHours / 2)
      const remainderHours = elapsedHours % 2
      const total = fullPackages * NINTENDO_PACKAGE_2H_PRICE + remainderHours * hourlyRate
      return {
        finalCost: total,
        originalCost: rawCost,
        hasSpecialPrice: true,
        promoLabel: `🎯 โปร Nintendo - ฿${total.toFixed(2)}`,
        discountAmount: Math.max(0, rawCost - total)
      }
    }
  }

  if (PS5_REGULAR_IDS.includes(room)) {
    if (elapsedHours >= 4) {
      const fullPackages = Math.floor(elapsedHours / 4)
      const remainderHours = elapsedHours % 4
      let total = fullPackages * PS5_REGULAR_PACKAGE_4H_PRICE
      if (remainderHours >= 2) {
        total += PS5_REGULAR_PACKAGE_2H_PRICE
      } else if (remainderHours > 0) {
        total += remainderHours * hourlyRate
      }
      return {
        finalCost: total,
        originalCost: rawCost,
        hasSpecialPrice: true,
        promoLabel: `🎮 โปร PS5 - ฿${total.toFixed(2)}`,
        discountAmount: Math.max(0, rawCost - total)
      }
    } else if (elapsedHours >= 2) {
      const fullPackages = Math.floor(elapsedHours / 2)
      const remainderHours = elapsedHours % 2
      const total = fullPackages * PS5_REGULAR_PACKAGE_2H_PRICE + remainderHours * hourlyRate
      return {
        finalCost: total,
        originalCost: rawCost,
        hasSpecialPrice: true,
        promoLabel: `🎮 โปร PS5 - ฿${total.toFixed(2)}`,
        discountAmount: Math.max(0, rawCost - total)
      }
    }
  }

  if (NINTENDO_IDS.includes(room)) {
    if (elapsedHours >= 4) {
      const fullPackages = Math.floor(elapsedHours / 4)
      const remainderHours = elapsedHours % 4
      let total = fullPackages * NINTENDO_PACKAGE_4H_PRICE
      if (remainderHours >= 2) {
        total += NINTENDO_PACKAGE_2H_PRICE
      } else if (remainderHours > 0) {
        total += remainderHours * hourlyRate
      }
      return {
        finalCost: total,
        originalCost: rawCost,
        hasSpecialPrice: true,
        promoLabel: `🎯 โปร Nintendo ${fullPackages > 0 ? fullPackages + '×4ชม.' : ''}${remainderHours >= 2 ? (fullPackages > 0 ? ' + ' : '') + '1×2ชม.' : ''}`,
        discountAmount: Math.max(0, rawCost - total)
      }
    } else if (elapsedHours >= 2) {
      const fullPackages = Math.floor(elapsedHours / 2)
      const remainderHours = elapsedHours % 2
      const total = fullPackages * NINTENDO_PACKAGE_2H_PRICE + remainderHours * hourlyRate
      return {
        finalCost: total,
        originalCost: rawCost,
        hasSpecialPrice: true,
        promoLabel: `🎯 โปร Nintendo ${fullPackages}×2ชม. = ${fullPackages}×฿${NINTENDO_PACKAGE_2H_PRICE}`,
        discountAmount: Math.max(0, rawCost - total)
      }
    }
  }

  if (PS5_VIP_IDS.includes(room)) {
    if (elapsedHours >= 4) {
      const fullPackages = Math.floor(elapsedHours / 4)
      const remainderHours = elapsedHours % 4
      let total = fullPackages * PS5_PACKAGE_4H_PRICE
      if (remainderHours >= 2) {
        total += PS5_PACKAGE_2H_PRICE
      } else if (remainderHours > 0) {
        total += remainderHours * hourlyRate
      }
      return {
        finalCost: total,
        originalCost: rawCost,
        hasSpecialPrice: true,
        promoLabel: `🎮 โปร PS5 VIP ${fullPackages > 0 ? fullPackages + '×4ชม.' : ''}${remainderHours >= 2 ? (fullPackages > 0 ? ' + ' : '') + '1×2ชม.' : ''}`,
        discountAmount: Math.max(0, rawCost - total)
      }
    } else if (elapsedHours >= 2) {
      const fullPackages = Math.floor(elapsedHours / 2)
      const remainderHours = elapsedHours % 2
      const total = fullPackages * PS5_PACKAGE_2H_PRICE + remainderHours * hourlyRate
      return {
        finalCost: total,
        originalCost: rawCost,
        hasSpecialPrice: true,
        promoLabel: `🎮 โปร PS5 VIP ${fullPackages}×2ชม. = ${fullPackages}×฿${PS5_PACKAGE_2H_PRICE}`,
        discountAmount: Math.max(0, rawCost - total)
      }
    }
  }

  if (PS5_REGULAR_IDS.includes(room)) {
    if (elapsedHours >= 4) {
      const fullPackages = Math.floor(elapsedHours / 4)
      const remainderHours = elapsedHours % 4
      let total = fullPackages * PS5_REGULAR_PACKAGE_4H_PRICE
      if (remainderHours >= 2) {
        total += PS5_REGULAR_PACKAGE_2H_PRICE
      } else if (remainderHours > 0) {
        total += remainderHours * hourlyRate
      }
      return {
        finalCost: total,
        originalCost: rawCost,
        hasSpecialPrice: true,
        promoLabel: `🎮 โปร PS5 ${fullPackages > 0 ? fullPackages + '×4ชม.' : ''}${remainderHours >= 2 ? (fullPackages > 0 ? ' + ' : '') + '1×2ชม.' : ''}`,
        discountAmount: Math.max(0, rawCost - total)
      }
    } else if (elapsedHours >= 2) {
      const fullPackages = Math.floor(elapsedHours / 2)
      const remainderHours = elapsedHours % 2
      const total = fullPackages * PS5_REGULAR_PACKAGE_2H_PRICE + remainderHours * hourlyRate
      return {
        finalCost: total,
        originalCost: rawCost,
        hasSpecialPrice: true,
        promoLabel: `🎮 โปร PS5 ${fullPackages}×2ชม. = ${fullPackages}×฿${PS5_REGULAR_PACKAGE_2H_PRICE}`,
        discountAmount: Math.max(0, rawCost - total)
      }
    }
  }

  return { finalCost: rawCost, originalCost: rawCost, hasSpecialPrice: false, promoLabel: null, discountAmount: 0 }
}

function CustomerViewBlue({ customers }) {
  const [roomFilter, setRoomFilter] = useState('all')

  // Calculate real-time cost and elapsed time for display (Blue-only)
  const displayCustomers = useMemo(() => {
    return customers.map(customer => {
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
      return {
        ...customer,
        currentCost: pricing.finalCost,
        originalCost: pricing.originalCost,
        hasDiscount: pricing.hasSpecialPrice,
        promoLabel: pricing.promoLabel,
        discountAmount: pricing.discountAmount,
        elapsedTime: formatElapsedTime(
          customer.start_time,
          customer.total_pause_duration,
          customer.pause_time,
          customer.is_running
        )
      }
    })
  }, [customers])

  const roomOptions = useMemo(() => {
    const set = new Set()
    customers.forEach(c => c.room && set.add(c.room))
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'th'))
  }, [customers])

  const filteredCustomers = useMemo(() => {
    if (roomFilter === 'all') return displayCustomers
    return displayCustomers.filter(c => c.room === roomFilter)
  }, [displayCustomers, roomFilter])

  const handleCallStaff = async (customer) => {
    const note = window.prompt('ระบุโน้ตสำหรับพนักงาน (เช่น สิ่งที่ต้องการให้ช่วย)', '')
    if (note === null) return
    try {
      await logActivityBlue(
        customer.name || 'customer',
        'CALL_STAFF',
        `เรียกพนักงานจากหน้าลูกค้า Blue Zone: ${customer.name || ''}`,
        { note: note || '-', room: customer.room }
      )
      alert('เรียกพนักงานแล้ว')
    } catch (error) {
      console.error('Call staff error:', error)
      alert('ไม่สามารถบันทึกการเรียกพนักงานได้')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-700 via-cyan-600 to-teal-500 animate-gradient p-3 md:p-6">

      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6 md:mb-8 pt-2 md:pt-4 slide-up">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white drop-shadow-2xl mb-2 md:mb-3 animate-float">
            🔵 JUTHAZONE BLUE 🔵
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-white/90 font-semibold glass-light inline-block px-4 py-2 md:px-6 md:py-2 rounded-full">
            ระบบคำนวณราคาตามเวลาจริง | รายการ: {customers.length} | แสดง: {filteredCustomers.length}
          </p>
        </div>

        {/* Room Filter */}
        {customers.length > 0 && (
          <div className="glass-light rounded-2xl shadow-xl p-4 mb-4 md:mb-6 slide-up-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-white font-semibold drop-shadow text-sm">🏠 ห้อง:</span>
              <button
                onClick={() => setRoomFilter('all')}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-all duration-200 ${roomFilter === 'all' ? 'bg-white text-blue-700 shadow-lg scale-105' : 'bg-white/10 text-white border-white/30 hover:bg-white/20'}`}
              >
                ทั้งหมด ({customers.length})
              </button>
              {roomOptions.map(room => {
                const count = customers.filter(c => c.room === room).length
                return (
                  <button
                    key={room}
                    onClick={() => setRoomFilter(prev => prev === room ? 'all' : room)}
                    className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-all duration-200 ${roomFilter === room ? 'bg-white text-blue-700 shadow-lg scale-105' : 'bg-white/10 text-white border-white/30 hover:bg-white/20'}`}
                  >
                    {room} ({count})
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {customers.length === 0 ? (
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl md:rounded-3xl shadow-2xl p-8 md:p-12 text-center border-2 border-white/50">
            <div className="text-6xl md:text-8xl mb-4 md:mb-6 animate-bounce-slow">🔵</div>
            <p className="text-2xl md:text-3xl text-gray-700 font-bold mb-2">ยังไม่มีรายการ</p>
            <p className="text-gray-500 text-base md:text-lg">รอลูกค้าเข้าใช้งาน</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {filteredCustomers.map((customer) => {
              return (
                <div
                  key={customer.id}
                  className="relative overflow-hidden bg-white/95 backdrop-blur-sm rounded-2xl md:rounded-3xl shadow-card p-4 md:p-6 border border-blue-200/60 transform transition-all duration-200 active:scale-[0.98] glow-blue hover:shadow-card-hover hover:border-blue-300 fade-in"
                >
                  {/* Top accent bar */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-teal-500 shimmer" />

                  {/* Customer Name */}
                  <div className="mb-3 md:mb-4">
                    <h2 className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-700 to-cyan-600 bg-clip-text text-transparent mb-2">
                      {customer.name}
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

                  {/* Elapsed Time */}
                  <div className="mb-3 md:mb-4">
                    <p className="text-xs sm:text-sm text-gray-500 mb-1.5 font-bold tracking-wide uppercase">⏱️ เวลาที่ใช้</p>
                    <div className="text-4xl sm:text-5xl md:text-6xl font-bold text-center py-4 md:py-5 rounded-2xl shadow-inner bg-gradient-to-br from-cyan-100 to-blue-100 text-cyan-800 border-2 border-cyan-300">
                      {customer.elapsedTime}
                    </div>
                  </div>

                  {/* Current Cost (Blue) */}
                  <div className="mb-3 md:mb-4 cost-tick">
                    <div className={`border rounded-2xl p-3 md:p-4 text-center shadow-sm ${
                      customer.hasDiscount
                        ? 'bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-300'
                        : 'bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-300'
                    }`}>
                      {customer.hasDiscount && (
                        <div className="mb-1 inline-block bg-orange-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                          {customer.promoLabel}
                        </div>
                      )}
                      <p className={`text-[10px] font-bold uppercase tracking-wider ${customer.hasDiscount ? 'text-orange-500' : 'text-emerald-600'}`}>
                        💰 ราคาปัจจุบัน
                      </p>
                      <p className={`text-4xl sm:text-5xl md:text-6xl font-extrabold bg-clip-text text-transparent ${
                        customer.hasDiscount
                          ? 'bg-gradient-to-r from-orange-500 to-red-500'
                          : 'bg-gradient-to-r from-emerald-600 to-green-600'
                      }`}>
                        ฿{customer.currentCost.toFixed(2)}
                      </p>
                      <div className="mt-2 flex items-center justify-center gap-2">
                        <span className="text-xs sm:text-sm font-semibold text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full">
                          {customer.hourly_rate} บาท/ชม.
                        </span>
                        {!customer.is_running && (
                          <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
                            ⏸️ หยุด
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Start Time */}
                  {customer.start_time && (
                    <div className="mb-3 md:mb-4">
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-2 md:p-3">
                        <p className="text-[10px] text-blue-500 font-bold uppercase">🕐 เวลาเริ่ม</p>
                        <p className="text-sm md:text-base text-blue-700 font-bold">
                          {formatTimeDisplay(customer.start_time)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Payment Status */}
                  <div className="mb-3">
                    <div
                      className={`p-2.5 rounded-xl text-center font-bold text-sm border ${
                        customer.is_paid
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-300'
                          : 'bg-red-50 text-red-600 border-red-300'
                      }`}
                    >
                      {customer.is_paid ? '✅ ชำระเงินแล้ว' : '❌ ยังไม่ชำระเงิน'}
                    </div>
                  </div>

                  {/* Call Staff Button */}
                  <button
                    onClick={() => handleCallStaff(customer)}
                    className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold py-2.5 md:py-3 px-6 rounded-xl transform hover:scale-[1.01] active:scale-95 transition-all duration-200 shadow-lg text-sm md:text-base"
                  >
                    🔔 เรียกพนักงาน
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Auto-refresh indicator */}
        <div className="mt-6 md:mt-8 text-center slide-up-2">
          <p className="text-white/90 text-sm sm:text-base font-semibold glass-light inline-block px-4 py-2 md:px-6 md:py-3 rounded-full">
            🔄 อัพเดทราคาตามเวลาจริง
          </p>
        </div>
      </div>
    </div>
  )
}

export default CustomerViewBlue

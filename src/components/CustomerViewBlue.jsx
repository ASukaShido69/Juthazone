import { useMemo, useState } from 'react'
import { formatTimeDisplay } from '../utils/timeFormat'
import { calculateCostBlue, formatElapsedTime } from '../utils/authUtilsBlue'
import { logActivityBlue } from '../utils/authUtilsBlue'

function CustomerViewBlue({ customers }) {
  const [roomFilter, setRoomFilter] = useState('all')

  // Calculate real-time cost and elapsed time for display
  const displayCustomers = useMemo(() => {
    return customers.map(customer => ({
      ...customer,
      currentCost: calculateCostBlue(
        customer.start_time,
        customer.hourly_rate,
        customer.total_pause_duration,
        customer.pause_time,
        customer.is_running
      ),
      elapsedTime: formatElapsedTime(
        customer.start_time,
        customer.total_pause_duration,
        customer.pause_time,
        customer.is_running
      )
    }))
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
      alert('✅ เรียกพนักงานแล้ว')
    } catch (error) {
      console.error('Call staff error:', error)
      alert('❌ ไม่สามารถบันทึกการเรียกพนักงานได้')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-700 via-cyan-600 to-teal-500 animate-gradient p-3 md:p-4 lg:p-6">
      <style>{`
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 15s ease infinite;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
        @keyframes cost-tick {
          0% { transform: scale(1); }
          50% { transform: scale(1.03); }
          100% { transform: scale(1); }
        }
        .cost-animate { animation: cost-tick 2s ease-in-out infinite; }
        @keyframes shimmer-blue {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .shimmer-blue {
          background: linear-gradient(90deg, transparent 25%, rgba(255,255,255,0.2) 50%, transparent 75%);
          background-size: 200% 100%;
          animation: shimmer-blue 2.5s infinite;
        }
        @keyframes glow-blue {
          0%, 100% { box-shadow: 0 0 5px rgba(6,182,212,0.2); }
          50% { box-shadow: 0 0 20px rgba(6,182,212,0.5), 0 0 40px rgba(6,182,212,0.15); }
        }
        .card-glow-blue { animation: glow-blue 3s ease-in-out infinite; }
      `}</style>

      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6 md:mb-8 pt-2 md:pt-4">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white drop-shadow-2xl mb-2 md:mb-3 animate-float">
            🔵 JUTHAZONE BLUE 🔵
          </h1>
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-white drop-shadow-lg font-semibold bg-white/20 backdrop-blur-sm inline-block px-4 py-2 md:px-6 md:py-2 rounded-full border border-white/40">
            ระบบคำนวณราคาตามเวลาจริง | รายการทั้งหมด: {customers.length} | แสดง: {filteredCustomers.length}
          </p>
        </div>

        {/* Room Filter */}
        {customers.length > 0 && (
          <div className="bg-white/15 backdrop-blur-md border border-white/25 rounded-2xl shadow-xl p-4 mb-4 md:mb-6">
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
                  className="relative overflow-hidden bg-gradient-to-br from-white via-blue-50 to-cyan-50 rounded-2xl md:rounded-3xl shadow-2xl p-4 md:p-6 border-2 border-blue-300/50 transform transition-all duration-300 active:scale-95 card-glow-blue"
                >
                  {/* Top accent bar */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-teal-500 shimmer-blue" />

                  {/* Customer Name */}
                  <div className="mb-3 md:mb-4">
                    <h2 className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-700 to-cyan-600 bg-clip-text text-transparent mb-2">
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

                  {/* Elapsed Time */}
                  <div className="mb-3 md:mb-4">
                    <p className="text-xs sm:text-sm text-gray-500 mb-1.5 font-bold tracking-wide uppercase">⏱️ เวลาที่ใช้</p>
                    <div className="text-4xl sm:text-5xl md:text-6xl font-bold text-center py-4 md:py-5 rounded-2xl shadow-inner bg-gradient-to-br from-cyan-100 to-blue-100 text-cyan-800 border-2 border-cyan-300">
                      {customer.elapsedTime}
                    </div>
                  </div>

                  {/* Current Cost (Pro-rated) - Enhanced */}
                  <div className="mb-3 md:mb-4 cost-animate">
                    <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-300 rounded-2xl p-3 md:p-4 text-center shadow-sm">
                      <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">💰 ราคาปัจจุบัน</p>
                      <p className="text-4xl sm:text-5xl md:text-6xl font-extrabold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
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
                  <div className="mb-3 md:mb-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-2 md:p-3">
                      <p className="text-[10px] text-blue-500 font-bold uppercase">🕐 เวลาเริ่ม</p>
                      <p className="text-sm md:text-base text-blue-700 font-bold">
                        {formatTimeDisplay(customer.start_time)}
                      </p>
                    </div>
                  </div>

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
        <div className="mt-6 md:mt-8 text-center">
          <p className="text-white text-sm sm:text-base drop-shadow-lg bg-white/15 backdrop-blur-sm inline-block px-4 py-2 md:px-6 md:py-3 rounded-full border border-white/30 font-semibold animate-pulse">
            🔄 อัพเดทราคาตามเวลาจริง
          </p>
        </div>
      </div>
    </div>
  )
}

export default CustomerViewBlue

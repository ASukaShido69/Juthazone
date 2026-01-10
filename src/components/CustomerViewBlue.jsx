import { useMemo } from 'react'
import { formatTimeDisplay } from '../utils/timeFormat'
import { calculateCostBlue, formatElapsedTime } from '../utils/authUtilsBlue'
import { logActivityBlue } from '../utils/authUtilsBlue'

function CustomerViewBlue({ customers }) {
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
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-cyan-500 to-teal-500 animate-gradient p-3 md:p-4 lg:p-6">
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
      `}</style>

      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6 md:mb-8 pt-2 md:pt-4">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white drop-shadow-2xl mb-2 md:mb-3 animate-float">
            🔵 JUTHAZONE BLUE 🔵
          </h1>
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-white drop-shadow-lg font-semibold bg-white/20 backdrop-blur-sm inline-block px-4 py-2 md:px-6 md:py-2 rounded-full border-2 border-white/40">
            ระบบคำนวณราคาตามเวลาจริง | รายการทั้งหมด: {customers.length} รายการ
          </p>
        </div>

        {customers.length === 0 ? (
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl md:rounded-3xl shadow-2xl p-8 md:p-12 text-center border-4 border-white/50">
            <div className="text-6xl md:text-8xl mb-4 md:mb-6 animate-bounce-slow">🔵</div>
            <p className="text-2xl md:text-3xl text-gray-700 font-bold mb-2">ยังไม่มีรายการ</p>
            <p className="text-gray-500 text-base md:text-lg">รอลูกค้าเข้าใช้งาน</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {displayCustomers.map((customer) => {
              return (
                <div
                  key={customer.id}
                  className="bg-gradient-to-br from-white via-blue-50 to-cyan-50 border-blue-400 rounded-2xl md:rounded-3xl shadow-2xl p-4 md:p-6 border-3 md:border-4 transform transition-all duration-300 hover:shadow-cyan-500/50 active:scale-95"
                >
                  {/* Customer Name */}
                  <div className="mb-3 md:mb-4">
                    <h2 className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-700 to-cyan-600 bg-clip-text text-transparent mb-2">
                      👤 {customer.name}
                    </h2>
                    <div className="inline-block bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs sm:text-sm font-bold shadow-lg">
                      📍 {customer.room}
                    </div>
                  </div>

                  {/* Note Section */}
                  {customer.note && (
                    <div className="mb-3 md:mb-4">
                      <div className="bg-yellow-100 border-2 border-yellow-400 rounded-lg p-2 md:p-3">
                        <p className="text-xs sm:text-sm text-gray-700 font-semibold mb-1">📝 Note</p>
                        <p className="text-sm md:text-base text-gray-800 break-words">{customer.note}</p>
                      </div>
                    </div>
                  )}

                  {/* Elapsed Time */}
                  <div className="mb-3 md:mb-4">
                    <p className="text-xs sm:text-sm text-gray-600 mb-1 font-semibold">⏱️ เวลาที่ใช้</p>
                    <div className="text-4xl sm:text-5xl md:text-6xl font-bold text-center py-4 md:py-6 rounded-xl md:rounded-2xl shadow-inner bg-gradient-to-br from-cyan-200 to-blue-200 text-cyan-800 border-3 md:border-4 border-cyan-400">
                      {customer.elapsedTime}
                    </div>
                  </div>

                  {/* Current Cost (Pro-rated) */}
                  <div className="mb-3 md:mb-4">
                    <p className="text-xs sm:text-sm text-gray-600 mb-1 font-semibold">💰 ราคาปัจจุบัน</p>
                    <div className="bg-gradient-to-br from-green-200 to-emerald-200 text-green-800 border-3 md:border-4 border-green-400 rounded-xl md:rounded-2xl py-4 md:py-6 text-center shadow-inner">
                      <p className="text-4xl sm:text-5xl md:text-6xl font-bold">
                        ฿{customer.currentCost.toFixed(2)}
                      </p>
                      <p className="text-xs sm:text-sm mt-2 font-semibold">
                        อัตรา {customer.hourly_rate} บาท/ชม.
                      </p>
                      {!customer.is_running && (
                        <p className="text-xs sm:text-sm mt-1 text-orange-600 font-bold">
                          ⏸️ หยุดชั่วคราว
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Start Time */}
                  <div className="mb-3 md:mb-4">
                    <div className="bg-blue-100 border-2 border-blue-300 rounded-lg p-2 md:p-3">
                      <p className="text-xs sm:text-sm text-gray-600 mb-1 font-semibold">🕐 เวลาเริ่ม</p>
                      <p className="text-sm md:text-base text-blue-700 font-bold">
                        {formatTimeDisplay(customer.start_time)}
                      </p>
                    </div>
                  </div>

                  {/* Payment Status */}
                  <div className="mb-4 md:mb-6">
                    <div
                      className={`p-3 md:p-4 rounded-xl text-center font-bold text-sm md:text-base ${
                        customer.is_paid
                          ? 'bg-green-100 text-green-700 border-2 border-green-400'
                          : 'bg-red-100 text-red-700 border-2 border-red-400'
                      }`}
                    >
                      {customer.is_paid ? '✅ ชำระเงินแล้ว' : '❌ ยังไม่ชำระเงิน'}
                    </div>
                  </div>

                  {/* Call Staff Button */}
                  <button
                    onClick={() => handleCallStaff(customer)}
                    className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold py-3 md:py-4 px-6 rounded-xl transform hover:scale-105 active:scale-95 transition-all duration-300 shadow-lg text-sm md:text-base"
                  >
                    🔔 เรียกพนักงาน
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default CustomerViewBlue

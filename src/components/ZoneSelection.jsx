import { useNavigate } from 'react-router-dom'

function ZoneSelection() {
  const navigate = useNavigate()

  const handleZoneSelect = (zone) => {
    localStorage.setItem('selected_zone', zone)
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-orange-500 animate-gradient flex items-center justify-center p-4">
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
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(255,255,255,0.5); }
          50% { box-shadow: 0 0 40px rgba(255,255,255,0.8); }
        }
        .pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
      `}</style>

      <div className="w-full max-w-5xl">
        {/* Logo */}
        <div className="text-center mb-12 animate-float">
          <h1 className="text-7xl md:text-8xl mb-4">🎮</h1>
          <h2 className="text-5xl md:text-7xl font-bold text-white drop-shadow-2xl mb-4">
            JUTHAZONE
          </h2>
          <p className="text-white/90 text-xl md:text-2xl drop-shadow-lg font-semibold bg-white/20 backdrop-blur-sm inline-block px-6 py-3 rounded-full border-2 border-white/40">
            เลือกโซนที่ต้องการเข้าใช้งาน
          </p>
        </div>

        {/* Zone Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 px-4">
          {/* Juthazone Red */}
          <button
            onClick={() => handleZoneSelect('red')}
            className="group bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-8 md:p-12 border-4 border-red-400 hover:border-red-600 transform transition-all duration-300 hover:scale-105 hover:shadow-red-500/50 active:scale-95 pulse-glow"
          >
            <div className="text-center">
              <div className="text-7xl md:text-8xl mb-6 group-hover:scale-110 transition-transform duration-300">
                🔴
              </div>
              <h3 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent mb-4">
                Juthazone Red
              </h3>
              <p className="text-gray-700 font-semibold text-lg md:text-xl mb-6">
                ระบบจัดการเวลาแบบกำหนดนาที
              </p>
              <div className="bg-red-50 border-3 border-red-300 rounded-2xl p-5">
                <p className="text-red-800 font-bold text-base md:text-lg mb-2">✨ ระบบเดิม</p>
                <p className="text-red-600 text-sm md:text-base">
                  กำหนดเวลาและราคาล่วงหน้า
                </p>
                <p className="text-red-500 text-xs md:text-sm mt-2">
                  เหมาะสำหรับแพ็คเกจเวลาคงที่
                </p>
              </div>
            </div>
          </button>

          {/* Juthazone Blue */}
          <button
            onClick={() => handleZoneSelect('blue')}
            className="group bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-8 md:p-12 border-4 border-blue-400 hover:border-blue-600 transform transition-all duration-300 hover:scale-105 hover:shadow-blue-500/50 active:scale-95 pulse-glow"
          >
            <div className="text-center">
              <div className="text-7xl md:text-8xl mb-6 group-hover:scale-110 transition-transform duration-300">
                🔵
              </div>
              <h3 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent mb-4">
                Juthazone Blue
              </h3>
              <p className="text-gray-700 font-semibold text-lg md:text-xl mb-6">
                ระบบคำนวณราคาตามเวลาจริง
              </p>
              <div className="bg-blue-50 border-3 border-blue-300 rounded-2xl p-5">
                <p className="text-blue-800 font-bold text-base md:text-lg mb-2">🆕 ระบบใหม่!</p>
                <p className="text-blue-600 text-sm md:text-base">
                  คิดราคาตามชั่วโมงที่ใช้จริง
                </p>
                <p className="text-blue-500 text-xs md:text-sm mt-2">
                  159 บาท/ชม. - คิดตามนาทีจริง
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* Info Section */}
        <div className="mt-10 px-4">
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 border-2 border-white/40">
            <div className="text-center">
              <p className="text-white font-bold text-base md:text-lg mb-3">
                💡 ความแตกต่างระหว่าง 2 โซน
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-white/90 text-sm md:text-base">
                <div className="bg-red-500/20 rounded-xl p-4 border border-red-300/30">
                  <p className="font-semibold mb-1">🔴 Red Zone:</p>
                  <p className="text-xs md:text-sm">ตั้งเวลา + ราคาตายตัว (เช่น 60 นาที = 100 บาท)</p>
                </div>
                <div className="bg-blue-500/20 rounded-xl p-4 border border-blue-300/30">
                  <p className="font-semibold mb-1">🔵 Blue Zone:</p>
                  <p className="text-xs md:text-sm">คิดตามเวลาจริง (เช่น 30 นาที = 79.50 บาท)</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-white/90 font-semibold drop-shadow-lg">
          <p className="text-sm md:text-base">© 2026 Juthazone - ระบบจัดการเวลาเล่น</p>
          <p className="text-xs md:text-sm mt-1 text-white/70">Developed with ❤️ by Theo Leo</p>
        </div>
      </div>
    </div>
  )
}

export default ZoneSelection

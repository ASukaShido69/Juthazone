import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authenticateUser } from '../utils/authUtils'

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedZone, setSelectedZone] = useState(null)
  const navigate = useNavigate()

  const handleZoneSelect = (zone) => {
    setSelectedZone(zone)
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Simulate loading for UX
    await new Promise(resolve => setTimeout(resolve, 500))

    // Authenticate against database
    const result = await authenticateUser(username, password)

    if (!result.success) {
      setError(`❌ ${result.error}`)
      setLoading(false)
      return
    }

    // Login success
    const userData = result.user
    
    // Save to localStorage
    localStorage.setItem('juthazone_user', JSON.stringify(userData))
    localStorage.setItem('selected_zone', selectedZone || 'red')
    
    // Callback
    onLogin(userData)
    
    // Redirect based on zone
    if (selectedZone === 'blue') {
      navigate('/blue/admin')
    } else {
      navigate('/admin')
    }
    setLoading(false)
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
      `}</style>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8 animate-float">
          <h1 className="text-6xl mb-3">🎮</h1>
          <h2 className="text-5xl font-bold text-white drop-shadow-2xl mb-2">JUTHAZONE</h2>
          <p className="text-white/90 text-lg drop-shadow-lg font-semibold">ระบบจัดการเวลาเล่น</p>
        </div>

        {/* Login Card */}
        <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-8 border-4 border-white/50">
          <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-6 text-center">
            🔐 เข้าสู่ระบบ
          </h3>

          {/* Zone Selection */}
          {!selectedZone ? (
            <div className="space-y-4 mb-6">
              <p className="text-center text-gray-700 font-semibold mb-4">เลือกโซนที่ต้องการเข้าสู่ระบบ</p>
              
              {/* Red Zone Button */}
              <button
                onClick={() => handleZoneSelect('red')}
                className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold py-4 px-6 rounded-xl transform hover:scale-105 active:scale-95 transition-all duration-300 shadow-lg"
              >
                <div className="flex items-center justify-center gap-3">
                  <span className="text-3xl">🔴</span>
                  <div className="text-left">
                    <p className="text-lg">Juthazone Red</p>
                    <p className="text-xs opacity-90">ระบบกำหนดเวลาและราคาล่วงหน้า</p>
                  </div>
                </div>
              </button>

              {/* Blue Zone Button */}
              <button
                onClick={() => handleZoneSelect('blue')}
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-4 px-6 rounded-xl transform hover:scale-105 active:scale-95 transition-all duration-300 shadow-lg"
              >
                <div className="flex items-center justify-center gap-3">
                  <span className="text-3xl">🔵</span>
                  <div className="text-left">
                    <p className="text-lg">Juthazone Blue</p>
                    <p className="text-xs opacity-90">คิดราคาตามเวลาจริง (Pro-rated)</p>
                  </div>
                </div>
              </button>

              {/* Back to Zone Selection */}
              <button
                onClick={() => navigate('/')}
                className="w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-xl transform hover:scale-105 active:scale-95 transition-all duration-300 text-sm"
              >
                ← กลับหน้าเลือกโซน
              </button>
            </div>
          ) : (
            <>
              {/* Show Selected Zone */}
              <div className="mb-4 text-center">
                <div className={`inline-block px-4 py-2 rounded-full font-bold ${
                  selectedZone === 'red' 
                    ? 'bg-red-100 text-red-700' 
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {selectedZone === 'red' ? '🔴 Juthazone Red' : '🔵 Juthazone Blue'}
                </div>
                <button
                  onClick={() => setSelectedZone(null)}
                  className="ml-2 text-sm text-gray-500 hover:text-gray-700 underline"
                >
                  เปลี่ยน
                </button>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                {/* Username Input */}
                <div>
                  <label className="block text-gray-700 font-bold mb-2">👤 ชื่อผู้ใช้</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value)
                      setError('')
                    }}
                    placeholder="Username"
                    className="w-full px-4 py-3 border-2 border-purple-300 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 text-base font-semibold"
                    disabled={loading}
                    autoComplete="username"
                  />
                </div>

                {/* Password Input */}
                <div>
                  <label className="block text-gray-700 font-bold mb-2">🔑 รหัสผ่าน</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setError('')
                    }}
                    placeholder="กรอกรหัสผ่าน"
                    className="w-full px-4 py-3 border-2 border-purple-300 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 text-base font-semibold"
                    disabled={loading}
                    autoComplete="current-password"
                  />
                </div>

                {/* Error Message */}
                {error && (
                  <div className="bg-red-100 border-2 border-red-400 text-red-700 px-4 py-3 rounded-lg font-semibold text-center">
                    {error}
                  </div>
                )}

                {/* Login Button */}
                <button
                  type="submit"
                  disabled={loading || !username || !password}
                  className={`w-full py-3 px-6 rounded-xl font-bold text-white text-lg transform transition-all duration-300 ${
                    loading || !username || !password
                      ? 'bg-gray-400 cursor-not-allowed'
                      : selectedZone === 'red'
                      ? 'bg-gradient-to-r from-red-600 to-red-500 hover:shadow-lg hover:scale-105 active:scale-95'
                      : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:shadow-lg hover:scale-105 active:scale-95'
                  }`}
                >
                  {loading ? '⏳ กำลังเข้าสู่ระบบ...' : '🚀 เข้าสู่ระบบ'}
                </button>
              </form>

              {/* Info Message */}
              <div className={`mt-8 border-2 rounded-xl p-4 ${
                selectedZone === 'red' 
                  ? 'bg-red-50 border-red-300' 
                  : 'bg-blue-50 border-blue-300'
              }`}>
                <p className={`font-bold text-center text-sm ${
                  selectedZone === 'red' ? 'text-red-700' : 'text-blue-700'
                }`}>
                  ✅ ระบบเข้าสู่ระบบ Juthazone {selectedZone === 'red' ? 'Red' : 'Blue'}
                </p>
                <p className={`text-center text-xs mt-2 ${
                  selectedZone === 'red' ? 'text-red-600' : 'text-blue-600'
                }`}>
                  {selectedZone === 'red' 
                    ? 'ระบบกำหนดเวลาและราคาล่วงหน้า' 
                    : 'ระบบคำนวณราคาตามเวลาจริง (Pro-rated)'}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-white/90 font-semibold drop-shadow-lg">
          <p>© 2026 Juthazone - ระบบจัดการเวลาเล่น</p>
        </div>
      </div>
    </div>
  )
}

export default LoginPage

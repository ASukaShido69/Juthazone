import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import supabase from '../firebase'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

function AnalyticsView({ user }) {
  const [history, setHistory] = useState([])
  const [analyticsData, setAnalyticsData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filterRoom, setFilterRoom] = useState('all')
  const [filterPaid, setFilterPaid] = useState('all')
  const [filterStaff, setFilterStaff] = useState('all')

  // Fetch analytics data
  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('customers_history')
        .select('*')
        .order('start_time', { ascending: false })
        .limit(1000) // Limit to last 1000 records for performance

      if (error) throw error
      setHistory(data || [])
    } catch (err) {
      console.error('Error fetching analytics:', err)
      setError('ไม่สามารถโหลดข้อมูล analytics ได้')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  // Apply filters to history
  const filteredHistory = useMemo(() => {
    let filtered = [...history]

    // Filter by room
    if (filterRoom !== 'all') {
      filtered = filtered.filter(h => h.room === filterRoom)
    }

    // Filter by payment status
    if (filterPaid !== 'all') {
      filtered = filtered.filter(h => h.is_paid === (filterPaid === 'paid'))
    }

    // Filter by staff member
    if (filterStaff !== 'all') {
      filtered = filtered.filter(h => h.added_by === filterStaff)
    }

    // Filter by date range
    if (dateFrom) {
      filtered = filtered.filter(h => new Date(h.start_time) >= new Date(dateFrom))
    }
    if (dateTo) {
      const endDate = new Date(dateTo)
      endDate.setHours(23, 59, 59)
      filtered = filtered.filter(h => new Date(h.start_time) <= endDate)
    }

    return filtered
  }, [history, filterRoom, filterPaid, filterStaff, dateFrom, dateTo])

  // Memoized analytics data processing for performance
  const analyticsDataMemo = useMemo(() => {
    if (!filteredHistory.length) {
      return {
        dailyRevenue: [],
        roomStats: [],
        peakHours: [],
        totalRevenue: 0,
        totalCustomers: 0,
        totalHours: 0,
        avgPerCustomer: 0
      }
    }

    // Calculate daily revenue
    const dailyMap = {}
    const roomMap = {}
    const hourMap = {}
    let totalRevenue = 0
    let totalCustomers = 0
    let totalHours = 0

    filteredHistory.forEach(record => {
      const startDate = new Date(record.start_time)
      const dateKey = startDate.toLocaleDateString('th-TH')
      const hour = startDate.getHours()
      const cost = parseFloat(record.final_cost) || 0
      const duration = parseFloat(record.duration_minutes) || 0

      // Daily revenue
      dailyMap[dateKey] = (dailyMap[dateKey] || 0) + cost

      // Room stats
      roomMap[record.room] = (roomMap[record.room] || 0) + 1

      // Peak hours
      hourMap[hour] = (hourMap[hour] || 0) + 1

      // Totals
      totalRevenue += cost
      totalCustomers += 1
      totalHours += duration / 60
    })

    // Format data for charts
    const dailyRevenue = Object.entries(dailyMap)
      .sort((a, b) => new Date(a[0]) - new Date(b[0]))
      .slice(-30)
      .map(([date, revenue]) => ({
        date,
        revenue: parseFloat(revenue.toFixed(2))
      }))

    const roomStats = Object.entries(roomMap)
      .map(([room, count]) => {
        const roomRevenue = filteredHistory
          .filter(r => r.room === room)
          .reduce((sum, r) => sum + (parseFloat(r.final_cost) || 0), 0)
        return {
          name: room,
          value: count,
          revenue: parseFloat(roomRevenue.toFixed(2))
        }
      })
      .sort((a, b) => b.value - a.value)

    const peakHours = Object.entries(hourMap)
      .map(([hour, count]) => ({
        hour: `${String(hour).padStart(2, '0')}:00`,
        customers: count
      }))
      .sort((a, b) => parseInt(b.hour) - parseInt(a.hour))

    return {
      dailyRevenue,
      roomStats,
      peakHours,
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalCustomers,
      totalHours: parseFloat(totalHours.toFixed(1)),
      avgPerCustomer: parseFloat((totalRevenue / (totalCustomers || 1)).toFixed(0))
    }
  }, [filteredHistory])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-orange-500 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-spin">⏳</div>
          <p className="text-white text-xl font-bold">กำลังโหลดข้อมูล Analytics...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-orange-500 flex items-center justify-center p-4">
        <div className="text-center bg-white/95 rounded-2xl p-8 max-w-md">
          <div className="text-5xl mb-4">❌</div>
          <p className="text-red-600 text-lg font-bold mb-4">{error}</p>
          <button
            onClick={fetchAnalytics}
            className="bg-purple-600 text-white font-bold py-2 px-6 rounded-xl hover:bg-purple-700 transition"
          >
            🔄 ลองใหม่
          </button>
        </div>
      </div>
    )
  }

  const colors = ['#9333ea', '#ec4899', '#f97316', '#06b6d4', '#22c55e', '#8b5cf6', '#f43f5e']

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-orange-500 animate-gradient p-3 md:p-6 lg:p-8">
      <style>{`
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 15s ease infinite;
        }
      `}</style>

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-2xl mb-2">
              📊 Dashboard Analytics
            </h1>
            <p className="text-white/90 text-lg drop-shadow-lg font-semibold">
              {user?.displayName} - {new Date().toLocaleDateString('th-TH')}
            </p>
          </div>
          <Link
            to="/admin"
            className="bg-white/90 hover:bg-white text-purple-600 font-bold py-2 px-6 rounded-xl shadow-lg hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
          >
            ← กลับแอดมิน
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-6 border-3 border-pink-300">
          <h3 className="text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">🔍 ตัวกรอง</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">วันที่เริ่มต้น</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border-2 border-purple-300 rounded-lg focus:outline-none focus:border-purple-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">วันที่สิ้นสุด</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border-2 border-purple-300 rounded-lg focus:outline-none focus:border-purple-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">ห้อง</label>
              <select
                value={filterRoom}
                onChange={(e) => setFilterRoom(e.target.value)}
                className="w-full px-3 py-2 border-2 border-purple-300 rounded-lg focus:outline-none focus:border-purple-500 text-sm"
              >
                <option value="all">ทั้งหมด</option>
                <option value="ชั้น 2 ห้อง VIP">ชั้น 2 ห้อง VIP</option>
                <option value="ชั้น 3 ห้อง VIP KARAOKE">ชั้น 3 ห้อง VIP KARAOKE</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">สถานะการจ่าย</label>
              <select
                value={filterPaid}
                onChange={(e) => setFilterPaid(e.target.value)}
                className="w-full px-3 py-2 border-2 border-purple-300 rounded-lg focus:outline-none focus:border-purple-500 text-sm"
              >
                <option value="all">ทั้งหมด</option>
                <option value="paid">จ่ายแล้ว</option>
                <option value="unpaid">ยังไม่จ่าย</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">พนักงาน</label>
              <select
                value={filterStaff}
                onChange={(e) => setFilterStaff(e.target.value)}
                className="w-full px-3 py-2 border-2 border-purple-300 rounded-lg focus:outline-none focus:border-purple-500 text-sm"
              >
                <option value="all">ทั้งหมด</option>
                {[...new Set(history.map(h => h.added_by).filter(Boolean))].sort().map(staff => (
                  <option key={staff} value={staff}>{staff}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={() => {
                setDateFrom('')
                setDateTo('')
                setFilterRoom('all')
                setFilterPaid('all')
                setFilterStaff('all')
              }}
              className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 text-sm"
            >
              🔄 ล้างตัวกรอง
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border-2 border-purple-300 hover:shadow-xl transition">
            <p className="text-gray-600 font-semibold text-sm">💰 รายได้รวม</p>
            <p className="text-3xl font-bold text-purple-600 mt-2">฿{analyticsDataMemo.totalRevenue}</p>
          </div>
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border-2 border-pink-300 hover:shadow-xl transition">
            <p className="text-gray-600 font-semibold text-sm">👥 จำนวนลูกค้า</p>
            <p className="text-3xl font-bold text-pink-600 mt-2">{analyticsDataMemo.totalCustomers}</p>
          </div>
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border-2 border-blue-300 hover:shadow-xl transition">
            <p className="text-gray-600 font-semibold text-sm">⏰ เวลารวม</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">{analyticsDataMemo.totalHours} ชม</p>
          </div>
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border-2 border-orange-300 hover:shadow-xl transition">
            <p className="text-gray-600 font-semibold text-sm">📈 เฉลี่ย/คน</p>
            <p className="text-3xl font-bold text-orange-600 mt-2">฿{analyticsDataMemo.avgPerCustomer}</p>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Daily Revenue Chart */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border-3 border-purple-300">
            <h2 className="text-xl font-bold text-purple-600 mb-4">💵 รายได้รายวัน</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analyticsDataMemo.dailyRevenue} margin={{ top: 5, right: 30, bottom: 60, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ddd" />
                <XAxis 
                  dataKey="date" 
                  angle={-45} 
                  textAnchor="end" 
                  height={80} 
                  fontSize={12}
                  interval={Math.floor(analyticsDataMemo.dailyRevenue.length / 5)}
                />
                <YAxis />
                <Tooltip 
                  formatter={(value) => `฿${value}`}
                  contentStyle={{ backgroundColor: '#fff', border: '2px solid #9333ea', borderRadius: '8px' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#9333ea" 
                  strokeWidth={3}
                  dot={{ fill: '#9333ea', r: 4 }}
                  activeDot={{ r: 6 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Room Statistics */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border-3 border-pink-300">
            <h2 className="text-xl font-bold text-pink-600 mb-4">🏠 สถิติห้อง</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analyticsDataMemo.roomStats}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  isAnimationActive={false}
                >
                  {analyticsDataMemo.roomStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => `${value} คน`}
                  contentStyle={{ backgroundColor: '#fff', border: '2px solid #ec4899', borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Peak Hours Chart */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border-3 border-blue-300 mb-6">
          <h2 className="text-xl font-bold text-blue-600 mb-4">🕐 ช่วงเวลาที่คนใช้มากสุด (Peak Hours)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analyticsDataMemo.peakHours} margin={{ top: 5, right: 30, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ddd" />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip 
                formatter={(value) => `${value} คน`}
                contentStyle={{ backgroundColor: '#fff', border: '2px solid #06b6d4', borderRadius: '8px' }}
              />
              <Bar dataKey="customers" fill="#06b6d4" radius={[8, 8, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Room Details */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border-3 border-orange-300">
          <h2 className="text-xl font-bold text-orange-600 mb-4">📊 รายละเอียดห้อง</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analyticsDataMemo.roomStats.map((room, idx) => (
              <div key={idx} className="bg-gradient-to-br from-orange-50 to-yellow-50 border-2 border-orange-200 rounded-xl p-4 hover:shadow-lg transition">
                <p className="text-lg font-bold text-orange-700">{room.name}</p>
                <div className="mt-3 space-y-2">
                  <p className="text-gray-600"><span className="font-bold">👥 จำนวน:</span> {room.value} คน</p>
                  <p className="text-gray-600"><span className="font-bold">💰 รายได้:</span> ฿{room.revenue.toFixed(2)}</p>
                  <p className="text-gray-600"><span className="font-bold">📈 เฉลี่ย:</span> ฿{(room.revenue / room.value).toFixed(0)}/คน</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AnalyticsView

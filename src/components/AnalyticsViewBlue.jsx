import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import supabase from '../firebase'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

function AnalyticsViewBlue({ user }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filterRoom, setFilterRoom] = useState('all')
  const [filterPaid, setFilterPaid] = useState('all')

  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('juthazoneb_customers_history')
        .select('*')
        .order('start_time', { ascending: false })
        .limit(1000)

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

  const filteredHistory = useMemo(() => {
    let filtered = [...history]

    if (filterRoom !== 'all') {
      filtered = filtered.filter(h => h.room === filterRoom)
    }

    if (filterPaid !== 'all') {
      filtered = filtered.filter(h => h.is_paid === (filterPaid === 'paid'))
    }

    if (dateFrom) {
      filtered = filtered.filter(h => new Date(h.start_time) >= new Date(dateFrom))
    }
    if (dateTo) {
      const endDate = new Date(dateTo)
      endDate.setHours(23, 59, 59)
      filtered = filtered.filter(h => new Date(h.start_time) <= endDate)
    }

    return filtered
  }, [history, filterRoom, filterPaid, dateFrom, dateTo])

  const analyticsData = useMemo(() => {
    if (!filteredHistory.length) {
      return {
        dailyRevenue: [],
        roomStats: [],
        peakHours: [],
        hourlyRateStats: [],
        totalRevenue: 0,
        totalCustomers: 0,
        totalHours: 0,
        avgPerCustomer: 0,
        avgHourlyRate: 0
      }
    }

    const dailyMap = {}
    const roomMap = {}
    const hourMap = {}
    const rateMap = {}
    let totalRevenue = 0
    let totalCustomers = 0
    let totalHours = 0
    let totalRateSum = 0

    filteredHistory.forEach(record => {
      const startDate = new Date(record.start_time)
      const dateKey = startDate.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
      const hour = startDate.getHours()
      const hourlyRate = record.hourly_rate || 0
      const revenue = record.final_cost || 0
      const duration = record.duration_minutes || 0

      // Daily revenue
      dailyMap[dateKey] = (dailyMap[dateKey] || 0) + revenue

      // Room stats
      if (!roomMap[record.room]) {
        roomMap[record.room] = { count: 0, revenue: 0, duration: 0 }
      }
      roomMap[record.room].count++
      roomMap[record.room].revenue += revenue
      roomMap[record.room].duration += duration

      // Peak hours
      hourMap[hour] = (hourMap[hour] || 0) + 1

      // Hourly rate stats
      const rateKey = `฿${hourlyRate}`
      rateMap[rateKey] = (rateMap[rateKey] || 0) + 1

      totalRevenue += revenue
      totalCustomers++
      totalHours += duration / 60
      totalRateSum += hourlyRate
    })

    const dailyRevenue = Object.entries(dailyMap).map(([date, revenue]) => ({
      date,
      revenue: parseFloat(revenue.toFixed(2))
    }))

    const roomStats = Object.entries(roomMap).map(([room, stats]) => ({
      name: room,
      count: stats.count,
      revenue: parseFloat(stats.revenue.toFixed(2)),
      avgDuration: parseFloat((stats.duration / stats.count).toFixed(2))
    }))

    const peakHours = Object.entries(hourMap)
      .map(([hour, count]) => ({
        hour: `${hour.padStart(2, '0')}:00`,
        count
      }))
      .sort((a, b) => parseInt(a.hour) - parseInt(b.hour))

    const hourlyRateStats = Object.entries(rateMap).map(([rate, count]) => ({
      rate,
      count
    }))

    return {
      dailyRevenue,
      roomStats,
      peakHours,
      hourlyRateStats,
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalCustomers,
      totalHours: parseFloat(totalHours.toFixed(2)),
      avgPerCustomer: totalCustomers > 0 ? parseFloat((totalRevenue / totalCustomers).toFixed(2)) : 0,
      avgHourlyRate: totalCustomers > 0 ? parseFloat((totalRateSum / totalCustomers).toFixed(2)) : 0
    }
  }, [filteredHistory])

  const COLORS = ['#3B82F6', '#06B6D4', '#14B8A6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-cyan-500 to-teal-500 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-spin">⏳</div>
          <p className="text-white text-xl font-bold">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-cyan-500 to-teal-500 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <p className="text-white text-xl font-bold">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-cyan-500 to-teal-500 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-2xl mb-2">
            📈 Analytics - Blue Zone
          </h1>
          <p className="text-lg md:text-xl text-white/90 drop-shadow-lg">
            วิเคราะห์ข้อมูลระบบคำนวณราคาตามเวลาจริง
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link
              to="/blue/admin"
              className="inline-block bg-white/90 hover:bg-white text-blue-600 font-bold py-2 px-6 rounded-xl shadow-lg hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
            >
              ← กลับหน้าแอดมิน
            </Link>
            <Link
              to="/"
              className="inline-block bg-white/90 hover:bg-white text-purple-600 font-bold py-2 px-6 rounded-xl shadow-lg hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
            >
              🏠 กลับหน้าหลัก
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-4 md:p-6 mb-6 border-4 border-blue-300">
          <h2 className="text-xl font-bold text-blue-700 mb-4">🔍 กรองข้อมูล</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-gray-700 font-semibold mb-2 text-sm">ห้อง</label>
              <select
                value={filterRoom}
                onChange={(e) => setFilterRoom(e.target.value)}
                className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
              >
                <option value="all">ทั้งหมด</option>
                <option value="ชั้น 2 ห้อง VIP">ชั้น 2 ห้อง VIP</option>
                <option value="ชั้น 3 ห้อง VIP KARAOKE">ชั้น 3 ห้อง VIP KARAOKE</option>
                <option value="ชั้น 3 ห้อง Golf">ชั้น 3 Golf</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-2 text-sm">สถานะการจ่าย</label>
              <select
                value={filterPaid}
                onChange={(e) => setFilterPaid(e.target.value)}
                className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
              >
                <option value="all">ทั้งหมด</option>
                <option value="paid">จ่ายแล้ว</option>
                <option value="unpaid">ยังไม่จ่าย</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-2 text-sm">วันที่เริ่ม</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-2 text-sm">วันที่สิ้นสุด</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl p-6 border-3 border-blue-300">
            <p className="text-gray-600 font-semibold mb-2 text-sm">💰 รายได้รวม</p>
            <p className="text-3xl font-bold text-green-600">฿{analyticsData.totalRevenue.toLocaleString()}</p>
          </div>
          <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl p-6 border-3 border-cyan-300">
            <p className="text-gray-600 font-semibold mb-2 text-sm">👥 จำนวนลูกค้า</p>
            <p className="text-3xl font-bold text-blue-600">{analyticsData.totalCustomers}</p>
          </div>
          <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl p-6 border-3 border-teal-300">
            <p className="text-gray-600 font-semibold mb-2 text-sm">📊 เฉลี่ยต่อคน</p>
            <p className="text-3xl font-bold text-cyan-600">฿{analyticsData.avgPerCustomer.toFixed(2)}</p>
          </div>
          <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl p-6 border-3 border-blue-300">
            <p className="text-gray-600 font-semibold mb-2 text-sm">⏱️ รวมชั่วโมง</p>
            <p className="text-3xl font-bold text-blue-600">{analyticsData.totalHours.toFixed(1)} ชม.</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Daily Revenue Chart */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 border-4 border-blue-300">
            <h3 className="text-xl font-bold text-blue-700 mb-4">📈 รายได้รายวัน</h3>
            {analyticsData.dailyRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analyticsData.dailyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} style={{ fontSize: '12px' }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={2} name="รายได้ (บาท)" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-400 text-center py-8">ไม่มีข้อมูล</p>
            )}
          </div>

          {/* Room Stats Chart */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 border-4 border-cyan-300">
            <h3 className="text-xl font-bold text-cyan-700 mb-4">🏠 สถิติตามห้อง</h3>
            {analyticsData.roomStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analyticsData.roomStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-20} textAnchor="end" height={80} style={{ fontSize: '11px' }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="revenue" fill="#06B6D4" name="รายได้ (บาท)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-400 text-center py-8">ไม่มีข้อมูล</p>
            )}
          </div>

          {/* Peak Hours Chart */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 border-4 border-teal-300">
            <h3 className="text-xl font-bold text-teal-700 mb-4">⏰ ช่วงเวลายอดนิยม</h3>
            {analyticsData.peakHours.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analyticsData.peakHours}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" style={{ fontSize: '12px' }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#14B8A6" name="จำนวนลูกค้า" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-400 text-center py-8">ไม่มีข้อมูล</p>
            )}
          </div>

          {/* Hourly Rate Distribution */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 border-4 border-blue-300">
            <h3 className="text-xl font-bold text-blue-700 mb-4">💵 การกระจายอัตราค่าบริการ</h3>
            {analyticsData.hourlyRateStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analyticsData.hourlyRateStats}
                    dataKey="count"
                    nameKey="rate"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={(entry) => `${entry.rate}: ${entry.count}`}
                  >
                    {analyticsData.hourlyRateStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-400 text-center py-8">ไม่มีข้อมูล</p>
            )}
          </div>
        </div>

        {/* Room Details Table */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 border-4 border-blue-300">
          <h3 className="text-xl font-bold text-blue-700 mb-4">📋 รายละเอียดตามห้อง</h3>
          {analyticsData.roomStats.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-500 text-white">
                    <th className="px-4 py-3 text-left rounded-tl-xl">ห้อง</th>
                    <th className="px-4 py-3 text-center">จำนวนลูกค้า</th>
                    <th className="px-4 py-3 text-center">รายได้รวม</th>
                    <th className="px-4 py-3 text-center rounded-tr-xl">ระยะเวลาเฉลี่ย</th>
                  </tr>
                </thead>
                <tbody>
                  {analyticsData.roomStats.map((room, index) => (
                    <tr
                      key={index}
                      className={`border-b ${
                        index % 2 === 0 ? 'bg-blue-50' : 'bg-white'
                      } hover:bg-cyan-100`}
                    >
                      <td className="px-4 py-3 font-semibold">{room.name}</td>
                      <td className="px-4 py-3 text-center font-bold text-blue-600">{room.count}</td>
                      <td className="px-4 py-3 text-center font-bold text-green-600">
                        ฿{room.revenue.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-cyan-600">
                        {room.avgDuration.toFixed(0)} นาที
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">ไม่มีข้อมูล</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default AnalyticsViewBlue

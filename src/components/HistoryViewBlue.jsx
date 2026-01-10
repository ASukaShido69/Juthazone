import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import supabase from '../firebase'
import { exportToExcel, printReceipt } from '../utils/exportUtils'
import { formatDateTimeThai } from '../utils/timeFormat'

function HistoryViewBlue() {
  const [history, setHistory] = useState([])
  const [filteredHistory, setFilteredHistory] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRoom, setFilterRoom] = useState('all')
  const [filterPaid, setFilterPaid] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchHistory()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [history, searchTerm, filterRoom, filterPaid, dateFrom, dateTo])

  const fetchHistory = async () => {
    if (!supabase) {
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('juthazoneb_customers_history')
        .select('*')
        .order('start_time', { ascending: false })

      if (error) throw error
      setHistory(data || [])
    } catch (error) {
      console.error('Error fetching history:', error)
      alert('ไม่สามารถโหลดประวัติได้: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...history]

    if (searchTerm) {
      filtered = filtered.filter(h =>
        h.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

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

    setFilteredHistory(filtered)
  }

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60)
    const mins = Math.floor(minutes % 60)
    if (hours > 0) {
      return `${hours} ชม. ${mins} นาที`
    }
    return `${mins} นาที`
  }

  const calculateTotalRevenue = () => {
    return filteredHistory.reduce((sum, h) => sum + (h.final_cost || 0), 0)
  }

  const handleExport = () => {
    const exportData = filteredHistory.map(h => ({
      'ชื่อ': h.name,
      'ห้อง': h.room,
      'เริ่ม': formatDateTimeThai(h.start_time),
      'จบ': h.end_time ? formatDateTimeThai(h.end_time) : '-',
      'ระยะเวลา (นาที)': h.duration_minutes,
      'อัตรา (บาท/ชม)': h.hourly_rate,
      'ราคา (บาท)': h.final_cost,
      'สถานะ': h.is_paid ? 'จ่ายแล้ว' : 'ยังไม่จ่าย',
      'เหตุผล': h.end_reason,
      'เพิ่มโดย': h.added_by || '-',
      'Note': h.note || '-'
    }))
    exportToExcel(exportData, 'Juthazone_Blue_History')
  }

  const clearFilters = () => {
    setSearchTerm('')
    setFilterRoom('all')
    setFilterPaid('all')
    setDateFrom('')
    setDateTo('')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-cyan-500 to-teal-500 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-spin">⏳</div>
          <p className="text-white text-xl font-bold">กำลังโหลดประวัติ...</p>
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
            📊 ประวัติการใช้งาน - Blue Zone
          </h1>
          <p className="text-lg md:text-xl text-white/90 drop-shadow-lg">
            ระบบคำนวณราคาตามเวลาจริง
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
          <h2 className="text-xl md:text-2xl font-bold text-blue-700 mb-4">🔍 ค้นหาและกรอง</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block text-gray-700 font-semibold mb-2 text-sm">ค้นหาชื่อ</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="กรอกชื่อ..."
                className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>

            {/* Room Filter */}
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

            {/* Payment Status Filter */}
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

            {/* Date From */}
            <div>
              <label className="block text-gray-700 font-semibold mb-2 text-sm">วันที่เริ่ม</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>

            {/* Date To */}
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

          <div className="mt-4 flex gap-3">
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold text-sm"
            >
              ล้างตัวกรอง
            </button>
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold text-sm"
            >
              📥 Export Excel
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl p-4 border-3 border-blue-300">
            <p className="text-gray-600 font-semibold mb-1 text-sm">จำนวนรายการ</p>
            <p className="text-3xl font-bold text-blue-600">{filteredHistory.length}</p>
          </div>
          <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl p-4 border-3 border-green-300">
            <p className="text-gray-600 font-semibold mb-1 text-sm">รายได้รวม</p>
            <p className="text-3xl font-bold text-green-600">฿{calculateTotalRevenue().toFixed(2)}</p>
          </div>
          <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl p-4 border-3 border-cyan-300">
            <p className="text-gray-600 font-semibold mb-1 text-sm">เฉลี่ยต่อรายการ</p>
            <p className="text-3xl font-bold text-cyan-600">
              ฿{filteredHistory.length > 0 ? (calculateTotalRevenue() / filteredHistory.length).toFixed(2) : '0.00'}
            </p>
          </div>
        </div>

        {/* History Table */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-4 md:p-6 border-4 border-teal-300">
          <h2 className="text-xl md:text-2xl font-bold text-teal-700 mb-4">📋 รายการทั้งหมด</h2>
          
          {filteredHistory.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-xl font-bold">ไม่พบข้อมูล</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-500 text-white">
                    <th className="px-4 py-3 text-left rounded-tl-xl text-sm">ชื่อ</th>
                    <th className="px-4 py-3 text-left text-sm">ห้อง</th>
                    <th className="px-4 py-3 text-center text-sm">เริ่ม</th>
                    <th className="px-4 py-3 text-center text-sm">จบ</th>
                    <th className="px-4 py-3 text-center text-sm">ระยะเวลา</th>
                    <th className="px-4 py-3 text-center text-sm">อัตรา/ชม</th>
                    <th className="px-4 py-3 text-center text-sm">ราคา</th>
                    <th className="px-4 py-3 text-center text-sm">สถานะ</th>
                    <th className="px-4 py-3 text-center rounded-tr-xl text-sm">เหตุผล</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((record, index) => (
                    <tr
                      key={record.id}
                      className={`border-b ${
                        index % 2 === 0 ? 'bg-blue-50' : 'bg-white'
                      } hover:bg-cyan-100 transition-all`}
                    >
                      <td className="px-4 py-3 font-semibold text-sm">{record.name}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="inline-block bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs">
                          {record.room}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-xs">{formatDateTimeThai(record.start_time)}</td>
                      <td className="px-4 py-3 text-center text-xs">
                        {record.end_time ? formatDateTimeThai(record.end_time) : '-'}
                      </td>
                      <td className="px-4 py-3 text-center text-sm font-semibold">
                        {formatDuration(record.duration_minutes)}
                      </td>
                      <td className="px-4 py-3 text-center text-sm font-bold text-blue-600">
                        ฿{record.hourly_rate}
                      </td>
                      <td className="px-4 py-3 text-center text-base font-bold text-green-600">
                        ฿{record.final_cost.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-1 rounded-full text-xs font-bold ${
                            record.is_paid
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {record.is_paid ? '✅ จ่ายแล้ว' : '❌ ยังไม่จ่าย'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm">
                        <span className="inline-block bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                          {record.end_reason === 'completed' && '✅ เสร็จสิ้น'}
                          {record.end_reason === 'expired' && '⏰ หมดเวลา'}
                          {record.end_reason === 'deleted' && '🗑️ ลบ'}
                          {record.end_reason === 'in_progress' && '⏳ กำลังใช้'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default HistoryViewBlue

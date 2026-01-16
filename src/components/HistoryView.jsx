import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import supabase from '../firebase'
import { exportToExcel, printReceipt } from '../utils/exportUtils'

function HistoryView() {
  const [history, setHistory] = useState([])
  const [filteredHistory, setFilteredHistory] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRoom, setFilterRoom] = useState('all')
  const [filterPaid, setFilterPaid] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({})

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
      console.log('Fetching history from customers_history table...')

      const { data, error } = await supabase
        .from('customers_history')
        .select('*')
        .order('start_time', { ascending: false })

      console.log('Fetch history result:', { count: data?.length, error })

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

    // Search by name
    if (searchTerm) {
      filtered = filtered.filter(h =>
        h.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filter by room
    if (filterRoom !== 'all') {
      filtered = filtered.filter(h => h.room === filterRoom)
    }

    // Filter by payment status
    if (filterPaid !== 'all') {
      filtered = filtered.filter(h => h.is_paid === (filterPaid === 'paid'))
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

    setFilteredHistory(filtered)
  }

  const formatDateTime = (timestamp) => {
    if (!timestamp) return '-'
    const date = new Date(timestamp)
    return date.toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDateTimeLocal = (timestamp) => {
    if (!timestamp) return ''
    const d = new Date(timestamp)
    return d.toISOString().slice(0, 16) // YYYY-MM-DDTHH:mm
  }

  const formatDuration = (minutes) => {
    if (minutes === null || minutes === undefined || Number.isNaN(Number(minutes))) {
      return '-'
    }
    const hours = Math.floor(minutes / 60)
    const mins = Math.floor(minutes % 60)
    if (hours > 0) {
      return `${hours} ชม. ${mins} นาที`
    }
    return `${mins} นาที`
  }

  const deleteHistoryItem = async (id) => {
    if (!confirm('ต้องการลบประวัตินี้ใช่หรือไม่?')) return

    try {
      console.log('Deleting history with id:', id)

      const { data, error } = await supabase
        .from('customers_history')
        .delete()
        .eq('id', id)
        .select()

      console.log('Delete history result:', { data, error })

      if (error) {
        console.error('Delete error details:', error)
        alert('❌ ไม่สามารถลบได้: ' + error.message)
        return
      }

      if (!data || data.length === 0) {
        alert('⚠️ ไม่พบประวัติที่ต้องการลบ')
        return
      }

      setHistory(prev => prev.filter(h => h.id !== id))
      alert('✅ ลบประวัติสำเร็จ')
    } catch (error) {
      console.error('Error deleting history:', error)
      alert('ไม่สามารถลบประวัติได้: ' + error.message)
    }
  }

  const updateHistoryItem = async (id) => {
    const data = editData[id]
    if (!data) return

    try {
      const payload = {
        name: data.name || 'ไม่ระบุ',
        room: data.room || 'ไม่ระบุ',
        added_by: data.added_by || null,
        start_time: data.start_time ? new Date(data.start_time).toISOString() : null,
        end_time: data.end_time ? new Date(data.end_time).toISOString() : null,
        duration_minutes: data.duration_minutes !== '' ? Number(data.duration_minutes) : null,
        final_cost: Number(data.final_cost) || 0,
        is_paid: Boolean(data.is_paid),
        end_reason: data.end_reason || 'completed',
        note: data.note || '',
        shift: data.shift || 'all',
        payment_method: data.payment_method || 'transfer'  // บันทึกวิธีการจ่ายเงิน
      }

      console.log('Updating history:', { id, payload })

      const { data: result, error } = await supabase
        .from('customers_history')
        .update(payload)
        .eq('id', id)
        .select()

      console.log('Update history result:', { result, error })

      if (error) {
        console.error('Update error details:', error)
        alert('❌ ไม่สามารถอัพเดทได้: ' + error.message)
        return
      }

      if (!result || result.length === 0) {
        alert('⚠️ ไม่พบประวัติที่ต้องการแก้ไข')
        return
      }
      
      await fetchHistory()
      setEditingId(null)
      setEditData({})
      alert('✅ อัพเดทข้อมูลสำเร็จ')
    } catch (error) {
      console.error('Error updating history:', error)
      alert('ไม่สามารถอัพเดทข้อมูลได้: ' + error.message)
    }
  }

  const clearAllHistory = async () => {
    const confirmed = window.confirm(
      '⚠️ คุณแน่ใจหรือไม่ที่จะลบประวัติทั้งหมด?\n\n' +
      'การกระทำนี้ไม่สามารถย้อนกลับได้!'
    )

    if (!confirmed) return

    const doubleConfirm = window.confirm(
      '🚨 ยืนยันอีกครั้ง!\n\nข้อมูลประวัติทั้งหมดจะถูกลบออกอย่างถาวร'
    )

    if (!doubleConfirm) return

    try {
      const { error } = await supabase
        .from('customers_history')
        .delete()
        .neq('id', 0) // Delete all records

      if (error) throw error
      
      setHistory([])
      alert('✅ ลบประวัติทั้งหมดสำเร็จ')
    } catch (error) {
      console.error('Error clearing history:', error)
      alert('❌ เกิดข้อผิดพลาดในการลบประวัติ: ' + error.message)
    }
  }

  const getTotalStats = () => {
    const total = filteredHistory.reduce(
      (acc, h) => ({
        count: acc.count + 1,
        revenue: acc.revenue + parseFloat(h.final_cost),
        duration: acc.duration + parseFloat(h.duration_minutes),
        paid: acc.paid + (h.is_paid ? 1 : 0)
      }),
      { count: 0, revenue: 0, duration: 0, paid: 0 }
    )
    return total
  }

  const stats = getTotalStats()

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
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 md:mb-8 gap-4 animate-float">
          <div className="text-center sm:text-left">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white drop-shadow-2xl mb-2">
              📊 ประวัติการใช้งาน
            </h1>
            <p className="text-white/90 text-sm md:text-lg drop-shadow-lg font-semibold">
              Juthazone - ระบบจัดการประวัติและสถิติ
            </p>
          </div>
          <Link
            to="/admin"
            className="bg-white/90 hover:bg-white text-purple-600 font-bold py-2 px-6 rounded-xl shadow-lg hover:shadow-2xl transform hover:scale-105 active:scale-95 transition-all duration-300"
          >
            ← กลับแอดมิน
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
          <div className="bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl p-4 md:p-6 shadow-2xl transform hover:scale-[1.02] transition-all duration-300 border-2 border-purple-300">
            <div className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">{stats.count}</div>
            <div className="text-xs md:text-sm text-gray-600 font-semibold mt-1">ทั้งหมด</div>
          </div>
          <div className="bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl p-4 md:p-6 shadow-2xl transform hover:scale-[1.02] transition-all duration-300 border-2 border-green-300">
            <div className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">฿{stats.revenue.toFixed(2)}</div>
            <div className="text-xs md:text-sm text-gray-600 font-semibold mt-1">รายได้</div>
          </div>
          <div className="bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl p-4 md:p-6 shadow-2xl transform hover:scale-[1.02] transition-all duration-300 border-2 border-blue-300">
            <div className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">{formatDuration(stats.duration)}</div>
            <div className="text-xs md:text-sm text-gray-600 font-semibold mt-1">เวลารวม</div>
          </div>
          <div className="bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl p-4 md:p-6 shadow-2xl transform hover:scale-[1.02] transition-all duration-300 border-2 border-orange-300">
            <div className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">{stats.paid}/{stats.count}</div>
            <div className="text-xs md:text-sm text-gray-600 font-semibold mt-1">จ่ายแล้ว</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl shadow-2xl p-4 md:p-6 mb-6 border-3 border-pink-300 transform hover:scale-[1.01] transition-all duration-300">
          <h2 className="text-lg md:text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">🔍 ค้นหาและกรอง</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">ค้นหาชื่อ</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ชื่อลูกค้า..."
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
                <option value="ชั้น 3 ห้อง Golf">ชั้น 3 Golf</option>
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

            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearchTerm('')
                  setFilterRoom('all')
                  setFilterPaid('all')
                  setDateFrom('')
                  setDateTo('')
                }}
                className="w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300"
              >
                ล้างตัวกรอง
              </button>
            </div>
          </div>
        </div>

        {/* History Table */}
        <div className="bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl shadow-2xl p-4 md:p-6 border-3 border-orange-300">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <h2 className="text-lg md:text-2xl font-bold bg-gradient-to-r from-purple-600 to-orange-600 bg-clip-text text-transparent">
              📋 รายการทั้งหมด ({filteredHistory.length})
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={async () => await exportToExcel(filteredHistory)}
                className="bg-gradient-to-r from-green-600 to-green-700 text-white font-bold py-2 px-4 rounded-lg hover:from-green-700 hover:to-green-800 transform hover:scale-105 active:scale-95 transition-all duration-300 shadow-lg text-xs md:text-sm whitespace-nowrap"
              >
                📥 Export Excel
              </button>
              <button
                onClick={clearAllHistory}
                className="bg-gradient-to-r from-red-600 to-red-700 text-white font-bold py-2 px-4 rounded-lg hover:from-red-700 hover:to-red-800 transform hover:scale-105 active:scale-95 transition-all duration-300 shadow-lg text-xs md:text-sm whitespace-nowrap"
              >
                🗑️ ลบทั้งหมด
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4 animate-spin">⏳</div>
              <p className="text-gray-600">กำลังโหลด...</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-5xl mb-4">📭</div>
              <p className="text-xl font-bold">ไม่พบประวัติ</p>
              <p className="text-sm mt-2">ลองเปลี่ยนตัวกรองหรือเพิ่มลูกค้าใหม่</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 md:mx-0">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                    <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs md:text-sm">ชื่อ</th>
                    <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs md:text-sm">ห้อง</th>
                    <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs md:text-sm hidden sm:table-cell">👥 พนักงาน</th>
                    <th className="px-2 md:px-4 py-2 md:py-3 text-center text-xs md:text-sm hidden sm:table-cell">🔄 กะ</th>
                    <th className="px-2 md:px-4 py-2 md:py-3 text-center text-xs md:text-sm hidden md:table-cell">เริ่ม</th>
                    <th className="px-2 md:px-4 py-2 md:py-3 text-center text-xs md:text-sm hidden md:table-cell">จบ</th>
                    <th className="px-2 md:px-4 py-2 md:py-3 text-center text-xs md:text-sm">ระยะเวลา</th>
                    <th className="px-2 md:px-4 py-2 md:py-3 text-center text-xs md:text-sm">ค่าใช้จ่าย</th>
                    <th className="px-2 md:px-4 py-2 md:py-3 text-center text-xs md:text-sm">สถานะจ่าย</th>
                    <th className="px-2 md:px-4 py-2 md:py-3 text-center text-xs md:text-sm hidden lg:table-cell">สถานะ</th>
                    <th className="px-2 md:px-4 py-2 md:py-3 text-center text-xs md:text-sm">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((record, index) => (
                    <tr
                      key={record.id}
                      className={`border-b ${
                        index % 2 === 0 ? 'bg-purple-50' : 'bg-white'
                      } hover:bg-purple-100 transition-all duration-200`}
                    >
                      <td className="px-2 md:px-4 py-2 md:py-3 font-semibold text-xs md:text-sm">
                        {editingId === record.id ? (
                          <div className="space-y-1">
                            <input
                              type="text"
                              value={editData[record.id]?.name ?? record.name ?? ''}
                              onChange={(e) => setEditData({...editData, [record.id]: {...editData[record.id], name: e.target.value}})}
                              className="w-full px-2 py-1 border-2 border-purple-300 rounded text-xs"
                              placeholder="ชื่อลูกค้า"
                            />
                            <input
                              type="text"
                              value={editData[record.id]?.note ?? record.note ?? ''}
                              onChange={(e) => setEditData({...editData, [record.id]: {...editData[record.id], note: e.target.value}})}
                              className="w-full px-2 py-1 border-2 border-purple-200 rounded text-xs"
                              placeholder="บันทึก"
                            />
                          </div>
                        ) : (
                          <>
                            {record.name}
                            {record.note && (
                              <div className="text-xs text-gray-500 mt-1">📝 {record.note}</div>
                            )}
                          </>
                        )}
                      </td>
                      <td className="px-2 md:px-4 py-2 md:py-3">
                        {editingId === record.id ? (
                          <input
                            type="text"
                            value={editData[record.id]?.room ?? record.room ?? ''}
                            onChange={(e) => setEditData({...editData, [record.id]: {...editData[record.id], room: e.target.value}})}
                            className="w-full px-2 py-1 border-2 border-blue-300 rounded text-xs"
                            placeholder="ห้อง"
                          />
                        ) : (
                          <span className="inline-block bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs">
                            {record.room}
                          </span>
                        )}
                      </td>
                      <td className="px-2 md:px-4 py-2 md:py-3 text-xs font-semibold hidden sm:table-cell">
                        {editingId === record.id ? (
                          <input
                            type="text"
                            value={editData[record.id]?.added_by ?? record.added_by ?? ''}
                            onChange={(e) => setEditData({...editData, [record.id]: {...editData[record.id], added_by: e.target.value}})}
                            className="w-full px-2 py-1 border-2 border-orange-300 rounded text-xs"
                            placeholder="พนักงาน"
                          />
                        ) : (
                          <span className="inline-block bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs">
                            {record.added_by || '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-2 md:px-4 py-2 md:py-3 text-xs font-semibold hidden sm:table-cell">
                        {editingId === record.id ? (
                          <select
                            value={editData[record.id]?.shift ?? record.shift ?? 'all'}
                            onChange={(e) => setEditData({...editData, [record.id]: {...editData[record.id], shift: e.target.value}})}
                            className="w-full px-2 py-1 border-2 border-orange-300 rounded text-xs"
                          >
                            <option value="all">ทั้งหมด</option>
                            <option value="1">กะ 1 (10:00-19:00)</option>
                            <option value="2">กะ 2 (19:00-01:00)</option>
                            <option value="3">กะ 3 (01:00-10:00)</option>
                          </select>
                        ) : (
                          <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                            record.shift === '1' ? 'bg-green-100 text-green-700' :
                            record.shift === '2' ? 'bg-orange-100 text-orange-700' :
                            record.shift === '3' ? 'bg-purple-100 text-purple-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {record.shift === '1' ? 'กะ 1' : record.shift === '2' ? 'กะ 2' : record.shift === '3' ? 'กะ 3' : 'ทั้งหมด'}
                          </span>
                        )}
                      </td>
                      <td className="px-2 md:px-4 py-2 md:py-3 text-center text-xs hidden md:table-cell">
                        {editingId === record.id ? (
                          <input
                            type="datetime-local"
                            value={editData[record.id]?.start_time ?? formatDateTimeLocal(record.start_time)}
                            onChange={(e) => setEditData({...editData, [record.id]: {...editData[record.id], start_time: e.target.value}})}
                            className="w-full px-2 py-1 border-2 border-purple-300 rounded text-xs"
                          />
                        ) : (
                          formatDateTime(record.start_time)
                        )}
                      </td>
                      <td className="px-2 md:px-4 py-2 md:py-3 text-center text-xs hidden md:table-cell">
                        {editingId === record.id ? (
                          <input
                            type="datetime-local"
                            value={editData[record.id]?.end_time ?? formatDateTimeLocal(record.end_time)}
                            onChange={(e) => setEditData({...editData, [record.id]: {...editData[record.id], end_time: e.target.value}})}
                            className="w-full px-2 py-1 border-2 border-purple-300 rounded text-xs"
                          />
                        ) : (
                          formatDateTime(record.end_time)
                        )}
                      </td>
                      <td className="px-2 md:px-4 py-2 md:py-3 text-center font-semibold text-xs md:text-sm">
                        {editingId === record.id ? (
                          <input
                            type="number"
                            value={editData[record.id]?.duration_minutes ?? record.duration_minutes ?? ''}
                            onChange={(e) => setEditData({...editData, [record.id]: {...editData[record.id], duration_minutes: Number(e.target.value)}})}
                            className="w-full px-2 py-1 border-2 border-purple-300 rounded text-xs"
                            min="0"
                            step="1"
                          />
                        ) : (
                          formatDuration(record.duration_minutes)
                        )}
                      </td>
                      <td className="px-2 md:px-4 py-2 md:py-3 text-center font-bold text-sm md:text-base text-green-600">
                        {editingId === record.id ? (
                          <input
                            type="number"
                            value={editData[record.id]?.final_cost ?? record.final_cost ?? ''}
                            onChange={(e) => setEditData({...editData, [record.id]: {...editData[record.id], final_cost: e.target.value}})}
                            className="w-full px-2 py-1 border-2 border-purple-300 rounded text-xs"
                            step="0.01"
                          />
                        ) : (
                          `฿${record.final_cost}`
                        )}
                      </td>
                      <td className="px-2 md:px-4 py-2 md:py-3 text-center">
                        {editingId === record.id ? (
                          <select
                            value={(editData[record.id]?.is_paid ?? record.is_paid ?? false) ? 'true' : 'false'}
                            onChange={(e) => setEditData({...editData, [record.id]: {...editData[record.id], is_paid: e.target.value === 'true'}})}
                            className="w-full px-2 py-1 border-2 border-purple-300 rounded text-xs"
                          >
                            <option value="true">จ่ายแล้ว</option>
                            <option value="false">ยังไม่จ่าย</option>
                          </select>
                        ) : (
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                            record.is_paid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {record.is_paid ? '✅ จ่ายแล้ว' : '❌ ยังไม่จ่าย'}
                          </span>
                        )}
                      </td>
                      <td className="px-2 md:px-4 py-2 md:py-3 text-center hidden lg:table-cell">
                        {editingId === record.id ? (
                          <select
                            value={editData[record.id]?.end_reason ?? record.end_reason ?? 'completed'}
                            onChange={(e) => setEditData({...editData, [record.id]: {...editData[record.id], end_reason: e.target.value}})}
                            className="w-full px-2 py-1 border-2 border-purple-300 rounded text-xs"
                          >
                            <option value="completed">เสร็จแล้ว</option>
                            <option value="expired">หมดเวลา</option>
                            <option value="deleted">ลบแล้ว</option>
                            <option value="in_progress">ดำเนินการ</option>
                          </select>
                        ) : (
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                              record.end_reason === 'completed'
                                ? 'bg-green-100 text-green-700'
                                : record.end_reason === 'expired'
                                ? 'bg-orange-100 text-orange-700'
                                : record.end_reason === 'deleted'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {record.end_reason === 'completed' && '✅ เสร็จแล้ว'}
                            {record.end_reason === 'expired' && '⏰ หมดเวลา'}
                            {record.end_reason === 'deleted' && '🗑️ ลบแล้ว'}
                            {record.end_reason === 'in_progress' && '⏳ ดำเนินการ'}
                          </span>
                        )}
                      </td>
                      <td className="px-2 md:px-4 py-2 md:py-3 text-center">
                        {editingId === record.id ? (
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => updateHistoryItem(record.id)}
                              className="px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-xs font-semibold"
                            >
                              💾
                            </button>
                            <button
                              onClick={() => {
                                setEditingId(null)
                                setEditData({})
                              }}
                              className="px-2 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded text-xs font-semibold"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-1 justify-center flex-wrap">
                            <button
                              onClick={() => {
                                const customer = {
                                  name: record.name,
                                  room: record.room,
                                  note: record.note,
                                  startTime: record.start_time,
                                  expectedEndTime: record.end_time,
                                  cost: record.final_cost,
                                  isPaid: record.is_paid
                                }
                                printReceipt(customer).catch(err => console.error('Print error:', err))
                              }}
                              className="px-2 py-1 bg-purple-500 hover:bg-purple-600 text-white rounded text-xs font-semibold"
                              title="พิมพ์ใบเสร็จ"
                            >
                              🖨️
                            </button>
                            <button
                              onClick={() => {
                                setEditingId(record.id)
                                setEditData({
                                  [record.id]: {
                                    name: record.name ?? '',
                                    note: record.note ?? '',
                                    room: record.room ?? '',
                                    added_by: record.added_by ?? '',
                                    start_time: formatDateTimeLocal(record.start_time),
                                    end_time: formatDateTimeLocal(record.end_time),
                                    duration_minutes: record.duration_minutes ?? '',
                                    final_cost: record.final_cost ?? '',
                                    is_paid: record.is_paid ?? false,
                                    end_reason: record.end_reason ?? 'completed',
                                    shift: record.shift ?? 'all'
                                  }
                                })
                              }}
                              className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-semibold"
                              title="แก้ไข"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => deleteHistoryItem(record.id)}
                              className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs font-semibold"
                              title="ลบ"
                            >
                              🗑️
                            </button>
                          </div>
                        )}
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

export default HistoryView

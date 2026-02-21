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
  const [users, setUsers] = useState({})
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({})
  const [originalSnapshot, setOriginalSnapshot] = useState({})

  useEffect(() => {
    fetchUsers()
    fetchHistory()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [history, searchTerm, filterRoom, filterPaid, dateFrom, dateTo])

  const fetchUsers = async () => {
    if (!supabase) return
    try {
      const { data, error } = await supabase
        .from('users')
        .select('username, display_name')
      if (error) throw error
      const userMap = {}
      data.forEach(user => {
        userMap[user.username] = user.display_name
      })
      setUsers(userMap)
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

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

  const deleteHistory = async (recordId) => {
    if (!supabase) return
    try {
      const { error } = await supabase
        .from('juthazoneb_customers_history')
        .delete()
        .eq('id', recordId)
      
      if (error) throw error
      
      alert('✅ ลบรายการเรียบร้อยแล้ว')
      fetchHistory()
    } catch (error) {
      console.error('Error deleting history:', error)
      alert('❌ ไม่สามารถลบรายการได้: ' + error.message)
    }
  }

  const startEdit = async (record) => {
    if (!supabase) return
    
    try {
      // Fetch fresh data from DB
      const { data, error } = await supabase
        .from('juthazoneb_customers_history')
        .select('*')
        .eq('id', record.id)
        .single()
      
      if (error) throw error
      
      setOriginalSnapshot(prev => ({ ...prev, [record.id]: data }))
      setEditData(prev => ({ 
        ...prev, 
        [record.id]: {
          ...data,
          start_time: data.start_time ? new Date(data.start_time).toISOString().slice(0, 16) : '',
          end_time: data.end_time ? new Date(data.end_time).toISOString().slice(0, 16) : ''
        }
      }))
      setEditingId(record.id)
    } catch (error) {
      console.error('Error fetching record for edit:', error)
      alert('ไม่สามารถโหลดข้อมูลได้: ' + error.message)
    }
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditData({})
  }

  const updateHistoryItem = async (id) => {
    const data = editData[id]
    const original = originalSnapshot[id]
    
    if (!data || !original) {
      alert('❌ เกิดข้อผิดพลาด: ไม่พบข้อมูลต้นฉบับ กรุณาลองใหม่')
      return
    }

    try {
      const payload = {
        name: data.name || original.name || 'ไม่ระบุ',
        room: data.room || original.room || 'ไม่ระบุ',
        added_by: data.added_by ?? original.added_by ?? null,
        start_time: data.start_time ? new Date(data.start_time).toISOString() : original.start_time,
        end_time: data.end_time ? new Date(data.end_time).toISOString() : original.end_time,
        duration_minutes: data.duration_minutes !== '' ? Number(data.duration_minutes) : original.duration_minutes,
        hourly_rate: data.hourly_rate !== '' ? Number(data.hourly_rate) : original.hourly_rate,
        final_cost: data.final_cost !== '' ? Number(data.final_cost) : original.final_cost || 0,
        is_paid: data.is_paid !== undefined ? Boolean(data.is_paid) : original.is_paid,
        end_reason: data.end_reason || original.end_reason || 'completed',
        note: data.note ?? original.note ?? '',
        updated_at: new Date().toISOString()
      }

      // Calculate changes
      const changes = []
      
      if (original.name !== payload.name) changes.push(`📝 ชื่อ: "${original.name}" → "${payload.name}"`)
      if (original.room !== payload.room) changes.push(`🏠 ห้อง: "${original.room}" → "${payload.room}"`)
      if (original.added_by !== payload.added_by) changes.push(`👤 พนักงาน: "${original.added_by || '-'}" → "${payload.added_by || '-'}"`)
      if (formatDateTimeThai(original.start_time) !== formatDateTimeThai(payload.start_time)) {
        changes.push(`🕐 เวลาเริ่ม: ${formatDateTimeThai(original.start_time)} → ${formatDateTimeThai(payload.start_time)}`)
      }
      if (formatDateTimeThai(original.end_time) !== formatDateTimeThai(payload.end_time)) {
        changes.push(`🕑 เวลาจบ: ${formatDateTimeThai(original.end_time)} → ${formatDateTimeThai(payload.end_time)}`)
      }
      if (original.duration_minutes !== payload.duration_minutes) {
        changes.push(`⏱️ ระยะเวลา: ${formatDuration(original.duration_minutes)} → ${formatDuration(payload.duration_minutes)}`)
      }
      if (original.hourly_rate !== payload.hourly_rate) {
        changes.push(`💵 อัตรา/ชม: ฿${original.hourly_rate} → ฿${payload.hourly_rate}`)
      }
      if (original.final_cost !== payload.final_cost) {
        changes.push(`💰 ราคา: ฿${original.final_cost} → ฿${payload.final_cost}`)
      }
      if (original.is_paid !== payload.is_paid) {
        changes.push(`💳 สถานะจ่าย: ${original.is_paid ? '✅ จ่ายแล้ว' : '❌ ยังไม่จ่าย'} → ${payload.is_paid ? '✅ จ่ายแล้ว' : '❌ ยังไม่จ่าย'}`)
      }
      if ((original.note || '') !== (payload.note || '')) {
        changes.push(`📝 บันทึก: "${original.note || '(ไม่มี)'}" → "${payload.note || '(ไม่มี)'}"`)
      }

      // Confirmation
      let confirmMessage = '🔍 รายละเอียดการเปลี่ยนแปลง\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n'
      
      if (changes.length === 0) {
        confirmMessage += '⚠️ ไม่มีการเปลี่ยนแปลงใดๆ\n\nคุณต้องการบันทึกต่อหรือไม่?'
      } else {
        confirmMessage += `พบการเปลี่ยนแปลง ${changes.length} รายการ:\n\n`
        changes.forEach((change, index) => {
          confirmMessage += `${index + 1}. ${change}\n`
        })
        confirmMessage += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ ยืนยันการบันทึกหรือไม่?'
      }

      if (!window.confirm(confirmMessage)) return

      const { data: result, error } = await supabase
        .from('juthazoneb_customers_history')
        .update(payload)
        .eq('id', id)
        .select()

      if (error) throw error

      if (!result || result.length === 0) {
        alert('⚠️ ไม่พบประวัติที่ต้องการแก้ไข')
        return
      }
      
      await fetchHistory()
      setEditingId(null)
      setEditData({})
      setOriginalSnapshot(prev => ({ ...prev, [id]: result?.[0] || null }))
      alert('✅ อัพเดทข้อมูลสำเร็จ')
    } catch (error) {
      console.error('Error updating history:', error)
      alert('ไม่สามารถอัพเดทข้อมูลได้: ' + error.message)
    }
  }

  const handleEditChange = (id, field, value) => {
    setEditData(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [field]: value
      }
    }))
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
                    <th className="px-4 py-3 text-center text-sm">พนักงาน</th>
                    <th className="px-4 py-3 text-center text-sm">สถานะ</th>
                    <th className="px-4 py-3 text-center text-sm">เหตุผล</th>
                    <th className="px-4 py-3 text-center text-sm">Note</th>
                    <th className="px-4 py-3 text-center rounded-tr-xl text-sm">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((record, index) => {
                    const isEditing = editingId === record.id
                    const editRow = editData[record.id] || record
                    
                    return (
                      <tr
                        key={record.id}
                        className={`border-b ${
                          index % 2 === 0 ? 'bg-blue-50' : 'bg-white'
                        } ${isEditing ? 'bg-yellow-50' : 'hover:bg-cyan-100'} transition-all`}
                      >
                        <td className="px-4 py-3 font-semibold text-sm">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editRow.name}
                              onChange={(e) => handleEditChange(record.id, 'name', e.target.value)}
                              className="w-full px-2 py-1 border-2 border-blue-300 rounded text-sm"
                            />
                          ) : (
                            record.name
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editRow.room}
                              onChange={(e) => handleEditChange(record.id, 'room', e.target.value)}
                              className="w-full px-2 py-1 border-2 border-blue-300 rounded text-sm"
                            />
                          ) : (
                            <span className="inline-block bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs">
                              {record.room}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-xs">
                          {isEditing ? (
                            <input
                              type="datetime-local"
                              value={editRow.start_time}
                              onChange={(e) => handleEditChange(record.id, 'start_time', e.target.value)}
                              className="w-full px-2 py-1 border-2 border-blue-300 rounded text-xs"
                            />
                          ) : (
                            formatDateTimeThai(record.start_time)
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-xs">
                          {isEditing ? (
                            <input
                              type="datetime-local"
                              value={editRow.end_time}
                              onChange={(e) => handleEditChange(record.id, 'end_time', e.target.value)}
                              className="w-full px-2 py-1 border-2 border-blue-300 rounded text-xs"
                            />
                          ) : (
                            record.end_time ? formatDateTimeThai(record.end_time) : '-'
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-sm font-semibold">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editRow.duration_minutes}
                              onChange={(e) => handleEditChange(record.id, 'duration_minutes', e.target.value)}
                              className="w-20 px-2 py-1 border-2 border-blue-300 rounded text-sm"
                            />
                          ) : (
                            formatDuration(record.duration_minutes)
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-sm font-bold text-blue-600">
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.01"
                              value={editRow.hourly_rate}
                              onChange={(e) => handleEditChange(record.id, 'hourly_rate', e.target.value)}
                              className="w-20 px-2 py-1 border-2 border-blue-300 rounded text-sm"
                            />
                          ) : (
                            `฿${record.hourly_rate}`
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-base font-bold text-green-600">
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.01"
                              value={editRow.final_cost}
                              onChange={(e) => handleEditChange(record.id, 'final_cost', e.target.value)}
                              className="w-24 px-2 py-1 border-2 border-green-300 rounded text-sm"
                            />
                          ) : (
                            `฿${record.final_cost.toFixed(2)}`
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-sm">
                          <span className="inline-block bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs font-semibold">
                            {users[record.added_by] || record.added_by || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isEditing ? (
                            <select
                              value={editRow.is_paid}
                              onChange={(e) => handleEditChange(record.id, 'is_paid', e.target.value === 'true')}
                              className="px-2 py-1 border-2 border-blue-300 rounded text-xs"
                            >
                              <option value="true">✅ จ่ายแล้ว</option>
                              <option value="false">❌ ยังไม่จ่าย</option>
                            </select>
                          ) : (
                            <span
                              className={`inline-block px-2 py-1 rounded-full text-xs font-bold ${
                                record.is_paid
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {record.is_paid ? '✅ จ่ายแล้ว' : '❌ ยังไม่จ่าย'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-sm">
                          {isEditing ? (
                            <select
                              value={editRow.end_reason}
                              onChange={(e) => handleEditChange(record.id, 'end_reason', e.target.value)}
                              className="px-2 py-1 border-2 border-blue-300 rounded text-xs"
                            >
                              <option value="completed">✅ เสร็จสิ้น</option>
                              <option value="expired">⏰ หมดเวลา</option>
                              <option value="deleted">🗑️ ลบ</option>
                              <option value="in_progress">⏳ กำลังใช้</option>
                            </select>
                          ) : (
                            <span className="inline-block bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                              {record.end_reason === 'completed' && '✅ เสร็จสิ้น'}
                              {record.end_reason === 'expired' && '⏰ หมดเวลา'}
                              {record.end_reason === 'deleted' && '🗑️ ลบ'}
                              {record.end_reason === 'in_progress' && '⏳ กำลังใช้'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-sm">
                          {isEditing ? (
                            <textarea
                              value={editRow.note || ''}
                              onChange={(e) => handleEditChange(record.id, 'note', e.target.value)}
                              className="w-full px-2 py-1 border-2 border-blue-300 rounded text-xs h-16"
                              placeholder="บันทึก..."
                            />
                          ) : (
                            <span className="text-xs text-gray-600">{record.note || '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isEditing ? (
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={() => updateHistoryItem(record.id)}
                                className="px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold text-xs"
                              >
                                ✅ บันทึก
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="px-2 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold text-xs"
                              >
                                ❌ ยกเลิก
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={() => startEdit(record)}
                                className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold text-xs"
                                title="แก้ไขรายการ"
                              >
                                ✏️ แก้ไข
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`ต้องการลบประวัติของ "${record.name}" ใช่หรือไม่?\n\nข้อมูลจะถูกลบถาวร!`)) {
                                    deleteHistory(record.id)
                                  }
                                }}
                                className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold text-xs"
                                title="ลบรายการประวัติ"
                              >
                                🗑️ ลบ
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
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

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import supabase from '../firebase'
import { exportToExcel, printReceipt, printHistoryReceipt } from '../utils/exportUtils'
import { formatDateTimeThai } from '../utils/timeFormat'
import { useTheme } from '../contexts/ThemeContext'
import ThemePicker from './ThemePicker'

function HistoryViewBlue() {
  const { setActiveZone } = useTheme()
  const [history, setHistory] = useState([])
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
  const [showEditModal, setShowEditModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const ITEMS_PER_PAGE = 50
  const debounceRef = useRef(null)

  // Debounce search input — ลด re-render จากการพิมพ์
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      setCurrentPage(1)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchTerm])

  useEffect(() => {
    setActiveZone('blue')
    fetchUsers()
    fetchHistory()
  }, [])

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

  // ═══ useMemo: คำนวณ filteredHistory เฉพาะเมื่อ dependencies เปลี่ยน ═══
  const filteredHistory = useMemo(() => {
    let filtered = history

    if (debouncedSearch) {
      const term = debouncedSearch.toLowerCase()
      filtered = filtered.filter(h => h.name.toLowerCase().includes(term))
    }

    if (filterRoom !== 'all') {
      filtered = filtered.filter(h => h.room === filterRoom)
    }

    if (filterPaid !== 'all') {
      filtered = filtered.filter(h => h.is_paid === (filterPaid === 'paid'))
    }

    if (dateFrom) {
      const fromDate = new Date(dateFrom)
      filtered = filtered.filter(h => new Date(h.start_time) >= fromDate)
    }
    if (dateTo) {
      const endDate = new Date(dateTo)
      endDate.setHours(23, 59, 59)
      filtered = filtered.filter(h => new Date(h.start_time) <= endDate)
    }

    return filtered
  }, [history, debouncedSearch, filterRoom, filterPaid, dateFrom, dateTo])

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1) }, [filterRoom, filterPaid, dateFrom, dateTo])

  // ═══ Pagination: แสดงเฉพาะ rows ของหน้าปัจจุบัน ═══
  const totalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE)
  const paginatedHistory = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredHistory.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredHistory, currentPage])

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60)
    const mins = Math.floor(minutes % 60)
    if (hours > 0) {
      return `${hours} ชม. ${mins} นาที`
    }
    return `${mins} นาที`
  }

  const totalRevenue = useMemo(() => {
    return filteredHistory.reduce((sum, h) => sum + (h.final_cost || 0), 0)
  }, [filteredHistory])

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
      setShowEditModal(true)
    } catch (error) {
      console.error('Error fetching record for edit:', error)
      alert('ไม่สามารถโหลดข้อมูลได้: ' + error.message)
    }
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditData({})
    setShowEditModal(false)
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
      setShowEditModal(false)
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
      <div className="min-h-screen jz-bg flex items-center justify-center">
        <div className="text-center fade-in">
          <div className="text-6xl mb-4 animate-spin">⏳</div>
          <p className="text-white text-xl font-bold">กำลังโหลดประวัติ...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen jz-bg p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6 slide-up">
          <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-2xl mb-2">
            📊 ประวัติการใช้งาน - Blue Zone
          </h1>
          <p className="text-lg md:text-xl text-white/90 drop-shadow-lg">
            ระบบคำนวณราคาตามเวลาจริง
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link
              to="/blue/admin"
              className="inline-block bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-6 rounded-xl shadow-lg jz-glow-hover transform hover:scale-105 transition-all duration-300 border border-white/20"
            >
              ← กลับหน้าแอดมิน
            </Link>
            <Link
              to="/"
              className="inline-block bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-6 rounded-xl shadow-lg jz-glow-hover transform hover:scale-105 transition-all duration-300 border border-white/20"
            >
              🏠 กลับหน้าหลัก
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-card p-4 md:p-6 mb-6 border jz-card-border slide-up-1">
          <h2 className="text-xl md:text-2xl font-bold jz-text-gradient mb-4">🔍 ค้นหาและกรอง</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block text-gray-700 font-semibold mb-2 text-sm">ค้นหาชื่อ</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="กรอกชื่อ..."
                className="w-full px-3 py-2 border-2 jz-input rounded-lg focus:outline-none text-sm"
              />
            </div>

            {/* Room Filter */}
            <div>
              <label className="block text-gray-700 font-semibold mb-2 text-sm">ห้อง</label>
              <select
                value={filterRoom}
                onChange={(e) => setFilterRoom(e.target.value)}
                className="w-full px-3 py-2 border-2 jz-input rounded-lg focus:outline-none text-sm"
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
                className="w-full px-3 py-2 border-2 jz-input rounded-lg focus:outline-none text-sm"
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
                className="w-full px-3 py-2 border-2 jz-input rounded-lg focus:outline-none text-sm"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-gray-700 font-semibold mb-2 text-sm">วันที่สิ้นสุด</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border-2 jz-input rounded-lg focus:outline-none text-sm"
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
          <div className="slide-up bg-white/95 backdrop-blur-sm rounded-2xl shadow-card p-4 border jz-card-border jz-glow-hover transition-shadow" style={{animationDelay: '0s'}}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-2xl">📊</span>
              <span className="text-[10px] font-bold uppercase tracking-wider jz-text-primary" style={{opacity: 0.7}}>จำนวน</span>
            </div>
            <p className="text-3xl font-extrabold jz-text-gradient">{filteredHistory.length}</p>
            <p className="text-xs text-gray-500 font-medium mt-1">รายการ</p>
          </div>
          <div className="slide-up bg-white/95 backdrop-blur-sm rounded-2xl shadow-card p-4 border border-green-200/30 hover:shadow-card-hover transition-shadow" style={{animationDelay: '0.1s'}}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-2xl">💰</span>
              <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">รายได้รวม</span>
            </div>
            <p className="text-3xl font-extrabold text-green-600">฿{totalRevenue.toFixed(0)}</p>
            <p className="text-xs text-gray-500 font-medium mt-1">บาท</p>
          </div>
          <div className="slide-up bg-white/95 backdrop-blur-sm rounded-2xl shadow-card p-4 border border-cyan-200/30 hover:shadow-card-hover transition-shadow" style={{animationDelay: '0.2s'}}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-2xl">📈</span>
              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">เฉลี่ย</span>
            </div>
            <p className="text-3xl font-extrabold text-cyan-600">
              ฿{filteredHistory.length > 0 ? (totalRevenue / filteredHistory.length).toFixed(0) : '0'}
            </p>
            <p className="text-xs text-gray-500 font-medium mt-1">บาท/รายการ</p>
          </div>
        </div>

        {/* History Table */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-card p-4 md:p-6 border jz-card-border">
          <h2 className="text-xl md:text-2xl font-bold jz-text-gradient mb-4">📋 รายการทั้งหมด</h2>
          
          {filteredHistory.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-xl font-bold">ไม่พบข้อมูล</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="jz-table-header shadow-lg">
                    <th className="px-4 py-3 text-left rounded-tl-xl text-sm font-bold tracking-wide">ชื่อ</th>
                    <th className="px-4 py-3 text-left text-sm font-bold tracking-wide">ห้อง</th>
                    <th className="px-4 py-3 text-center text-sm font-bold tracking-wide">🕐 เริ่ม</th>
                    <th className="px-4 py-3 text-center text-sm font-bold tracking-wide">🕑 จบ</th>
                    <th className="px-4 py-3 text-center text-sm font-bold tracking-wide">⏱ เวลา</th>
                    <th className="px-4 py-3 text-center text-sm font-bold tracking-wide">💲 อัตรา</th>
                    <th className="px-4 py-3 text-center text-sm font-bold tracking-wide">💰 ราคา</th>
                    <th className="px-4 py-3 text-center text-sm font-bold tracking-wide">👤 พนักงาน</th>
                    <th className="px-4 py-3 text-center text-sm font-bold tracking-wide">💳 สถานะ</th>
                    <th className="px-4 py-3 text-center text-sm font-bold tracking-wide">📊 เหตุผล</th>
                    <th className="px-4 py-3 text-center text-sm font-bold tracking-wide">📝 Note</th>
                    <th className="px-4 py-3 text-center rounded-tr-xl text-sm font-bold tracking-wide">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedHistory.map((record, index) => (
                    <tr
                      key={record.id}
                      className={`border-b border-gray-100 ${
                        index % 2 === 0 ? 'jz-row-alt' : 'bg-white'
                      } jz-row-hover transition-colors duration-150`}
                    >
                      <td className="px-4 py-3 font-semibold text-sm">{record.name}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="inline-block jz-badge px-2 py-1 rounded-full text-xs">
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
                      <td className="px-4 py-3 text-center text-sm">
                        <span className="inline-block bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs font-semibold">
                          {users[record.added_by] || record.added_by || '-'}
                        </span>
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
                      <td className="px-4 py-3 text-center text-sm">
                        <span className="text-xs text-gray-600">{record.note || '-'}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => printHistoryReceipt(record, 'blue')}
                            className="px-2 py-1 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-semibold text-xs shadow transform hover:scale-105 active:scale-95 transition-all"
                            title="พิมพ์ใบเสร็จ"
                          >
                            🖨️ พิมพ์
                          </button>
                          <button
                            onClick={() => startEdit(record)}
                            className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold text-xs shadow transform hover:scale-105 active:scale-95 transition-all"
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
                            className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold text-xs shadow transform hover:scale-105 active:scale-95 transition-all"
                            title="ลบรายการประวัติ"
                          >
                            🗑️ ลบ
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-gray-200">
              <div className="text-sm text-gray-600 font-medium">
                แสดง {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredHistory.length)} จาก {filteredHistory.length} รายการ
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                    currentPage === 1 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'jz-badge font-bold hover:opacity-80'
                  }`}
                >
                  ≪
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                    currentPage === 1 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'jz-badge font-bold hover:opacity-80'
                  }`}
                >
                  ‹
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let page
                  if (totalPages <= 5) {
                    page = i + 1
                  } else if (currentPage <= 3) {
                    page = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    page = totalPages - 4 + i
                  } else {
                    page = currentPage - 2 + i
                  }
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                        currentPage === page
                          ? 'jz-btn jz-glow'
                          : 'bg-gray-100 text-gray-700 hover:opacity-80'
                      }`}
                    >
                      {page}
                    </button>
                  )
                })}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                    currentPage === totalPages ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'jz-badge font-bold hover:opacity-80'
                  }`}
                >
                  ›
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                    currentPage === totalPages ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'jz-badge font-bold hover:opacity-80'
                  }`}
                >
                  ≫
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Edit Modal Dialog */}
        {showEditModal && editingId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 max-w-4xl w-full border-4 my-auto modal-in" style={{borderColor: 'var(--jz-primary)'}}>
              {/* Header */}
              <div className="flex justify-between items-center mb-6 pb-4 border-b-2" style={{borderColor: 'var(--jz-primary-light)'}}>
                <h2 className="text-2xl md:text-3xl font-bold jz-text-primary">✏️ แก้ไขข้อมูลประวัติ - Blue Zone</h2>
                <button
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingId(null)
                    setEditData({})
                  }}
                  className="text-2xl text-gray-500 hover:text-gray-700 font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Edit Form - 2 Columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 max-h-[60vh] overflow-y-auto">
                {/* ชื่อ */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">📝 ชื่อลูกค้า</label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editData[editingId]?.name ?? ''}
                      onChange={(e) => setEditData({...editData, [editingId]: {...editData[editingId], name: e.target.value}})}
                      className="w-full px-4 py-2 border-2 border-blue-300 rounded-lg text-base font-semibold focus:outline-none focus:border-blue-600"
                      placeholder="ชื่อลูกค้า"
                    />
                    <div className="text-xs text-gray-500 italic bg-gray-100 p-2 rounded">
                      💾 ต้นฉบับ: {originalSnapshot[editingId]?.name || '-'}
                    </div>
                  </div>
                </div>

                {/* ห้อง */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">🏠 ห้อง</label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editData[editingId]?.room ?? ''}
                      onChange={(e) => setEditData({...editData, [editingId]: {...editData[editingId], room: e.target.value}})}
                      className="w-full px-4 py-2 border-2 border-blue-300 rounded-lg text-base focus:outline-none focus:border-blue-600"
                      placeholder="ชื่อห้อง"
                    />
                    <div className="text-xs text-gray-500 italic bg-gray-100 p-2 rounded">
                      💾 ต้นฉบับ: {originalSnapshot[editingId]?.room || '-'}
                    </div>
                  </div>
                </div>

                {/* เวลาเริ่ม */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">🕐 เวลาเริ่มต้น</label>
                  <div className="space-y-2">
                    <input
                      type="datetime-local"
                      value={editData[editingId]?.start_time ?? ''}
                      onChange={(e) => setEditData({...editData, [editingId]: {...editData[editingId], start_time: e.target.value}})}
                      className="w-full px-4 py-2 border-2 border-green-300 rounded-lg text-base focus:outline-none focus:border-green-600"
                    />
                    <div className="text-xs text-gray-500 italic bg-gray-100 p-2 rounded">
                      💾 ต้นฉบับ: {formatDateTimeThai(originalSnapshot[editingId]?.start_time) || '-'}
                    </div>
                  </div>
                </div>

                {/* เวลาจบ */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">🕑 เวลาสิ้นสุด</label>
                  <div className="space-y-2">
                    <input
                      type="datetime-local"
                      value={editData[editingId]?.end_time ?? ''}
                      onChange={(e) => setEditData({...editData, [editingId]: {...editData[editingId], end_time: e.target.value}})}
                      className="w-full px-4 py-2 border-2 border-red-300 rounded-lg text-base focus:outline-none focus:border-red-600"
                    />
                    <div className="text-xs text-gray-500 italic bg-gray-100 p-2 rounded">
                      💾 ต้นฉบับ: {formatDateTimeThai(originalSnapshot[editingId]?.end_time) || '-'}
                    </div>
                  </div>
                </div>

                {/* ระยะเวลา */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">⏱️ ระยะเวลา (นาที)</label>
                  <div className="space-y-2">
                    <input
                      type="number"
                      value={editData[editingId]?.duration_minutes ?? ''}
                      onChange={(e) => setEditData({...editData, [editingId]: {...editData[editingId], duration_minutes: Number(e.target.value)}})}
                      className="w-full px-4 py-2 border-2 border-blue-300 rounded-lg text-base focus:outline-none focus:border-blue-600"
                      min="0"
                      step="1"
                    />
                    <div className="text-xs text-gray-500 italic bg-gray-100 p-2 rounded">
                      💾 ต้นฉบับ: {formatDuration(originalSnapshot[editingId]?.duration_minutes) || '-'}
                    </div>
                  </div>
                </div>

                {/* อัตราต่อชั่วโมง */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">💵 อัตรา/ชั่วโมง (฿)</label>
                  <div className="space-y-2">
                    <input
                      type="number"
                      value={editData[editingId]?.hourly_rate ?? ''}
                      onChange={(e) => setEditData({...editData, [editingId]: {...editData[editingId], hourly_rate: e.target.value}})}
                      className="w-full px-4 py-2 border-2 border-blue-300 rounded-lg text-base font-bold focus:outline-none focus:border-blue-600"
                      step="0.01"
                    />
                    <div className="text-xs text-gray-500 italic bg-gray-100 p-2 rounded">
                      💾 ต้นฉบับ: ฿{originalSnapshot[editingId]?.hourly_rate || 0}
                    </div>
                  </div>
                </div>

                {/* ราคา */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">💰 ราคารวม (฿)</label>
                  <div className="space-y-2">
                    <input
                      type="number"
                      value={editData[editingId]?.final_cost ?? ''}
                      onChange={(e) => setEditData({...editData, [editingId]: {...editData[editingId], final_cost: e.target.value}})}
                      className="w-full px-4 py-2 border-2 border-green-300 rounded-lg text-base font-bold focus:outline-none focus:border-green-600"
                      step="0.01"
                    />
                    <div className="text-xs text-gray-500 italic bg-gray-100 p-2 rounded">
                      💾 ต้นฉบับ: ฿{originalSnapshot[editingId]?.final_cost || 0}
                    </div>
                  </div>
                </div>

                {/* บันทึก */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">📝 บันทึก</label>
                  <div className="space-y-2">
                    <textarea
                      value={editData[editingId]?.note ?? ''}
                      onChange={(e) => setEditData({...editData, [editingId]: {...editData[editingId], note: e.target.value}})}
                      className="w-full px-4 py-2 border-2 border-blue-300 rounded-lg text-base focus:outline-none focus:border-blue-600"
                      placeholder="บันทึกเพิ่มเติม (ถ้ามี)"
                      rows="3"
                    />
                    <div className="text-xs text-gray-500 italic bg-gray-100 p-2 rounded">
                      💾 ต้นฉบับ: {originalSnapshot[editingId]?.note || '(ไม่มี)'}
                    </div>
                  </div>
                </div>

                {/* พนักงาน */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">👤 พนักงาน</label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editData[editingId]?.added_by ?? ''}
                      onChange={(e) => setEditData({...editData, [editingId]: {...editData[editingId], added_by: e.target.value}})}
                      className="w-full px-4 py-2 border-2 border-cyan-300 rounded-lg text-base focus:outline-none focus:border-cyan-600"
                      placeholder="ชื่อพนักงาน"
                    />
                    <div className="text-xs text-gray-500 italic bg-gray-100 p-2 rounded">
                      💾 ต้นฉบับ: {originalSnapshot[editingId]?.added_by || '(ไม่ระบุ)'}
                    </div>
                  </div>
                </div>

                {/* สถานะจ่าย */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">💳 สถานะจ่าย</label>
                  <div className="space-y-2">
                    <select
                      value={(editData[editingId]?.is_paid ?? false) ? 'true' : 'false'}
                      onChange={(e) => setEditData({...editData, [editingId]: {...editData[editingId], is_paid: e.target.value === 'true'}})}
                      className="w-full px-4 py-2 border-2 border-blue-300 rounded-lg text-base font-semibold focus:outline-none focus:border-blue-600"
                    >
                      <option value="true">✅ จ่ายแล้ว</option>
                      <option value="false">❌ ยังไม่จ่าย</option>
                    </select>
                    <div className="text-xs text-gray-500 italic bg-gray-100 p-2 rounded">
                      💾 ต้นฉบับ: {originalSnapshot[editingId]?.is_paid ? '✅ จ่ายแล้ว' : '❌ ยังไม่จ่าย'}
                    </div>
                  </div>
                </div>

                {/* สถานะ */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">📊 สถานะ</label>
                  <div className="space-y-2">
                    <select
                      value={editData[editingId]?.end_reason ?? 'completed'}
                      onChange={(e) => setEditData({...editData, [editingId]: {...editData[editingId], end_reason: e.target.value}})}
                      className="w-full px-4 py-2 border-2 border-blue-300 rounded-lg text-base focus:outline-none focus:border-blue-600"
                    >
                      <option value="completed">✅ เสร็จสิ้น</option>
                      <option value="expired">⏰ หมดเวลา</option>
                      <option value="deleted">🗑️ ลบแล้ว</option>
                      <option value="in_progress">⏳ กำลังใช้</option>
                    </select>
                    <div className="text-xs text-gray-500 italic bg-gray-100 p-2 rounded">
                      💾 ต้นฉบับ: {
                        originalSnapshot[editingId]?.end_reason === 'completed' ? '✅ เสร็จสิ้น' :
                        originalSnapshot[editingId]?.end_reason === 'expired' ? '⏰ หมดเวลา' :
                        originalSnapshot[editingId]?.end_reason === 'deleted' ? '🗑️ ลบแล้ว' :
                        originalSnapshot[editingId]?.end_reason === 'in_progress' ? '⏳ กำลังใช้' : '-'
                      }
                    </div>
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 justify-center pt-6 border-t-2 border-blue-300">
                <button
                  onClick={() => updateHistoryItem(editingId)}
                  className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg text-lg font-bold shadow-lg transform hover:scale-105 active:scale-95 transition-all"
                >
                  💾 บันทึก
                </button>
                <button
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingId(null)
                    setEditData({})
                  }}
                  className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-lg font-bold shadow-lg transform hover:scale-105 active:scale-95 transition-all"
                >
                  ✕ ยกเลิก
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Theme Picker */}
      <ThemePicker zone="blue" />
    </div>
  )
}

export default HistoryViewBlue

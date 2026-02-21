import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import supabase from '../firebase'
import { exportToExcel, printReceipt, printHistoryReceipt } from '../utils/exportUtils'

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
  const [rowStatus, setRowStatus] = useState({}) // track syncing/saving states per row
  const [originalSnapshot, setOriginalSnapshot] = useState({}) // latest data pulled before edit
  const [showEditModal, setShowEditModal] = useState(false) // modal state สำหรับแก้ไข
  const [showShiftModal, setShowShiftModal] = useState(false) // modal state สำหรับจัดการกะ

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

  const formatShort = (timestamp) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    return date.toLocaleString('th-TH', {
      day: '2-digit',
      month: 'short',
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
    const original = originalSnapshot[id] // ข้อมูลจริงจาก database
    
    if (!data || !original) {
      console.error('❌ ไม่พบข้อมูลสำหรับการอัพเดท:', { data, original })
      alert('❌ เกิดข้อผิดพลาด: ไม่พบข้อมูลต้นฉบับ กรุณาลองใหม่')
      return
    }

    try {
      // สร้าง payload โดยใช้ค่าจาก editData แต่ถ้าไม่มีให้ใช้จาก original
      // ป้องกันการเขียนทับด้วยค่าว่างโดยไม่ตั้งใจ
      const payload = {
        name: data.name || original.name || 'ไม่ระบุ',
        room: data.room || original.room || 'ไม่ระบุ',
        added_by: data.added_by ?? original.added_by ?? null,
        start_time: data.start_time ? new Date(data.start_time).toISOString() : original.start_time,
        end_time: data.end_time ? new Date(data.end_time).toISOString() : original.end_time,
        duration_minutes: data.duration_minutes !== '' ? Number(data.duration_minutes) : original.duration_minutes,
        final_cost: data.final_cost !== '' ? Number(data.final_cost) : original.final_cost || 0,
        is_paid: data.is_paid !== undefined ? Boolean(data.is_paid) : original.is_paid,
        end_reason: data.end_reason || original.end_reason || 'completed',
        note: data.note ?? original.note ?? '',  // ใช้ ?? เพื่อเก็บ empty string และใช้ original เป็น fallback
        shift: data.shift || original.shift || 'all',
        payment_method: data.payment_method || original.payment_method || 'transfer',
        created_by: original.created_by || original.added_by || null,  // เก็บผู้สร้างเดิม
        last_updated_by: data.last_updated_by ?? original.last_updated_by ?? null,  // บันทึกผู้แก้ไขล่าสุด
        updated_at: new Date().toISOString()
      }

      // คำนวณการเปลี่ยนแปลง
      const changes = []
      
      if (original.name !== payload.name) {
        changes.push(`📝 ชื่อ: "${original.name}" → "${payload.name}"`)
      }
      if (original.room !== payload.room) {
        changes.push(`🏠 ห้อง: "${original.room}" → "${payload.room}"`)
      }
      if (original.added_by !== payload.added_by) {
        changes.push(`👤 พนักงาน: "${original.added_by || '-'}" → "${payload.added_by || '-'}"`)
      }
      if (original.shift !== payload.shift) {
        const shiftNames = { '1': 'กะ 1', '2': 'กะ 2', '3': 'กะ 3', 'all': 'ทั้งหมด' }
        changes.push(`🔄 กะ: "${shiftNames[original.shift] || original.shift}" → "${shiftNames[payload.shift] || payload.shift}"`)
      }
      if (formatDateTime(original.start_time) !== formatDateTime(payload.start_time)) {
        changes.push(`🕐 เวลาเริ่ม: ${formatDateTime(original.start_time)} → ${formatDateTime(payload.start_time)}`)
      }
      if (formatDateTime(original.end_time) !== formatDateTime(payload.end_time)) {
        changes.push(`🕑 เวลาจบ: ${formatDateTime(original.end_time)} → ${formatDateTime(payload.end_time)}`)
      }
      if (original.duration_minutes !== payload.duration_minutes) {
        changes.push(`⏱️ ระยะเวลา: ${formatDuration(original.duration_minutes)} → ${formatDuration(payload.duration_minutes)}`)
      }
      if (original.final_cost !== payload.final_cost) {
        changes.push(`💰 ราคา: ฿${original.final_cost} → ฿${payload.final_cost}`)
      }
      if (original.is_paid !== payload.is_paid) {
        changes.push(`💳 สถานะจ่าย: ${original.is_paid ? '✅ จ่ายแล้ว' : '❌ ยังไม่จ่าย'} → ${payload.is_paid ? '✅ จ่ายแล้ว' : '❌ ยังไม่จ่าย'}`)
      }
      if ((original.note || '') !== (payload.note || '')) {
        const oldNote = original.note || '(ไม่มี)'
        const newNote = payload.note || '(ไม่มี)'
        changes.push(`📝 บันทึก: "${oldNote}" → "${newNote}"`)
      }
      if (original.end_reason !== payload.end_reason) {
        const reasonNames = { 
          'completed': '✅ เสร็จแล้ว', 
          'expired': '⏰ หมดเวลา', 
          'deleted': '🗑️ ลบแล้ว', 
          'in_progress': '⏳ ดำเนินการ' 
        }
        changes.push(`📊 สถานะ: ${reasonNames[original.end_reason] || original.end_reason} → ${reasonNames[payload.end_reason] || payload.end_reason}`)
      }

      // แสดง confirmation popup
      let confirmMessage = '🔍 รายละเอียดการเปลี่ยนแปลง\n'
      confirmMessage += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n'
      
      if (changes.length === 0) {
        confirmMessage += '⚠️ ไม่มีการเปลี่ยนแปลงใดๆ\n\n'
        confirmMessage += 'คุณต้องการบันทึกต่อหรือไม่?'
      } else {
        confirmMessage += `พบการเปลี่ยนแปลง ${changes.length} รายการ:\n\n`
        changes.forEach((change, index) => {
          confirmMessage += `${index + 1}. ${change}\n`
        })
        confirmMessage += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
        confirmMessage += '✅ ยืนยันการบันทึกหรือไม่?'
      }

      const confirmed = window.confirm(confirmMessage)
      
      if (!confirmed) {
        console.log('❌ ผู้ใช้ยกเลิกการบันทึก')
        return
      }

      // บันทึกข้อมูล
      setRowStatus(prev => ({ ...prev, [id]: { ...(prev[id] || {}), saving: true } }))

      console.log('💾 Updating history record:', { 
        id,
        changesCount: changes.length,
        changes: changes,
        fullPayload: payload
      })

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
            setOriginalSnapshot(prev => ({ ...prev, [id]: result?.[0] || null }))
      alert('✅ อัพเดทข้อมูลสำเร็จ')
    } catch (error) {
      console.error('Error updating history:', error)
      alert('ไม่สามารถอัพเดทข้อมูลได้: ' + error.message)
          } finally {
            setRowStatus(prev => ({ ...prev, [id]: { ...(prev[id] || {}), saving: false } }))
    }
  }

        const loadRowBeforeEdit = async (record) => {
          const id = record.id
          setRowStatus(prev => ({ ...prev, [id]: { ...(prev[id] || {}), syncing: true, syncError: null } }))
          try {
            console.log('Fetching latest data for record ID:', id)
            const { data: fresh, error } = await supabase
              .from('customers_history')
              .select('*')
              .eq('id', id)
              .single()

            if (error) throw error
            console.log('Synced latest data:', fresh)

            const base = fresh || record
            // บันทึกข้อมูลล่าสุดที่ซิงค์มา
            setOriginalSnapshot(prev => ({ ...prev, [id]: base }))
            
            // ใช้ข้อมูลจาก base (ข้อมูลล่าสุด) สำหรับ edit form
            setEditData({
              [id]: {
                name: base.name ?? '',
                note: base.note ?? '',
                room: base.room ?? '',
                added_by: base.added_by ?? '',
                start_time: formatDateTimeLocal(base.start_time),
                end_time: formatDateTimeLocal(base.end_time),
                duration_minutes: base.duration_minutes ?? '',
                final_cost: base.final_cost ?? '',
                is_paid: base.is_paid ?? false,
                end_reason: base.end_reason ?? 'completed',
                shift: base.shift ?? 'all',
                payment_method: base.payment_method ?? 'transfer'
              }
            })
            setEditingId(id)
            setShowEditModal(true) // เปิด modal
            console.log('Edit modal activated with latest data')
          } catch (error) {
            console.error('Sync row before edit failed:', error)
            alert('❌ ซิงค์ข้อมูลล่าสุดไม่สำเร็จ: ' + error.message)
            setRowStatus(prev => ({ ...prev, [id]: { ...(prev[id] || {}), syncError: error.message } }))
          } finally {
            setRowStatus(prev => ({ ...prev, [id]: { ...(prev[id] || {}), syncing: false } }))
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

  const getShiftStats = () => {
    const shifts = {
      '1': { name: 'กะ 1 (10:00-19:00)', count: 0, revenue: 0, duration: 0, paid: 0, color: 'green' },
      '2': { name: 'กะ 2 (19:00-01:00)', count: 0, revenue: 0, duration: 0, paid: 0, color: 'orange' },
      '3': { name: 'กะ 3 (01:00-10:00)', count: 0, revenue: 0, duration: 0, paid: 0, color: 'purple' },
      'all': { name: 'ทั้งหมด/ไม่ระบุ', count: 0, revenue: 0, duration: 0, paid: 0, color: 'gray' }
    }

    filteredHistory.forEach(h => {
      const shiftKey = h.shift || 'all'
      if (shifts[shiftKey]) {
        shifts[shiftKey].count++
        shifts[shiftKey].revenue += parseFloat(h.final_cost || 0)
        shifts[shiftKey].duration += parseFloat(h.duration_minutes || 0)
        if (h.is_paid) shifts[shiftKey].paid++
      }
    })

    return shifts
  }

  const stats = getTotalStats()

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-700 via-pink-600 to-orange-500 animate-gradient p-3 md:p-6 lg:p-8">
      <style>{`
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 15s ease infinite;
        }
        @keyframes stat-in {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .stat-animate { animation: stat-in 0.4s ease-out both; }
        @keyframes table-row-in {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .table-row-animate { animation: table-row-in 0.25s ease-out; }
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
          <div className="flex gap-3">
            <button
              onClick={() => setShowShiftModal(true)}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-2 px-6 rounded-xl shadow-lg hover:shadow-2xl transform hover:scale-105 active:scale-95 transition-all duration-300"
            >
              🔄 จัดการกะ
            </button>
            <Link
              to="/admin"
              className="bg-white/90 hover:bg-white text-purple-600 font-bold py-2 px-6 rounded-xl shadow-lg hover:shadow-2xl transform hover:scale-105 active:scale-95 transition-all duration-300"
            >
              ← กลับแอดมิน
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
          <div className="stat-animate bg-white/95 backdrop-blur-sm rounded-2xl p-4 md:p-5 shadow-xl border border-purple-200 hover:shadow-2xl transition-shadow" style={{animationDelay: '0s'}}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-2xl">📊</span>
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">ทั้งหมด</span>
            </div>
            <div className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">{stats.count}</div>
            <div className="text-xs text-gray-500 font-medium mt-1">รายการ</div>
          </div>
          <div className="stat-animate bg-white/95 backdrop-blur-sm rounded-2xl p-4 md:p-5 shadow-xl border border-green-200 hover:shadow-2xl transition-shadow" style={{animationDelay: '0.1s'}}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-2xl">💰</span>
              <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">รายได้</span>
            </div>
            <div className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">฿{stats.revenue.toFixed(0)}</div>
            <div className="text-xs text-gray-500 font-medium mt-1">บาท</div>
          </div>
          <div className="stat-animate bg-white/95 backdrop-blur-sm rounded-2xl p-4 md:p-5 shadow-xl border border-blue-200 hover:shadow-2xl transition-shadow" style={{animationDelay: '0.2s'}}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-2xl">⏱️</span>
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">เวลารวม</span>
            </div>
            <div className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">{formatDuration(stats.duration)}</div>
            <div className="text-xs text-gray-500 font-medium mt-1">ชั่วโมง</div>
          </div>
          <div className="stat-animate bg-white/95 backdrop-blur-sm rounded-2xl p-4 md:p-5 shadow-xl border border-orange-200 hover:shadow-2xl transition-shadow" style={{animationDelay: '0.3s'}}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-2xl">✅</span>
              <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">จ่ายแล้ว</span>
            </div>
            <div className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">{stats.paid}<span className="text-lg text-gray-400">/{stats.count}</span></div>
            <div className="text-xs text-gray-500 font-medium mt-1">{stats.count > 0 ? Math.round(stats.paid/stats.count*100) : 0}%</div>
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
                  <tr className="bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white shadow-lg">
                    <th className="px-2 md:px-4 py-2.5 md:py-3.5 text-left text-xs md:text-sm font-bold tracking-wide">ชื่อ</th>
                    <th className="px-2 md:px-4 py-2.5 md:py-3.5 text-left text-xs md:text-sm font-bold tracking-wide">ห้อง</th>
                    <th className="px-2 md:px-4 py-2.5 md:py-3.5 text-left text-xs md:text-sm font-bold tracking-wide hidden sm:table-cell">👥 สร้าง</th>
                    <th className="px-2 md:px-4 py-2.5 md:py-3.5 text-left text-xs md:text-sm font-bold tracking-wide hidden lg:table-cell">✏️ แก้ไข</th>
                    <th className="px-2 md:px-4 py-2.5 md:py-3.5 text-center text-xs md:text-sm font-bold tracking-wide hidden sm:table-cell">🔄 กะ</th>
                    <th className="px-2 md:px-4 py-2.5 md:py-3.5 text-center text-xs md:text-sm font-bold tracking-wide hidden md:table-cell">📅 วันที่</th>
                    <th className="px-2 md:px-4 py-2.5 md:py-3.5 text-center text-xs md:text-sm font-bold tracking-wide hidden md:table-cell">🕐 เริ่ม</th>
                    <th className="px-2 md:px-4 py-2.5 md:py-3.5 text-center text-xs md:text-sm font-bold tracking-wide hidden md:table-cell">🕑 จบ</th>
                    <th className="px-2 md:px-4 py-2.5 md:py-3.5 text-center text-xs md:text-sm font-bold tracking-wide">⏱ เวลา</th>
                    <th className="px-2 md:px-4 py-2.5 md:py-3.5 text-center text-xs md:text-sm font-bold tracking-wide">💰 ราคา</th>
                    <th className="px-2 md:px-4 py-2.5 md:py-3.5 text-center text-xs md:text-sm font-bold tracking-wide">💳 จ่าย</th>
                    <th className="px-2 md:px-4 py-2.5 md:py-3.5 text-center text-xs md:text-sm font-bold tracking-wide hidden lg:table-cell">สถานะ</th>
                    <th className="px-2 md:px-4 py-2.5 md:py-3.5 text-center text-xs md:text-sm font-bold tracking-wide">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((record, index) => (
                    <tr
                      key={record.id}
                      className={`table-row-animate border-b border-gray-100 ${
                        index % 2 === 0 ? 'bg-purple-50/50' : 'bg-white'
                      } hover:bg-purple-100/70 transition-all duration-200`}
                      style={{ animationDelay: `${index * 0.03}s` }}
                    >
                      <td className="px-2 md:px-4 py-2 md:py-3 font-semibold text-xs md:text-sm">
                        {record.name}
                        {record.note && (
                          <div className="text-xs text-gray-500 mt-1">📝 {record.note}</div>
                        )}
                      </td>
                      <td className="px-2 md:px-4 py-2 md:py-3">
                        <span className="inline-block bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs">
                          {record.room}
                        </span>
                      </td>
                      <td className="px-2 md:px-4 py-2 md:py-3 text-xs font-semibold hidden sm:table-cell">
                        <span className="inline-block bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                          {record.created_by || record.added_by || '—'}
                        </span>
                      </td>
                      <td className="px-2 md:px-4 py-2 md:py-3 text-xs font-semibold hidden lg:table-cell">
                        <span className="inline-block bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs">
                          {record.last_updated_by || record.added_by || '—'}
                        </span>
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
                        {record.session_date || formatShort(record.start_time).split(' ')[0]}
                      </td>
                      <td className="px-2 md:px-4 py-2 md:py-3 text-center text-xs hidden md:table-cell">
                        <div className="space-y-1">
                          <div>{formatDateTime(record.start_time)}</div>
                        </div>
                      </td>
                      <td className="px-2 md:px-4 py-2 md:py-3 text-center text-xs hidden md:table-cell">
                        <div className="space-y-1">
                          <div>{formatDateTime(record.end_time)}</div>
                          {record.updated_at && (
                            <div className="text-[10px] text-gray-500">อัพเดท: {formatShort(record.updated_at)}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-2 md:px-4 py-2 md:py-3 text-center font-semibold text-xs md:text-sm">
                        {formatDuration(record.duration_minutes)}
                      </td>
                      <td className="px-2 md:px-4 py-2 md:py-3 text-center font-bold text-sm md:text-base text-green-600">
                        ฿{record.final_cost}
                      </td>
                      <td className="px-2 md:px-4 py-2 md:py-3 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                          record.is_paid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {record.is_paid ? '✅ จ่ายแล้ว' : '❌ ยังไม่จ่าย'}
                        </span>
                      </td>
                      <td className="px-2 md:px-4 py-2 md:py-3 text-center hidden lg:table-cell">
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
                      </td>
                      <td className="px-2 md:px-4 py-2 md:py-3 text-center">
                        <div className="flex flex-col gap-1 justify-center min-w-[100px]">
                            <button
                              onClick={() => {
                                printHistoryReceipt(record, 'red')
                              }}
                              className="px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-xs font-bold shadow transform hover:scale-105 active:scale-95 transition-all"
                              title="พิมพ์ใบเสร็จ"
                            >
                              🖨️ พิมพ์
                            </button>
                            <button
                              onClick={() => loadRowBeforeEdit(record)}
                              disabled={rowStatus[record.id]?.syncing}
                              className={`px-3 py-2 rounded-lg text-xs font-bold text-white shadow transform transition-all ${
                                rowStatus[record.id]?.syncing 
                                  ? 'bg-blue-300 cursor-not-allowed' 
                                  : 'bg-blue-500 hover:bg-blue-600 hover:scale-105 active:scale-95'
                              }`}
                              title="แก้ไข (ซิงค์ข้อมูลล่าสุดก่อน)"
                            >
                              {rowStatus[record.id]?.syncing ? '⏳ ซิงค์...' : '✏️ แก้ไข'}
                            </button>
                            <button
                              onClick={() => deleteHistoryItem(record.id)}
                              className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-bold shadow transform hover:scale-105 active:scale-95 transition-all"
                              title="ลบ"
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
        </div>

        {/* Shift Management Modal */}
        {showShiftModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 max-w-6xl w-full border-4 border-blue-500 my-auto max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex justify-between items-center mb-6 pb-4 border-b-2 border-blue-300">
                <h2 className="text-2xl md:text-3xl font-bold text-blue-700">🔄 สถิติและจัดการตามกะ</h2>
                <button
                  onClick={() => setShowShiftModal(false)}
                  className="text-2xl text-gray-500 hover:text-gray-700 font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Shift Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {Object.entries(getShiftStats()).map(([shiftKey, stats]) => (
                  <div
                    key={shiftKey}
                    className={`bg-${stats.color}-50 border-2 border-${stats.color}-300 rounded-xl p-4 shadow-lg hover:shadow-xl transition-all`}
                  >
                    <div className={`text-lg font-bold text-${stats.color}-700 mb-3`}>
                      {stats.name}
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">จำนวน:</span>
                        <span className="font-bold">{stats.count} รายการ</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">รายได้:</span>
                        <span className="font-bold text-green-600">฿{stats.revenue.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">เวลารวม:</span>
                        <span className="font-bold">{formatDuration(stats.duration)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">จ่ายแล้ว:</span>
                        <span className="font-bold text-blue-600">{stats.paid}/{stats.count}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Shift History Table */}
              <div className="space-y-6">
                {['1', '2', '3', 'all'].map(shiftKey => {
                  const shiftData = filteredHistory.filter(h => (h.shift || 'all') === shiftKey)
                  if (shiftData.length === 0) return null

                  const shiftInfo = {
                    '1': { name: 'กะ 1 (10:00-19:00)', color: 'green' },
                    '2': { name: 'กะ 2 (19:00-01:00)', color: 'orange' },
                    '3': { name: 'กะ 3 (01:00-10:00)', color: 'purple' },
                    'all': { name: 'ทั้งหมด/ไม่ระบุ', color: 'gray' }
                  }[shiftKey]

                  return (
                    <div key={shiftKey} className="border-2 border-gray-200 rounded-xl p-4">
                      <h3 className={`text-xl font-bold text-${shiftInfo.color}-700 mb-4`}>
                        {shiftInfo.name} ({shiftData.length} รายการ)
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className={`bg-${shiftInfo.color}-100`}>
                              <th className="px-3 py-2 text-left">ชื่อ</th>
                              <th className="px-3 py-2 text-left">ห้อง</th>
                              <th className="px-3 py-2 text-center">พนักงาน</th>
                              <th className="px-3 py-2 text-center">เวลาเริ่ม</th>
                              <th className="px-3 py-2 text-center">ระยะเวลา</th>
                              <th className="px-3 py-2 text-center">ราคา</th>
                              <th className="px-3 py-2 text-center">สถานะ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {shiftData.map((record, index) => (
                              <tr
                                key={record.id}
                                className={`border-b ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-${shiftInfo.color}-50 transition-all`}
                              >
                                <td className="px-3 py-2 font-semibold">{record.name}</td>
                                <td className="px-3 py-2">
                                  <span className="inline-block bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                                    {record.room}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <span className="inline-block bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs">
                                    {record.added_by || '—'}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-center text-xs">
                                  {formatDateTime(record.start_time)}
                                </td>
                                <td className="px-3 py-2 text-center font-semibold">
                                  {formatDuration(record.duration_minutes)}
                                </td>
                                <td className="px-3 py-2 text-center font-bold text-green-600">
                                  ฿{record.final_cost}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                                    record.is_paid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                  }`}>
                                    {record.is_paid ? '✅' : '❌'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Close Button */}
              <div className="flex justify-center mt-6 pt-6 border-t-2 border-gray-200">
                <button
                  onClick={() => setShowShiftModal(false)}
                  className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-lg font-bold shadow-lg transform hover:scale-105 active:scale-95 transition-all"
                >
                  ✕ ปิด
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal Dialog */}
        {showEditModal && editingId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 max-w-4xl w-full border-4 border-purple-500 my-auto">
              {/* Header */}
              <div className="flex justify-between items-center mb-6 pb-4 border-b-2 border-purple-300">
                <h2 className="text-2xl md:text-3xl font-bold text-purple-700">✏️ แก้ไขข้อมูลประวัติ</h2>
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
                      className="w-full px-4 py-2 border-2 border-purple-300 rounded-lg text-base font-semibold focus:outline-none focus:border-purple-600"
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
                    <select
                      value={editData[editingId]?.room ?? ''}
                      onChange={(e) => setEditData({...editData, [editingId]: {...editData[editingId], room: e.target.value}})}
                      className="w-full px-4 py-2 border-2 border-blue-300 rounded-lg text-base focus:outline-none focus:border-blue-600"
                    >
                      <option value="ชั้น 2 ห้อง VIP">ชั้น 2 ห้อง VIP</option>
                      <option value="ชั้น 3 ห้อง VIP KARAOKE">ชั้น 3 ห้อง VIP KARAOKE</option>
                      <option value="ชั้น 3 ห้อง Golf">ชั้น 3 Golf</option>
                    </select>
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
                      💾 ต้นฉบับ: {formatDateTime(originalSnapshot[editingId]?.start_time) || '-'}
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
                      💾 ต้นฉบับ: {formatDateTime(originalSnapshot[editingId]?.end_time) || '-'}
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

                {/* ราคา */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">💰 ราคา (฿)</label>
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
                      className="w-full px-4 py-2 border-2 border-purple-300 rounded-lg text-base focus:outline-none focus:border-purple-600"
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
                      className="w-full px-4 py-2 border-2 border-orange-300 rounded-lg text-base focus:outline-none focus:border-orange-600"
                      placeholder="ชื่อพนักงาน"
                    />
                    <div className="text-xs text-gray-500 italic bg-gray-100 p-2 rounded">
                      💾 ต้นฉบับ: {originalSnapshot[editingId]?.added_by || '(ไม่ระบุ)'}
                    </div>
                  </div>
                </div>

                {/* กะ */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">🔄 กะ</label>
                  <div className="space-y-2">
                    <select
                      value={editData[editingId]?.shift ?? 'all'}
                      onChange={(e) => setEditData({...editData, [editingId]: {...editData[editingId], shift: e.target.value}})}
                      className="w-full px-4 py-2 border-2 border-blue-300 rounded-lg text-base font-semibold focus:outline-none focus:border-blue-600"
                    >
                      <option value="all">ทั้งหมด</option>
                      <option value="1">กะ 1 (10:00-19:00)</option>
                      <option value="2">กะ 2 (19:00-01:00)</option>
                      <option value="3">กะ 3 (01:00-10:00)</option>
                    </select>
                    <div className="text-xs text-gray-500 italic bg-gray-100 p-2 rounded">
                      💾 ต้นฉบับ: {
                        originalSnapshot[editingId]?.shift === '1' ? 'กะ 1 (10:00-19:00)' :
                        originalSnapshot[editingId]?.shift === '2' ? 'กะ 2 (19:00-01:00)' :
                        originalSnapshot[editingId]?.shift === '3' ? 'กะ 3 (01:00-10:00)' :
                        'ทั้งหมด'
                      }
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
                      className="w-full px-4 py-2 border-2 border-purple-300 rounded-lg text-base font-semibold focus:outline-none focus:border-purple-600"
                    >
                      <option value="true">✅ จ่ายแล้ว</option>
                      <option value="false">❌ ยังไม่จ่าย</option>
                    </select>
                    <div className="text-xs text-gray-500 italic bg-gray-100 p-2 rounded">
                      💾 ต้นฉบับ: {originalSnapshot[editingId]?.is_paid ? '✅ จ่ายแล้ว' : '❌ ยังไม่จ่าย'}
                    </div>
                  </div>
                </div>

                {/* วิธีชำระเงิน */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">💰 วิธีชำระเงิน</label>
                  <div className="space-y-2">
                    <select
                      value={editData[editingId]?.payment_method ?? 'transfer'}
                      onChange={(e) => setEditData({...editData, [editingId]: {...editData[editingId], payment_method: e.target.value}})}
                      className="w-full px-4 py-2 border-2 border-green-300 rounded-lg text-base font-semibold focus:outline-none focus:border-green-600"
                    >
                      <option value="transfer">💳 โอนเงิน</option>
                      <option value="cash">💵 เงินสด</option>
                    </select>
                    <div className="text-xs text-gray-500 italic bg-gray-100 p-2 rounded">
                      💾 ต้นฉบับ: {
                        originalSnapshot[editingId]?.payment_method === 'transfer' ? '💳 โอนเงิน' :
                        originalSnapshot[editingId]?.payment_method === 'cash' ? '💵 เงินสด' :
                        '💳 โอนเงิน'
                      }
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
                      className="w-full px-4 py-2 border-2 border-purple-300 rounded-lg text-base focus:outline-none focus:border-purple-600"
                    >
                      <option value="completed">✅ เสร็จแล้ว</option>
                      <option value="expired">⏰ หมดเวลา</option>
                      <option value="deleted">🗑️ ลบแล้ว</option>
                      <option value="in_progress">⏳ ดำเนินการ</option>
                    </select>
                    <div className="text-xs text-gray-500 italic bg-gray-100 p-2 rounded">
                      💾 ต้นฉบับ: {
                        originalSnapshot[editingId]?.end_reason === 'completed' ? '✅ เสร็จแล้ว' :
                        originalSnapshot[editingId]?.end_reason === 'expired' ? '⏰ หมดเวลา' :
                        originalSnapshot[editingId]?.end_reason === 'deleted' ? '🗑️ ลบแล้ว' :
                        originalSnapshot[editingId]?.end_reason === 'in_progress' ? '⏳ ดำเนินการ' : '-'
                      }
                    </div>
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 justify-center pt-6 border-t-2 border-purple-300">
                <button
                  onClick={() => updateHistoryItem(editingId)}
                  disabled={rowStatus[editingId]?.saving}
                  className={`px-6 py-3 rounded-lg text-lg font-bold text-white shadow-lg transform transition-all ${
                    rowStatus[editingId]?.saving 
                      ? 'bg-green-300 cursor-not-allowed' 
                      : 'bg-green-500 hover:bg-green-600 hover:scale-105 active:scale-95'
                  }`}
                >
                  {rowStatus[editingId]?.saving ? '⏳ บันทึก...' : '💾 บันทึก'}
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
    </div>
  )
}

export default HistoryView

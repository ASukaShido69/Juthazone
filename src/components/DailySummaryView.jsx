import { useState, useEffect } from 'react'
import supabase from '../firebase'
import { utils as XLSXUtils, writeFile } from 'xlsx'

function DailySummaryView({ user, onLogout }) {
  const [viewMode, setViewMode] = useState('daily') // 'daily' or 'range'
  const [selectedShift, setSelectedShift] = useState('all') // 'all', '1', '2', '3'
  const [summaryData, setSummaryData] = useState({
    gameZoneTotal: 0,
    gameZoneTransfer: 0,
    gameZoneCash: 0,
    gameZoneByRoom: {}, // ข้อมูลแต่ละห้อง
    gameZoneEntries: [], // รายการ Game Zone
    computerZoneEntries: [],
    computerZoneTotal: 0,
    computerZoneTransfer: 0,
    computerZoneCash: 0,
    grandTotal: 0,
    grandTransfer: 0,
    grandCash: 0,
    date: new Date().toISOString().split('T')[0]
  })
  
  const [rangeData, setRangeData] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    entries: [],
    totalGameZone: 0,
    totalGameZoneTransfer: 0,
    totalGameZoneCash: 0,
    totalComputerZone: 0,
    totalComputerZoneTransfer: 0,
    totalComputerZoneCash: 0,
    grandTotal: 0,
    grandTransfer: 0,
    grandCash: 0
  })
  
  const [editingEntry, setEditingEntry] = useState(null) // เก็บรายการที่กำลังแก้ไข
  const [editFormData, setEditFormData] = useState({
    customerName: '',
    hours: '',
    transferAmount: '',
    cashAmount: '',
    startTime: '',
    description: ''
  })
  // Toggle state for sections
  const [showComputerZone, setShowComputerZone] = useState(true)
  const [showVIPByRoom, setShowVIPByRoom] = useState(true)
  
  const [loading, setLoading] = useState(true)
  const [shiftSummary, setShiftSummary] = useState({}) // เก็บข้อมูลแยกตามกะ
  
  // Shift configurations
  const shifts = {
    1: { name: 'เช้า-เย็น', start: '10:00', end: '19:00' },
    2: { name: 'เย็น-ดึก', start: '19:00', end: '01:00' },
    3: { name: 'ดึก-เช้า', start: '01:00', end: '10:00' }
  }

  const getShiftFromTime = (timeStr) => {
    if (!timeStr) return 'all'
    const hour = parseInt(timeStr.split(':')[0])
    if (hour >= 10 && hour < 19) return '1'
    if (hour >= 19 || hour < 1) return '2'
    if (hour >= 1 && hour < 10) return '3'
    return 'all'
  }

  // Load summary data on mount
  useEffect(() => {
    loadDailySummary()
  }, [summaryData.date])

  // Load range data when dates change
  useEffect(() => {
    if (viewMode === 'range') {
      loadRangeSummary()
    }
  }, [rangeData.startDate, rangeData.endDate, viewMode])

  // Realtime subscription for computer_zone_history
  useEffect(() => {
    if (!supabase) return

    const channel = supabase
      .channel('computer_zone_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'computer_zone_history'
        },
        (payload) => {
          console.log('Computer Zone change detected:', payload)
          // Reload data when any change happens
          if (viewMode === 'daily') {
            loadDailySummary()
          } else {
            loadRangeSummary()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [viewMode, summaryData.date, rangeData.startDate, rangeData.endDate])

  // Realtime subscription for customers_history (VIP)
  useEffect(() => {
    if (!supabase) return

    const channel = supabase
      .channel('customers_history_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customers_history'
        },
        () => {
          if (viewMode === 'daily') {
            loadDailySummary()
          } else {
            loadRangeSummary()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [viewMode, summaryData.date, rangeData.startDate, rangeData.endDate])

  const loadDailySummary = async () => {
    if (!supabase) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const today = summaryData.date

      // Get game zone data from history - filter by session_date (not end_time)
      // This ensures daily cutoff at 00:00 regardless of when customer finished
      const { data: historyData, error: historyError } = await supabase
        .from('customers_history')
        .select('*')
        .eq('session_date', today)

      if (historyError) throw historyError

      // Calculate game zone totals by payment method and room
      let gameZoneTotal = 0
      let gameZoneTransfer = 0
      let gameZoneCash = 0
      const gameZoneByRoom = {} // สะสมข้อมูลตามห้อง

      if (historyData) {
        historyData.forEach(record => {
          const cost = parseFloat(record.final_cost) || 0
          const room = record.room || 'ไม่ระบุห้อง'
          gameZoneTotal += cost
          
          // Default to transfer if payment_method not specified
          const paymentMethod = record.payment_method || 'transfer'
          if (paymentMethod === 'transfer') {
            gameZoneTransfer += cost
          } else if (paymentMethod === 'cash') {
            gameZoneCash += cost
          }

          // สะสมข้อมูลตามห้อง
          if (!gameZoneByRoom[room]) {
            gameZoneByRoom[room] = {
              total: 0,
              transfer: 0,
              cash: 0,
              count: 0
            }
          }
          gameZoneByRoom[room].total += cost
          gameZoneByRoom[room].count += 1
          if (paymentMethod === 'transfer') {
            gameZoneByRoom[room].transfer += cost
          } else {
            gameZoneByRoom[room].cash += cost
          }
        })
      }

      // Get computer zone entries from history
      const { data: computerData, error: computerError } = await supabase
        .from('computer_zone_history')
        .select('*')
        .eq('session_date', today)

      if (computerError) throw computerError

      const computerZoneEntries = computerData || []
      let computerZoneTotal = 0
      let computerZoneTransfer = 0
      let computerZoneCash = 0

      computerZoneEntries.forEach(entry => {
        const transfer = parseFloat(entry.transfer_amount) || 0
        const cash = parseFloat(entry.cash_amount) || 0
        computerZoneTransfer += transfer
        computerZoneCash += cash
        computerZoneTotal += transfer + cash
      })

      setSummaryData({
        gameZoneTotal,
        gameZoneTransfer,
        gameZoneCash,
        gameZoneByRoom, // เพิ่มข้อมูลตามห้อง
        gameZoneEntries: historyData || [], // เพิ่มรายการ Game Zone
        computerZoneEntries,
        computerZoneTotal,
        computerZoneTransfer,
        computerZoneCash,
        grandTotal: gameZoneTotal + computerZoneTotal,
        grandTransfer: gameZoneTransfer + computerZoneTransfer,
        grandCash: gameZoneCash + computerZoneCash,
        date: today
      })

      // Calculate shift summary
      calculateShiftSummary(historyData, computerData)
    } catch (error) {
      console.error('Error loading summary:', error)
      alert('ไม่สามารถโหลดข้อมูลสรุปยอดได้: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const calculateShiftSummary = (historyData, computerData) => {
    const summary = {
      1: { computerTotal: 0, computerTransfer: 0, computerCash: 0, gameZoneTotal: 0, gameZoneTransfer: 0, gameZoneCash: 0, entries: [] },
      2: { computerTotal: 0, computerTransfer: 0, computerCash: 0, gameZoneTotal: 0, gameZoneTransfer: 0, gameZoneCash: 0, entries: [] },
      3: { computerTotal: 0, computerTransfer: 0, computerCash: 0, gameZoneTotal: 0, gameZoneTransfer: 0, gameZoneCash: 0, entries: [] }
    }

    // Process computer zone data
    computerData?.forEach(entry => {
      const shift = entry.shift || 'all'
      if (shift !== 'all' && summary[shift]) {
        const transfer = parseFloat(entry.transfer_amount) || 0
        const cash = parseFloat(entry.cash_amount) || 0
        const total = transfer + cash

        summary[shift].computerTotal += total
        summary[shift].computerTransfer += transfer
        summary[shift].computerCash += cash
        summary[shift].entries.push(entry)
      }
    })

    // Process game zone data
    historyData?.forEach(record => {
      // Game zone ไม่มี shift ให้หากำหนดจาก start_time
      if (record.start_time) {
        const shift = getShiftFromTime(record.start_time)
        if (summary[shift]) {
          const cost = parseFloat(record.final_cost) || 0
          const paymentMethod = record.payment_method || 'transfer'
          
          summary[shift].gameZoneTotal += cost
          if (paymentMethod === 'transfer') {
            summary[shift].gameZoneTransfer += cost
          } else {
            summary[shift].gameZoneCash += cost
          }
        }
      }
    })

    setShiftSummary(summary)
  }

  const loadRangeSummary = async () => {
    if (!supabase) return

    try {
      setLoading(true)
      const { startDate, endDate } = rangeData

      // Get game zone data for date range - filter by session_date
      const { data: historyData, error: historyError } = await supabase
        .from('customers_history')
        .select('*')
        .gte('session_date', startDate)
        .lte('session_date', endDate)

      if (historyError) throw historyError

      // Calculate game zone totals with payment method breakdown
      let totalGameZone = 0
      let totalGameZoneTransfer = 0
      let totalGameZoneCash = 0

      if (historyData) {
        historyData.forEach(record => {
          const cost = parseFloat(record.final_cost) || 0
          totalGameZone += cost
          
          const paymentMethod = record.payment_method || 'transfer'
          if (paymentMethod === 'transfer') {
            totalGameZoneTransfer += cost
          } else if (paymentMethod === 'cash') {
            totalGameZoneCash += cost
          }
        })
      }

      // Get computer zone data for date range - filter by session_date
      const { data: computerData, error: computerError } = await supabase
        .from('computer_zone_history')
        .select('*')
        .gte('session_date', startDate)
        .lte('session_date', endDate)

      if (computerError) throw computerError

      const computerZoneEntries = computerData || []
      
      // Calculate computer zone totals with payment method breakdown
      let totalComputerZone = 0
      let totalComputerZoneTransfer = 0
      let totalComputerZoneCash = 0

      computerZoneEntries.forEach(entry => {
        const transfer = parseFloat(entry.transfer_amount) || 0
        const cash = parseFloat(entry.cash_amount) || 0
        totalComputerZone += (transfer + cash)
        totalComputerZoneTransfer += transfer
        totalComputerZoneCash += cash
      })

      setRangeData(prev => ({
        ...prev,
        entries: computerZoneEntries,
        totalGameZone,
        totalGameZoneTransfer,
        totalGameZoneCash,
        totalComputerZone,
        totalComputerZoneTransfer,
        totalComputerZoneCash,
        grandTotal: totalGameZone + totalComputerZone,
        grandTransfer: totalGameZoneTransfer + totalComputerZoneTransfer,
        grandCash: totalGameZoneCash + totalComputerZoneCash
      }))
    } catch (error) {
      console.error('Error loading range summary:', error)
      alert('ไม่สามารถโหลดข้อมูลได้: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const deleteComputerEntry = async (id) => {
    if (!window.confirm('ต้องการลบรายการนี้หรือไม่?')) return

    try {
      const entryToDelete = summaryData.computerZoneEntries.find(e => e.id === id)
      
      const { error } = await supabase
        .from('computer_zone_history')
        .delete()
        .eq('id', id)

      if (error) throw error

      // Realtime จะ reload ข้อมูลอัตโนมัติ ไม่ต้อง update local state
      alert('✅ ลบรายการสำเร็จ')
    } catch (error) {
      console.error('Error deleting entry:', error)
      alert('เกิดข้อผิดพลาด: ' + error.message)
    }
  }

  const startEditEntry = (entry) => {
    setEditingEntry(entry.id)
    setEditFormData({
      customerName: entry.customer_name || '',
      hours: entry.hours || '',
      transferAmount: entry.transfer_amount || '',
      cashAmount: entry.cash_amount || '',
      startTime: entry.start_time || '',
      description: entry.description || '',
      shift: entry.shift || 'all'
    })
  }

  const cancelEdit = () => {
    setEditingEntry(null)
    setEditFormData({
      customerName: '',
      hours: '',
      transferAmount: '',
      cashAmount: '',
      startTime: '',
      description: '',
      shift: 'all'
    })
  }

  const updateComputerEntry = async (id) => {
    if (!editFormData.hours || (!editFormData.transferAmount && !editFormData.cashAmount)) {
      alert('กรุณากรอก: ชั่วโมง และยอดเงิน')
      return
    }

    try {
      const transferAmt = parseFloat(editFormData.transferAmount) || 0
      const cashAmt = parseFloat(editFormData.cashAmount) || 0
      const totalCost = transferAmt + cashAmt
      const shift = editFormData.shift || 'all'  // ใช้ค่า shift ที่ผู้ใช้เลือก
      const customerName = editFormData.customerName.trim() || 'ไม่ระบุชื่อ'

      const updatePayload = {
        customer_name: customerName,
        hours: parseFloat(editFormData.hours),
        transfer_amount: transferAmt,
        cash_amount: cashAmt,
        total_cost: totalCost,
        shift: shift,
        start_time: editFormData.startTime || null,
        description: editFormData.description || `${customerName} - ${editFormData.hours} ชม.`,
        updated_at: new Date().toISOString()
      }

      console.log('Updating computer zone entry:', { id, payload: updatePayload })

      const { data, error } = await supabase
        .from('computer_zone_history')
        .update(updatePayload)
        .eq('id', id)
        .select()

      console.log('Update result:', { data, error })

      if (error) {
        console.error('Update error details:', error)
        alert('❌ ไม่สามารถแก้ไขได้: ' + error.message)
        return
      }

      if (!data || data.length === 0) {
        alert('⚠️ ไม่พบรายการที่ต้องการแก้ไข')
        return
      }

      // Realtime จะ reload ข้อมูลอัตโนมัติ
      cancelEdit()
      alert('✅ แก้ไขรายการสำเร็จ')
    } catch (error) {
      console.error('Error updating entry:', error)
      alert('เกิดข้อผิดพลาด: ' + error.message)
    }
  }

  // Helpers for history (VIP)
  const formatDateTimeLocal = (value) => {
    if (!value) return ''
    const d = new Date(value)
    const iso = d.toISOString()
    return iso.slice(0, 16) // YYYY-MM-DDTHH:mm
  }

  const startEditHistory = (entry) => {
    setEditingHistoryId(entry.id)
    setHistoryForm({
      name: entry.name || '',
      room: entry.room || '',
      addedBy: entry.added_by || '',
      startTime: formatDateTimeLocal(entry.start_time),
      endTime: formatDateTimeLocal(entry.end_time),
      durationMinutes: entry.duration_minutes || '',
      finalCost: entry.final_cost || '',
      isPaid: !!entry.is_paid,
      endReason: entry.end_reason || 'in_progress',
      note: entry.note || ''
    })
  }

  const cancelHistoryEdit = () => {
    setEditingHistoryId(null)
    setHistoryForm({
      name: '',
      room: '',
      addedBy: '',
      startTime: '',
      endTime: '',
      durationMinutes: '',
      finalCost: '',
      isPaid: false,
      endReason: 'in_progress',
      note: ''
    })
  }

  const updateHistoryEntry = async (id) => {
    if (!historyForm.finalCost) {
      alert('กรุณากรอกค่าใช้จ่าย (final_cost)')
      return
    }

    try {
      const payload = {
        name: historyForm.name || 'ไม่ระบุ',
        room: historyForm.room || 'ไม่ระบุ',
        added_by: historyForm.addedBy || null,
        start_time: historyForm.startTime ? new Date(historyForm.startTime).toISOString() : null,
        end_time: historyForm.endTime ? new Date(historyForm.endTime).toISOString() : null,
        duration_minutes: historyForm.durationMinutes ? parseFloat(historyForm.durationMinutes) : null,
        final_cost: parseFloat(historyForm.finalCost) || 0,
        is_paid: !!historyForm.isPaid,
        end_reason: historyForm.endReason || 'completed',
        note: historyForm.note || '',
        updated_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('customers_history')
        .update(payload)
        .eq('id', id)

      if (error) throw error

      cancelHistoryEdit()
      alert('✅ แก้ไข History สำเร็จ')
    } catch (error) {
      console.error('Error updating history:', error)
      alert('เกิดข้อผิดพลาด: ' + error.message)
    }
  }

  const deleteHistoryEntry = async (id) => {
    if (!window.confirm('ต้องการลบประวัตินี้หรือไม่?')) return

    try {
      const { error } = await supabase
        .from('customers_history')
        .delete()
        .eq('id', id)

      if (error) throw error
      alert('✅ ลบ History สำเร็จ')
    } catch (error) {
      console.error('Error deleting history:', error)
      alert('เกิดข้อผิดพลาด: ' + error.message)
    }
  }

  const exportToExcel = () => {
    try {
      const data = []
      const header = ['#', 'ชื่อลูกค้า', 'ชั่วโมง', 'ยอดรายได้ (บาท)', 'เงินสด (บาท)', 'รวม (บาท)', 'เวลา', 'หมายเหตุ', 'เพิ่มโดย', 'วันที่']
      
      summaryData.computerZoneEntries.forEach((entry, index) => {
        data.push([
          index + 1,
          entry.customer_name,
          entry.hours,
          (parseFloat(entry.transfer_amount) || 0).toFixed(2),
          (parseFloat(entry.cash_amount) || 0).toFixed(2),
          (parseFloat(entry.total_cost) || 0).toFixed(2),
          entry.start_time || '-',
          entry.description || '-',
          entry.added_by,
          new Date(entry.created_at).toLocaleDateString('th-TH')
        ])
      })

      // Add summary rows
      data.push([])
      data.push(['สรุปยอด', '', '', '', '', '', '', '', '', ''])
      data.push(['Game Zone (โอน)', '', '', summaryData.gameZoneTransfer.toFixed(2), summaryData.gameZoneCash.toFixed(2), summaryData.gameZoneTotal.toFixed(2), '', '', '', ''])
      data.push(['Computer Zone (โอน)', '', '', summaryData.computerZoneTransfer.toFixed(2), summaryData.computerZoneCash.toFixed(2), summaryData.computerZoneTotal.toFixed(2), '', '', '', ''])
      data.push(['รวมทั้งสิ้น', '', '', summaryData.grandTransfer.toFixed(2), summaryData.grandCash.toFixed(2), summaryData.grandTotal.toFixed(2), '', '', '', ''])

      const ws = XLSXUtils.aoa_to_sheet([header, ...data])
      const wb = XLSXUtils.book_new()
      XLSXUtils.book_append_sheet(wb, ws, 'Daily Summary')
      
      const fileName = `daily-summary-${summaryData.date}.xlsx`
      writeFile(wb, fileName)
      alert('✅ ส่งออก Excel สำเร็จ')
    } catch (error) {
      console.error('Error exporting:', error)
      alert('เกิดข้อผิดพลาด: ' + error.message)
    }
  }

  const exportRangeToExcel = () => {
    try {
      const data = []
      const header = ['#', 'วันที่', 'ชั่วโมง', 'ค่าใช้จ่าย (บาท)', 'หมายเหตุ', 'เพิ่มโดย']
      
      rangeData.entries.forEach((entry, index) => {
        data.push([
          index + 1,
          new Date(entry.summary_date).toLocaleDateString('th-TH'),
          entry.hours,
          entry.cost,
          entry.description || '-',
          entry.added_by
        ])
      })

      // Add summary rows
      data.push([])
      data.push(['สรุปยอด (วันที่ ' + new Date(rangeData.startDate).toLocaleDateString('th-TH') + ' - ' + new Date(rangeData.endDate).toLocaleDateString('th-TH') + ')', '', '', '', '', ''])
      data.push(['ห้อง VIP', '', '', rangeData.totalGameZone.toFixed(2), '', ''])
      data.push(['Computer Zone', '', '', rangeData.totalComputerZone.toFixed(2), '', ''])
      data.push(['รวมทั้งสิ้น', '', '', rangeData.grandTotal.toFixed(2), '', ''])

      const ws = XLSXUtils.aoa_to_sheet([header, ...data])
      const wb = XLSXUtils.book_new()
      XLSXUtils.book_append_sheet(wb, ws, 'Range Summary')
      
      const fileName = `summary-${rangeData.startDate}-to-${rangeData.endDate}.xlsx`
      writeFile(wb, fileName)
      alert('✅ ส่งออก Excel สำเร็จ')
    } catch (error) {
      console.error('Error exporting:', error)
      alert('เกิดข้อผิดพลาด: ' + error.message)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-spin">⏳</div>
          <p className="text-white text-xl font-bold">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-3 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8 pt-4">
          <div className="text-left">
            <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-2xl">
              📊 สรุปยอดรายวัน
            </h1>
            <p className="text-gray-300 text-lg mt-2">
              ระบบสรุปยอดขายแบบรายวัน
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => window.history.back()}
              className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-all"
            >
              ← ย้อนกลับ
            </button>
            <button
              onClick={onLogout}
              className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-all"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setViewMode('daily')}
            className={`px-6 py-3 font-bold rounded-lg transition-all ${
              viewMode === 'daily'
                ? 'bg-blue-500 text-white shadow-lg'
                : 'bg-gray-600 text-gray-200 hover:bg-gray-700'
            }`}
          >
            📅 สรุปยอดรายวัน
          </button>
          <button
            onClick={() => setViewMode('range')}
            className={`px-6 py-3 font-bold rounded-lg transition-all ${
              viewMode === 'range'
                ? 'bg-blue-500 text-white shadow-lg'
                : 'bg-gray-600 text-gray-200 hover:bg-gray-700'
            }`}
          >
            📈 สรุปยอดช่วงวัน
          </button>
        </div>

        {/* Daily Summary View */}
        {viewMode === 'daily' && (
          <>
            {/* Date Picker and Shift Selector */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-white rounded-lg p-4 shadow-lg">
                <label className="block text-gray-700 font-bold mb-2">📅 เลือกวันที่</label>
                <input
                  type="date"
                  value={summaryData.date}
                  onChange={(e) => setSummaryData({ ...summaryData, date: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              
              <div className="bg-white rounded-lg p-4 shadow-lg">
                <label className="block text-white-700 font-bold mb-2">🔄 รายละเอียดตามกะ</label>
                <select
                  value={selectedShift}
                  onChange={(e) => setSelectedShift(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
                >
                  <option value="all">ทั้งหมด</option>
                  <option value="1">กะ 1 (10:00-19:00)</option>
                  <option value="2">กะ 2 (19:00-01:00)</option>
                  <option value="3">กะ 3 (01:00-10:00)</option>
                </select>
              </div>
            </div>

            {/* Summary Cards with Payment Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Game Zone Summary */}
              <div className="bg-gradient-to-br from-green-400 to-emerald-600 rounded-2xl p-6 shadow-2xl text-white">
                <h2 className="text-lg font-semibold mb-4 opacity-90">🎮 ห้อง VIP</h2>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between items-center">
                    <span>💸 เงินโอน:</span>
                    <span className="font-bold">฿{summaryData.gameZoneTransfer.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>💳 เงินสด:</span>
                    <span className="font-bold">฿{summaryData.gameZoneCash.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-white/30 pt-2 flex justify-between items-center">
                    <span className="font-bold">รวม:</span>
                    <span className="text-2xl font-bold">฿{summaryData.gameZoneTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Computer Zone Summary */}
              <div className="bg-gradient-to-br from-blue-400 to-cyan-600 rounded-2xl p-6 shadow-2xl text-white">
                <h2 className="text-lg font-semibold mb-4 opacity-90">💻 Computer Zone</h2>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between items-center">
                    <span>💸 เงินโอน:</span>
                    <span className="font-bold">฿{summaryData.computerZoneTransfer.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>💳 เงินสด:</span>
                    <span className="font-bold">฿{summaryData.computerZoneCash.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-white/30 pt-2 flex justify-between items-center">
                    <span className="font-bold">รวม:</span>
                    <span className="text-2xl font-bold">฿{summaryData.computerZoneTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Grand Total with Breakdown */}
            <div className="bg-gradient-to-br from-yellow-400 to-orange-600 rounded-2xl p-8 shadow-2xl text-white mb-8">
              <h2 className="text-2xl font-bold mb-6">💰 รวมทั้งสิ้น</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white/20 rounded-lg p-4">
                  <p className="text-sm opacity-90">💸 เงินโอน (Transfer)</p>
                  <p className="text-4xl font-bold">฿{summaryData.grandTransfer.toFixed(2)}</p>
                </div>
                <div className="bg-white/20 rounded-lg p-4">
                  <p className="text-sm opacity-90">💳 เงินสด (Cash)</p>
                  <p className="text-4xl font-bold">฿{summaryData.grandCash.toFixed(2)}</p>
                </div>
                <div className="bg-white/20 rounded-lg p-4 border-2 border-white">
                  <p className="text-sm opacity-90">📊 รวมทั้งหมด</p>
                  <p className="text-4xl font-bold">฿{summaryData.grandTotal.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Shift Details */}
            {selectedShift !== 'all' && shiftSummary[selectedShift] && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4 text-white">
                  🔄 รายละเอียดกะ {selectedShift} ({shifts[selectedShift]?.start}-{shifts[selectedShift]?.end})
                </h2>
                
                <div className="bg-white rounded-2xl shadow-xl p-6 border-4 border-blue-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                    {/* Computer Zone */}
                    <div className="bg-gradient-to-br from-cyan-400 to-blue-600 rounded-xl p-5 shadow-lg text-white">
                      <h3 className="text-lg font-bold mb-3">💻 Computer Zone</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>โอน:</span>
                          <span className="font-bold">฿{shiftSummary[selectedShift].computerTransfer.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>สด:</span>
                          <span className="font-bold">฿{shiftSummary[selectedShift].computerCash.toFixed(2)}</span>
                        </div>
                        <div className="border-t border-white/30 pt-2 flex justify-between font-bold text-lg">
                          <span>รวม:</span>
                          <span>฿{shiftSummary[selectedShift].computerTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Game Zone VIP */}
                    <div className="bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl p-5 shadow-lg text-white">
                      <h3 className="text-lg font-bold mb-3">🎮 ห้อง VIP</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>โอน:</span>
                          <span className="font-bold">฿{shiftSummary[selectedShift].gameZoneTransfer.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>สด:</span>
                          <span className="font-bold">฿{shiftSummary[selectedShift].gameZoneCash.toFixed(2)}</span>
                        </div>
                        <div className="border-t border-white/30 pt-2 flex justify-between font-bold text-lg">
                          <span>รวม:</span>
                          <span>฿{shiftSummary[selectedShift].gameZoneTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Total Transfer */}
                    <div className="bg-gradient-to-br from-purple-400 to-pink-600 rounded-xl p-5 shadow-lg text-white">
                      <h3 className="text-lg font-bold mb-3">💸 เงินโอน</h3>
                      <p className="text-4xl font-bold">
                        ฿{(shiftSummary[selectedShift].computerTransfer + shiftSummary[selectedShift].gameZoneTransfer).toFixed(2)}
                      </p>
                    </div>

                    {/* Total Cash + Grand Total */}
                    <div className="bg-gradient-to-br from-yellow-400 to-orange-600 rounded-xl p-5 shadow-lg text-white">
                      <h3 className="text-lg font-bold mb-3">💳 รวมยอดทั้งหมด</h3>
                      <div className="text-4xl font-bold">
                        ฿{(shiftSummary[selectedShift].computerTotal + shiftSummary[selectedShift].gameZoneTotal).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Export Button */}
            <div className="mb-6">
              <button
                onClick={exportToExcel}
                className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-3 px-6 rounded-lg transition-all shadow-lg transform hover:scale-105 active:scale-95 flex items-center gap-2"
              >
                📥 ส่งออก Excel
              </button>
            </div>

            {/* Computer Zone Details with Staff Names */}
            <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 mb-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-800">
                  💻 รายการลูกค้าคอมพิวเตอร์วันนี้
                </h2>
                <button
                  onClick={() => setShowComputerZone(!showComputerZone)}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-all"
                >
                  {showComputerZone ? '▼ ซ่อน' : '▶ แสดง'}
                </button>
              </div>
              {showComputerZone && (
              <>
                {(() => {
                  // Filter entries by selected shift
                  const filteredEntries = selectedShift === 'all' 
                    ? summaryData.computerZoneEntries 
                    : summaryData.computerZoneEntries.filter(entry => entry.shift === selectedShift)
                  
                  if (filteredEntries.length === 0) {
                    return (
                      <div className="text-center py-12 text-gray-400">
                        <div className="text-5xl mb-4">💻</div>
                        <p className="text-xl font-bold">
                          {selectedShift === 'all' 
                            ? 'ไม่มีรายการลูกค้าคอมพิวเตอร์วันนี้'
                            : `ไม่มีรายการกะ ${selectedShift} (${shifts[selectedShift]?.name})`
                          }
                        </p>
                      </div>
                    )
                  }
                  
                  // Calculate totals for filtered entries
                  const filteredTransfer = filteredEntries.reduce((sum, e) => sum + (parseFloat(e.transfer_amount) || 0), 0)
                  const filteredCash = filteredEntries.reduce((sum, e) => sum + (parseFloat(e.cash_amount) || 0), 0)
                  const filteredTotal = filteredTransfer + filteredCash
                  
                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-100 border-b-2 border-gray-300">
                            <th className="px-4 py-3 text-left text-gray-700 font-bold">#</th>
                            <th className="px-4 py-3 text-left text-gray-700 font-bold">👤 พนักงาน</th>
                            <th className="px-4 py-3 text-center text-gray-700 font-bold">🔄 กะ</th>
                            <th className="px-4 py-3 text-right text-gray-700 font-bold">💸 โอน</th>
                            <th className="px-4 py-3 text-right text-gray-700 font-bold">💳 สด</th>
                            <th className="px-4 py-3 text-right text-gray-700 font-bold">📊 รวม</th>
                            <th className="px-4 py-3 text-center text-gray-700 font-bold">🕐 เวลา</th>
                            <th className="px-4 py-3 text-center text-gray-700 font-bold">🔧 จัดการ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredEntries.map((entry, index) => {
                        const shiftColor = {
                          '1': 'bg-green-100 text-green-700',
                          '2': 'bg-orange-100 text-orange-700',
                          '3': 'bg-purple-100 text-purple-700'
                        }[entry.shift || 'all'] || 'bg-gray-100 text-gray-700'
                        
                        return (
                          <tr key={entry.id} className="border-b border-gray-200 hover:bg-blue-50 transition-colors">
                            <td className="px-4 py-3 text-gray-700 font-semibold">{index + 1}</td>
                            <td className="px-4 py-3">
                              <span className="inline-block bg-blue-200 text-blue-800 px-3 py-1 rounded-full font-bold text-xs">
                                {entry.added_by || 'ไม่ระบุ'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-block px-3 py-1 rounded-lg font-bold text-xs ${shiftColor}`}>
                                กะ {entry.shift || 'all'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-blue-600 font-bold">฿{(parseFloat(entry.transfer_amount) || 0).toFixed(2)}</td>
                            <td className="px-4 py-3 text-right text-orange-600 font-bold">฿{(parseFloat(entry.cash_amount) || 0).toFixed(2)}</td>
                            <td className="px-4 py-3 text-right text-gray-700 font-bold text-lg">฿{(parseFloat(entry.total_cost) || 0).toFixed(2)}</td>
                            <td className="px-4 py-3 text-center text-gray-600">{entry.start_time || '-'}</td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => startEditEntry(entry)}
                                className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs mr-1 font-semibold"
                                title="แก้ไข"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => deleteComputerEntry(entry.id)}
                                className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs font-semibold"
                                title="ลบ"
                              >
                                🗑️
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                          </tbody>
                        <tfoot>
                          <tr className="bg-blue-100 border-t-2 border-gray-300 font-bold text-gray-700">
                            <td colSpan="4" className="px-4 py-3">
                              รวม{selectedShift !== 'all' ? ` กะ ${selectedShift}` : 'ทั้งหมด'}
                            </td>
                            <td className="px-4 py-3 text-right text-blue-600">฿{filteredTransfer.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right text-orange-600">฿{filteredCash.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right text-lg">฿{filteredTotal.toFixed(2)}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )
                })()}
              </>
              )}
            </div>

            {/* Game Zone Details by Room */}
            {Object.keys(summaryData.gameZoneByRoom).length > 0 && (
              <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 mb-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-800">
                    🎮 รายละเอียด ห้อง VIP แต่ละห้อง
                  </h2>
                  <button
                    onClick={() => setShowVIPByRoom(!showVIPByRoom)}
                    className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg transition-all"
                  >
                    {showVIPByRoom ? '▼ ซ่อน' : '▶ แสดง'}
                  </button>
                </div>
                {showVIPByRoom && (() => {
                  // Filter VIP entries by selected shift
                  const filteredVipEntries = selectedShift === 'all'
                    ? summaryData.gameZoneEntries
                    : summaryData.gameZoneEntries.filter(entry => {
                        if (entry.start_time) {
                          const shift = getShiftFromTime(entry.start_time)
                          return shift === selectedShift
                        }
                        return false
                      })
                  
                  // Recalculate room totals from filtered entries
                  const filteredRoomData = {}
                  let filteredVipTotal = 0
                  let filteredVipTransfer = 0
                  let filteredVipCash = 0
                  
                  filteredVipEntries.forEach(record => {
                    const cost = parseFloat(record.final_cost) || 0
                    const room = record.room || 'ไม่ระบุห้อง'
                    const paymentMethod = record.payment_method || 'transfer'
                    
                    filteredVipTotal += cost
                    if (paymentMethod === 'transfer') {
                      filteredVipTransfer += cost
                    } else {
                      filteredVipCash += cost
                    }
                    
                    if (!filteredRoomData[room]) {
                      filteredRoomData[room] = { total: 0, transfer: 0, cash: 0, count: 0 }
                    }
                    filteredRoomData[room].total += cost
                    filteredRoomData[room].count += 1
                    if (paymentMethod === 'transfer') {
                      filteredRoomData[room].transfer += cost
                    } else {
                      filteredRoomData[room].cash += cost
                    }
                  })
                  
                  if (Object.keys(filteredRoomData).length === 0) {
                    return (
                      <div className="text-center py-12 text-gray-400">
                        <div className="text-5xl mb-4">🎮</div>
                        <p className="text-xl font-bold">
                          {selectedShift === 'all' 
                            ? 'ไม่มีรายการห้อง VIP วันนี้'
                            : `ไม่มีรายการกะ ${selectedShift} (${shifts[selectedShift]?.name})`
                          }
                        </p>
                      </div>
                    )
                  }
                  
                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-100 border-b-2 border-gray-300">
                            <th className="px-4 py-3 text-left text-gray-700 font-bold">🚪 ห้อง</th>
                            <th className="px-4 py-3 text-center text-gray-700 font-bold">👥 จำนวน</th>
                            <th className="px-4 py-3 text-right text-gray-700 font-bold">💸 โอน</th>
                            <th className="px-4 py-3 text-right text-gray-700 font-bold">💳 สด</th>
                            <th className="px-4 py-3 text-right text-gray-700 font-bold">💰 รวม</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(filteredRoomData).map(([room, data]) => {
                            const percentage = filteredVipTotal > 0 
                              ? ((data.total / filteredVipTotal) * 100).toFixed(1)
                              : 0
                            return (
                              <tr key={room} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3 text-gray-700 font-semibold">{room}</td>
                                <td className="px-4 py-3 text-center text-gray-700">{data.count}</td>
                                <td className="px-4 py-3 text-right text-blue-600 font-bold">฿{data.transfer.toFixed(2)}</td>
                                <td className="px-4 py-3 text-right text-orange-600 font-bold">฿{data.cash.toFixed(2)}</td>
                                <td className="px-4 py-3 text-right text-gray-700 font-bold text-lg">฿{data.total.toFixed(2)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-green-100 border-t-2 border-gray-300 font-bold text-gray-700">
                            <td className="px-4 py-3">
                              รวม{selectedShift !== 'all' ? ` กะ ${selectedShift}` : 'ทั้งหมด'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {Object.values(filteredRoomData).reduce((sum, data) => sum + data.count, 0)}
                            </td>
                            <td className="px-4 py-3 text-right text-blue-600">฿{filteredVipTransfer.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right text-orange-600">฿{filteredVipCash.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right text-lg">฿{filteredVipTotal.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right">100%</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Info Box */}
            <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4 mb-6">
              <p className="text-blue-800 font-semibold">
                💡 <strong>Tip:</strong> ตัว สรุปยอด ไม่เข้าใจตรงไหนถามลีโอได้เลยค้าบ
              </p>
            </div>
          </>
        )}

        {/* Range Summary View */}
        {viewMode === 'range' && (
          <>
            {/* Date Range Picker */}
            <div className="bg-white rounded-lg p-4 mb-6 shadow-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 font-bold mb-2">📅 วันที่เริ่มต้น</label>
                  <input
                    type="date"
                    value={rangeData.startDate}
                    onChange={(e) => setRangeData({ ...rangeData, startDate: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-2">📅 วันที่สิ้นสุด</label>
                  <input
                    type="date"
                    value={rangeData.endDate}
                    onChange={(e) => setRangeData({ ...rangeData, endDate: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Summary Cards for Range */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-gradient-to-br from-green-400 to-emerald-600 rounded-2xl p-6 shadow-2xl text-white">
                <h2 className="text-sm font-semibold mb-2 opacity-90">🎮 ห้อง VIP</h2>
                <p className="text-3xl font-bold">฿{rangeData.totalGameZone.toFixed(2)}</p>
                <p className="text-xs opacity-75 mt-1">โอน: ฿{rangeData.totalGameZoneTransfer.toFixed(2)}</p>
                <p className="text-xs opacity-75">สด: ฿{rangeData.totalGameZoneCash.toFixed(2)}</p>
              </div>

              <div className="bg-gradient-to-br from-blue-400 to-cyan-600 rounded-2xl p-6 shadow-2xl text-white">
                <h2 className="text-sm font-semibold mb-2 opacity-90">💻 Computer Zone</h2>
                <p className="text-3xl font-bold">฿{rangeData.totalComputerZone.toFixed(2)}</p>
                <p className="text-xs opacity-75 mt-1">โอน: ฿{rangeData.totalComputerZoneTransfer.toFixed(2)}</p>
                <p className="text-xs opacity-75">สด: ฿{rangeData.totalComputerZoneCash.toFixed(2)}</p>
              </div>

              <div className="bg-gradient-to-br from-purple-400 to-pink-600 rounded-2xl p-6 shadow-2xl text-white">
                <h2 className="text-sm font-semibold mb-2 opacity-90">💸 เงินโอน</h2>
                <p className="text-xs opacity-75 mt-1">โอน: ฿{rangeData.grandTransfer.toFixed(2)}</p>

                <h2 className="text-sm font-semibold mb-2 opacity-90">💳 เงินสด</h2>
                <p className="text-xs opacity-75 mt-1">สด: ฿{rangeData.grandCash.toFixed(2)}</p>
              </div>

              <div className="bg-gradient-to-br from-yellow-400 to-orange-600 rounded-2xl p-6 shadow-2xl text-white">
                <h2 className="text-sm font-semibold mb-2 opacity-90">📊 รวมทั้งหมด</h2>
                <p className="text-3xl font-bold">รวม: ฿{rangeData.grandTotal.toFixed(2)}</p>
              </div>
            </div>

            {/* Export Button for Range */}
            <div className="mb-6">
              <button
                onClick={exportRangeToExcel}
                className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-3 px-6 rounded-lg transition-all shadow-lg transform hover:scale-105 active:scale-95 flex items-center gap-2"
              >
                📥 ส่งออก Excel
              </button>
            </div>
          </>
        )}

        {/* Edit Computer Zone Entry Modal */}
        {editingEntry && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-3 z-50">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">✏️ แก้ไขรายการ</h2>
              
              <div className="space-y-3">
                {/* Customer Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">👤 ชื่อลูกค้า</label>
                  <input
                    type="text"
                    value={editFormData.customerName || ''}
                    onChange={(e) => setEditFormData({...editFormData, customerName: e.target.value})}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Hours */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">⏱️ ชั่วโมง</label>
                  <input
                    type="number"
                    step="0.5"
                    value={editFormData.hours || ''}
                    onChange={(e) => setEditFormData({...editFormData, hours: e.target.value})}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Transfer Amount */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">💸 เงินโอน</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.transferAmount || ''}
                    onChange={(e) => setEditFormData({...editFormData, transferAmount: e.target.value})}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Cash Amount */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">💳 เงินสด</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.cashAmount || ''}
                    onChange={(e) => setEditFormData({...editFormData, cashAmount: e.target.value})}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Start Time */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">🕐 เวลาเริ่ม</label>
                  <input
                    type="time"
                    value={editFormData.startTime || ''}
                    onChange={(e) => setEditFormData({...editFormData, startTime: e.target.value})}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Shift */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">🔄 กะ</label>
                  <select
                    value={editFormData.shift || 'all'}
                    onChange={(e) => setEditFormData({...editFormData, shift: e.target.value})}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="all">ไม่ระบุกะ</option>
                    <option value="1">กะ 1 (10:00-19:00)</option>
                    <option value="2">กะ 2 (19:00-01:00)</option>
                    <option value="3">กะ 3 (01:00-10:00)</option>
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">📝 หมายเหตุ</label>
                  <textarea
                    value={editFormData.description || ''}
                    onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    rows="2"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => updateComputerEntry(editingEntry)}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-all"
                >
                  ✅ บันทึก
                </button>
                <button
                  onClick={cancelEdit}
                  className="flex-1 bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition-all"
                >
                  ❌ ยกเลิก
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default DailySummaryView

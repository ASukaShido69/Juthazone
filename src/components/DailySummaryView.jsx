import { useState, useEffect, useCallback } from 'react'
import supabase from '../firebase'
import { utils as XLSXUtils, writeFile } from 'xlsx'

function DailySummaryView({ user, onLogout }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedShift, setSelectedShift] = useState('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  const [vipEntries, setVipEntries] = useState([])
  const [computerEntries, setComputerEntries] = useState([])
  const [allVipEntries, setAllVipEntries] = useState([])
  const [allComputerEntries, setAllComputerEntries] = useState([])
  
  const [summary, setSummary] = useState({
    vip: { total: 0, transfer: 0, cash: 0, count: 0 },
    computer: { total: 0, transfer: 0, cash: 0, count: 0 },
    grand: { total: 0, transfer: 0, cash: 0 }
  })

  const shifts = {
    '1': { name: 'กะเช้า', time: '10:00-19:00', color: 'bg-yellow-100 text-yellow-800' },
    '2': { name: 'กะเย็น', time: '19:00-01:00', color: 'bg-purple-100 text-purple-800' },
    '3': { name: 'กะดึก', time: '01:00-10:00', color: 'bg-blue-100 text-blue-800' }
  }

  const toBangkokDateString = (isoTs) => {
    if (!isoTs) return null
    const d = new Date(isoTs)
    if (Number.isNaN(d.getTime())) return null
    // Convert to Bangkok (+07:00) by shifting minutes
    const bangkok = new Date(d.getTime() + 7 * 60 * 60 * 1000)
    return bangkok.toISOString().split('T')[0]
  }

  const getShiftFromTime = useCallback((timeStr) => {
    if (!timeStr) return 'all'

    // Handle both HH:mm:ss and full ISO strings reliably
    let hour = null
    const asDate = new Date(timeStr)
    if (!Number.isNaN(asDate.getTime())) {
      hour = asDate.getHours()
    } else {
      const parts = timeStr.split(':')
      hour = parseInt(parts[0], 10)
    }

    if (Number.isNaN(hour) || hour === null) return 'all'
    if (hour >= 10 && hour < 19) return '1'
    if (hour >= 19 || hour < 1) return '2'
    if (hour >= 1 && hour < 10) return '3'
    return 'all'
  }, [])

  const applyShiftFilter = useCallback((vipData, computerData, shift) => {
    if (shift === 'all') {
      setVipEntries(vipData)
      setComputerEntries(computerData)
      return
    }

    const filteredVip = vipData.filter(e => (e.shift || getShiftFromTime(e.start_time)) === shift)
    const filteredComputer = computerData.filter(e => (e.shift || getShiftFromTime(e.start_time || e.created_at)) === shift)

    setVipEntries(filteredVip)
    setComputerEntries(filteredComputer)
  }, [getShiftFromTime])

  const loadData = useCallback(async () => {
    if (!supabase) return
    
    try {
      setLoading(true)
      setError(null)

      // Date range for the selected day (Bangkok local time) to avoid cross-day drift
      const dayStart = new Date(`${selectedDate}T00:00:00+07:00`).toISOString()
      const nextDay = new Date(`${selectedDate}T00:00:00+07:00`)
      nextDay.setDate(nextDay.getDate() + 1)
      const dayEnd = nextDay.toISOString()

      // Load VIP entries (session_date preferred, fallback to start_time range)
      const { data: vipData, error: vipError } = await supabase
        .from('customers_history')
        .select('*')
        .eq('session_date', selectedDate)
        .or(`start_time.gte.${dayStart},start_time.lt.${dayEnd}`)
        .neq('end_reason', 'in_progress')
        .order('start_time', { ascending: false })

      if (vipError) throw vipError

      // Load Computer Zone entries: prefer session_date match; fallback to created_at range when session_date missing
      const { data: computerData, error: computerError } = await supabase
        .from('computer_zone_history')
        .select('*')
        .or(
          `session_date.eq.${selectedDate},and(session_date.is.null,created_at.gte.${dayStart},created_at.lt.${dayEnd})`
        )
        .order('created_at', { ascending: false })

      if (computerError) throw computerError

      // Add shift/session_date detection if missing
      const processedVip = (vipData || []).map(entry => ({
        ...entry,
        shift: entry.shift || getShiftFromTime(entry.start_time)
      }))

      const processedComputer = (computerData || []).map(entry => {
        const fallbackDate = entry.session_date
          || toBangkokDateString(entry.created_at)
          || selectedDate
        return {
          ...entry,
          shift: entry.shift || getShiftFromTime(entry.start_time || entry.created_at),
          session_date: fallbackDate
        }
      })

      setAllVipEntries(processedVip)
      setAllComputerEntries(processedComputer)
      calculateSummary(processedVip, processedComputer)
      applyShiftFilter(processedVip, processedComputer, selectedShift)

    } catch (error) {
      console.error('Error loading data:', error)
      setError('❌ ไม่สามารถโหลดข้อมูลได้: ' + error.message)
    } finally {
      setLoading(false)
    }
  }, [selectedDate, selectedShift, getShiftFromTime, applyShiftFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!supabase) return

    const vipChannel = supabase
      .channel('vip_summary')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers_history' }, () => {
        loadData()
      })
      .subscribe()

    const computerChannel = supabase
      .channel('computer_summary')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'computer_zone_history' }, () => {
        loadData()
      })
      .subscribe()

    return () => {
      vipChannel.unsubscribe()
      computerChannel.unsubscribe()
    }
  }, [loadData])

  const calculateSummary = (vipData, computerData) => {
    const vipSummary = vipData.reduce((acc, entry) => {
      const cost = parseFloat(entry.final_cost) || 0
      const isTransfer = (entry.payment_method || 'transfer') === 'transfer'
      
      acc.total += cost
      acc.count += 1
      if (isTransfer) acc.transfer += cost
      else acc.cash += cost
      
      return acc
    }, { total: 0, transfer: 0, cash: 0, count: 0 })

    const computerSummary = computerData.reduce((acc, entry) => {
      const transfer = parseFloat(entry.transfer_amount) || 0
      const cash = parseFloat(entry.cash_amount) || 0
      
      acc.total += (transfer + cash)
      acc.transfer += transfer
      acc.cash += cash
      acc.count += 1
      
      return acc
    }, { total: 0, transfer: 0, cash: 0, count: 0 })

    setSummary({
      vip: vipSummary,
      computer: computerSummary,
      grand: {
        total: vipSummary.total + computerSummary.total,
        transfer: vipSummary.transfer + computerSummary.transfer,
        cash: vipSummary.cash + computerSummary.cash
      }
    })
  }

  const getFilteredData = useCallback(() => {
    return { vip: vipEntries, computer: computerEntries }
  }, [vipEntries, computerEntries])

  const getFilteredSummary = useCallback(() => {
    const vipSum = vipEntries.reduce((acc, e) => {
      const cost = parseFloat(e.final_cost) || 0
      const isTransfer = (e.payment_method || 'transfer') === 'transfer'
      acc.total += cost
      if (isTransfer) acc.transfer += cost
      else acc.cash += cost
      return acc
    }, { total: 0, transfer: 0, cash: 0 })

    const computerSum = computerEntries.reduce((acc, e) => {
      const transfer = parseFloat(e.transfer_amount) || 0
      const cash = parseFloat(e.cash_amount) || 0
      acc.total += (transfer + cash)
      acc.transfer += transfer
      acc.cash += cash
      return acc
    }, { total: 0, transfer: 0, cash: 0 })

    return {
      vip: vipSum,
      computer: computerSum,
      grand: {
        total: vipSum.total + computerSum.total,
        transfer: vipSum.transfer + computerSum.transfer,
        cash: vipSum.cash + computerSum.cash
      }
    }
  }, [vipEntries, computerEntries])

  const handleShiftChange = useCallback((shift) => {
    setSelectedShift(shift)
    applyShiftFilter(allVipEntries, allComputerEntries, shift)
  }, [allVipEntries, allComputerEntries, applyShiftFilter])

  const exportToExcel = useCallback(() => {
    const { vip, computer } = getFilteredData()
    const filtered = getFilteredSummary()

    const vipSheet = vip.map((entry, index) => ({
      'ลำดับ': index + 1,
      'ชื่อลูกค้า': entry.name || '-',
      'ห้อง': entry.room || '-',
      'เวลาเริ่ม': entry.start_time || '-',
      'เวลาสิ้นสุด': entry.end_time || '-',
      'ระยะเวลา (นาที)': entry.duration_minutes || 0,
      'ค่าใช้จ่าย': entry.final_cost || 0,
      'วิธีจ่าย': entry.payment_method === 'cash' ? 'เงินสด' : 'โอน',
      'หมายเหตุ': entry.note || '-'
    }))

    const computerSheet = computer.map((entry, index) => ({
      'ลำดับ': index + 1,
      'กะ': entry.shift ? `กะ ${entry.shift}` : 'ไม่ระบุ',
      'โอน': entry.transfer_amount || 0,
      'สด': entry.cash_amount || 0,
      'รวม': entry.total_cost || 0,
      'พนักงาน': entry.added_by || '-',
      'เวลา': entry.start_time || '-'
    }))

    const summarySheet = [
      { 'ประเภท': 'ห้อง VIP', 'โอน (฿)': filtered.vip.transfer.toFixed(2), 'สด (฿)': filtered.vip.cash.toFixed(2), 'รวม (฿)': filtered.vip.total.toFixed(2) },
      { 'ประเภท': 'Computer Zone', 'โอน (฿)': filtered.computer.transfer.toFixed(2), 'สด (฿)': filtered.computer.cash.toFixed(2), 'รวม (฿)': filtered.computer.total.toFixed(2) },
      { 'ประเภท': '=== รวมทั้งหมด ===', 'โอน (฿)': filtered.grand.transfer.toFixed(2), 'สด (฿)': filtered.grand.cash.toFixed(2), 'รวม (฿)': filtered.grand.total.toFixed(2) }
    ]

    const wb = XLSXUtils.book_new()
    XLSXUtils.book_append_sheet(wb, XLSXUtils.json_to_sheet(summarySheet), 'สรุปยอด')
    XLSXUtils.book_append_sheet(wb, XLSXUtils.json_to_sheet(vipSheet), 'ห้อง VIP')
    XLSXUtils.book_append_sheet(wb, XLSXUtils.json_to_sheet(computerSheet), 'Computer Zone')

    const fileName = `สรุปยอด_${selectedDate}${selectedShift !== 'all' ? `_กะ${selectedShift}` : ''}.xlsx`
    writeFile(wb, fileName)
    alert('✅ ส่งออก Excel สำเร็จ')
  }, [selectedDate, selectedShift, getFilteredData, getFilteredSummary])

  const displaySummary = getFilteredSummary()
  const { vip: displayVip, computer: displayComputer } = getFilteredData()

  // คำนวณยอดรวมแต่ละกะ
  const calculateShiftSummaries = useCallback(() => {
    const shiftSummaries = {
      '1': { total: 0, transfer: 0, cash: 0 },
      '2': { total: 0, transfer: 0, cash: 0 },
      '3': { total: 0, transfer: 0, cash: 0 }
    }

    // VIP entries
    allVipEntries.forEach(entry => {
      const shift = entry.shift || getShiftFromTime(entry.start_time)
      if (shift && shiftSummaries[shift]) {
        const cost = parseFloat(entry.final_cost) || 0
        const isTransfer = (entry.payment_method || 'transfer') === 'transfer'
        shiftSummaries[shift].total += cost
        if (isTransfer) shiftSummaries[shift].transfer += cost
        else shiftSummaries[shift].cash += cost
      }
    })

    // Computer entries
    allComputerEntries.forEach(entry => {
      const shift = entry.shift || getShiftFromTime(entry.start_time || entry.created_at)
      if (shift && shiftSummaries[shift]) {
        const transfer = parseFloat(entry.transfer_amount) || 0
        const cash = parseFloat(entry.cash_amount) || 0
        shiftSummaries[shift].total += (transfer + cash)
        shiftSummaries[shift].transfer += transfer
        shiftSummaries[shift].cash += cash
      }
    })

    return shiftSummaries
  }, [allVipEntries, allComputerEntries, getShiftFromTime])

  const shiftSummaries = calculateShiftSummaries()

  // คำนวณวันที่แสดงแบบภาษาไทย
  const getThaiDateDisplay = () => {
    const date = new Date(selectedDate)
    const thaiYear = date.getFullYear() + 543 - 2000 // แปลงเป็น พ.ศ. แบบ 2 หลัก
    const day = date.getDate()
    const month = date.getMonth() + 1
    return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${thaiYear}`
  }

  const getNextDayThaiDate = () => {
    const date = new Date(selectedDate)
    date.setDate(date.getDate() + 1)
    const thaiYear = date.getFullYear() + 543 - 2000
    const day = date.getDate()
    const month = date.getMonth() + 1
    return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${thaiYear}`
  }

  if (loading && allVipEntries.length === 0 && allComputerEntries.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="text-6xl mb-4">⏳</div>
          <div className="text-2xl">กำลังโหลดข้อมูล...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pt-4">
          <div>
            <h1 className="text-3xl md:text-5xl font-bold text-white drop-shadow-2xl">
              📊 สรุปยอดรายวัน
            </h1>
            <p className="text-gray-300 text-sm md:text-lg mt-2">
              วันที่ {new Date(selectedDate).toLocaleDateString('th-TH', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
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

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-xl">
            <label className="block text-gray-700 font-bold mb-2">📅 เลือกวันที่</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-lg"
            />
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-xl">
            <label className="block text-gray-700 font-bold mb-2">🔄 เลือกกะ</label>
            <select
              value={selectedShift}
              onChange={(e) => handleShiftChange(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white text-lg"
            >
              <option value="all">📊 ทั้งหมด</option>
              <option value="1">☀️ กะ 1: เช้า-เย็น (10:00-19:00)</option>
              <option value="2">🌙 กะ 2: เย็น-ดึก (19:00-01:00)</option>
              <option value="3">🌃 กะ 3: ดึก-เช้า (01:00-10:00)</option>
            </select>
          </div>
        </div>

        {/* สรุปยอดตามช่วงเวลา */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6 text-center">
            📊 สรุปรายวัน
          </h2>
          <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl p-6 mb-4">
            <p className="text-center text-lg md:text-xl font-bold text-gray-800">
              ยอดรวมเมื่อวันที่ <span className="text-purple-600">{getThaiDateDisplay()}</span> ตั้งแต่ 10:00 - 10:00 ของวันที่ <span className="text-purple-600">{getNextDayThaiDate()}</span>
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* กะ 1 */}
            <div className="bg-gradient-to-br from-yellow-100 to-orange-100 rounded-xl p-5 shadow-lg border-2 border-yellow-300">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">☀️</span>
                <h3 className="font-bold text-gray-800 text-lg">กะ 1 (เช้า-เย็น)</h3>
              </div>
              <p className="text-sm text-gray-600 mb-3">10:00 - 19:00</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">โอน:</span>
                  <span className="font-semibold text-blue-600">฿{shiftSummaries['1'].transfer.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">สด:</span>
                  <span className="font-semibold text-orange-600">฿{shiftSummaries['1'].cash.toFixed(2)}</span>
                </div>
                <div className="border-t-2 border-yellow-300 pt-2 flex justify-between">
                  <span className="font-bold text-gray-800">ยอดรวมกะ 1 =</span>
                  <span className="font-bold text-xl text-green-600">฿{shiftSummaries['1'].total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* กะ 2 */}
            <div className="bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl p-5 shadow-lg border-2 border-purple-300">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🌙</span>
                <h3 className="font-bold text-gray-800 text-lg">กะ 2 (เย็น-ดึก)</h3>
              </div>
              <p className="text-sm text-gray-600 mb-3">19:00 - 01:00</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">โอน:</span>
                  <span className="font-semibold text-blue-600">฿{shiftSummaries['2'].transfer.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">สด:</span>
                  <span className="font-semibold text-orange-600">฿{shiftSummaries['2'].cash.toFixed(2)}</span>
                </div>
                <div className="border-t-2 border-purple-300 pt-2 flex justify-between">
                  <span className="font-bold text-gray-800">ยอดรวมกะ 2 =</span>
                  <span className="font-bold text-xl text-green-600">฿{shiftSummaries['2'].total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* กะ 3 */}
            <div className="bg-gradient-to-br from-blue-100 to-cyan-100 rounded-xl p-5 shadow-lg border-2 border-blue-300">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🌃</span>
                <h3 className="font-bold text-gray-800 text-lg">กะ 3 (ดึก-เช้า)</h3>
              </div>
              <p className="text-sm text-gray-600 mb-3">01:00 - 10:00</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">โอน:</span>
                  <span className="font-semibold text-blue-600">฿{shiftSummaries['3'].transfer.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">สด:</span>
                  <span className="font-semibold text-orange-600">฿{shiftSummaries['3'].cash.toFixed(2)}</span>
                </div>
                <div className="border-t-2 border-blue-300 pt-2 flex justify-between">
                  <span className="font-bold text-gray-800">ยอดรวมกะ 3 =</span>
                  <span className="font-bold text-xl text-green-600">฿{shiftSummaries['3'].total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* รวมทั้งหมด */}
            <div className="bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl p-5 shadow-lg border-4 border-green-400">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">💰</span>
                <h3 className="font-bold text-gray-800 text-lg">รวมทั้งหมด</h3>
              </div>
              <p className="text-sm text-gray-600 mb-3">ทุกกะ (24 ชม.)</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">โอน:</span>
                  <span className="font-semibold text-blue-600">
                    ฿{(shiftSummaries['1'].transfer + shiftSummaries['2'].transfer + shiftSummaries['3'].transfer).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">สด:</span>
                  <span className="font-semibold text-orange-600">
                    ฿{(shiftSummaries['1'].cash + shiftSummaries['2'].cash + shiftSummaries['3'].cash).toFixed(2)}
                  </span>
                </div>
                <div className="border-t-4 border-green-400 pt-2 flex justify-between">
                  <span className="font-bold text-gray-800 text-lg">รวมยอดทั้งหมด =</span>
                  <span className="font-bold text-2xl text-green-600">
                    ฿{(shiftSummaries['1'].total + shiftSummaries['2'].total + shiftSummaries['3'].total).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* VIP Summary */}
          <div className="bg-gradient-to-br from-green-400 via-emerald-500 to-teal-600 rounded-2xl p-6 shadow-2xl text-white transform hover:scale-105 transition-transform">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              🎮 ห้อง VIP
              <span className="text-sm bg-white/20 px-2 py-1 rounded-full">{displayVip.length} รายการ</span>
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-white/10 rounded-lg p-3">
                <span className="font-semibold">💸 เงินโอน:</span>
                <span className="text-2xl font-bold">฿{displaySummary.vip.transfer.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center bg-white/10 rounded-lg p-3">
                <span className="font-semibold">💳 เงินสด:</span>
                <span className="text-2xl font-bold">฿{displaySummary.vip.cash.toFixed(2)}</span>
              </div>
              <div className="border-t-2 border-white/30 pt-3 flex justify-between items-center">
                <span className="text-lg font-bold">รวม:</span>
                <span className="text-3xl font-bold">฿{displaySummary.vip.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Computer Summary */}
          <div className="bg-gradient-to-br from-blue-400 via-cyan-500 to-sky-600 rounded-2xl p-6 shadow-2xl text-white transform hover:scale-105 transition-transform">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              💻 Computer Zone
              <span className="text-sm bg-white/20 px-2 py-1 rounded-full">{displayComputer.length} รายการ</span>
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-white/10 rounded-lg p-3">
                <span className="font-semibold">💸 เงินโอน:</span>
                <span className="text-2xl font-bold">฿{displaySummary.computer.transfer.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center bg-white/10 rounded-lg p-3">
                <span className="font-semibold">💳 เงินสด:</span>
                <span className="text-2xl font-bold">฿{displaySummary.computer.cash.toFixed(2)}</span>
              </div>
              <div className="border-t-2 border-white/30 pt-3 flex justify-between items-center">
                <span className="text-lg font-bold">รวม:</span>
                <span className="text-3xl font-bold">฿{displaySummary.computer.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Grand Total */}
          <div className="bg-gradient-to-br from-yellow-400 via-orange-500 to-red-600 rounded-2xl p-6 shadow-2xl text-white transform hover:scale-105 transition-transform">
            <h2 className="text-xl font-bold mb-4">💰 รวมทั้งหมด</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-white/10 rounded-lg p-3">
                <span className="font-semibold">💸 เงินโอน:</span>
                <span className="text-2xl font-bold">฿{displaySummary.grand.transfer.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center bg-white/10 rounded-lg p-3">
                <span className="font-semibold">💳 เงินสด:</span>
                <span className="text-2xl font-bold">฿{displaySummary.grand.cash.toFixed(2)}</span>
              </div>
              <div className="border-t-2 border-white/30 pt-3 flex justify-between items-center">
                <span className="text-lg font-bold">รวมทั้งสิ้น:</span>
                <span className="text-4xl font-bold">฿{displaySummary.grand.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-500 text-white rounded-xl p-4 mb-6 flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-lg font-bold hover:bg-red-600 px-3 py-1 rounded"
            >
              ✕
            </button>
          </div>
        )}

        {/* Export Button */}
        <div className="mb-6 flex gap-3">
          <button
            onClick={exportToExcel}
            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-4 px-8 rounded-xl transition-all shadow-2xl transform hover:scale-105 active:scale-95 flex items-center gap-3 text-lg"
          >
            📥 ส่งออก Excel
          </button>
          <button
            onClick={loadData}
            className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-bold py-4 px-8 rounded-xl transition-all shadow-2xl transform hover:scale-105 active:scale-95 flex items-center gap-3 text-lg"
          >
            🔄 รีโหลด
          </button>
        </div>

        {/* VIP Details Table */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 mb-6">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            🎮 รายละเอียดห้อง VIP
            <span className="text-lg bg-green-100 text-green-800 px-3 py-1 rounded-full">
              {displayVip.length} รายการ
            </span>
          </h2>
          
          {displayVip.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-6xl mb-4">🎮</div>
              <p className="text-xl font-bold">
                {selectedShift === 'all' ? 'ไม่มีข้อมูลห้อง VIP' : `ไม่มีข้อมูล${shifts[selectedShift]?.name}`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-green-100 to-emerald-100 border-b-2 border-gray-300">
                    <th className="px-4 py-3 text-left text-gray-700 font-bold">#</th>
                    <th className="px-4 py-3 text-left text-gray-700 font-bold">👤 ชื่อ</th>
                    <th className="px-4 py-3 text-left text-gray-700 font-bold">🚪 ห้อง</th>
                    <th className="px-4 py-3 text-center text-gray-700 font-bold">🔄 กะ</th>
                    <th className="px-4 py-3 text-right text-gray-700 font-bold">💰 ค่าใช้จ่าย</th>
                    <th className="px-4 py-3 text-center text-gray-700 font-bold">💳 วิธีจ่าย</th>
                  </tr>
                </thead>
                <tbody>
                  {displayVip.map((entry, index) => {
                    const shift = getShiftFromTime(entry.start_time)
                    return (
                      <tr key={entry.id} className="border-b border-gray-200 hover:bg-green-50 transition-colors">
                        <td className="px-4 py-3 text-gray-700 font-semibold">{index + 1}</td>
                        <td className="px-4 py-3 font-bold text-gray-800">{entry.name || '-'}</td>
                        <td className="px-4 py-3">
                          <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full font-semibold text-xs">
                            {entry.room || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {shift && (
                            <span className={`px-3 py-1 rounded-full font-bold text-xs ${shifts[shift].color}`}>
                              {shifts[shift].name}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-green-600 font-bold text-lg">
                            ฿{parseFloat(entry.final_cost || 0).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {entry.payment_method === 'cash' ? (
                            <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full font-bold text-xs">
                              💳 เงินสด
                            </span>
                          ) : (
                            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-bold text-xs">
                              💸 โอน
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gradient-to-r from-green-100 to-emerald-100 border-t-2 border-gray-300 font-bold">
                    <td colSpan="4" className="px-4 py-3 text-gray-800 text-lg">
                      รวม {selectedShift !== 'all' ? shifts[selectedShift].name : 'ทั้งหมด'}
                    </td>
                    <td className="px-4 py-3 text-right text-green-600 text-xl">
                      ฿{displaySummary.vip.total.toFixed(2)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Computer Zone Details Table */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 mb-6">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            💻 รายละเอียด Computer Zone
            <span className="text-lg bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
              {displayComputer.length} รายการ
            </span>
          </h2>
          
          {displayComputer.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-6xl mb-4">💻</div>
              <p className="text-xl font-bold">
                {selectedShift === 'all' ? 'ไม่มีข้อมูล Computer Zone' : `ไม่มีข้อมูล${shifts[selectedShift]?.name}`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-100 to-cyan-100 border-b-2 border-gray-300">
                    <th className="px-4 py-3 text-left text-gray-700 font-bold">#</th>
                    <th className="px-4 py-3 text-center text-gray-700 font-bold">🔄 กะ</th>
                    <th className="px-4 py-3 text-right text-gray-700 font-bold">💸 โอน</th>
                    <th className="px-4 py-3 text-right text-gray-700 font-bold">💳 สด</th>
                    <th className="px-4 py-3 text-right text-gray-700 font-bold">💰 รวม</th>
                    <th className="px-4 py-3 text-center text-gray-700 font-bold">👤 พนักงาน</th>
                  </tr>
                </thead>
                <tbody>
                  {displayComputer.map((entry, index) => (
                    <tr key={entry.id} className="border-b border-gray-200 hover:bg-blue-50 transition-colors">
                      <td className="px-4 py-3 text-gray-700 font-semibold">{index + 1}</td>
                      <td className="px-4 py-3 text-center">
                        {entry.shift ? (
                          <span className={`px-3 py-1 rounded-full font-bold text-xs ${shifts[entry.shift]?.color || 'bg-gray-100 text-gray-800'}`}>
                            กะ {entry.shift}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-blue-600 font-bold">
                        ฿{parseFloat(entry.transfer_amount || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-orange-600 font-bold">
                        ฿{parseFloat(entry.cash_amount || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-green-600 font-bold text-lg">
                          ฿{(parseFloat(entry.transfer_amount || 0) + parseFloat(entry.cash_amount || 0)).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full font-semibold text-xs">
                          {entry.added_by || 'ไม่ระบุ'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gradient-to-r from-blue-100 to-cyan-100 border-t-2 border-gray-300 font-bold">
                    <td colSpan="2" className="px-4 py-3 text-gray-800 text-lg">
                      รวม {selectedShift !== 'all' ? shifts[selectedShift].name : 'ทั้งหมด'}
                    </td>
                    <td className="px-4 py-3 text-right text-blue-600 text-lg">
                      ฿{displaySummary.computer.transfer.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-orange-600 text-lg">
                      ฿{displaySummary.computer.cash.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-green-600 text-xl">
                      ฿{displaySummary.computer.total.toFixed(2)}
                    </td>
                    <td colSpan="2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Info Footer */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 text-white shadow-2xl">
          <div className="flex items-start gap-4">
            <div className="text-4xl">💡</div>
            <div>
              <h3 className="font-bold text-xl mb-2">ข้อมูลการใช้งาน</h3>
              <ul className="space-y-1 text-sm opacity-90">
                <li>• เลือกวันที่เพื่อดูสรุปยอดประจำวัน</li>
                <li>• เลือกกะเพื่อดูรายละเอียดตามช่วงเวลาทำงาน</li>
                <li>• กดปุ่ม "ส่งออก Excel" เพื่อดาวน์โหลดรายงาน</li>
                <li>• ข้อมูลจะอัพเดทอัตโนมัติแบบ real-time</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DailySummaryView

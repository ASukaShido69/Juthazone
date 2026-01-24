import { useState, useEffect } from 'react'
import supabase from '../firebase'

function ComputerZoneEntry({ user }) {
  // Function to get current date in Thailand timezone
  const getCurrentDate = () => {
    const now = new Date()
    // Convert to Thailand timezone (UTC+7)
    const thaiTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
    return thaiTime.toISOString().split('T')[0]
  }

  const [entryData, setEntryData] = useState({
    customerName: '',
    hours: '',
    transferAmount: '',
    cashAmount: '',
    sessionDate: getCurrentDate(),
    startTime: '',
    description: '',
    shift: 'all' // เพิ่มกะที่เลือก
  })
  
  const [loading, setLoading] = useState(false)
  const [selectedShift, setSelectedShift] = useState('all')
  const [todayEntries, setTodayEntries] = useState([])
  const [loadingEntries, setLoadingEntries] = useState(true)

  // Shift configurations
  const shifts = {
    1: { name: 'เช้า-เย็น', start: '10:00', end: '19:00' },
    2: { name: 'เย็น-ดึก', start: '19:00', end: '01:00' },
    3: { name: 'ดึก-เช้า', start: '01:00', end: '10:00' }
  }

  // Load today's entries on mount and setup realtime
  useEffect(() => {
    loadTodayEntries()
    
    if (!supabase) return
    
    const channel = supabase
      .channel('computer_zone_today')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'computer_zone_history'
        },
        () => {
          loadTodayEntries()
        }
      )
      .subscribe()
    
    return () => {
      channel.unsubscribe()
    }
  }, [])

  const loadTodayEntries = async () => {
    if (!supabase) return
    
    try {
      setLoadingEntries(true)
      // Get current date in Thailand timezone
      const now = new Date()
      const thaiTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
      const today = thaiTime.toISOString().split('T')[0]
      
      const { data, error } = await supabase
        .from('computer_zone_history')
        .select('*')
        .eq('session_date', today)
        .order('start_time', { ascending: false })
      
      if (error) throw error
      setTodayEntries(data || [])
    } catch (error) {
      console.error('Error loading today entries:', error)
    } finally {
      setLoadingEntries(false)
    }
  }

  const getShiftFromTime = (timeStr) => {
    if (!timeStr) return 'all'
    const hour = parseInt(timeStr.split(':')[0])
    if (hour >= 10 && hour < 19) return '1'
    if (hour >= 19 || hour < 1) return '2'
    if (hour >= 1 && hour < 10) return '3'
    return 'all'
  }

  const getFilteredEntries = () => {
    if (selectedShift === 'all') return todayEntries
    return todayEntries.filter(entry => getShiftFromTime(entry.start_time) === selectedShift)
  }

  const deleteEntry = async (id) => {
    if (!confirm('ต้องการลบรายการนี้ใช่หรือไม่?')) return
    
    try {
      const { error } = await supabase
        .from('computer_zone_history')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      alert('✅ ลบรายการสำเร็จ')
      loadTodayEntries()
    } catch (error) {
      console.error('Error deleting entry:', error)
      alert('เกิดข้อผิดพลาด: ' + error.message)
    }
  }

  const handleInputChange = (field, value) => {
    setEntryData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const addEntry = async () => {
    if (!entryData.transferAmount && !entryData.cashAmount) {
      alert('กรุณากรอกยอดเงิน (โอนหรือเงินสด)')
      return
    }

    try {
      setLoading(true)
      const transferAmt = parseFloat(entryData.transferAmount) || 0
      const cashAmt = parseFloat(entryData.cashAmount) || 0
      const totalCost = transferAmt + cashAmt

      // ใช้ค่า default
      const hours = parseFloat(entryData.hours) || 1 // Default 1 ชั่วโมง
      const now = new Date()
      const currentTime = now.toTimeString().slice(0, 5) // HH:MM format
      const startTime = entryData.startTime || currentTime // ใช้เวลาปัจจุบันถ้าไม่กรอก

      // Use selected shift from dropdown หรือคำนวณจากเวลา
      let shift = entryData.shift
      if (shift === 'all' || !shift) {
        shift = getShiftFromTime(startTime)
      }
      
      let sessionDate = entryData.sessionDate
      
      // ⚠️ สำคัญ: ปรับวันที่สำหรับกะที่ข้ามวัน
      // รอบวันทำงาน = 10:00 - 10:00 วันถัดไป
      // - กะ 2 (19:00-01:00): ถ้าอยู่ในช่วง 00:00-00:59 ต้องนับเป็นวันก่อนหน้า
      // - กะ 3 (01:00-10:00): ต้องนับเป็นวันก่อนหน้าทั้งหมด
      
      const hourInt = parseInt(startTime.split(':')[0])
      
      if (shift === '2' && hourInt < 1) {
        // กะ 2 ในช่วง 00:00-00:59 (ข้ามวัน) → ลบ 1 วัน
        const dateObj = new Date(sessionDate + 'T00:00:00')
        dateObj.setDate(dateObj.getDate() - 1)
        sessionDate = dateObj.toISOString().split('T')[0]
      } else if (shift === '3') {
        // กะ 3 ทั้งหมด (01:00-10:00) → ลบ 1 วัน
        const dateObj = new Date(sessionDate + 'T00:00:00')
        dateObj.setDate(dateObj.getDate() - 1)
        sessionDate = dateObj.toISOString().split('T')[0]
      }
      
      // ถ้าไม่กรอกชื่อ ใช้ชื่อ default
      const customerName = entryData.customerName.trim() || 'ไม่ระบุชื่อ'

      const newEntry = {
        customer_name: customerName,
        hours: hours,
        transfer_amount: transferAmt,
        cash_amount: cashAmt,
        total_cost: totalCost,
        session_date: sessionDate, // วันที่ที่ปรับแล้ว (กะ 3 จะถูกลบ 1 วัน)
        shift: shift,
        start_time: startTime,
        description: entryData.description || `เพิ่มโดย ${user?.username || 'Unknown'}`,
        added_by: user?.username || 'Unknown',
        created_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('computer_zone_history')
        .insert([newEntry])

      if (error) throw error

      // Reset form
      setEntryData({
        customerName: '',
        hours: '',
        transferAmount: '',
        cashAmount: '',
        sessionDate: getCurrentDate(),
        startTime: '',
        description: '',
        shift: 'all'
      })
      alert('✅ เพิ่มรายการลูกค้าคอมพิวเตอร์สำเร็จ')
    } catch (error) {
      console.error('Error adding entry:', error)
      alert('เกิดข้อผิดพลาด: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl shadow-xl p-6 md:p-8 border-2 border-blue-200 mb-8">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-4xl">💻</span>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-800">เพิ่มรายการลูกค้าคอมวันนี้</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {/* Transfer Amount */}
        <div>
          <label className="block text-gray-700 font-bold mb-2">💸 เงินโอน *</label>
          <input
            type="number"
            step="0.01"
            placeholder="0"
            value={entryData.transferAmount}
            onChange={(e) => handleInputChange('transferAmount', e.target.value)}
            disabled={loading}
            className="w-full px-4 py-2 border-2 border-blue-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-gray-100"
          />
        </div>

        {/* Cash Amount */}
        <div>
          <label className="block text-gray-700 font-bold mb-2">💸 เงินสด *</label>
          <input
            type="number"
            step="0.01"
            placeholder="0"
            value={entryData.cashAmount}
            onChange={(e) => handleInputChange('cashAmount', e.target.value)}
            disabled={loading}
            className="w-full px-4 py-2 border-2 border-blue-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-gray-100"
          />
        </div>

        {/* Date */}
        <div>
          <label className="block text-gray-700 font-bold mb-2">📅 วันที่เริ่มบริการ</label>
          <input
            type="date"
            value={entryData.sessionDate}
            onChange={(e) => handleInputChange('sessionDate', e.target.value)}
            disabled={loading}
            className="w-full px-4 py-2 border-2 border-blue-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-gray-100"
          />
          <p className="text-xs text-blue-600 mt-1 font-semibold">💡 กรอกวันที่ปัจจุบันตามปกติ (กะ 2-3 ที่ข้ามวันจะปรับอัตโนมัติ)</p>
        </div>

        {/* Description */}
        <div>
          <label className="block text-gray-700 font-bold mb-2">📝 หมายเหตุ</label>
          <input
            type="text"
            placeholder="เช่น อะไรก็ได้"
            value={entryData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            disabled={loading}
            className="w-full px-4 py-2 border-2 border-blue-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-gray-100"
          />
        </div>

        {/* Shift Selector */}
        <div>
          <label className="block text-gray-700 font-bold mb-2">🔄 เลือกกะ *</label>
          <select
            value={entryData.shift}
            onChange={(e) => handleInputChange('shift', e.target.value)}
            disabled={loading}
            className="w-full px-4 py-2 border-2 border-blue-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-gray-100 bg-white"
          >
            <option value="all">ไม่ระบุกะ</option>
            <option value="1">กะ 1 (10:00-19:00)</option>
            <option value="2">กะ 2 (19:00-01:00)</option>
            <option value="3">กะ 3 (01:00-10:00)</option>
          </select>
        </div>

        {/* Total Display */}
        <div className="bg-white rounded-lg p-4 border-2 border-green-300">
          <label className="block text-gray-700 font-bold mb-2">📊 รวม</label>
          <div className="text-3xl font-bold text-green-600">
            ฿{((parseFloat(entryData.transferAmount) || 0) + (parseFloat(entryData.cashAmount) || 0)).toFixed(2)}
          </div>
        </div>
      </div>


      {/* Submit Button */}
      <div className="flex gap-4">
        <button
          onClick={addEntry}
          disabled={loading}
          className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-all shadow-lg transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed"
        >
          {loading ? '⏳ กำลังบันทึก...' : '✅ เพิ่มรายการ'}
        </button>
        <button
          onClick={() => setEntryData({
            customerName: '',
            hours: '',
            transferAmount: '',
            cashAmount: '',
            sessionDate: getCurrentDate(),
            startTime: '',
            description: '',
            shift: 'all'
          })}
          disabled={loading}
          className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-lg transition-all disabled:cursor-not-allowed"
        >
          🔄 เคลียร์
        </button>
      </div>
    </div>
  )
}

export default ComputerZoneEntry

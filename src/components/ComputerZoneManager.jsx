import { useState, useEffect } from 'react'
import supabase from '../firebase'

function ComputerZoneManager({ isOpen, onClose, user }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const [editingEntry, setEditingEntry] = useState(null)
  const [editFormData, setEditFormData] = useState({
    customerName: '',
    hours: '',
    transferAmount: '',
    cashAmount: '',
    startTime: '',
    description: '',
    shift: 'all'
  })
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    if (isOpen) {
      loadEntries()
    }
  }, [isOpen, filterDate])

  // Realtime subscription
  useEffect(() => {
    if (!supabase || !isOpen) return

    const channel = supabase
      .channel('computer_zone_manager')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'computer_zone_history'
        },
        () => {
          loadEntries()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isOpen, filterDate])

  const loadEntries = async () => {
    if (!supabase) return

    try {
      setLoading(true)
      console.log('Loading entries for date:', filterDate)

      const { data, error } = await supabase
        .from('computer_zone_history')
        .select('*')
        .eq('session_date', filterDate)
        .order('created_at', { ascending: false })

      console.log('Load entries result:', { data, error, count: data?.length })

      if (error) {
        console.error('Load entries error:', error)
        alert('⚠️ ไม่สามารถโหลดข้อมูลได้: ' + error.message)
        return
      }

      setEntries(data || [])
    } catch (error) {
      console.error('Error loading entries:', error)
      alert('เกิดข้อผิดพลาด: ' + error.message)
    } finally {
      setLoading(false)
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

  const updateEntry = async (id) => {
    if (!editFormData.transferAmount && !editFormData.cashAmount) {
      alert('กรุณากรอกยอดเงิน')
      return
    }

    try {
      const transferAmt = parseFloat(editFormData.transferAmount) || 0
      const cashAmt = parseFloat(editFormData.cashAmount) || 0
      const totalCost = transferAmt + cashAmt
      const hours = parseFloat(editFormData.hours) || 1

      // Use selected shift from dropdown
      const shift = editFormData.shift || 'all'

      const customerName = editFormData.customerName.trim() || 'ไม่ระบุชื่อ'

      console.log('Updating entry:', {
        id,
        customer_name: customerName,
        hours: hours,
        transfer_amount: transferAmt,
        cash_amount: cashAmt,
        total_cost: totalCost,
        shift: shift
      })

      // ลองตรวจสอบว่ารายการมีอยู่จริง
      const { data: existingEntry } = await supabase
        .from('computer_zone_history')
        .select('*')
        .eq('id', id)
        .single()

      console.log('Existing entry check:', existingEntry)

      if (!existingEntry) {
        alert('⚠️ ไม่พบรายการที่ต้องการแก้ไข กรุณาลองรีเฟรชหน้าใหม่')
        return
      }

      const { data, error } = await supabase
        .from('computer_zone_history')
        .update({
          customer_name: customerName,
          hours: hours,
          transfer_amount: transferAmt,
          cash_amount: cashAmt,
          total_cost: totalCost,
          shift: shift,
          start_time: editFormData.startTime || null,
          description: editFormData.description || `${customerName} - ${hours} ชม.`,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()

      console.log('Update result:', { data, error })

      if (error) {
        console.error('Update error details:', error)
        alert('❌ ไม่สามารถแก้ไขได้: ' + error.message)
        return
      }

      // ถ้า update สำเร็จแต่ไม่มี data ส่งกลับมา ให้ถือว่าสำเร็จ
      cancelEdit()
      await loadEntries() // โหลด entries ใหม่หลังแก้สำเร็จ
      alert('✅ แก้ไขสำเร็จ')
    } catch (error) {
      console.error('Error updating entry:', error)
      alert('เกิดข้อผิดพลาด: ' + error.message)
    }
  }

  const deleteEntry = async (id) => {
    if (!window.confirm('ต้องการลบรายการนี้หรือไม่?')) return

    try {
      console.log('Deleting entry with id:', id)

      // ตรวจสอบว่ารายการมีอยู่จริง
      const { data: existingEntry } = await supabase
        .from('computer_zone_history')
        .select('*')
        .eq('id', id)
        .single()

      console.log('Existing entry before delete:', existingEntry)

      if (!existingEntry) {
        alert('⚠️ ไม่พบรายการที่ต้องการลบ กรุณาลองรีเฟรชหน้าใหม่')
        return
      }

      const { error } = await supabase
        .from('computer_zone_history')
        .delete()
        .eq('id', id)

      console.log('Delete result:', { error })

      if (error) {
        console.error('Delete error details:', error)
        alert('❌ ไม่สามารถลบได้: ' + error.message)
        return
      }

      await loadEntries() // โหลด entries ใหม่หลังลบสำเร็จ
      alert('✅ ลบสำเร็จ')
    } catch (error) {
      console.error('Error deleting entry:', error)
      alert('เกิดข้อผิดพลาด: ' + error.message)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-cyan-600 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white">📋 จัดการรายการ Computer Zone</h2>
            <p className="text-blue-100 mt-1">จัดการข้อมูลลูกค้า Computer Zone</p>
          </div>
          <button
            onClick={onClose}
            className="bg-white/20 hover:bg-white/30 text-white font-bold py-2 px-4 rounded-lg transition-all"
          >
            ✖ ปิด
          </button>
        </div>

        {/* Filter */}
        <div className="p-4 bg-gray-50 border-b">
          <div className="flex items-center gap-4">
            <label className="font-bold text-gray-700">📅 เลือกวันที่:</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
            <span className="text-gray-600">รายการทั้งหมด: {entries.length}</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              <p className="text-gray-600 mt-4">กำลังโหลด...</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 text-lg">ไม่มีรายการในวันที่เลือก</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100 border-b-2 border-gray-300">
                    <th className="px-4 py-3 text-left text-gray-700 font-bold">#</th>
                    <th className="px-4 py-3 text-center text-gray-700 font-bold">👤 พนักงาน</th>
                    <th className="px-4 py-3 text-center text-gray-700 font-bold">🔄 กะ</th>
                    <th className="px-4 py-3 text-right text-gray-700 font-bold">💸 โอน</th>
                    <th className="px-4 py-3 text-right text-gray-700 font-bold">💳 สด</th>
                    <th className="px-4 py-3 text-right text-gray-700 font-bold">💰 รวม</th>
                    <th className="px-4 py-3 text-center text-gray-700 font-bold">🕐 เวลา</th>
                    <th className="px-4 py-3 text-left text-gray-700 font-bold">📝 หมายเหตุ</th>
                    <th className="px-4 py-3 text-center text-gray-700 font-bold">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, index) => (
                    <tr key={entry.id} className="border-b border-gray-200 hover:bg-gray-50">
                      {editingEntry === entry.id ? (
                        <>
                          <td className="px-4 py-3 text-gray-700 font-semibold">{index + 1}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-block bg-blue-200 text-blue-800 px-2 py-1 rounded-full font-bold text-xs">
                              {entry.added_by || 'ไม่ระบุ'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={editFormData.shift}
                              onChange={(e) => setEditFormData({...editFormData, shift: e.target.value})}
                              className="w-full px-2 py-1 border rounded text-xs"
                            >
                              <option value="all">ไม่ระบุ</option>
                              <option value="1">กะ 1 (10:00-19:00)</option>
                              <option value="2">กะ 2 (19:00-01:00)</option>
                              <option value="3">กะ 3 (01:00-10:00)</option>
                            </select>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <input
                              type="number"
                              step="0.01"
                              value={editFormData.transferAmount}
                              onChange={(e) => setEditFormData({...editFormData, transferAmount: e.target.value})}
                              className="w-24 px-2 py-1 border rounded text-right"
                              placeholder="0.00"
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <input
                              type="number"
                              step="0.01"
                              value={editFormData.cashAmount}
                              onChange={(e) => setEditFormData({...editFormData, cashAmount: e.target.value})}
                              className="w-24 px-2 py-1 border rounded text-right"
                              placeholder="0.00"
                            />
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700 font-bold">
                            ฿{((parseFloat(editFormData.transferAmount) || 0) + (parseFloat(editFormData.cashAmount) || 0)).toFixed(2)}
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="time"
                              value={editFormData.startTime}
                              onChange={(e) => setEditFormData({...editFormData, startTime: e.target.value})}
                              className="w-full px-2 py-1 border rounded text-xs"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={editFormData.description}
                              onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
                              className="w-full px-2 py-1 border rounded text-xs"
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex gap-1 justify-center">
                              <button
                                onClick={() => updateEntry(entry.id)}
                                className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs font-semibold"
                              >
                                💾
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="bg-gray-400 hover:bg-gray-500 text-white px-2 py-1 rounded text-xs font-semibold"
                              >
                                ✖️
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-gray-700 font-semibold">{index + 1}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-block bg-blue-200 text-blue-800 px-2 py-1 rounded-full font-bold text-xs">
                              {entry.added_by || 'ไม่ระบุ'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-2 py-1 rounded-lg font-bold text-xs ${
                              entry.shift === '1' ? 'bg-green-100 text-green-700' :
                              entry.shift === '2' ? 'bg-orange-100 text-orange-700' :
                              entry.shift === '3' ? 'bg-purple-100 text-purple-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {entry.shift === 'all' ? 'ไม่ระบุ' : `กะ ${entry.shift}`}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-blue-600 font-bold">฿{(parseFloat(entry.transfer_amount) || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-orange-600 font-bold">฿{(parseFloat(entry.cash_amount) || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-gray-700 font-bold">฿{(parseFloat(entry.total_cost) || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-center text-gray-600 text-xs">{entry.start_time || '-'}</td>
                          <td className="px-4 py-3 text-gray-700 text-xs">{entry.description || '-'}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex gap-1 justify-center">
                              <button
                                onClick={() => startEditEntry(entry)}
                                className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs font-semibold"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => deleteEntry(entry.id)}
                                className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs font-semibold"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </>
                      )}
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

export default ComputerZoneManager

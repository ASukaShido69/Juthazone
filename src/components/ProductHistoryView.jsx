import { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import supabase from '../firebase'
import { formatDateTimeThai } from '../utils/timeFormat'
import { useTheme } from '../contexts/ThemeContext'
import ThemePicker from './ThemePicker'

function ProductHistoryView() {
  const { setActiveZone } = useTheme()

  // ═══ State ═══
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filterProduct, setFilterProduct] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)

  // Edit modal state
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({})
  const [originalSnapshot, setOriginalSnapshot] = useState({})
  const [showEditModal, setShowEditModal] = useState(false)

  const ITEMS_PER_PAGE = 50
  const debounceRef = useRef(null)

  // ═══ Init ═══
  useEffect(() => {
    setActiveZone('blue')
    fetchHistory()
  }, [])

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      setCurrentPage(1)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchTerm])

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1) }, [dateFrom, dateTo, filterProduct])

  // ═══ Fetch ═══
  const fetchHistory = async () => {
    if (!supabase) { setLoading(false); return }
    try {
      const { data, error } = await supabase
        .from('historyforproduct')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setHistory(data || [])
    } catch (err) {
      console.error('Error fetching product history:', err)
      alert('ไม่สามารถโหลดประวัติการขายสินค้าได้: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // ═══ Unique product names for filter dropdown ═══
  const productNames = useMemo(() => {
    const names = [...new Set(history.map(h => h.product_name).filter(Boolean))]
    return names.sort((a, b) => a.localeCompare(b, 'th'))
  }, [history])

  // ═══ Filtered & paginated data ═══
  const filteredHistory = useMemo(() => {
    let filtered = history
    if (debouncedSearch) {
      const term = debouncedSearch.toLowerCase()
      filtered = filtered.filter(h => h.product_name?.toLowerCase().includes(term))
    }
    if (filterProduct !== 'all') {
      filtered = filtered.filter(h => h.product_name === filterProduct)
    }
    if (dateFrom) {
      const from = new Date(dateFrom)
      filtered = filtered.filter(h => new Date(h.created_at) >= from)
    }
    if (dateTo) {
      const end = new Date(dateTo)
      end.setHours(23, 59, 59)
      filtered = filtered.filter(h => new Date(h.created_at) <= end)
    }
    return filtered
  }, [history, debouncedSearch, filterProduct, dateFrom, dateTo])

  const totalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE)
  const paginatedHistory = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredHistory.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredHistory, currentPage])

  // ═══ Summary stats ═══
  const totalRevenue = useMemo(() =>
    filteredHistory.reduce((sum, h) => sum + (Number(h.total_price) || 0), 0)
  , [filteredHistory])

  const totalQty = useMemo(() =>
    filteredHistory.reduce((sum, h) => sum + (Number(h.quantity) || 0), 0)
  , [filteredHistory])

  // ═══ Delete ═══
  const deleteRecord = async (id) => {
    if (!confirm('ต้องการลบรายการขายนี้ใช่หรือไม่?\n\nข้อมูลจะถูกลบถาวร!')) return
    try {
      const { error } = await supabase
        .from('historyforproduct')
        .delete()
        .eq('id', id)
      if (error) throw error
      alert('✅ ลบรายการขายสำเร็จ')
      fetchHistory()
    } catch (err) {
      console.error('Delete product history error:', err)
      alert('❌ ไม่สามารถลบได้: ' + err.message)
    }
  }

  // ═══ Start Edit ═══
  const startEdit = async (record) => {
    if (!supabase) return
    try {
      const { data, error } = await supabase
        .from('historyforproduct')
        .select('*')
        .eq('id', record.id)
        .single()
      if (error) throw error

      setOriginalSnapshot(prev => ({ ...prev, [record.id]: data }))
      setEditData(prev => ({
        ...prev,
        [record.id]: {
          ...data,
          created_at: data.created_at ? new Date(data.created_at).toISOString().slice(0, 16) : ''
        }
      }))
      setEditingId(record.id)
      setShowEditModal(true)
    } catch (err) {
      console.error('Error fetching record for edit:', err)
      alert('ไม่สามารถโหลดข้อมูลได้: ' + err.message)
    }
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditData({})
    setShowEditModal(false)
  }

  // ═══ Save Edit ═══
  const updateRecord = async (id) => {
    const data = editData[id]
    const original = originalSnapshot[id]
    if (!data || !original) {
      alert('❌ เกิดข้อผิดพลาด: ไม่พบข้อมูลต้นฉบับ กรุณาลองใหม่')
      return
    }

    try {
      const payload = {
        product_name: data.product_name || original.product_name || 'ไม่ระบุ',
        quantity: data.quantity !== '' ? Number(data.quantity) : original.quantity,
        product_price: data.product_price !== '' ? Number(data.product_price) : original.product_price,
        total_price: data.total_price !== '' ? Number(data.total_price) : original.total_price,
        created_at: data.created_at ? new Date(data.created_at).toISOString() : original.created_at,
        added_by: data.added_by ?? original.added_by ?? '',
        note: data.note ?? original.note ?? ''
      }

      // Build change list
      const changes = []
      if (original.product_name !== payload.product_name)
        changes.push(`📦 สินค้า: "${original.product_name}" → "${payload.product_name}"`)
      if (Number(original.quantity) !== payload.quantity)
        changes.push(`🔢 จำนวน: ${original.quantity} → ${payload.quantity}`)
      if (Number(original.product_price) !== payload.product_price)
        changes.push(`💵 ราคา/ชิ้น: ฿${original.product_price} → ฿${payload.product_price}`)
      if (Number(original.total_price) !== payload.total_price)
        changes.push(`💰 รวม: ฿${original.total_price} → ฿${payload.total_price}`)
      if (formatDateTimeThai(original.created_at) !== formatDateTimeThai(payload.created_at))
        changes.push(`🕐 เวลา: ${formatDateTimeThai(original.created_at)} → ${formatDateTimeThai(payload.created_at)}`)
      if ((original.added_by || '') !== (payload.added_by || ''))
        changes.push(`👤 พนักงาน: "${original.added_by || '(ไม่ระบุ)'}" → "${payload.added_by || '(ไม่ระบุ)'}"`)
      if ((original.note || '') !== (payload.note || ''))
        changes.push(`📝 หมายเหตุ: "${original.note || '(ไม่มี)'}" → "${payload.note || '(ไม่มี)'}"`)

      let confirmMessage = '🔍 รายละเอียดการเปลี่ยนแปลง\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n'
      if (changes.length === 0) {
        confirmMessage += '⚠️ ไม่มีการเปลี่ยนแปลงใดๆ\n\nคุณต้องการบันทึกต่อหรือไม่?'
      } else {
        confirmMessage += `พบการเปลี่ยนแปลง ${changes.length} รายการ:\n\n`
        changes.forEach((c, i) => { confirmMessage += `${i + 1}. ${c}\n` })
        confirmMessage += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ ยืนยันการบันทึกหรือไม่?'
      }
      if (!window.confirm(confirmMessage)) return

      const { data: result, error } = await supabase
        .from('historyforproduct')
        .update(payload)
        .eq('id', id)
        .select()
      if (error) throw error

      if (!result || result.length === 0) {
        alert('⚠️ ไม่พบรายการที่ต้องการแก้ไข')
        return
      }

      await fetchHistory()
      setEditingId(null)
      setEditData({})
      setOriginalSnapshot(prev => ({ ...prev, [id]: result?.[0] || null }))
      setShowEditModal(false)
      alert('✅ อัพเดทข้อมูลสำเร็จ')
    } catch (err) {
      console.error('Error updating record:', err)
      alert('ไม่สามารถอัพเดทข้อมูลได้: ' + err.message)
    }
  }

  // ═══ Export Excel ═══
  const handleExport = async () => {
    const exportData = filteredHistory.map((h, i) => ({
      'ลำดับที่': i + 1,
      'เวลา': formatDateTimeThai(h.created_at),
      'สินค้า': h.product_name,
      'จำนวน': h.quantity,
      'ราคา/ชิ้น': h.product_price,
      'รวม': h.total_price,
      'พนักงาน': h.added_by || '-',
      'หมายเหตุ': h.note || '-'
    }))
    try {
      const { default: XLSX } = await import('xlsx')
      const ws = XLSX.utils.json_to_sheet(exportData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'รายงาน')
      const ts = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(wb, `ProductHistory-${ts}.xlsx`)
      alert('✅ ส่งออก Excel สำเร็จ')
    } catch (err) {
      console.error('Excel export error:', err)
      alert('❌ เกิดข้อผิดพลาดในการส่งออก')
    }
  }

  const clearFilters = () => {
    setSearchTerm('')
    setFilterProduct('all')
    setDateFrom('')
    setDateTo('')
  }

  // ═══ Loading Screen ═══
  if (loading) {
    return (
      <div className="min-h-screen jz-bg flex items-center justify-center">
        <div className="text-center fade-in">
          <div className="text-6xl mb-4 animate-spin">⏳</div>
          <p className="text-white text-xl font-bold">กำลังโหลดประวัติสินค้า...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen jz-bg p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">

        {/* ══════════════════════════════════════════
            HEADER
        ══════════════════════════════════════════ */}
        <div className="text-center mb-6 slide-up">
          <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-2xl mb-2">
            📦 ประวัติการขายสินค้า
          </h1>
          <p className="text-lg md:text-xl text-white/90 drop-shadow-lg">
            รายงานการขายสินค้าทั้งหมด
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

        {/* ══════════════════════════════════════════
            SUMMARY STATS
        ══════════════════════════════════════════ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 slide-up-1">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-card p-4 border jz-card-border text-center">
            <div className="text-3xl font-bold jz-text-gradient">{filteredHistory.length}</div>
            <div className="text-sm text-gray-600 font-semibold mt-1">🧾 รายการทั้งหมด</div>
          </div>
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-card p-4 border jz-card-border text-center">
            <div className="text-3xl font-bold jz-text-gradient">{totalQty.toLocaleString()}</div>
            <div className="text-sm text-gray-600 font-semibold mt-1">📦 จำนวนสินค้ารวม</div>
          </div>
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-card p-4 border jz-card-border text-center">
            <div className="text-3xl font-bold jz-text-gradient">฿{totalRevenue.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</div>
            <div className="text-sm text-gray-600 font-semibold mt-1">💰 ยอดขายรวม</div>
          </div>
        </div>

        {/* ══════════════════════════════════════════
            FILTERS
        ══════════════════════════════════════════ */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-card p-4 md:p-6 mb-6 border jz-card-border slide-up-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl md:text-2xl font-bold jz-text-gradient">🔍 ค้นหาและกรอง</h2>
            <button
              onClick={clearFilters}
              className="text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg font-semibold transition-all"
            >
              🔄 ล้างตัวกรอง
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block text-gray-700 font-semibold mb-2 text-sm">ค้นหาสินค้า</label>
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="🔍 พิมพ์ชื่อสินค้า..."
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 transition-colors text-sm"
              />
            </div>

            {/* Filter by product name */}
            <div>
              <label className="block text-gray-700 font-semibold mb-2 text-sm">สินค้า</label>
              <select
                value={filterProduct}
                onChange={e => setFilterProduct(e.target.value)}
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 transition-colors text-sm bg-white"
              >
                <option value="all">📦 ทั้งหมด</option>
                {productNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div>
              <label className="block text-gray-700 font-semibold mb-2 text-sm">ตั้งแต่วันที่</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 transition-colors text-sm"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-gray-700 font-semibold mb-2 text-sm">ถึงวันที่</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 transition-colors text-sm"
              />
            </div>
          </div>

          {/* Export */}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={handleExport}
              className="px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold shadow transition-all transform hover:scale-105 active:scale-95 text-sm"
            >
              📊 Export Excel
            </button>
            <span className="flex items-center text-sm text-gray-500 font-medium">
              พบ <span className="mx-1 font-bold jz-text-gradient">{filteredHistory.length}</span> รายการ
            </span>
          </div>
        </div>

        {/* ══════════════════════════════════════════
            TABLE
        ══════════════════════════════════════════ */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-card border jz-card-border overflow-hidden slide-up-2">
          {paginatedHistory.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-gray-400 text-xl font-semibold">ไม่พบประวัติการขาย</p>
              <p className="text-gray-400 text-sm mt-2">ลองเปลี่ยนตัวกรองหรือล้างการค้นหา</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="jz-badge text-white">
                    <th className="px-4 py-3 text-center text-sm font-bold">#</th>
                    <th className="px-4 py-3 text-left text-sm font-bold">🕐 เวลา</th>
                    <th className="px-4 py-3 text-left text-sm font-bold">📦 สินค้า</th>
                    <th className="px-4 py-3 text-center text-sm font-bold">🔢 จำนวน</th>
                    <th className="px-4 py-3 text-center text-sm font-bold">💵 ราคา/ชิ้น</th>
                    <th className="px-4 py-3 text-center text-sm font-bold">💰 รวม</th>
                    <th className="px-4 py-3 text-center text-sm font-bold">👤 พนักงาน</th>
                    <th className="px-4 py-3 text-center text-sm font-bold">📝 หมายเหตุ</th>
                    <th className="px-4 py-3 text-center text-sm font-bold">⚙️ จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedHistory.map((h, i) => (
                    <tr
                      key={h.id}
                      className="border-b border-gray-100 hover:bg-blue-50/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-center text-sm text-gray-500 font-medium">
                        {(currentPage - 1) * ITEMS_PER_PAGE + i + 1}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {formatDateTimeThai(h.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-gray-800">{h.product_name}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-bold">
                          {h.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                        ฿{Number(h.product_price).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-bold text-green-600">
                          ฿{Number(h.total_price).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600 font-medium">
                        {h.added_by || '-'}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-500">
                        {h.note || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col gap-1 items-center">
                          <button
                            onClick={() => startEdit(h)}
                            className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold text-xs shadow transform hover:scale-105 active:scale-95 transition-all w-full"
                          >
                            ✏️ แก้ไข
                          </button>
                          <button
                            onClick={() => deleteRecord(h.id)}
                            className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold text-xs shadow transform hover:scale-105 active:scale-95 transition-all w-full"
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

          {/* ══ Pagination ══ */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-gray-200">
              <div className="text-sm text-gray-600 font-medium">
                แสดง {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredHistory.length)} จาก {filteredHistory.length} รายการ
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${currentPage === 1 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'jz-badge text-white hover:opacity-80'}`}
                >≪</button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${currentPage === 1 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'jz-badge text-white hover:opacity-80'}`}
                >‹</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let page
                  if (totalPages <= 5) page = i + 1
                  else if (currentPage <= 3) page = i + 1
                  else if (currentPage >= totalPages - 2) page = totalPages - 4 + i
                  else page = currentPage - 2 + i
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${currentPage === page ? 'jz-btn jz-glow' : 'bg-gray-100 text-gray-700 hover:opacity-80'}`}
                    >{page}</button>
                  )
                })}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${currentPage === totalPages ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'jz-badge text-white hover:opacity-80'}`}
                >›</button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${currentPage === totalPages ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'jz-badge text-white hover:opacity-80'}`}
                >≫</button>
              </div>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════
            EDIT MODAL
        ══════════════════════════════════════════ */}
        {showEditModal && editingId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div
              className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 max-w-3xl w-full border-4 my-auto modal-in"
              style={{ borderColor: 'var(--jz-primary)' }}
            >
              {/* Modal Header */}
              <div
                className="flex justify-between items-center mb-6 pb-4 border-b-2"
                style={{ borderColor: 'var(--jz-primary-light)' }}
              >
                <h2 className="text-2xl md:text-3xl font-bold jz-text-primary">
                  ✏️ แก้ไขรายการขายสินค้า
                </h2>
                <button
                  onClick={cancelEdit}
                  className="text-2xl text-gray-500 hover:text-gray-700 font-bold leading-none"
                >✕</button>
              </div>

              {/* Modal Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 max-h-[60vh] overflow-y-auto pr-1">

                {/* ชื่อสินค้า */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">📦 ชื่อสินค้า</label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editData[editingId]?.product_name ?? ''}
                      onChange={e => setEditData({ ...editData, [editingId]: { ...editData[editingId], product_name: e.target.value } })}
                      className="w-full px-4 py-2 border-2 border-blue-300 rounded-lg text-base font-semibold focus:outline-none focus:border-blue-600"
                      placeholder="ชื่อสินค้า"
                    />
                    <div className="text-xs text-gray-500 italic bg-gray-100 p-2 rounded">
                      💾 ต้นฉบับ: {originalSnapshot[editingId]?.product_name || '-'}
                    </div>
                  </div>
                </div>

                {/* จำนวน */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">🔢 จำนวน</label>
                  <div className="space-y-2">
                    <input
                      type="number"
                      value={editData[editingId]?.quantity ?? ''}
                      onChange={e => setEditData({ ...editData, [editingId]: { ...editData[editingId], quantity: e.target.value } })}
                      className="w-full px-4 py-2 border-2 border-blue-300 rounded-lg text-base focus:outline-none focus:border-blue-600"
                      min="0"
                      step="1"
                    />
                    <div className="text-xs text-gray-500 italic bg-gray-100 p-2 rounded">
                      💾 ต้นฉบับ: {originalSnapshot[editingId]?.quantity}
                    </div>
                  </div>
                </div>

                {/* ราคา/ชิ้น */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">💵 ราคา/ชิ้น (฿)</label>
                  <div className="space-y-2">
                    <input
                      type="number"
                      value={editData[editingId]?.product_price ?? ''}
                      onChange={e => setEditData({ ...editData, [editingId]: { ...editData[editingId], product_price: e.target.value } })}
                      className="w-full px-4 py-2 border-2 border-blue-300 rounded-lg text-base font-bold focus:outline-none focus:border-blue-600"
                      step="0.01"
                      min="0"
                    />
                    <div className="text-xs text-gray-500 italic bg-gray-100 p-2 rounded">
                      💾 ต้นฉบับ: ฿{originalSnapshot[editingId]?.product_price}
                    </div>
                  </div>
                </div>

                {/* ราคารวม */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">💰 ราคารวม (฿)</label>
                  <div className="space-y-2">
                    <input
                      type="number"
                      value={editData[editingId]?.total_price ?? ''}
                      onChange={e => setEditData({ ...editData, [editingId]: { ...editData[editingId], total_price: e.target.value } })}
                      className="w-full px-4 py-2 border-2 border-green-300 rounded-lg text-base font-bold focus:outline-none focus:border-green-600"
                      step="0.01"
                      min="0"
                    />
                    <div className="text-xs text-gray-500 italic bg-gray-100 p-2 rounded">
                      💾 ต้นฉบับ: ฿{originalSnapshot[editingId]?.total_price}
                    </div>
                  </div>
                </div>

                {/* เวลา */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">🕐 วันเวลาที่ขาย</label>
                  <div className="space-y-2">
                    <input
                      type="datetime-local"
                      value={editData[editingId]?.created_at ?? ''}
                      onChange={e => setEditData({ ...editData, [editingId]: { ...editData[editingId], created_at: e.target.value } })}
                      className="w-full px-4 py-2 border-2 border-green-300 rounded-lg text-base focus:outline-none focus:border-green-600"
                    />
                    <div className="text-xs text-gray-500 italic bg-gray-100 p-2 rounded">
                      💾 ต้นฉบับ: {formatDateTimeThai(originalSnapshot[editingId]?.created_at) || '-'}
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
                      onChange={e => setEditData({ ...editData, [editingId]: { ...editData[editingId], added_by: e.target.value } })}
                      className="w-full px-4 py-2 border-2 border-cyan-300 rounded-lg text-base focus:outline-none focus:border-cyan-600"
                      placeholder="ชื่อพนักงาน"
                    />
                    <div className="text-xs text-gray-500 italic bg-gray-100 p-2 rounded">
                      💾 ต้นฉบับ: {originalSnapshot[editingId]?.added_by || '(ไม่ระบุ)'}
                    </div>
                  </div>
                </div>

                {/* หมายเหตุ */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">📝 หมายเหตุ</label>
                  <div className="space-y-2">
                    <textarea
                      value={editData[editingId]?.note ?? ''}
                      onChange={e => setEditData({ ...editData, [editingId]: { ...editData[editingId], note: e.target.value } })}
                      className="w-full px-4 py-2 border-2 border-blue-300 rounded-lg text-base focus:outline-none focus:border-blue-600"
                      placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
                      rows="3"
                    />
                    <div className="text-xs text-gray-500 italic bg-gray-100 p-2 rounded">
                      💾 ต้นฉบับ: {originalSnapshot[editingId]?.note || '(ไม่มี)'}
                    </div>
                  </div>
                </div>

              </div>

              {/* Modal Buttons */}
              <div className="flex gap-3 justify-center pt-6 border-t-2 border-blue-300">
                <button
                  onClick={() => updateRecord(editingId)}
                  className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg text-lg font-bold shadow-lg transform hover:scale-105 active:scale-95 transition-all"
                >
                  💾 บันทึก
                </button>
                <button
                  onClick={cancelEdit}
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

export default ProductHistoryView

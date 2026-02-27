import { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import supabase from '../firebase'
import { formatDateTimeThai } from '../utils/timeFormat'
import { useTheme } from '../contexts/ThemeContext'
import ThemePicker from './ThemePicker'

function ProductHistoryView() {
  const { setActiveZone } = useTheme()
  const [history, setHistory] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const ITEMS_PER_PAGE = 50
  const debounceRef = useRef(null)

  useEffect(() => {
    setActiveZone('blue')
    fetchHistory()
  }, [])

  // debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      setCurrentPage(1)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchTerm])

  const fetchHistory = async () => {
    if (!supabase) {
      setLoading(false)
      return
    }
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

  const filteredHistory = useMemo(() => {
    let filtered = history
    if (debouncedSearch) {
      const term = debouncedSearch.toLowerCase()
      filtered = filtered.filter(h => h.product_name.toLowerCase().includes(term))
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
  }, [history, debouncedSearch, dateFrom, dateTo])

  useEffect(() => { setCurrentPage(1) }, [dateFrom, dateTo])

  const totalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE)
  const paginatedHistory = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredHistory.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredHistory, currentPage])

  const handleExport = async () => {
    const exportData = filteredHistory.map((h, i) => ({
      'ลำดับที่': i + 1,
      'เวลา': formatDateTimeThai(h.created_at),
      'สินค้า': h.product_name,
      'จำนวน': h.quantity,
      'ราคา/ชิ้น': h.product_price,
      'รวม': h.total_price
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

  const deleteRecord = async (id) => {
    if (!confirm('ต้องการลบรายการขายนี้ใช่หรือไม่?')) return
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

  return (
    <div className="min-h-screen jz-bg p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-white">📦 ประวัติการขายสินค้า</h1>
        </div>
        <div className="mb-4 flex flex-wrap gap-2 justify-center">
          <input
            type="text"
            placeholder="ค้นหาสินค้า..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="px-3 py-2 border rounded w-48"
          />
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2 border rounded"
          />
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="px-3 py-2 border rounded"
          />
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-green-500 text-white rounded"
          >Export Excel</button>
          <Link
            to="/blue/admin"
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded"
          >🏠 กลับ</Link>
        </div>

        {loading ? (
          <p className="text-center text-white">กำลังโหลด...</p>
        ) : paginatedHistory.length === 0 ? (
          <p className="text-center text-gray-300">ไม่พบประวัติการขาย</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-white">
              <thead>
                <tr>
                  <th className="px-2 py-1 border">#</th>
                  <th className="px-2 py-1 border">เวลา</th>
                  <th className="px-2 py-1 border">สินค้า</th>
                  <th className="px-2 py-1 border">จำนวน</th>
                  <th className="px-2 py-1 border">ราคา/ชิ้น</th>
                  <th className="px-2 py-1 border">รวม</th>
                  <th className="px-2 py-1 border">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {paginatedHistory.map((h, i) => (
                  <tr key={h.id} className="hover:bg-white/10">
                    <td className="px-2 py-1 border">{(currentPage-1)*ITEMS_PER_PAGE + i + 1}</td>
                    <td className="px-2 py-1 border">{formatDateTimeThai(h.created_at)}</td>
                    <td className="px-2 py-1 border">{h.product_name}</td>
                    <td className="px-2 py-1 border">{h.quantity}</td>
                    <td className="px-2 py-1 border">฿{h.product_price}</td>
                    <td className="px-2 py-1 border">฿{h.total_price}</td>
                    <td className="px-2 py-1 border">
                      <button
                        onClick={() => deleteRecord(h.id)}
                        className="text-red-400 hover:text-red-600"
                      >🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex justify-center gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="px-3 py-1 bg-white/20 rounded disabled:opacity-50"
            >‹</button>
            <span className="px-3 py-1">{currentPage} / {totalPages}</span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="px-3 py-1 bg-white/20 rounded disabled:opacity-50"
            >›</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default ProductHistoryView

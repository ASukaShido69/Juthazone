import { useState } from 'react'

function CustomerManagementModal({ isOpen, onClose, customers, onUpdate, onDelete }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})

  if (!isOpen) return null

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.room.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => {
    switch(sortBy) {
      case 'name': return a.name.localeCompare(b.name, 'th')
      case 'date': return new Date(b.start_time) - new Date(a.start_time)
      case 'cost': return (b.currentCost || 0) - (a.currentCost || 0)
      default: return 0
    }
  })

  const startEdit = (customer) => {
    setEditingId(customer.id)
    setEditForm({
      note: customer.note || '',
      hourlyRate: customer.hourly_rate || customer.cost || 0,
      paymentMethod: customer.paymentMethod || 'transfer'
    })
  }

  const saveEdit = (customerId) => {
    onUpdate(customerId, editForm)
    setEditingId(null)
    setEditForm({})
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({})
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-6 rounded-t-3xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl md:text-3xl font-bold">👥 จัดการลูกค้า</h2>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 p-2 rounded-lg transition-all"
            >
              ✕
            </button>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="🔍 ค้นหาชื่อหรือห้อง..."
              className="flex-1 px-4 py-2 rounded-lg text-gray-800 focus:outline-none"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 rounded-lg text-gray-800 focus:outline-none"
            >
              <option value="name">📋 เรียงตามชื่อ</option>
              <option value="date">🕐 เรียงตามเวลา</option>
              <option value="cost">💰 เรียงตามราคา</option>
            </select>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-xl font-semibold">ไม่พบลูกค้า</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCustomers.map((customer, index) => (
                <div
                  key={customer.id}
                  className={`border-2 rounded-2xl p-4 transition-all ${
                    editingId === customer.id ? 'bg-blue-50 border-blue-400' : 'bg-gray-50 border-gray-200 hover:border-blue-300'
                  }`}
                >
                  {editingId === customer.id ? (
                    // Edit Mode
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">📝 Note</label>
                          <textarea
                            value={editForm.note}
                            onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                            className="w-full px-3 py-2 border-2 rounded-lg focus:outline-none resize-none h-20"
                            placeholder="หมายเหตุ"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">💰 ราคา</label>
                          <input
                            type="number"
                            value={editForm.hourlyRate}
                            onChange={(e) => setEditForm({ ...editForm, hourlyRate: e.target.value })}
                            className="w-full px-3 py-2 border-2 rounded-lg focus:outline-none"
                            placeholder="ราคา"
                            step="0.01"
                            min="0"
                          />
                        </div>
                      </div>
                      {customer.paymentMethod && (
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">💳 วิธีการชำระเงิน</label>
                          <select
                            value={editForm.paymentMethod}
                            onChange={(e) => setEditForm({ ...editForm, paymentMethod: e.target.value })}
                            className="w-full px-3 py-2 border-2 rounded-lg focus:outline-none"
                          >
                            <option value="transfer">💸 โอนเงิน</option>
                            <option value="cash">💵 เงินสด</option>
                          </select>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(customer.id)}
                          className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600"
                        >
                          ✅ บันทึก
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg font-bold hover:bg-gray-600"
                        >
                          ❌ ยกเลิก
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-bold text-gray-800">{customer.name}</h3>
                          <span className="inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold">
                            📍 {customer.room}
                          </span>
                        </div>
                        {customer.note && (
                          <p className="text-sm text-gray-600 mb-2">
                            <span className="font-bold">📝 Note:</span> {customer.note}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-4 text-sm">
                          <div>
                            <span className="font-bold text-gray-700">💰 ราคา:</span>
                            <span className="ml-2 font-bold text-green-600">
                              ฿{(customer.hourly_rate || customer.cost || 0).toFixed(2)}
                            </span>
                          </div>
                          {customer.paymentMethod && (
                            <div>
                              <span className="font-bold text-gray-700">💳:</span>
                              <span className="ml-2 font-bold text-blue-600">
                                {customer.paymentMethod === 'transfer' ? '💸 โอนเงิน' : '💵 เงินสด'}
                              </span>
                            </div>
                          )}
                          {customer.mode && (
                            <div>
                              <span className="font-bold text-gray-700">Mode:</span>
                              <span className="ml-2 font-bold">
                                {customer.mode === 'red' ? '🔴 Red' : '🔵 Blue'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(customer)}
                          className="px-4 py-2 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition-all"
                        >
                          ✏️ แก้ไข
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`ต้องการลบ "${customer.name}" ใช่หรือไม่?`)) {
                              onDelete(customer.id)
                            }
                          }}
                          className="px-4 py-2 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600 transition-all"
                        >
                          🗑️ ลบ
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-100 p-6 rounded-b-3xl border-t-2">
          <div className="text-center text-sm text-gray-600 font-semibold mb-4">
            รวมทั้งสิ้น {filteredCustomers.length} รายการ
          </div>
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition-all"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  )
}

export default CustomerManagementModal

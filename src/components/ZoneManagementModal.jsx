import { useState } from 'react'

function ZoneManagementModal({ isOpen, onClose, zones, onUpdate }) {
  const [localZones, setLocalZones] = useState(zones)
  const [editingZoneKey, setEditingZoneKey] = useState(null)
  const [editingItemId, setEditingItemId] = useState(null)
  const [showAddItem, setShowAddItem] = useState(null)
  const [newItem, setNewItem] = useState({ label: '', defaultPrice: '' })

  if (!isOpen) return null

  const handleSaveZone = (zoneKey, label) => {
    const updated = { ...localZones }
    updated[zoneKey].label = label
    setLocalZones(updated)
    setEditingZoneKey(null)
  }

  const handleUpdateItem = (zoneKey, itemId, newLabel, newPrice) => {
    const updated = { ...localZones }
    const item = updated[zoneKey].items.find(i => i.id === itemId)
    if (item) {
      item.label = newLabel
      item.defaultPrice = parseFloat(newPrice)
    }
    setLocalZones(updated)
    setEditingItemId(null)
  }

  const handleAddItem = (zoneKey) => {
    if (!newItem.label || !newItem.defaultPrice) {
      alert('กรุณากรอกชื่อและราคา')
      return
    }
    const updated = { ...localZones }
    const newId = `${zoneKey}-item-${Date.now()}`
    updated[zoneKey].items.push({
      id: newId,
      label: newItem.label,
      defaultPrice: parseFloat(newItem.defaultPrice)
    })
    setLocalZones(updated)
    setNewItem({ label: '', defaultPrice: '' })
    setShowAddItem(null)
  }

  const handleDeleteItem = (zoneKey, itemId) => {
    if (!confirm('ต้องการลบรายการนี้ใช่หรือไม่?')) return
    const updated = { ...localZones }
    updated[zoneKey].items = updated[zoneKey].items.filter(i => i.id !== itemId)
    setLocalZones(updated)
  }

  const handleSave = () => {
    onUpdate(localZones)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-6 rounded-t-3xl">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl md:text-3xl font-bold">⚙️ จัดการโซน (Zones)</h2>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 p-2 rounded-lg transition-all"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {Object.entries(localZones).map(([zoneKey, zone]) => (
            <div key={zoneKey} className="border-2 border-gray-300 rounded-2xl p-4">
              {/* Zone Header */}
              <div className="flex justify-between items-center mb-4">
                {editingZoneKey === zoneKey ? (
                  <div className="flex gap-2 flex-1">
                    <input
                      type="text"
                      value={zone.label}
                      onChange={(e) => {
                        const updated = { ...localZones }
                        updated[zoneKey].label = e.target.value
                        setLocalZones(updated)
                      }}
                      className="flex-1 px-3 py-2 border-2 rounded-lg focus:outline-none"
                    />
                    <button
                      onClick={() => handleSaveZone(zoneKey, zone.label)}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600"
                    >
                      ✅ บันทึก
                    </button>
                    <button
                      onClick={() => setEditingZoneKey(null)}
                      className="px-4 py-2 bg-gray-500 text-white rounded-lg font-bold hover:bg-gray-600"
                    >
                      ❌ ยกเลิก
                    </button>
                  </div>
                ) : (
                  <>
                    <h3 className="text-xl font-bold text-gray-800">{zone.label}</h3>
                    <button
                      onClick={() => setEditingZoneKey(zoneKey)}
                      className="px-3 py-1 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600"
                    >
                      ✏️ แก้ไข
                    </button>
                  </>
                )}
              </div>

              {/* Items List */}
              <div className="space-y-2 mb-4">
                {zone.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
                    {editingItemId === item.id ? (
                      <>
                        <input
                          type="text"
                          value={item.label}
                          onChange={(e) => {
                            const updated = { ...localZones }
                            const foundItem = updated[zoneKey].items.find(i => i.id === item.id)
                            if (foundItem) foundItem.label = e.target.value
                            setLocalZones(updated)
                          }}
                          className="flex-1 px-2 py-1 border rounded"
                          placeholder="ชื่อรายการ"
                        />
                        <input
                          type="number"
                          value={item.defaultPrice}
                          onChange={(e) => {
                            const updated = { ...localZones }
                            const foundItem = updated[zoneKey].items.find(i => i.id === item.id)
                            if (foundItem) foundItem.defaultPrice = parseFloat(e.target.value)
                            setLocalZones(updated)
                          }}
                          className="w-24 px-2 py-1 border rounded"
                          placeholder="ราคา"
                          step="0.01"
                          min="0"
                        />
                        <button
                          onClick={() => handleUpdateItem(zoneKey, item.id, item.label, item.defaultPrice)}
                          className="px-2 py-1 bg-green-500 text-white rounded font-bold text-sm hover:bg-green-600"
                        >
                          ✅
                        </button>
                        <button
                          onClick={() => setEditingItemId(null)}
                          className="px-2 py-1 bg-gray-500 text-white rounded font-bold text-sm hover:bg-gray-600"
                        >
                          ❌
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 font-semibold text-gray-800">{item.label}</span>
                        <span className="font-bold text-lg text-green-600">฿{item.defaultPrice}</span>
                        <button
                          onClick={() => setEditingItemId(item.id)}
                          className="px-2 py-1 bg-blue-500 text-white rounded font-bold text-sm hover:bg-blue-600"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteItem(zoneKey, item.id)}
                          className="px-2 py-1 bg-red-500 text-white rounded font-bold text-sm hover:bg-red-600"
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Item Section */}
              {showAddItem === zoneKey ? (
                <div className="flex gap-2 bg-blue-50 p-3 rounded-lg border-2 border-blue-300">
                  <input
                    type="text"
                    value={newItem.label}
                    onChange={(e) => setNewItem({ ...newItem, label: e.target.value })}
                    className="flex-1 px-3 py-2 border rounded-lg focus:outline-none"
                    placeholder="ชื่อรายการใหม่"
                  />
                  <input
                    type="number"
                    value={newItem.defaultPrice}
                    onChange={(e) => setNewItem({ ...newItem, defaultPrice: e.target.value })}
                    className="w-28 px-3 py-2 border rounded-lg focus:outline-none"
                    placeholder="ราคา"
                    step="0.01"
                    min="0"
                  />
                  <button
                    onClick={() => handleAddItem(zoneKey)}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600"
                  >
                    ➕ เพิ่ม
                  </button>
                  <button
                    onClick={() => {
                      setShowAddItem(null)
                      setNewItem({ label: '', defaultPrice: '' })
                    }}
                    className="px-4 py-2 bg-gray-500 text-white rounded-lg font-bold hover:bg-gray-600"
                  >
                    ❌ ยกเลิก
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddItem(zoneKey)}
                  className="w-full py-2 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition-all"
                >
                  ➕ เพิ่มรายการใหม่
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-100 p-6 rounded-b-3xl flex gap-3 justify-end border-t-2">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-500 text-white rounded-lg font-bold hover:bg-gray-600 transition-all"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-3 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 transition-all"
          >
            ✅ บันทึกทั้งหมด
          </button>
        </div>
      </div>
    </div>
  )
}

export default ZoneManagementModal

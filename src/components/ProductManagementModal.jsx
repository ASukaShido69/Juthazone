import { useState, useEffect } from 'react'

function ProductManagementModal({ isOpen, onClose, products, onUpdate }) {
  const [localProducts, setLocalProducts] = useState([])
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')

  useEffect(() => {
    setLocalProducts(products || [])
  }, [products])

  const handleAdd = () => {
    if (!newName || !newPrice) return
    setLocalProducts([...localProducts, { id: Date.now().toString(), name: newName, price: parseFloat(newPrice) }])
    setNewName('')
    setNewPrice('')
  }

  const handleDelete = (id) => {
    setLocalProducts(localProducts.filter(p => p.id !== id))
  }

  const handleNameChange = (id, name) => {
    setLocalProducts(localProducts.map(p => p.id === id ? { ...p, name } : p))
  }

  const handlePriceChange = (id, price) => {
    setLocalProducts(localProducts.map(p => p.id === id ? { ...p, price: parseFloat(price) || 0 } : p))
  }

  const save = () => {
    onUpdate(localProducts)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-11/12 max-w-3xl p-6 relative">
        <h2 className="text-xl font-bold mb-4">จัดการสินค้า</h2>
        <div className="space-y-3">
          {localProducts.map(prod => (
            <div key={prod.id} className="flex items-center gap-2">
              <input
                type="text"
                value={prod.name}
                onChange={e => handleNameChange(prod.id, e.target.value)}
                className="flex-1 px-2 py-1 border rounded"
                placeholder="ชื่อสินค้า"
              />
              <input
                type="number"
                value={prod.price}
                onChange={e => handlePriceChange(prod.id, e.target.value)}
                className="w-24 px-2 py-1 border rounded"
                placeholder="ราคา"
                min="0"
                step="0.01"
              />
              <button
                onClick={() => handleDelete(prod.id)}
                className="text-red-500 hover:text-red-700"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="flex-1 px-2 py-1 border rounded"
            placeholder="ชื่อสินค้าใหม่"
          />
          <input
            type="number"
            value={newPrice}
            onChange={e => setNewPrice(e.target.value)}
            className="w-24 px-2 py-1 border rounded"
            placeholder="ราคา"
            min="0"
            step="0.01"
          />
          <button
            onClick={handleAdd}
            className="px-3 py-1 bg-green-500 text-white rounded"
          >
            ➕
          </button>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-300 rounded">ยกเลิก</button>
          <button onClick={save} className="px-4 py-2 bg-blue-500 text-white rounded">บันทึก</button>
        </div>
      </div>
    </div>
  )
}

export default ProductManagementModal

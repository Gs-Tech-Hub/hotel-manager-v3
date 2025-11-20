"use client"

import { useState } from 'react'
import { useSearchParams, useRouter, useParams } from 'next/navigation'

export default function DepartmentTransferPage() {
  const params = useParams() as { code?: string }
  const search = useSearchParams()
  const to = search.get('to') || ''
  const [productId, setProductId] = useState('')
  const [productType, setProductType] = useState('drink')
  const [quantity, setQuantity] = useState<number>(1)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  const submit = async (e: any) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/departments/${encodeURIComponent(String(params.code))}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toDepartmentCode: to, items: [{ type: productType, id: productId, quantity }] }),
      })
      const j = await res.json()
      if (!res.ok || !j?.success) {
        setMessage(j?.error?.message || 'Failed')
      } else {
        setMessage('Transfer request created')
        // optional: navigate back
        // router.back()
      }
    } catch (err: any) {
      setMessage(err?.message || 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold">Create Transfer</h2>
      <form onSubmit={submit} className="space-y-3 mt-4">
        <div>
          <label className="block text-sm">From</label>
          <div className="p-2 bg-muted rounded">{params.code}</div>
        </div>
        <div>
          <label className="block text-sm">To</label>
          <input className="w-full p-2 border rounded" value={to} readOnly />
        </div>
        <div>
          <label className="block text-sm">Product Type</label>
          <select className="w-full p-2 border rounded" value={productType} onChange={(e) => setProductType(e.target.value)}>
            <option value="drink">Drink</option>
            <option value="inventoryItem">Inventory Item</option>
          </select>
        </div>
        <div>
          <label className="block text-sm">Product ID</label>
          <input className="w-full p-2 border rounded" value={productId} onChange={(e) => setProductId(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm">Quantity</label>
          <input type="number" min={1} className="w-full p-2 border rounded" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
        </div>
        <div>
          <button className="px-3 py-2 bg-sky-600 text-white rounded" disabled={loading}>{loading ? 'Creating...' : 'Create Transfer'}</button>
        </div>
        {message && <div className="text-sm mt-2">{message}</div>}
      </form>
    </div>
  )
}

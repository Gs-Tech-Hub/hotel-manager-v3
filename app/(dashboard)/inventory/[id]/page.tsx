"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getDisplayUnit, formatQuantityWithUnit } from '@/lib/unit-mapper'
import { formatPrice } from '@/lib/price'
import { Trash2, Edit2 } from 'lucide-react'
import { formatTablePrice } from '@/lib/formatters'

type Movement = {
  id: string
  movementType: string
  quantity: number
  reason?: string
  createdAt: string
}

type ItemDetail = {
  id: string
  name: string
  sku: string
  category: string
  itemType?: string
  quantity: number
  unitPrice: number
  movements?: Movement[]
}

export default function InventoryDetail(...args: any[]) {
  // Accept flexible args to satisfy Next.js generated PageProps typing variations
  const maybeProps = args[0] || {};
  const params = maybeProps.params || {};
  const id = params.id || (typeof maybeProps === 'string' ? maybeProps : undefined);
  const [item, setItem] = useState<ItemDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [restockQty, setRestockQty] = useState<number>(0)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', unitPrice: '', quantity: '' })
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const router = useRouter()

  const fetchItem = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/inventory/${encodeURIComponent(id)}?includeMovements=true`)
      if (!res.ok) throw new Error(`Failed to fetch item (${res.status})`)
      const json = await res.json()
      if (!json?.success) throw new Error(json?.error || 'Invalid response')
      setItem(json.data)
    } catch (err: any) {
      console.error('Failed to load inventory item', err)
      setError(err?.message || 'Failed to load item')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (id) fetchItem() }, [id])

  const handleEditClick = () => {
    if (item) {
      setEditForm({ name: item.name, unitPrice: String(item.unitPrice || 0), quantity: String(item.quantity || 0) })
      setIsEditing(true)
      setEditError(null)
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!item || !editForm.name) {
      setEditError('Item name is required')
      return
    }

    setEditLoading(true)
    setEditError(null)
    try {
      const res = await fetch(`/api/inventory/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          unitPrice: Number(editForm.unitPrice),
          quantity: Number(editForm.quantity),
        }),
      })

      if (!res.ok) throw new Error(`Failed to update item (${res.status})`)
      const json = await res.json()
      if (!json?.success) throw new Error(json?.error || 'Invalid response')

      await fetchItem()
      setIsEditing(false)
    } catch (err: any) {
      console.error('Failed to edit inventory item', err)
      setEditError(err?.message || 'Failed to update item')
    } finally {
      setEditLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!item) return
    if (!confirm(`Are you sure you want to delete "${item.name}"? This cannot be undone.`)) {
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/inventory/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error(`Failed to delete item (${res.status})`)
      const json = await res.json()
      if (!json?.success) throw new Error(json?.error || 'Invalid response')

      // Redirect back to inventory list after successful deletion
      router.push('/inventory')
    } catch (err: any) {
      console.error('Failed to delete inventory item', err)
      setError(err?.message || 'Failed to delete item')
    } finally {
      setLoading(false)
    }
  }

  const submitRestock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!item) return
    if (!restockQty || Number(restockQty) <= 0) {
      setError('Restock quantity must be greater than zero')
      return
    }

    try {
      // Prefer recording a movement for auditability
      const res = await fetch(`/api/inventory/movements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: id,
          movementType: 'in',
          quantity: Number(restockQty),
          reason: 'Restock (admin)',
        }),
      })

      if (!res.ok) throw new Error(`Failed to record restock (${res.status})`)
      const json = await res.json()
      if (!json?.success) throw new Error(json?.error || 'Invalid response')

      // After movement recorded, refresh item details
      await fetchItem()
      setRestockQty(0)
    } catch (err: any) {
      console.error('Failed to restock', err)
      setError(err?.message || 'Failed to restock')
    }
  }

  if (loading) return <div>Loading...</div>
  if (error) return <div className="text-red-600">{error}</div>
  if (!item) return <div>No item found.</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{item.name}</h1>
        <div className="flex gap-2">
          <button 
            onClick={handleEditClick}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm flex items-center gap-1 hover:bg-blue-700"
          >
            <Edit2 size={16} />
            Edit
          </button>
          <button 
            onClick={handleDelete}
            className="px-3 py-1 bg-red-600 text-white rounded text-sm flex items-center gap-1 hover:bg-red-700"
          >
            <Trash2 size={16} />
            Delete
          </button>
          <button onClick={() => router.back()} className="px-3 py-1 border rounded text-sm">Back</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded p-4 bg-white">
          <div><strong>SKU:</strong> {item.sku}</div>
          <div><strong>Category:</strong> {item.category}</div>
          <div><strong>Quantity:</strong> {formatQuantityWithUnit(item.quantity, getDisplayUnit(item.category, item.itemType))}</div>
          <div><strong>Unit price:</strong> {formatTablePrice(item.unitPrice)}</div>
        </div>

        <div className="border rounded p-4 bg-white">
          <form onSubmit={submitRestock} className="space-y-2">
            <div>
              <label className="block text-sm">Restock quantity</label>
              <input type="number" value={restockQty} onChange={(e) => setRestockQty(Number(e.target.value))} className="border px-2 py-1 w-full" />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="px-3 py-1 bg-green-600 text-white rounded">Apply</button>
              <button type="button" onClick={() => { setRestockQty(0); }} className="px-3 py-1 border rounded">Reset</button>
            </div>
          </form>
        </div>
      </div>

      {isEditing && (
        <div className="border rounded p-4 bg-white border-blue-400">
          <h3 className="font-semibold mb-3">Edit Item</h3>
          {editError && <div className="text-red-600 text-sm mb-2">{editError}</div>}
          <form onSubmit={handleEditSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium">Item Name</label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="border px-2 py-1 w-full rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Unit Price (in cents)</label>
              <input
                type="number"
                value={editForm.unitPrice}
                onChange={(e) => setEditForm({ ...editForm, unitPrice: e.target.value })}
                className="border px-2 py-1 w-full rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Quantity</label>
              <input
              type="number"
              value={editForm.quantity}
              onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
              className="border px-2 py-1 w-full rounded"
            />  
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={editLoading} className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50">
                {editLoading ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-3 py-1 border rounded text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="border rounded p-4 bg-white">
        <h3 className="font-semibold">Movements</h3>
        {item.movements && item.movements.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {item.movements.map((m) => (
              <li key={m.id} className="flex justify-between">
                <div>
                  <div className="text-sm font-medium">{m.movementType}</div>
                  <div className="text-xs text-muted-foreground">{m.reason}</div>
                </div>
                <div className="text-sm">{m.quantity} — <span className="text-xs text-muted-foreground">{new Date(m.createdAt).toLocaleString()}</span></div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-muted-foreground">No movements</div>
        )}
      </div>
    </div>
  )
}

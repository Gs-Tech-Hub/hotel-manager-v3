"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

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
        <button onClick={() => router.back()} className="px-3 py-1 border rounded text-sm">Back</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded p-4 bg-white">
          <div><strong>SKU:</strong> {item.sku}</div>
          <div><strong>Category:</strong> {item.category}</div>
          <div><strong>Quantity:</strong> {item.quantity}</div>
          <div><strong>Unit price:</strong> {new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(item.unitPrice))}</div>
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

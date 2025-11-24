"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Movement = {
  id: string
  movementType: string
  quantity: number
  reason?: string
  reference?: string
  inventoryItemId: string
  createdAt: string
}

export default function InventoryMovementsPage() {
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchMovements = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/inventory/movements?page=1&limit=200')
      if (!res.ok) throw new Error(`Failed to fetch movements (${res.status})`)
      const j = await res.json()
      const items = j.data?.items || []
      setMovements(items)
    } catch (e: any) {
      console.error('fetchMovements error', e)
      setError(e?.message || 'Failed to load movements')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchMovements() }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventory Movements</h1>
        <div>
          <Link href="/inventory" className="px-3 py-1 border rounded text-sm mr-2">Back to Inventory</Link>
          <button onClick={fetchMovements} className="px-3 py-1 border rounded text-sm">Refresh</button>
        </div>
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading movements...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="overflow-x-auto">
        <table className="w-full table-auto border-collapse">
          <thead>
            <tr className="text-left">
              <th className="p-2">Date</th>
              <th className="p-2">Type</th>
              <th className="p-2">Item</th>
              <th className="p-2">Quantity</th>
              <th className="p-2">Reason</th>
              <th className="p-2">Reference</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="p-2">{new Date(m.createdAt).toLocaleString()}</td>
                <td className="p-2">{m.movementType}</td>
                <td className="p-2"><Link href={`/inventory/${encodeURIComponent(m.inventoryItemId)}`} className="text-sky-600">{m.inventoryItemId}</Link></td>
                <td className="p-2">{m.quantity}</td>
                <td className="p-2">{m.reason || '-'}</td>
                <td className="p-2">{m.reference || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

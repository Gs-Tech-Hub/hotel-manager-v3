"use client"

import { useEffect, useState } from 'react'

export default function TransferAuditPanel({ code }: { code: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [transfers, setTransfers] = useState<any[] | null>(null)
  const [movements, setMovements] = useState<any[] | null>(null)

  useEffect(() => {
    if (!code) return
    const fetchAudit = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/departments/${encodeURIComponent(code)}/audit`)
        if (!res.ok) throw new Error('Failed to load audit')
        const j = await res.json()
        const data = j.data || j
        setTransfers(data.transfers || [])
        setMovements(data.movements || [])
      } catch (e: any) {
        console.error('fetchAudit error', e)
        setError(e?.message || 'Failed to load audit')
      } finally {
        setLoading(false)
      }
    }
    fetchAudit()
  }, [code])

  return (
    <div className="mt-6">
      <h2 className="text-xl font-semibold">Transfers & Inventory Movements</h2>
      {loading && <div className="text-sm text-muted-foreground">Loading audit...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      {!loading && !error && (
        <div className="mt-3 space-y-4">
          <div>
            <div className="font-medium">Recent Transfers</div>
            {(!transfers || transfers.length === 0) && <div className="text-sm text-muted-foreground">No transfers found.</div>}
            {transfers && transfers.length > 0 && (
              <ul className="mt-2 space-y-2">
                {transfers.map((t) => (
                  <li key={t.id} className="border rounded p-2 bg-white">
                    <div className="text-sm">Status: <span className="font-medium">{t.status}</span></div>
                    <div className="text-sm">From: {t.fromDepartmentName || t.fromDepartmentId} → To: {t.toDepartmentName || t.toDepartmentId}</div>
                    <div className="text-sm">Items: {t.items?.map((it: any) => `${it.productType}:${it.productName || it.productId} x${it.quantity}`).join(', ')}</div>
                    <div className="text-xs text-muted-foreground">Created: {new Date(t.createdAt).toLocaleString()}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <div className="font-medium">Inventory Movements (related to transfers)</div>
            {(!movements || movements.length === 0) && <div className="text-sm text-muted-foreground">No movements found.</div>}
            {movements && movements.length > 0 && (
              <ul className="mt-2 space-y-2">
                {movements.map((m) => (
                  <li key={m.id} className="border rounded p-2 bg-white">
                    <div className="text-sm">Type: <span className="font-medium">{m.movementType}</span> — Reason: {m.reason || '-'}</div>
                    <div className="text-sm">Item: {m.inventoryItemName || m.inventoryItemId} — Qty: {m.quantity}</div>
                    <div className="text-sm">Reference: {m.reference}</div>
                    <div className="text-xs text-muted-foreground">When: {new Date(m.createdAt).toLocaleString()}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

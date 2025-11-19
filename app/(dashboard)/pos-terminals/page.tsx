"use client"

"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

type Terminal = {
  id: string
  name: string
  departmentCode?: string
  status?: string
  today?: { count: number; total: number }
}

export default function POSTerminalsIndex() {
  const [terminals, setTerminals] = useState<Terminal[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTerminals = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/pos/terminals')
      if (!res.ok) throw new Error(`Failed to fetch terminals (${res.status})`)
      const json = await res.json()
      if (!json || !json.success) throw new Error(json?.error || 'Invalid response')
      setTerminals(json.data || [])
    } catch (err: any) {
      console.error('Failed to load terminals', err)
      setError(err?.message || 'Failed to load terminals')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTerminals()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">POS Terminals</h1>
        <div>
          <button onClick={fetchTerminals} className="px-3 py-1 border rounded text-sm">Refresh</button>
        </div>
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading terminals...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {terminals.map((t) => (
          <div key={t.id} className="border rounded p-4 bg-white">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-semibold">{t.name} <span className="text-xs text-muted-foreground ml-2">{t.departmentCode ? `(${t.departmentCode})` : ''}</span></div>
                <div className="text-xs text-muted-foreground">Status: {t.status ?? 'unknown'}</div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <div className="text-right">
                  {t.today ? (
                    <>
                      <div className="text-sm font-semibold">{t.today.count} tx</div>
                      <div className="text-xs text-muted-foreground">{new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(t.today.total)}</div>
                    </>
                  ) : (
                    <div className="text-xs text-muted-foreground">No data</div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Link href={`/pos-terminals/${encodeURIComponent(t.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, ''))}/checkout`} className="px-3 py-2 bg-sky-600 text-white rounded">Open</Link>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

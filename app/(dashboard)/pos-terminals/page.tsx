"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { RotateCcw, Plus } from "lucide-react"
import Price from '@/components/ui/Price'

type POSTerminal = {
  id: string
  name: string
  slug?: string
  departmentCode?: string
  departmentName?: string
  status?: string
  today?: { count: number; total: number }
}

export default function POSTerminalsPage() {
  const [terminals, setTerminals] = useState<POSTerminal[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTerminals = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/pos/terminals')
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
        <div>
          <h1 className="text-3xl font-bold">POS Terminals</h1>
          <p className="text-sm text-muted-foreground mt-1">Available sales points and sections</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={fetchTerminals} 
            disabled={loading}
            className="px-3 py-2 border rounded text-sm flex items-center gap-2 hover:bg-gray-50 disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            Refresh
          </button>
          <button className="px-3 py-2 bg-blue-600 text-white rounded text-sm flex items-center gap-2 hover:bg-blue-700">
            <Plus className="w-4 h-4" />
            New Terminal
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">
          {error}
        </div>
      )}

      {loading && <div className="text-sm text-muted-foreground">Loading terminals...</div>}
      
      {terminals.length === 0 && !loading && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
          No terminals configured. Create department sections to set up POS terminals.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {terminals.map((terminal) => (
          <div key={terminal.id} className="border rounded-lg p-4 bg-white hover:shadow-md transition">
            <div className="space-y-3">
              <div>
                <h3 className="font-semibold text-gray-900">{terminal.name}</h3>
                <p className="text-xs text-gray-500 mt-1">{terminal.departmentName || 'No department'}</p>
              </div>

              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${terminal.status === 'online' ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className="text-xs text-gray-600">{terminal.status ?? 'unknown'}</span>
              </div>

              {terminal.today && (
                <div className="p-2 bg-gray-50 rounded">
                  <div className="text-xs text-gray-600">Today&apos;s Sales</div>
                  <div className="flex justify-between items-baseline mt-1">
                    <span className="font-semibold text-gray-900">{terminal.today.count} tx</span>
                    <span className="text-sm text-gray-700">
                      <Price amount={Math.round(terminal.today.total)} isMinor={true} />
                    </span>
                  </div>
                </div>
              )}

              <Link
                href={`/pos-terminals/${encodeURIComponent(terminal.slug ?? terminal.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, ''))}/checkout?terminal=${terminal.id}`}
                className="w-full px-3 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 transition text-center block"
              >
                Open Terminal
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

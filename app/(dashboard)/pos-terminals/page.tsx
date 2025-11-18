"use client"

import Link from "next/link"

export default function POSTerminalsIndex() {
  const terminals = [
    { id: 'pos-001', name: 'POS-001', status: 'online' },
    { id: 'pos-002', name: 'POS-002', status: 'offline' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">POS Terminals</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {terminals.map((t) => (
          <div key={t.id} className="border rounded p-4 bg-white">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-semibold">{t.name}</div>
                <div className="text-xs text-muted-foreground">Status: {t.status}</div>
              </div>
              <div className="flex gap-2">
                <Link href={`/pos-terminals/${t.id}/checkout`} className="px-3 py-2 bg-sky-600 text-white rounded">Open</Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

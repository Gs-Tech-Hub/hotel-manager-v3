"use client"

import { useState } from "react"

export function POSCashierLogin({ onLogin }: { onLogin: (id: string) => void }) {
  const [id, setId] = useState('')
  const [pin, setPin] = useState('')

  return (
    <div className="p-4 bg-white rounded shadow">
      <h3 className="font-bold mb-2">Cashier Login</h3>
      <div className="space-y-2">
        <input placeholder="Employee ID" value={id} onChange={(e) => setId(e.target.value)} className="w-full border rounded px-2 py-1" />
        <input placeholder="PIN" type="password" value={pin} onChange={(e) => setPin(e.target.value)} className="w-full border rounded px-2 py-1" />
        <div className="flex gap-2">
          <button onClick={() => onLogin(id)} className="flex-1 bg-sky-600 text-white px-3 py-2 rounded">Login</button>
        </div>
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"

export function POSPayment({ total, onComplete, onCancel }: { total: number; onComplete: (r: { method: string; amount: number }) => void; onCancel?: () => void }) {
  const [method, setMethod] = useState<'cash'|'card'>('cash')
  const [tendered, setTendered] = useState<number>(total)

  const change = tendered - total

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
        <h3 className="text-lg font-bold mb-4">Payment</h3>
        <div className="mb-3">
          <div className="flex gap-2">
            <button onClick={() => setMethod('cash')} className={`px-3 py-2 rounded ${method==='cash' ? 'bg-sky-600 text-white' : 'bg-slate-100'}`}>Cash</button>
            <button onClick={() => setMethod('card')} className={`px-3 py-2 rounded ${method==='card' ? 'bg-sky-600 text-white' : 'bg-slate-100'}`}>Card</button>
          </div>
        </div>
        <div className="mb-3">
          <label className="block text-sm">Total</label>
          <div className="font-bold text-xl">${total.toFixed(2)}</div>
        </div>
        <div className="mb-4">
          <label className="block text-sm">Amount Tendered</label>
          <input type="number" value={tendered} onChange={(e) => setTendered(Number(e.target.value))} className="w-full border rounded px-3 py-2" />
          <div className={`mt-2 font-semibold ${change>=0 ? 'text-green-600' : 'text-red-600'}`}>Change: ${change.toFixed(2)}</div>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 px-4 py-2 border rounded">Cancel</button>
          <button onClick={() => onComplete({ method, amount: tendered })} disabled={tendered < total} className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded disabled:opacity-60">Complete</button>
        </div>
      </div>
    </div>
  )
}

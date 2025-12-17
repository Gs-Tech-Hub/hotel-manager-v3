"use client"

import { useState } from "react"
import Price from '@/components/ui/Price'

export function POSPayment({ total, onComplete, onCancel }: { total: number; onComplete: (r: { method: string; amount?: number; isDeferred?: boolean }) => void; onCancel?: () => void }) {
  const [paymentType, setPaymentType] = useState<'immediate'|'deferred'>('immediate')
  const [method, setMethod] = useState<'cash'|'card'>('cash')
  const [tendered, setTendered] = useState<number>(total)

  const change = tendered - total

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
        <h3 className="text-lg font-bold mb-4">Payment</h3>
        
        {/* Payment Type Selection */}
        <div className="mb-4 pb-4 border-b">
          <label className="block text-sm font-semibold mb-2">Payment Type</label>
          <div className="flex gap-2">
            <button onClick={() => setPaymentType('immediate')} className={`flex-1 px-3 py-2 rounded transition ${paymentType==='immediate' ? 'bg-sky-600 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}>Pay Now</button>
            <button onClick={() => setPaymentType('deferred')} className={`flex-1 px-3 py-2 rounded transition ${paymentType==='deferred' ? 'bg-amber-600 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}>Pay Later</button>
          </div>
        </div>

        {/* Immediate Payment Section */}
        {paymentType === 'immediate' && (
          <>
            <div className="mb-3">
              <label className="block text-sm font-semibold mb-2">Payment Method</label>
              <div className="flex gap-2">
                <button onClick={() => setMethod('cash')} className={`flex-1 px-3 py-2 rounded transition ${method==='cash' ? 'bg-sky-600 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}>💵 Cash</button>
                <button onClick={() => setMethod('card')} className={`flex-1 px-3 py-2 rounded transition ${method==='card' ? 'bg-sky-600 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}>💳 Card</button>
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-sm">Total</label>
              <div className="font-bold text-xl"><Price amount={total} isMinor={false} /></div>
            </div>
            <div className="mb-4">
              <label className="block text-sm">Amount Tendered</label>
              <input type="number" value={tendered} onChange={(e) => setTendered(Number(e.target.value))} className="w-full border rounded px-3 py-2" />
              <div className={`mt-2 font-semibold ${change>=0 ? 'text-green-600' : 'text-red-600'}`}>Change: <Price amount={change} isMinor={false} /></div>
            </div>
          </>
        )}

        {/* Deferred Payment Section */}
        {paymentType === 'deferred' && (
          <div className="mb-4 p-3 bg-amber-50 rounded border border-amber-200">
            <div className="text-sm mb-2">
              <p className="font-semibold text-amber-900">Order Total</p>
              <p className="text-lg font-bold text-amber-700"><Price amount={total} isMinor={false} /></p>
            </div>
            <p className="text-xs text-amber-700">This order will be marked as PENDING and payment can be settled later.</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 px-4 py-2 border rounded hover:bg-slate-50 transition">Cancel</button>
          <button 
            onClick={() => {
              if (paymentType === 'deferred') {
                onComplete({ method: 'deferred', isDeferred: true })
              } else {
                onComplete({ method, amount: tendered })
              }
            }} 
            disabled={paymentType === 'immediate' && tendered < total} 
            className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-60 transition"
          >
            {paymentType === 'deferred' ? 'Create Deferred Order' : 'Complete Payment'}
          </button>
        </div>
      </div>
    </div>
  )
}

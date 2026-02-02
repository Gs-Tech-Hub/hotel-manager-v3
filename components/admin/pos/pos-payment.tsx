"use client"

import { useState } from "react"
import Price from '@/components/ui/Price'
import { normalizeToCents, centsToDollars } from '@/lib/price'

export function POSPayment({ total, onComplete, onCancel, allowDeferred = true }: { total: number; onComplete: (r: { method: string; amount?: number; isMinor?: boolean; isDeferred?: boolean }) => void; onCancel?: () => void; allowDeferred?: boolean }) {
  // total is expected to come in as cents from POS checkout
  const totalCents = total
  
  const [paymentType, setPaymentType] = useState<'immediate'|'deferred'>(allowDeferred ? 'immediate' : 'immediate')
  const [method, setMethod] = useState<'cash'|'card'>('cash')
  const [tenderedCents, setTenderedCents] = useState<number>(totalCents)
  const [isProcessing, setIsProcessing] = useState(false)

  const changeCents = tenderedCents - totalCents

  const handleComplete = async () => {
    if (isProcessing) return
    
    setIsProcessing(true)
    try {
      if (paymentType === 'deferred') {
        onComplete({ method: 'deferred', isDeferred: true })
      } else {
        // Send amount in cents (isMinor: true) for consistency with backend
        onComplete({ method, amount: tenderedCents, isMinor: true })
      }
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
        <h3 className="text-lg font-bold mb-4">Payment</h3>
        
        {/* Payment Type Selection */}
        <div className="mb-4 pb-4 border-b">
          <label className="block text-sm font-semibold mb-2">Payment Type</label>
          <div className="flex gap-2">
            <button onClick={() => setPaymentType('immediate')} className={`flex-1 px-3 py-2 rounded transition ${paymentType==='immediate' ? 'bg-sky-600 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}>Pay Now</button>
            {allowDeferred && (
              <button onClick={() => setPaymentType('deferred')} className={`flex-1 px-3 py-2 rounded transition ${paymentType==='deferred' ? 'bg-amber-600 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}>Pay Later</button>
            )}
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
              <div className="font-bold text-xl"><Price amount={totalCents} isMinor={true} /></div>
            </div>
            <div className="mb-4">
              <label className="block text-sm">Amount Tendered</label>
              <input 
                type="number" 
                step="0.01"
                min="0"
                value={Math.round(centsToDollars(tenderedCents) * 100) / 100}
                onChange={(e) => {
                  const newDollars = Number(e.target.value)
                  if (!isNaN(newDollars)) {
                    setTenderedCents(Math.round(newDollars * 100))
                  }
                }} 
                className="w-full border rounded px-3 py-2" 
              />
              <div className={`mt-2 font-semibold ${changeCents >= 0 ? 'text-green-600' : 'text-red-600'}`}>Change: <Price amount={changeCents} isMinor={true} /></div>
            </div>
          </>
        )}

        {/* Deferred Payment Section */}
        {paymentType === 'deferred' && (
          <div className="mb-4 p-3 bg-amber-50 rounded border border-amber-200">
            <div className="text-sm mb-2">
              <p className="font-semibold text-amber-900">Order Total</p>
              <p className="text-lg font-bold text-amber-700"><Price amount={totalCents} isMinor={true} /></p>
            </div>
            <p className="text-xs text-amber-700">This order will be marked as PENDING and payment can be settled later.</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button onClick={onCancel} disabled={isProcessing} className="flex-1 px-4 py-2 border rounded hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed">Cancel</button>
          <button 
            onClick={handleComplete}
            disabled={isProcessing || (paymentType === 'immediate' && tenderedCents < totalCents)} 
            className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {isProcessing ? 'Processing...' : (paymentType === 'deferred' ? 'Create Deferred Order' : 'Complete Payment')}
          </button>
        </div>
      </div>
    </div>
  )
}

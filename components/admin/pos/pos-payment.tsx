"use client"

import { useState } from "react"
import { formatTablePrice } from '@/lib/formatters'

interface PaymentProps {
  total: number;
  onComplete: (r: { method: string; amount?: number; isMinor?: boolean; isDeferred?: boolean }) => void;
  onCancel?: () => void;
  allowDeferred?: boolean;
  isProcessing?: boolean;
  selectedEmployee?: { id: string; name?: string } | null;
}

export function POSPayment({ 
  total, 
  onComplete, 
  onCancel, 
  allowDeferred = true, 
  isProcessing: externalIsProcessing = false,
  selectedEmployee = null 
}: PaymentProps) {
  // total is expected to come in as cents from POS checkout
  const totalCents = total
  
  // Determine initial payment type and method based on employee selection
  // If employee selected, default to 'charges' method; otherwise 'cash'
  const defaultMethod = selectedEmployee?.id ? 'charges' : 'cash'
  const [paymentType, setPaymentType] = useState<'immediate'|'deferred'>(allowDeferred ? 'immediate' : 'immediate')
  const [method, setMethod] = useState<'cash'|'card'|'charges'>(defaultMethod as 'cash'|'card'|'charges')
  
  // Use external processing state if provided (from parent)
  const isTransacting = externalIsProcessing

  const handleComplete = async () => {
    if (isTransacting) return
    
    // Don't use internal state - the parent is managing state
    // Just call onComplete and let parent handle the loading state
    if (paymentType === 'deferred') {
      onComplete({ method: 'deferred', isDeferred: true })
    } else if (method === 'charges') {
      // Charges payment method - special handling in parent
      onComplete({ method: 'charges', amount: totalCents, isMinor: true })
    } else {
      // Send amount in cents (isMinor: true) for consistency with backend
      onComplete({ method, amount: totalCents, isMinor: true })
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
            <button onClick={() => setPaymentType('immediate')} disabled={isTransacting} className={`flex-1 px-3 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed ${paymentType==='immediate' ? 'bg-sky-600 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}>Pay Now</button>
            {allowDeferred && (
              <button onClick={() => setPaymentType('deferred')} disabled={isTransacting} className={`flex-1 px-3 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed ${paymentType==='deferred' ? 'bg-amber-600 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}>Pay Later</button>
            )}
          </div>
        </div>

        {/* Immediate Payment Section */}
        {paymentType === 'immediate' && (
          <>
            <div className="mb-3">
              <label className="block text-sm font-semibold mb-2">Payment Method</label>
              <div className="flex flex-col gap-2">
                {/* Charges payment method - only shown if employee selected */}
                {selectedEmployee?.id && (
                  <button 
                    onClick={() => setMethod('charges')} 
                    disabled={isTransacting} 
                    className={`px-3 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed text-left ${method==='charges' ? 'bg-orange-600 text-white border-2 border-orange-700' : 'bg-slate-100 hover:bg-slate-200 border-2 border-transparent'}`}
                  >
                    <div className="font-semibold">💳 Charge to {selectedEmployee.name || 'Employee'}</div>
                    <div className="text-xs opacity-75">Amount will be deducted from salary</div>
                  </button>
                )}
                
                {/* Cash and Card methods */}
                <div className={`flex gap-2 ${selectedEmployee?.id ? 'opacity-60' : ''}`}>
                  <button onClick={() => setMethod('cash')} disabled={isTransacting} className={`flex-1 px-3 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed ${method==='cash' ? 'bg-sky-600 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}>💵 Cash</button>
                  <button onClick={() => setMethod('card')} disabled={isTransacting} className={`flex-1 px-3 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed ${method==='card' ? 'bg-sky-600 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}>💳 Card</button>
                </div>
                {selectedEmployee?.id && (
                  <div className="text-xs text-gray-500 mt-1">
                    ℹ️ Cash/Card also applies when employee has charges
                  </div>
                )}
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-sm">Total</label>
              <div className="font-bold text-xl">{formatTablePrice(totalCents)}</div>
            </div>
          </>
        )}

        {/* Deferred Payment Section */}
        {paymentType === 'deferred' && (
          <div className="mb-4 p-3 bg-amber-50 rounded border border-amber-200">
            <div className="text-sm mb-2">
              <p className="font-semibold text-amber-900">Order Total</p>
              <p className="text-lg font-bold text-amber-700">{formatTablePrice(totalCents)}</p>
            </div>
            <p className="text-xs text-amber-700">This order will be marked as PENDING and payment can be settled later.</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button onClick={onCancel} disabled={isTransacting} className="flex-1 px-4 py-2 border rounded hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed">Cancel</button>
          <button 
            onClick={handleComplete}
            disabled={isTransacting} 
            className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:bg-gray-400 disabled:opacity-100 disabled:cursor-not-allowed transition"
          >
            {isTransacting ? 'Processing...' : (paymentType === 'deferred' ? 'Create Deferred Order' : 'Complete Payment')}
          </button>
        </div>
      </div>
    </div>
  )
}

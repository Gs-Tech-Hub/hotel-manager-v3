"use client"

import { useMemo } from "react"
import { formatTablePrice } from '@/lib/formatters'

export interface CartLine {
  lineId: string
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  type?: string
  serviceData?: {    // Service-specific pricing details
    id: string
    pricingModel: 'per_count' | 'per_time'
    pricePerCount: number
    pricePerMinute: number
    description?: string
  }
}

export function POSCart({ items, onRemove, onQty }: { items: CartLine[]; onRemove: (id: string) => void; onQty: (id: string, qty: number) => void }) {
  const subtotal = useMemo(() => items.reduce((s, i) => s + i.unitPrice * i.quantity, 0), [items])
  // Tax is calculated on the backend during order creation, not in cart display
  const total = subtotal

  return (
    <div className="border rounded-lg p-4 bg-white">
      <h3 className="font-bold mb-3">Order Summary</h3>
      <div className="space-y-2 max-h-60 overflow-auto mb-3">
        {items.map((it) => (
          <div key={it.lineId} className="flex justify-between items-center">
              <div>
              <div className="font-semibold text-sm">{it.productName}</div>
              <div className="text-xs text-muted-foreground">{formatTablePrice(it.unitPrice)} each</div>
            </div>
            <div className="flex items-center gap-2">
              <input type="number" value={it.quantity} min={1} onChange={(e) => onQty(it.lineId, Number(e.target.value))} className="w-14 text-center border rounded" />
              <div className="font-semibold">{formatTablePrice(it.unitPrice * it.quantity)}</div>
              <button onClick={() => onRemove(it.lineId)} className="text-red-500">✕</button>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t pt-3 space-y-1 text-sm">
        <div className="flex justify-between"> <span>Subtotal</span> <span>{formatTablePrice(subtotal)}</span> </div>
        <div className="flex justify-between font-bold text-lg"> <span>Total</span> <span>{formatTablePrice(total)}</span> </div>
      </div>
    </div>
  )
}

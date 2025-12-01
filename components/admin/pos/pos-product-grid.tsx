"use client"

import { useState } from "react"
import Price from '@/components/ui/Price'

export interface POSProduct {
  id: string
  name: string
  price: number
  available?: boolean
}

export function POSProductGrid({ products, onAdd }: { products: POSProduct[]; onAdd: (p: POSProduct) => void }) {
  const [qty] = useState(1)

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {products.map((p) => (
        <button
          key={p.id}
          onClick={() => onAdd(p)}
          disabled={!p.available}
          className={`p-3 rounded-lg text-left transition-all ${p.available ? 'bg-white border hover:shadow' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
        >
            <div className="flex justify-between items-baseline">
            <div className="font-semibold text-sm">{p.name}</div>
            <div className="text-sm text-sky-600"><Price amount={p.price} isMinor={false} /></div>
          </div>
          <div className="text-xs text-muted-foreground mt-2">Qty: {qty}</div>
        </button>
      ))}
    </div>
  )
}

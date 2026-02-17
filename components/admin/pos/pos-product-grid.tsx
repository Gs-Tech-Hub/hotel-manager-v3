"use client"

import { useState } from "react"
import { formatTablePrice } from '@/lib/formatters'

export interface POSProduct {
  id: string
  name: string
  price: number
  available?: boolean
  quantity?: number  // Stock quantity for validation
  type?: string      // Product type (food, drink, service, etc.)
  serviceData?: {    // Service-specific pricing details
    id: string
    pricingModel: 'per_count' | 'per_time'
    pricePerCount: number
    pricePerMinute: number
    description?: string
  }
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
            <div className="flex flex-col">
            <div className="font-semibold text-sm">{p.name}</div>
            <div className="text-sm text-sky-600 mt-1">{formatTablePrice(p.price)}</div>
          </div>
          <div className="text-xs text-muted-foreground mt-2">Qty: {qty}</div>
        </button>
      ))}
    </div>
  )
}

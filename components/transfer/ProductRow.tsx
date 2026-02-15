"use client"

import React from 'react'

type ProductRowProps = {
  id: string
  name: string
  type?: 'item' | 'service'
  available?: number | null
  quantity?: number
  reserved?: number
  unitPrice?: number
  pricingModel?: 'per_count' | 'per_time'
  pricePerCount?: number
  pricePerMinute?: number
  onAdd: () => void
}

export default function ProductRow({ 
  id, 
  name, 
  type = 'item',
  available = 0,
  quantity = 0,
  reserved = 0,
  unitPrice = 0,
  pricingModel,
  pricePerCount,
  pricePerMinute,
  onAdd 
}: ProductRowProps) {
  const isService = type === 'service'
  const isAvailable = isService || (available ?? 0) > 0

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50">
      <div className="flex-1">
        <div className="font-medium text-sm">{name}</div>
        
        {isService ? (
          // Service display
          <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
            <div className="text-blue-600 font-semibold">
              {pricingModel === 'per_count' 
                ? `€${pricePerCount?.toFixed(2)} per count` 
                : `€${pricePerMinute?.toFixed(2)}/min`}
            </div>
            <div className="text-slate-500">Service (all-or-nothing transfer)</div>
          </div>
        ) : (
          // Item display
          <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
            <div className="flex gap-3">
              <span>Qty: <span className="font-semibold">{quantity}</span></span>
              <span>Reserved: <span className="font-semibold">{reserved}</span></span>
              <span>Available: <span className="font-semibold">{available}</span></span>
            </div>
            {unitPrice && unitPrice > 0 && (
              <div className="text-green-700 font-semibold">€{unitPrice.toFixed(2)} each</div>
            )}
          </div>
        )}
      </div>
      
      <button 
        className={`px-3 py-2 border rounded text-sm font-medium transition-colors ${
          isAvailable
            ? 'hover:bg-blue-50 hover:border-blue-500 hover:text-blue-600'
            : 'opacity-50 cursor-not-allowed'
        }`}
        onClick={onAdd} 
        disabled={!isAvailable}
      >
        Add
      </button>
    </div>
  )
}

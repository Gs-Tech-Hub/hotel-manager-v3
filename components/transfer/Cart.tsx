"use client"

import React from 'react'

type CartItem = { 
  id: string
  name: string
  type: 'item' | 'service'
  quantity: number
  inventoryType?: 'item' | 'service'
}

type Props = {
  items: CartItem[]
  onUpdateQuantity: (id: string, qty: number) => void
  onRemove: (id: string) => void
  onSubmit: () => void
}

export default function Cart({ items, onUpdateQuantity, onRemove, onSubmit }: Props) {
  return (
    <div>
      <div className="font-medium">Transfer Cart</div>
      <div className="mt-2 space-y-2 max-h-80 overflow-auto">
        {items.length === 0 && <div className="text-sm text-muted-foreground">No items selected</div>}
        {items.map((c) => {
          const isService = c.type === 'service' || c.inventoryType === 'service'
          return (
            <div key={c.id} className="flex items-center justify-between p-2 border rounded bg-slate-50">
              <div className="flex-1">
                <div className="font-medium text-sm">{c.name}</div>
                <div className="text-xs text-muted-foreground">
                  {isService ? 'Service (all-or-nothing)' : 'Item'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isService && (
                  <input 
                    type="number" 
                    min={1} 
                    value={c.quantity} 
                    onChange={(e) => onUpdateQuantity(c.id, Number(e.target.value))} 
                    className="w-16 p-1 border rounded text-sm" 
                  />
                )}
                {isService && (
                  <div className="text-sm font-medium px-2 py-1 bg-blue-100 rounded">Qty: 1</div>
                )}
                <button className="text-xs text-red-600 hover:text-red-800" onClick={() => onRemove(c.id)}>
                  Remove
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button 
          onClick={onSubmit} 
          className="flex-1 px-3 py-2 bg-sky-600 text-white rounded hover:bg-sky-700 disabled:opacity-50" 
          disabled={items.length === 0}
        >
          Create Transfer
        </button>
        <button 
          onClick={() => items.forEach(it => onUpdateQuantity(it.id, 0))} 
          className="px-3 py-2 border rounded hover:bg-slate-50"
        >
          Clear
        </button>
      </div>
    </div>
  )
}

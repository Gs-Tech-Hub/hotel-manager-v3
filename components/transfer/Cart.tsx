"use client"

import React from 'react'

type CartItem = { id: string; name: string; type: string; quantity: number; available?: number }

type Props = {
  items: CartItem[]
  onUpdateQuantity: (id: string, qty: number) => void
  onRemove: (id: string) => void
  onSubmit: () => void
}

export default function Cart({ items, onUpdateQuantity, onRemove, onSubmit }: Props) {
  return (
    <div>
      <div className="font-medium">Cart</div>
      <div className="mt-2 space-y-2 max-h-80 overflow-auto">
        {items.length === 0 && <div className="text-sm text-muted-foreground">No items</div>}
        {items.map((c) => (
          <div key={c.id} className="flex items-center justify-between p-2 border rounded">
            <div>
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-muted-foreground">{c.type}</div>
            </div>
            <div className="flex items-center gap-2">
              <input type="number" min={1} value={c.quantity} onChange={(e) => onUpdateQuantity(c.id, Number(e.target.value))} className="w-20 p-1 border rounded" />
              <button className="text-sm text-red-600" onClick={() => onRemove(c.id)}>Remove</button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button onClick={onSubmit} className="px-3 py-2 bg-sky-600 text-white rounded" disabled={items.length === 0}>Create Transfer</button>
        <button onClick={() => items.forEach(it => onUpdateQuantity(it.id, 0))} className="px-3 py-2 border rounded">Clear</button>
      </div>
    </div>
  )
}

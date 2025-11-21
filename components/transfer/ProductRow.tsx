"use client"

import React from 'react'

type ProductRowProps = {
  id: string
  name: string
  available?: number | null
  onAdd: () => void
}

export default function ProductRow({ id, name, available = 0, onAdd }: ProductRowProps) {
  return (
    <div className="flex items-center justify-between p-2 border rounded">
      <div>
        <div className="font-medium">{name}</div>
        <div className="text-xs text-muted-foreground">Available: {available ?? 0}</div>
      </div>
      <div>
        <button className="px-2 py-1 border rounded" onClick={onAdd} disabled={(available ?? 0) <= 0}>Add</button>
      </div>
    </div>
  )
}

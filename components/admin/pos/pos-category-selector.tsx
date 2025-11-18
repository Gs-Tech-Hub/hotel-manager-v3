"use client"

import { LucideIcon } from "lucide-react"

interface POSCategory {
  id: string
  name: string
  icon?: LucideIcon
  color?: string
}

export function POSCategorySelector({
  categories,
  selectedId,
  onSelect,
}: {
  categories: POSCategory[]
  selectedId?: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
      {categories.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className={`p-3 rounded-lg font-semibold transition-all text-sm ${
            selectedId === c.id
              ? 'bg-sky-600 text-white shadow'
              : 'bg-white border hover:bg-slate-50'
          }`}
        >
          <div className="mb-1 text-center">{c.name}</div>
        </button>
      ))}
    </div>
  )
}

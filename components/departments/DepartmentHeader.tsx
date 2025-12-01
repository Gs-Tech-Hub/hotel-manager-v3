"use client"

import Link from 'next/link'
import { BookOpen, Utensils, Coffee, Activity, Gamepad } from 'lucide-react'
import Price from '@/components/ui/Price'

export default function DepartmentHeader({ department, sectionStock, onBack }: any) {
  const iconForType: Record<string, any> = { restaurants: Utensils, bars: Coffee, gyms: Activity, games: Gamepad }
  const key = (department?.type || department?.code || '').toString().toLowerCase()
  const Icon = iconForType[key] ?? BookOpen

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="p-2 bg-muted rounded-md"><Icon className="h-6 w-6" /></div>
        <div>
          <h1 className="text-2xl font-bold">{department?.name}</h1>
          {department?.description && <div className="text-sm text-muted-foreground">{department.description}</div>}
          {sectionStock && (
            <div className="text-sm text-muted-foreground mt-2">
              <span className="font-medium">Section stock:</span> Low {sectionStock.low} / High {sectionStock.high} / Empty {sectionStock.empty} — Products: {sectionStock.totalProducts}
            </div>
          )}

          {/* Section-level stats (if present in metadata.sectionStats) */}
          {department?.metadata?.sectionStats && (
            <div className="text-sm text-muted-foreground mt-2">
              <span className="font-medium">Orders:</span> {department.metadata.sectionStats.totalOrders ?? 0} •
              <span className="ml-2 font-medium">Pending:</span> {department.metadata.sectionStats.pendingOrders ?? 0} •
              <span className="ml-2 font-medium">Units Sold:</span> {department.metadata.sectionStats.fulfilledUnits ?? 0} •
              <span className="ml-2 font-medium">Amount:</span> <Price amount={department.metadata.sectionStats.totalAmount ?? 0} isMinor={true} />
            </div>
          )}
        </div>
      </div>

      <div>
        <button onClick={onBack} className="px-3 py-1 border rounded text-sm">Back</button>
      </div>
    </div>
  )
}

"use client"

import { ReactNode } from 'react'

type StockSummaryCardProps = {
  high: number
  low: number
  empty: number
  totalProducts: number
}

export default function StockSummaryCard({ high, low, empty, totalProducts }: StockSummaryCardProps) {
  return (
    <div className="p-3 bg-blue-50 rounded border border-blue-200">
      <div className="text-sm font-medium text-blue-900">Stock Summary</div>
      <div className="text-sm text-blue-800 mt-1 grid grid-cols-2 gap-2">
        <div><span className="font-semibold">Available:</span> {high}</div>
        <div><span className="font-semibold">Low Stock:</span> {low}</div>
        <div><span className="font-semibold">Out of Stock:</span> {empty}</div>
        <div><span className="font-semibold">Total Products:</span> {totalProducts}</div>
      </div>
    </div>
  )
}

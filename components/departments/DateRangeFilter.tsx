"use client"

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Calendar, X } from 'lucide-react'

type Props = {
  onDateChange?: (fromDate: string | null, toDate: string | null) => void
  defaultFromDate?: string | null
  defaultToDate?: string | null
}

export default function DateRangeFilter({ onDateChange, defaultFromDate, defaultToDate }: Props) {
  const [fromDate, setFromDate] = useState<string>(defaultFromDate || '')
  const [toDate, setToDate] = useState<string>(defaultToDate || '')
  const [showPicker, setShowPicker] = useState(false)
  const [filterLabel, setFilterLabel] = useState<string | null>(defaultFromDate && defaultToDate ? 'Today' : null)

  useEffect(() => {
    onDateChange?.(fromDate || null, toDate || null)
  }, [fromDate, toDate, onDateChange])

  const handleClear = () => {
    setFromDate('')
    setToDate('')
    setFilterLabel(null)
    onDateChange?.(null, null)
  }

  const handleQuickSelect = (days: number) => {
    const toD = new Date()
    const fromD = new Date()
    fromD.setDate(toD.getDate() - days)

    setFromDate(fromD.toISOString().split('T')[0])
    setToDate(toD.toISOString().split('T')[0])
    setFilterLabel(`Last ${days} days`)
  }

  const handleToday = () => {
    const today = new Date().toISOString().split('T')[0]
    setFromDate(today)
    setToDate(today)
    setFilterLabel('Today')
  }

  const handleLast24Hours = () => {
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    setFromDate(yesterday)
    setToDate(today)
    setFilterLabel('Last 24hrs')
  }

  const isFiltered = Boolean(fromDate || toDate)

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <button
          onClick={() => setShowPicker(!showPicker)}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded border text-sm transition-colors ${
            isFiltered
              ? 'bg-blue-50 border-blue-300 text-blue-900 hover:bg-blue-100'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Calendar className="h-4 w-4" />
          <span className="text-xs font-medium">
            {filterLabel || 'Date Range'}
          </span>
        </button>

        {showPicker && (
          <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded shadow-lg p-4 z-10 w-72">
            <div className="space-y-4">
              {/* Quick Select Buttons */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleToday()}
                  className="text-xs"
                >
                  Today
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleLast24Hours()}
                  className="text-xs"
                >
                  Last 24 hrs
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleQuickSelect(7)}
                  className="text-xs"
                >
                  Last 7 days
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleQuickSelect(30)}
                  className="text-xs"
                >
                  Last 30 days
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleQuickSelect(90)}
                  className="text-xs"
                >
                  Last 90 days
                </Button>
              </div>

              {/* Date Inputs */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">From Date</label>
                  <Input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">To Date</label>
                  <Input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Clear & Close Buttons */}
              <div className="flex gap-2 justify-end border-t pt-3">
                {isFiltered && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleClear}
                    className="text-xs"
                  >
                    Clear
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => setShowPicker(false)}
                  className="text-xs"
                >
                  Done
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick indicator badge */}
      {isFiltered && (
        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
          Filtered
        </span>
      )}
    </div>
  )
}

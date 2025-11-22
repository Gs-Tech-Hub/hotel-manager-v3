"use client"

import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import { Utensils, Coffee, Activity, Gamepad, BookOpen } from 'lucide-react'

type Department = {
  id: string
  code: string
  name: string
  description?: string
  type?: string
  icon?: string
  totalOrders?: number
  pendingOrders?: number
  referenceType?: string | null
  referenceId?: string | null
  metadata?: any
}

// Prefer mapping by department.type (these values come from the prisma model)
const iconForType: Record<string, any> = {
  restaurants: Utensils,
  bars: Coffee,
  gyms: Activity,
  games: Gamepad,
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDepartments = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/departments')
      if (!res.ok) throw new Error(`Failed to fetch departments (${res.status})`)
      const json = await res.json()
      if (!json) throw new Error('Invalid response')
      const data = json.data || json // handle legacy shapes
      // Keep only canonical/top-level departments (exclude per-entity sections)
      const canonical = (data || []).filter((dd: any) => {
        // prefer explicit reference fields, otherwise fall back to code pattern
        if (dd.referenceType) return false
        if (dd.metadata && dd.metadata.section) return false
        if (typeof dd.code === 'string' && dd.code.includes(':')) return false
        return true
      })
      setDepartments(canonical || [])
    } catch (err: any) {
      console.error('Failed to load departments', err)
      setError(err?.message || 'Failed to load departments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDepartments() }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Departments</h1>
        <div>
          <button onClick={fetchDepartments} className="px-3 py-1 border rounded text-sm">Refresh</button>
        </div>
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading departments...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {departments.map((d) => {
          const key = (d.type || d.code || '').toString().toLowerCase()
          const Icon = iconForType[key] ?? BookOpen
          return (
            <Link
              key={d.code}
              href={`/departments/${encodeURIComponent(d.code)}`}
              className="block border rounded-lg p-5 bg-card hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className="p-2 bg-muted rounded-md">
                    <Icon className="h-6 w-6 text-foreground" />
                   </div>
                  <div>
                    <h3 className="text-lg font-semibold">{d.name}</h3>
                    {d.description ? (
                      <p className="text-sm text-muted-foreground mt-1">{d.description}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1">Manage inventory, orders and KPIs for this department.</p>
                    )}
                    <div className="text-sm text-muted-foreground mt-3">Code: <span className="font-mono">{d.code}</span></div>
                  </div>
                </div>

                <div className="flex flex-col items-end justify-center gap-2">
                  {/* <div className="text-sm">Orders <span className="font-medium">{d.totalOrders ?? 0}</span></div> */}
                  {/* <div className="flex items-center gap-2">
                    {d.pendingOrders && d.pendingOrders > 0 ? (
                      <div className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">{d.pendingOrders} pending</div>
                    ) : (
                      <div className="text-xs text-muted-foreground">No pending</div>
                    )}
                    <div className="text-sm text-sky-600 font-medium">Open →</div>
                  </div> */}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

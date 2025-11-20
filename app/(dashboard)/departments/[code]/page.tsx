"use client"

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Utensils, Coffee, Activity, Gamepad, BookOpen } from 'lucide-react'

type DepartmentInfo = {
  code: string
  name: string
  description?: string
  type?: string
  icon?: string
}

const iconForType: Record<string, any> = {
  restaurants: Utensils,
  bars: Coffee,
  gyms: Activity,
  games: Gamepad,
}

type MenuItem = {
  id: string
  inventoryId?: string
  name: string
  price?: number
  available?: boolean
}

type ChildDept = DepartmentInfo & {
  totalOrders?: number
  pendingOrders?: number
  processingOrders?: number
  fulfilledOrders?: number
  stock?: { low: number; high: number; empty: number; totalProducts: number }
}

export default function DepartmentDetail(/* { params }: { params: { code: string } } */) {
  const { code } = useParams() as { code?: string }
  const [menu, setMenu] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [department, setDepartment] = useState<DepartmentInfo | null>(null)
  const [children, setChildren] = useState<ChildDept[]>([])
  const router = useRouter()

  const fetchMenu = async () => {
    setLoading(true)
    setError(null)
    try {
      if (!code) throw new Error('Missing department code')
      const res = await fetch(`/api/departments/${encodeURIComponent(code)}/menu`)
      if (!res.ok) throw new Error(`Failed to fetch menu (${res.status})`)
      const json = await res.json()
      if (!json?.success) throw new Error(json?.error || 'Invalid response')
      setMenu(json.data || [])
    } catch (err: any) {
      console.error('Failed to load department menu', err)
      setError(err?.message || 'Failed to load department menu')
    } finally {
      setLoading(false)
    }
  }

  const fetchDepartment = async () => {
    try {
      if (!code) throw new Error('Missing department code')
      const res = await fetch(`/api/departments/${encodeURIComponent(code)}`)
      if (!res.ok) throw new Error(`Failed to fetch department (${res.status})`)
      const json = await res.json()
      const data = json.data || json
      setDepartment(data || null)
      // Also load children (per-entity sections) when main department exists
      if (data) await loadChildrenForDepartment(data)
    } catch (err) {
      console.error('Failed to load department', err)
    }
  }

  const loadChildrenForDepartment = async (dept: DepartmentInfo) => {
    try {
      const res = await fetch('/api/departments')
      if (!res.ok) throw new Error('Failed to fetch departments')
      const json = await res.json()
      const all = json.data || json || []
      // Children are seeded with codes like `restaurant:{id}:main` so filter by prefix
      const prefix = `${dept.code}:`
      const found = (all as any[])
        .filter((d) => typeof d.code === 'string' && d.code.startsWith(prefix))
        .map((d) => ({
          code: d.code,
          name: d.name,
          description: d.description,
          type: d.type,
          icon: d.icon,
          totalOrders: d.totalOrders,
          pendingOrders: d.pendingOrders,
          processingOrders: d.processingOrders,
          fulfilledOrders: d.fulfilledOrders,
        })) as ChildDept[]

      // Fetch stock summaries in parallel
      const withStock = await Promise.all(
        found.map(async (c) => {
          try {
            const r = await fetch(`/api/departments/${encodeURIComponent(c.code)}/stock`)
            if (!r.ok) return { ...c }
            const j = await r.json()
            const s = j.data || j
            return { ...c, stock: s }
          } catch (e) {
            return { ...c }
          }
        })
      )
      setChildren(withStock)
    } catch (e) {
      console.error('Failed to load children', e)
    }
  }

  useEffect(() => { fetchMenu(); fetchDepartment() }, [code])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-muted rounded-md">
            {(() => {
              const key = (department?.type || department?.code || code || '').toString().toLowerCase()
              const Icon = iconForType[key] ?? BookOpen
              return <Icon className="h-6 w-6" />
            })()}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{department?.name || code}</h1>
            {department?.description && <div className="text-sm text-muted-foreground">{department.description}</div>}
          </div>
        </div>
        <div>
          <button onClick={() => router.back()} className="px-3 py-1 border rounded text-sm">Back</button>
        </div>
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading menu...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {menu.map((m) => (
          <div key={m.id} className="border rounded p-4 bg-white">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-semibold">{m.name}</div>
                <div className="text-xs text-muted-foreground">{m.available ? 'Available' : 'Unavailable'}</div>
              </div>
              <div className="text-right">
                <div className="font-medium">{m.price ? new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(m.price)) : '-'}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {children.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold">Sections</h2>
          <div className="mt-3 space-y-3">
            {children.map((c) => (
              <div key={c.code} className="flex items-center justify-between border rounded p-3 bg-card">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-sm text-muted-foreground">Code: <span className="font-mono">{c.code}</span></div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-sm">Orders: <span className="font-medium">{c.totalOrders ?? 0}</span></div>
                  <div className="text-sm">Pending: <span className="font-medium">{c.pendingOrders ?? 0}</span></div>
                  <div className="text-sm">Stock: <span className="font-medium">Low {c.stock?.low ?? '-'} / High {c.stock?.high ?? '-'} / Empty {c.stock?.empty ?? '-'}</span></div>
                  <div>
                    <a href={`/departments/${encodeURIComponent(c.code)}`} className="text-sm text-sky-600">Open</a>
                  </div>
                  <div>
                    {/* Quick transfer link: opens transfer creation page with pre-filled destination */}
                    <a href={`/departments/${encodeURIComponent(String(department?.code || code || ''))}/transfer?to=${encodeURIComponent(c.code)}`} className="text-sm text-amber-600">Transfer</a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

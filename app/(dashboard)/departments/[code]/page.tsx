"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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

export default function DepartmentDetail({ params }: { params: { code: string } }) {
  const { code } = params
  const [menu, setMenu] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [department, setDepartment] = useState<DepartmentInfo | null>(null)
  const router = useRouter()

  const fetchMenu = async () => {
    setLoading(true)
    setError(null)
    try {
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
      const res = await fetch(`/api/departments/${encodeURIComponent(code)}`)
      if (!res.ok) throw new Error(`Failed to fetch department (${res.status})`)
      const json = await res.json()
      const data = json.data || json
      setDepartment(data || null)
    } catch (err) {
      console.error('Failed to load department', err)
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
    </div>
  )
}

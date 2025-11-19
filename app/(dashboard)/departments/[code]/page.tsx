"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

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

  useEffect(() => { fetchMenu() }, [code])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Department: {code}</h1>
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

"use client"

import Link from 'next/link'
import { useEffect, useState } from 'react'

type Department = { id: string; code: string; name: string }

type InventoryItem = {
  id: string
  name: string
  sku: string
  category: string
  quantity: number
  unitPrice: number
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedDept, setSelectedDept] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  

  const fetchItems = async (dept?: string | null) => {
    setLoading(true)
    setError(null)
    try {
      const url = new URL('/api/inventory', window.location.origin)
      if (dept) url.searchParams.set('department', dept)
      const res = await fetch(url.toString())
      if (!res.ok) throw new Error(`Failed to fetch inventory (${res.status})`)
      const json = await res.json()
      if (!json?.success) throw new Error(json?.error || 'Invalid response')
      setItems(json.data?.items || [])
    } catch (err: any) {
      console.error('Failed to load inventory', err)
      setError(err?.message || 'Failed to load inventory')
    } finally {
      setLoading(false)
    }
  }

  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/departments')
      if (!res.ok) throw new Error('Failed to fetch departments')
      const json = await res.json()
      const data = json.data || json
      setDepartments(data || [])
    } catch (err) {
      console.warn('Could not load departments for inventory filter', err)
    }
  }

  useEffect(() => {
    fetchDepartments()
    fetchItems(selectedDept)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDept])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventory</h1>
        <div>
          <button onClick={() => fetchItems(selectedDept)} className="px-3 py-1 border rounded text-sm mr-2">Refresh</button>
          <Link href={selectedDept ? `/inventory/transfer?source=${encodeURIComponent(selectedDept)}` : '#'} className={`px-3 py-1 border rounded text-sm ${!selectedDept ? 'opacity-60 pointer-events-none' : ''}`}>Transfer</Link>
        </div>
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading inventory...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="flex items-center gap-4">
        <div>
          <label className="text-sm mr-2">Filter by department</label>
          <select value={selectedDept ?? ''} onChange={(e) => setSelectedDept(e.target.value || null)} className="border px-2 py-1">
            <option value="">All Departments</option>
            {departments
              .filter((d) => !String(d.code).includes(':')) // only top-level departments
              .map((d) => (
                <option key={d.code} value={d.code}>{d.name} ({d.code})</option>
              ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full table-auto border-collapse">
          <thead>
            <tr className="text-left">
              <th className="p-2">Name</th>
              <th className="p-2">SKU</th>
              <th className="p-2">Category</th>
              <th className="p-2">Quantity</th>
              <th className="p-2">Price</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t">
                <td className="p-2">{it.name}</td>
                <td className="p-2 text-xs text-muted-foreground">{it.sku}</td>
                <td className="p-2">{it.category}</td>
                <td className="p-2">{it.quantity}</td>
                <td className="p-2">{new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(it.unitPrice))}</td>
                <td className="p-2">
                  <Link href={`/inventory/${encodeURIComponent(it.id)}`} className="px-2 py-1 bg-sky-600 text-white rounded text-sm">Open</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
    </div>
  )
}

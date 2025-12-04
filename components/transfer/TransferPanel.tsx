"use client"

import React, { useEffect, useState } from 'react'
import { mapDeptCodeToCategory } from '@/lib/utils'
import Pagination from '@/components/ui/Pagination'
import Cart from '@/components/transfer/Cart'

type MenuItem = { id: string; name: string; available?: number | boolean; unitPrice?: number }

export default function TransferPanel({ sourceCode, onClose, initialTarget }: { sourceCode: string; onClose: () => void; initialTarget?: string | null }) {
  const [productType, setProductType] = useState<'inventoryItem' | 'drink' | 'food'>('inventoryItem')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(12)
  const [products, setProducts] = useState<MenuItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const [departments, setDepartments] = useState<Array<{ id: string; code: string; name: string }>>([])
  const [targetDept, setTargetDept] = useState<string | null>(initialTarget ?? null)

  useEffect(() => {
    if (initialTarget) setTargetDept(initialTarget)
  }, [initialTarget])

  const [cart, setCart] = useState<{ id: string; name: string; type: string; quantity: number }[]>([])

  useEffect(() => { fetchDepartments(); fetchProducts(1) }, [productType])

  async function fetchDepartments() {
    try {
      const [deptRes, sectionsRes] = await Promise.all([
        fetch('/api/departments'),
        fetch(`/api/admin/department-sections?departmentCode=${encodeURIComponent(sourceCode)}`)
      ])
      const deptData = await deptRes.json()
      const sectionsData = await sectionsRes.json()
      
      // Map departments
      const list = deptData.data || deptData || []
      const depts = list.map((d: any) => ({ id: d.id, code: d.code, name: d.name }))
      
      // Get the source department to get its ID for filtering sections
      const sourceDept = depts.find((d: any) => d.code === sourceCode)
      
      // Map sections - only include sections from the source department
      const sections = (sectionsData?.data || [])
        .filter((s: any) => s.departmentId === sourceDept?.id)
        .map((s: any) => {
          const sectionCode = `${sourceCode}:${s.slug || s.id}`
          return { id: s.id, code: sectionCode, name: `${s.name}` }
        })
      
      setDepartments([...depts, ...sections])
    } catch (e) {
      console.error('failed to load departments', e)
    }
  }

  async function fetchProducts(p = 1) {
    if (!sourceCode) return
    setLoading(true)
    try {
      const q = new URLSearchParams({ type: productType, page: String(p), pageSize: String(pageSize) })
      if (search) q.set('search', search)
  // Backend filters department by category; add category param instead of calling departments endpoint
  const cat = mapDeptCodeToCategory(sourceCode)
  if (cat) q.set('category', cat)
  const res = await fetch(`/api/inventory?${q.toString()}`)
      const j = await res.json()
      if (res.ok && j?.success) {
        setProducts((j.data.items || []).map((it: any) => ({ id: it.id, name: it.name, available: it.available, unitPrice: it.unitPrice })))
        setTotal(j.data.total || 0)
        setPage(p)
      }
    } catch (e) {
      console.error('fetchProducts error', e)
    } finally {
      setLoading(false)
    }
  }

  function addToCart(item: MenuItem) {
    setCart((c) => {
      const found = c.find((x) => x.id === item.id)
      const avail = typeof item.available === 'boolean' ? (item.available ? 1 : 0) : Number(item.available ?? 0)
      if (found) return c.map((x) => x.id === item.id ? { ...x, quantity: Math.min(avail, x.quantity + 1) } : x)
      return [...c, { id: item.id, name: item.name, type: productType, quantity: 1 }]
    })
  }

  function updateQty(id: string, qty: number) {
    setCart((c) => c.map((x) => x.id === id ? { ...x, quantity: qty } : x))
  }

  function removeItem(id: string) { setCart((c) => c.filter((x) => x.id !== id)) }

  async function submit() {
    if (!targetDept) return alert('Choose a destination department or section')
    if (cart.length === 0) return alert('Add items to transfer')
    try {
      const items = cart.map((c) => ({ type: c.type, id: c.id, quantity: c.quantity }))
      const res = await fetch(`/api/departments/${encodeURIComponent(sourceCode)}/transfer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toDepartmentCode: targetDept, items }),
      })
      const j = await res.json()
      if (!res.ok || !j?.success) {
        alert(j?.error?.message || 'Failed to create transfer')
      } else {
        alert('Transfer created')
        onClose()
      }
    } catch (e) {
      console.error('submit transfer error', e)
      alert('Failed to create transfer')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-md md:rounded-md w-full md:w-3/4 max-h-[90vh] overflow-auto p-4 z-50">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Transfer from {sourceCode}</h3>
          <div>
            <button onClick={onClose} className="px-2 py-1 border rounded">Close</button>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <select className="p-2 border rounded" value={productType} onChange={(e) => setProductType(e.target.value as any)}>
              <option value="inventoryItem">Inventory Items</option>
              <option value="drink">Drinks</option>
              <option value="food">Food</option>
            </select>
            <input className="p-2 border rounded flex-1" placeholder="Search products" value={search} onChange={(e) => setSearch(e.target.value)} />
            <button className="px-3 py-2 border rounded" onClick={() => fetchProducts(1)}>Search</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium mb-2">Products</div>
              <div className="space-y-2 max-h-80 overflow-auto">
                {loading ? <div className="text-sm">Loading...</div> : products.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">Available: {typeof p.available === 'boolean' ? (p.available ? '1' : '0') : String(p.available ?? 0)}</div>
                    </div>
                    <div>
                      <button className="px-2 py-1 border rounded" onClick={() => addToCart(p)} disabled={(typeof p.available === 'boolean' ? (p.available ? 1 : 0) : Number(p.available ?? 0)) <= 0}>Add</button>
                    </div>
                  </div>
                ))}
              </div>
              <Pagination page={page} total={total} pageSize={pageSize} onPrev={() => fetchProducts(Math.max(1, page - 1))} onNext={() => fetchProducts(page + 1)} />
            </div>

            <div>
              <div className="text-sm font-medium">Destination</div>
              <div className="mt-2">
                <select className="w-full p-2 border rounded" value={targetDept ?? ''} onChange={(e) => setTargetDept(e.target.value || null)}>
                  <option value="">Select department or section...</option>
                  {departments.map((d) => (<option key={d.id} value={d.code}>{d.name} — {d.code}</option>))}
                </select>
              </div>

              <div className="mt-4">
                <Cart items={cart} onUpdateQuantity={updateQty} onRemove={removeItem} onSubmit={submit} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

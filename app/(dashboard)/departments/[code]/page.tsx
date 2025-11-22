"use client"

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Utensils, Coffee, Activity, Gamepad, BookOpen } from 'lucide-react'
import { useMemo } from 'react'

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

type ProductDetail = {
  id: string
  name: string
  type: string
  available: number | boolean
  unitPrice?: number
  unitsSold?: number
  amountSold?: number
  pendingQuantity?: number
  reservedQuantity?: number
}

type ChildDept = DepartmentInfo & {
  totalOrders?: number
  pendingOrders?: number
  processingOrders?: number
  fulfilledOrders?: number
  stock?: { low: number; high: number; empty: number; totalProducts: number }
  products?: ProductDetail[]
}

export default function DepartmentDetail(/* { params }: { params: { code: string } } */) {
  const { code } = useParams() as { code?: string }
  const [menu, setMenu] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [department, setDepartment] = useState<DepartmentInfo | null>(null)
  const [children, setChildren] = useState<ChildDept[]>([])
  const [sectionStock, setSectionStock] = useState<{ low: number; high: number; empty: number; totalProducts: number } | null>(null)
  const [sectionProducts, setSectionProducts] = useState<ProductDetail[] | null>(null)
  const [sectionProductsLoading, setSectionProductsLoading] = useState(false)
 
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
      if (data) {
        // If the current code looks like a section (contains ':'), treat this
        // as a section detail page and load the section's stock summary.
        if (code.includes(':')) {
          try {
            const sRes = await fetch(`/api/departments/${encodeURIComponent(code)}/stock`)
            if (sRes.ok) {
              const sj = await sRes.json()
              const sData = sj?.data || sj || null
              setSectionStock(sData)
              console.debug('[section] stock fetch', code, { ok: sRes.ok, status: sRes.status, data: sData })
            }
            // Also load the full product details for this section so the
            // detailed page can show availability, units sold, pending,
            // reserved and amount sold.
            fetchSectionProducts(code)
          } catch (e) {
            console.warn('Failed to fetch section stock', e)
            setSectionStock(null)
          }
        } else {
          await loadChildrenForDepartment(data)
        }
      }
    } catch (err) {
      console.error('Failed to load department', err)
    }
  }

  const fetchSectionProducts = async (sectionCode: string) => {
    setSectionProductsLoading(true)
    setSectionProducts(null)
    try {
      // Attempt to infer the parent department code from the section code
      // e.g. section codes are seeded like `restaurant:{id}:main` so the
      // parent department code is likely the first two segments.
      let parent = sectionCode
      if (sectionCode.includes(':')) {
        const parts = sectionCode.split(':')
        if (parts.length >= 2) parent = parts.slice(0, 2).join(':')
      }

      // Primary attempt: call products on the parent department and pass
      // the section param so the server calculates per-section stats.
      let url = `/api/departments/${encodeURIComponent(parent)}/products?details=true&section=${encodeURIComponent(sectionCode)}&pageSize=100`
      let res = await fetch(url)

      // Fallback: if parent-based call fails, try calling against the
      // section department itself without a separate section filter.
      if (!res.ok) {
        url = `/api/departments/${encodeURIComponent(sectionCode)}/products?details=true&pageSize=100`
        res = await fetch(url)
      }

      if (!res.ok) {
        console.warn('Failed to fetch section products', { url, status: res.status })
        setSectionProducts([])
        return
      }

      const j = await res.json()
      const items = (j.data?.items || j.items || []) as any[]
      const products = items.map((it) => ({
        id: it.id,
        name: it.name,
        type: it.type,
        available: it.available,
        unitPrice: it.unitPrice,
        unitsSold: it.unitsSold || 0,
        amountSold: it.amountSold || 0,
        pendingQuantity: it.pendingQuantity || 0,
        reservedQuantity: it.reservedQuantity || 0,
      }))
      setSectionProducts(products)
    } catch (e) {
      console.error('fetchSectionProducts error', e)
      setSectionProducts([])
    } finally {
      setSectionProductsLoading(false)
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

      // Fetch product details (limited) for each child in parallel. We don't
      // fetch or surface the full stock summary here (keeps the section list
      // lightweight). Stock details are shown only on a section's detail page.
      const withProducts = await Promise.all(
        found.map(async (c) => {
          try {
            const pRes = await fetch(`/api/departments/${encodeURIComponent(dept.code)}/products?details=true&section=${encodeURIComponent(c.code)}&pageSize=4`)
            let products: ProductDetail[] = []
            if (pRes.ok) {
              try {
                const pj = await pRes.json()
                const items = (pj.data?.items || pj.items || []) as any[]
                console.debug('[dept children] products fetch', c.code, { ok: pRes.ok, status: pRes.status, itemsCount: items.length })
                products = items.map((it) => ({
                  id: it.id,
                  name: it.name,
                  type: it.type,
                  available: it.available,
                  unitPrice: it.unitPrice,
                  unitsSold: it.unitsSold || 0,
                  amountSold: it.amountSold || 0,
                  pendingQuantity: it.pendingQuantity || 0,
                  reservedQuantity: it.reservedQuantity || 0,
                }))
              } catch (e) {
                products = []
              }
            }

            return { ...c, products }
          } catch (e) {
            return { ...c }
          }
        })
      )
      setChildren(withProducts)
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
            {sectionStock && (
              <div className="text-sm text-muted-foreground mt-2">
                <span className="font-medium">Section stock:</span> Low {sectionStock.low} / High {sectionStock.high} / Empty {sectionStock.empty} — Products: {sectionStock.totalProducts}
              </div>
            )}
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

      {code?.includes(':') && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold">Products</h2>
          <div className="mt-3">
            {sectionProductsLoading ? (
              <div className="text-sm text-muted-foreground">Loading products...</div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="px-2 py-1">Product</th>
                      <th className="px-2 py-1">Available</th>
                      <th className="px-2 py-1">Units Sold</th>
                      <th className="px-2 py-1">Pending</th>
                      <th className="px-2 py-1">Reserved</th>
                      <th className="px-2 py-1">Amount Sold</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sectionProducts && sectionProducts.length > 0 ? (
                      sectionProducts.map((p) => (
                        <tr key={p.id} className="border-t">
                          <td className="px-2 py-2">{p.name}</td>
                          <td className="px-2 py-2">{String(p.available)}</td>
                          <td className="px-2 py-2">{p.unitsSold ?? 0}</td>
                          <td className="px-2 py-2">{p.pendingQuantity ?? 0}</td>
                          <td className="px-2 py-2">{p.reservedQuantity ?? 0}</td>
                          <td className="px-2 py-2">{p.amountSold ? new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(p.amountSold)) : '-'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-2 py-4 text-muted-foreground" colSpan={6}>No products available</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {children.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold">Sections</h2>
          <div className="mt-3 space-y-3">
            {children.map((c) => (
              <div key={c.code} className="border rounded p-3 bg-card">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-sm text-muted-foreground">Code: <span className="font-mono">{c.code}</span></div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-sm">Orders: <span className="font-medium">{c.totalOrders ?? 0}</span></div>
                    <div className="text-sm">Pending: <span className="font-medium">{c.pendingOrders ?? 0}</span></div>
                    <div>
                      <a href={`/departments/${encodeURIComponent(c.code)}`} className="text-sm text-sky-600">Open</a>
                    </div>
                  </div>
                </div>

                {/* Product table (shows headers even if empty) */}
                <div className="w-full mt-3 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="px-2 py-1">Product</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.products && c.products.length > 0 ? (
                        c.products.map((p) => (
                          <tr key={p.id} className="border-t">
                            <td className="px-2 py-2">{p.name}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="px-2 py-4 text-muted-foreground" colSpan={1}>No products available</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    
    </div>
  )
}

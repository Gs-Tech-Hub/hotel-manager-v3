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
  // Route param may be percent-encoded (e.g. 'restaurant%3Amain').
  // Normalize by decoding once so checks like includes(':') work.
  const decodedCode = useMemo(() => (code ? decodeURIComponent(code) : ''), [code])
  const [menu, setMenu] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [department, setDepartment] = useState<DepartmentInfo | null>(null)
  const [children, setChildren] = useState<ChildDept[]>([])
  const [sectionStock, setSectionStock] = useState<{ low: number; high: number; empty: number; totalProducts: number } | null>(null)
  const [sectionProducts, setSectionProducts] = useState<ProductDetail[] | null>(null)
  const [sectionProductsLoading, setSectionProductsLoading] = useState(false)
  const [pendingModalOpen, setPendingModalOpen] = useState(false)
  const [pendingModalProduct, setPendingModalProduct] = useState<string | null>(null)
  const [pendingModalItems, setPendingModalItems] = useState<any[] | null>(null)
  const [pendingModalLoading, setPendingModalLoading] = useState(false)
 
  const router = useRouter()

  const [pendingOrderLines, setPendingOrderLines] = useState<any[] | null>(null)
  const [pendingOrderLinesLoading, setPendingOrderLinesLoading] = useState(false)

  const fetchMenu = async () => {
    setLoading(true)
    setError(null)
    try {
      // Skip menu fetch when viewing a section (sections have colon in code)
      if (!decodedCode) throw new Error('Missing department code')
      if (decodedCode.includes(':')) {
        setMenu([])
        return
      }
      const res = await fetch(`/api/departments/${encodeURIComponent(decodedCode)}/menu`)
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
  if (!decodedCode) throw new Error('Missing department code')
  const res = await fetch(`/api/departments/${encodeURIComponent(decodedCode)}`)
      if (!res.ok) throw new Error(`Failed to fetch department (${res.status})`)
      const json = await res.json()
      const data = json.data || json
      setDepartment(data || null)
      // Also load children (per-entity sections) when main department exists
      if (data) {
        // If the current code looks like a section (contains ':'), treat this
        // as a section detail page and load the section's stock summary.
        if (decodedCode.includes(':')) {
          try {
            const sRes = await fetch(`/api/departments/${encodeURIComponent(decodedCode)}/stock`)
            if (sRes.ok) {
              const sj = await sRes.json()
              const sData = sj?.data || sj || null
              setSectionStock(sData)
              console.debug('[section] stock fetch', code, { ok: sRes.ok, status: sRes.status, data: sData })
            }
            // Also load the full product details for this section so the
            // detailed page can show availability, units sold, pending,
            // reserved and amount sold.
            fetchSectionProducts(decodedCode)
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

  const fetchPendingOrderLines = async (sectionCode: string) => {
    setPendingOrderLinesLoading(true)
    setPendingOrderLines(null)
    try {
      // Use the department orders endpoint to obtain orderHeader ids and lines
      const res = await fetch(`/api/departments/${encodeURIComponent(sectionCode)}/orders?status=pending&limit=200`)
      if (!res.ok) {
        setPendingOrderLines([])
        return
      }
      const j = await res.json()
      const orders = j.data?.orders || j.orders || []
      const lines: any[] = []
      for (const o of orders) {
        const hdr = o.orderHeader || o.order || o
        const lns = o.lines || []
        for (const l of lns) {
          lines.push({
            id: l.id,
            productName: l.productName || l.name,
            quantity: l.quantity,
            orderHeaderId: hdr?.id,
            orderNumber: hdr?.orderNumber,
            customerName: hdr?.customer?.name || hdr?.customerName || null,
            status: l.status || 'pending'
          })
        }
      }
      setPendingOrderLines(lines)
    } catch (e) {
      console.error('fetchPendingOrderLines error', e)
      setPendingOrderLines([])
    } finally {
      setPendingOrderLinesLoading(false)
    }
  }

  const loadChildrenForDepartment = async (dept: DepartmentInfo) => {
    try {
      const res = await fetch('/api/departments')
      if (!res.ok) throw new Error('Failed to fetch departments')
      const json = await res.json()
      const all = json.data || json || []
      // Children are seeded with codes like `restaurant:{id}:main` so filter by prefix
      // Use a robust matching strategy to locate section children. Departments
      // may have codes like `RESTAURANT`, `BAR_CLUB` while sections use
      // `restaurant:<id>:main` or `bar:<id>:main`. Normalize and compare by
      // lowercasing and also by the first token of the department code.
      const deptCode = (dept.code || '').toString().toLowerCase()
      const deptFirst = deptCode.split(/[^a-z0-9]+/)[0] || deptCode

      const found = (all as any[])
        .filter((d) => {
          if (!d || typeof d.code !== 'string') return false
          const c = d.code.toString().toLowerCase()
          return (
            c.startsWith(`${deptCode}:`) ||
            c.startsWith(`${deptFirst}:`) ||
            // Also accept explicit references if present
            (d.referenceType && String(d.referenceType).toLowerCase() === deptCode) ||
            (d.referenceId && String(d.referenceId) === String((dept as any).id))
          )
        })
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

      // Set children immediately (fast render). Then load a small product
      // preview for each child asynchronously so the initial page load is
      // not blocked by multiple product requests.
      setChildren(found)

      // Fire-and-forget product previews (limit pageSize to 4). Update each
      // child as results arrive. This keeps the sections list responsive.
      for (const c of found) {
        ;(async () => {
          try {
            const pRes = await fetch(`/api/departments/${encodeURIComponent(dept.code)}/products?details=true&section=${encodeURIComponent(c.code)}&pageSize=4`)
            if (!pRes.ok) return
            const pj = await pRes.json()
            const items = (pj.data?.items || pj.items || []) as any[]
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

            setChildren((prev) => prev.map((x) => (x.code === c.code ? { ...x, products } : x)))
          } catch (e) {
            // ignore individual child product failures
          }
        })()
      }
    } catch (e) {
      console.error('Failed to load children', e)
    }
  }

  const refreshPendingForModal = async (productName: string | null) => {
    if (!productName) return
    setPendingModalLoading(true)
    setPendingModalItems(null)
    try {
  if (!decodedCode) throw new Error('Missing section code')
  // Fetch department-level orders with pending status and filter lines
  const res = await fetch(`/api/departments/${encodeURIComponent(decodedCode)}/orders?status=pending&limit=200`)
      if (!res.ok) throw new Error('Failed to load pending orders')
      const j = await res.json()
      const orders = j.data?.orders || j.orders || []
      const matches: any[] = []
      for (const o of orders) {
        const hdr = o.orderHeader || o.order || o
        const lines = o.lines || []
        for (const l of lines) {
          // Compare by product name (backend may change shape); be tolerant
          if ((l.productName || l.name || '').toString().toLowerCase() === productName.toString().toLowerCase()) {
            matches.push({
              id: l.id,
              productName: l.productName || l.name,
              quantity: l.quantity,
              orderHeader: hdr,
              customerName: hdr?.customer?.name || hdr?.customerName || null,
            })
          }
        }
      }
      setPendingModalItems(matches)
    } catch (e) {
      console.error('refreshPendingForModal error', e)
      setPendingModalItems([])
    } finally {
      setPendingModalLoading(false)
    }
  }

  const openPendingModal = async (productName: string) => {
    setPendingModalProduct(productName)
    setPendingModalOpen(true)
    await refreshPendingForModal(productName)
  }

  


  // Trigger fetches when the decoded route param changes
  useEffect(() => { fetchMenu(); fetchDepartment() }, [decodedCode])

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
        {/* Show menu cards only when viewing a top-level department (not a section)
            and only when there are no sections for this department. If the
            department has sections we keep the view focused on sections only. */}
          {(!decodedCode.includes(':') && children.length === 0) && menu.map((m) => (
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

      {decodedCode.includes(':') && (
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
                      <th className="px-2 py-1">Amount Sold</th>
                      <th className="px-2 py-1">Actions</th>
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
                          <td className="px-2 py-2">{p.amountSold ? new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(p.amountSold)) : '-'}</td>
                          <td className="px-2 py-2">
                            {p.pendingQuantity && p.pendingQuantity > 0 ? (
                              <button
                                onClick={() => openPendingModal(p.name)}
                                className="px-2 py-1 text-sm bg-amber-100 text-amber-800 rounded"
                              >
                                View / Fulfill ({p.pendingQuantity})
                              </button>
                            ) : (
                              <div className="text-sm text-muted-foreground">—</div>
                            )}
                          </td>
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

                {/* NOTE: product lists are intentionally omitted in the section summary to keep this view lightweight.
                    Detailed product and pending-order actions are available on the section detail page. */}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section-level pending orders panel (visible on section detail pages) */}
      {decodedCode.includes(':') && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold">Pending Orders</h2>
          <div className="mt-3">
            {pendingOrderLinesLoading ? (
              <div className="text-sm text-muted-foreground">Loading pending orders...</div>
            ) : (
              <div className="space-y-2">
                {pendingOrderLines && pendingOrderLines.length > 0 ? (
                  pendingOrderLines.map((ln) => (
                    <div key={`${ln.orderHeaderId}-${ln.id}`} className="border rounded p-3 flex items-center justify-between">
                      <div>
                        <div className="font-medium">Order #{ln.orderNumber} — {ln.productName}</div>
                        <div className="text-sm text-muted-foreground">Customer: {ln.customerName || 'Guest'} — Qty: {ln.quantity}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch(`/api/orders/${encodeURIComponent(ln.orderHeaderId)}/fulfillment`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ lineItemId: ln.id, status: 'fulfilled' }),
                              })
                              if (!res.ok) throw new Error('Failed to mark delivered')
                              // refresh lists
                              await fetchPendingOrderLines(decodedCode)
                              await fetchSectionProducts(decodedCode)
                            } catch (e) {
                              console.error('Failed to mark delivered', e)
                              alert('Failed to mark item delivered')
                            }
                          }}
                          className="px-3 py-1 bg-sky-600 text-white rounded text-sm"
                        >Mark delivered</button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground">No pending orders for this section.</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pending items modal (simple inline modal) */}
      {pendingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Pending orders for: {pendingModalProduct}</h3>
              <div>
                <button onClick={() => setPendingModalOpen(false)} className="px-3 py-1 border rounded">Close</button>
              </div>
            </div>

            <div className="mt-4">
              {pendingModalLoading ? (
                <div className="text-sm text-muted-foreground">Loading pending items...</div>
              ) : pendingModalItems && pendingModalItems.length > 0 ? (
                <div className="space-y-3">
                  {pendingModalItems.map((it) => (
                    <div key={`${it.orderHeader.id}-${it.id}`} className="border rounded p-2 flex items-center justify-between">
                      <div>
                        <div className="font-medium">Order #{it.orderHeader.orderNumber} — {it.productName}</div>
                        <div className="text-sm text-muted-foreground">Customer: {it.customerName || 'Guest'} — Qty: {it.quantity}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch(`/api/orders/${encodeURIComponent(it.orderHeader.id)}/fulfillment`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ lineItemId: it.id, status: 'fulfilled' }),
                              })
                              if (!res.ok) throw new Error('Failed to mark delivered')
                              // refresh modal list
                              await refreshPendingForModal(pendingModalProduct)
                            } catch (e) {
                              console.error('Failed to fulfill line', e)
                              alert('Failed to mark item delivered')
                            }
                          }}
                          className="px-3 py-1 bg-sky-600 text-white rounded text-sm"
                        >Mark delivered</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No pending items found for this product.</div>
              )}
            </div>
          </div>
        </div>
      )}
    
    </div>
  )
}

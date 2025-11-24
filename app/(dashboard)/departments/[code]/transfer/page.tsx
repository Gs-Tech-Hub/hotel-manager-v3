"use client"

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useRouter, useParams } from 'next/navigation'

type ProductRow = { id: string; name: string; type: string; available: number; unitPrice?: number }
type CartItem = { id: string; name: string; type: string; quantity: number }

export default function DepartmentTransferPage() {
  const params = useParams() as { code?: string }
  const search = useSearchParams()
  const to = search.get('to') || ''
  const router = useRouter()

  const [productType, setProductType] = useState<'drink' | 'inventoryItem' | 'food'>('drink')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(12)
  const [products, setProducts] = useState<ProductRow[]>([])
  const [totalProducts, setTotalProducts] = useState(0)
  const [loadingProducts, setLoadingProducts] = useState(false)

  const [cart, setCart] = useState<CartItem[]>([])
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [transfers, setTransfers] = useState<any[]>([])
  const [transfersPage, setTransfersPage] = useState(1)
  const [transfersTotal, setTransfersTotal] = useState(0)
  const [loadingTransfers, setLoadingTransfers] = useState(false)
  const [deptId, setDeptId] = useState<string | null>(null)

  const deptCode = params.code

  useEffect(() => {
    fetchProducts()
  }, [productType, page, query, deptCode])

  useEffect(() => {
    fetchTransfers()
  }, [transfersPage, deptCode])

  useEffect(() => {
    // fetch department info to get dept id
    async function fetchDept() {
      if (!deptCode) return
      try {
        const res = await fetch(`/api/departments/${encodeURIComponent(String(deptCode))}`)
        const j = await res.json()
        if (res.ok && j?.success) setDeptId(j.data.id)
      } catch (err) {
        console.error('failed to fetch dept', err)
      }
    }
    fetchDept()
  }, [deptCode])

  async function fetchProducts() {
    if (!deptCode) return
    setLoadingProducts(true)
    try {
      const q = new URLSearchParams({ type: productType, page: String(page), pageSize: String(pageSize) })
      if (query) q.set('search', query)
      const res = await fetch(`/api/departments/${encodeURIComponent(String(deptCode))}/products?${q.toString()}`)
      const j = await res.json()
      if (res.ok && j?.success) {
        setProducts(j.data.items || [])
        setTotalProducts(j.data.total || 0)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingProducts(false)
    }
  }

  async function fetchTransfers() {
    if (!deptCode) return
    setLoadingTransfers(true)
    try {
      const q = new URLSearchParams({ page: String(transfersPage), pageSize: '10', direction: 'all' })
      const res = await fetch(`/api/departments/${encodeURIComponent(String(deptCode))}/transfer/list?${q.toString()}`)
      const j = await res.json()
      if (res.ok && j?.success) {
        setTransfers(j.data.items || [])
        setTransfersTotal(j.data.total || 0)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingTransfers(false)
    }
  }

  const canSubmit = cart.length > 0 && !!to

  function addToCart(p: ProductRow) {
    setCart((c) => {
      const found = c.find((x) => x.id === p.id && x.type === p.type)
      if (found) return c.map((x) => (x.id === p.id && x.type === p.type ? { ...x, quantity: Math.min(p.available, x.quantity + 1) } : x))
      return [...c, { id: p.id, name: p.name, type: p.type, quantity: 1 }]
    })
  }

  function updateCartQuantity(id: string, type: string, quantity: number) {
    setCart((c) => c.map((x) => (x.id === id && x.type === type ? { ...x, quantity } : x)))
  }

  function removeFromCart(id: string, type: string) {
    setCart((c) => c.filter((x) => !(x.id === id && x.type === type)))
  }

  async function submitTransfer(e: any) {
    e.preventDefault()
    if (!canSubmit) {
      setMessage('Choose destination and at least one item')
      return
    }
    setCreating(true)
    setMessage(null)
    try {
      const items = cart.map((c) => ({ type: c.type, id: c.id, quantity: c.quantity }))
      const res = await fetch(`/api/departments/${encodeURIComponent(String(deptCode))}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toDepartmentCode: to, items }),
      })
      const j = await res.json()
      if (!res.ok || !j?.success) setMessage(j?.error?.message || 'Failed to create transfer')
      else {
        setMessage('Transfer request created')
        setCart([])
        fetchTransfers()
      }
    } catch (err: any) {
      setMessage(err?.message || 'Failed')
    } finally {
      setCreating(false)
    }
  }

  async function approveTransfer(id: string) {
    if (!deptCode) return
    try {
      const res = await fetch(`/api/departments/${encodeURIComponent(String(deptCode))}/transfer/${encodeURIComponent(id)}/approve`, { method: 'POST' })
      const j = await res.json()
      if (!res.ok || !j?.success) setMessage(j?.error?.message || 'Receive failed')
      else {
        setMessage('Transfer received and executed')
        // Refresh transfers list and attempt to refresh products availability
        fetchTransfers()
        try { fetchProducts() } catch (e) { /* best-effort refresh */ }
      }
    } catch (err: any) {
      setMessage(err?.message || 'Receive failed')
    }
  }

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalProducts / pageSize)), [totalProducts, pageSize])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-4 bg-white rounded shadow">
          <h3 className="text-lg font-semibold">Create Transfer</h3>
          <div className="mt-3 space-y-3">
            <div>
              <label className="block text-sm">From</label>
              <div className="p-2 bg-muted rounded">{deptCode}</div>
            </div>
            <div>
              <label className="block text-sm">To</label>
              <input className="w-full p-2 border rounded" value={to} readOnly />
            </div>
            <div>
              <label className="block text-sm">Product Type</label>
              <select className="w-full p-2 border rounded" value={productType} onChange={(e) => { setProductType(e.target.value as any); setPage(1) }}>
                <option value="drink">Drink</option>
                <option value="inventoryItem">Inventory Item</option>
                <option value="food">Food (restaurant)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm">Search</label>
              <input className="w-full p-2 border rounded" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products by name" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium">Products</div>
                <div className="text-xs text-muted-foreground">{totalProducts} results</div>
              </div>
              <div className="space-y-2 max-h-72 overflow-auto">
                {loadingProducts ? (
                  <div className="text-sm">Loading...</div>
                ) : (
                  products.map((p) => (
                    <div key={`${p.type}-${p.id}`} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">Available: {p.available}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" className="px-2 py-1 border rounded text-sm" onClick={() => addToCart(p)} disabled={p.available <= 0}>Add</button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-center justify-between mt-3">
                <div className="space-x-2">
                  <button className="px-2 py-1 border rounded" disabled={page <= 1} onClick={() => setPage((s) => Math.max(1, s - 1))}>Prev</button>
                  <button className="px-2 py-1 border rounded" disabled={page >= totalPages} onClick={() => setPage((s) => Math.min(totalPages, s + 1))}>Next</button>
                </div>
                <div className="text-xs">Page {page} / {totalPages}</div>
              </div>
            </div>

            <form onSubmit={submitTransfer}>
              <div className="mt-2">
                <div className="text-sm font-medium">Cart</div>
                {cart.length === 0 && <div className="text-xs text-muted-foreground">No items added</div>}
                <div className="space-y-2 mt-2">
                  {cart.map((c) => (
                    <div key={`${c.type}-${c.id}`} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.type}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="number" min={1} value={c.quantity} onChange={(e) => updateCartQuantity(c.id, c.type, Number(e.target.value))} className="w-20 p-1 border rounded" />
                        <button type="button" className="px-2 py-1 text-sm text-red-600" onClick={() => removeFromCart(c.id, c.type)}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <button className="px-3 py-2 bg-sky-600 text-white rounded" disabled={!canSubmit || creating}>{creating ? 'Creating...' : 'Create Transfer'}</button>
              </div>
              {message && <div className="text-sm mt-2">{message}</div>}
            </form>
          </div>
        </div>

        <div className="p-4 bg-white rounded shadow">
          <h3 className="text-lg font-semibold">Transfers</h3>
          <div className="mt-3 space-y-3">
            {loadingTransfers ? <div className="text-sm">Loading transfers...</div> : (
              <div className="space-y-2 max-h-96 overflow-auto">
                {transfers.map((t: any) => (
                  <div key={t.id} className="p-2 border rounded">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{t.status} — {t.items.length} item(s)</div>
                        <div className="text-xs text-muted-foreground">From: {t.fromDepartmentId} • To: {t.toDepartmentId}</div>
                        <div className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleString()}</div>
                      </div>
                      <div />
                    </div>
                    <div className="mt-2 text-sm">
                      {t.items.map((it: any) => (<div key={it.id} className="text-xs">{it.productType}: {it.productId} x {it.quantity}</div>))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between mt-3">
              <div className="space-x-2">
                <button className="px-2 py-1 border rounded" disabled={transfersPage <= 1} onClick={() => setTransfersPage((s) => Math.max(1, s - 1))}>Prev</button>
                <button className="px-2 py-1 border rounded" disabled={transfersPage >= Math.max(1, Math.ceil(transfersTotal / 10))} onClick={() => setTransfersPage((s) => s + 1)}>Next</button>
              </div>
              <div className="text-xs">Page {transfersPage} / {Math.max(1, Math.ceil(transfersTotal / 10))}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

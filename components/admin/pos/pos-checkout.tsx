"use client"

import { useEffect, useState } from "react"
import { POSCategorySelector } from "@/components/admin/pos/pos-category-selector"
import { POSProductGrid, POSProduct } from "@/components/admin/pos/pos-product-grid"
import { POSCart, CartLine } from "@/components/admin/pos/pos-cart"
import { POSPayment } from "@/components/admin/pos/pos-payment"
import { POSReceipt } from "@/components/admin/pos/pos-receipt"

export default function POSCheckoutShell({ terminalId }: { terminalId?: string }) {
  const [category, setCategory] = useState<string | null>(null)
  const [cart, setCart] = useState<CartLine[]>([])
  const [showPayment, setShowPayment] = useState(false)
  const [receipt, setReceipt] = useState<any | null>(null)
  const [products, setProducts] = useState<POSProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [terminalError, setTerminalError] = useState<string | null>(null)
  const [salesSummary, setSalesSummary] = useState<{ count: number; total: number } | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [summaryRefreshKey, setSummaryRefreshKey] = useState(0)

  const [departmentSection, setDepartmentSection] = useState<any | null>(null)
  const [loadingDepartments, setLoadingDepartments] = useState(false)
  const [departmentsError, setDepartmentsError] = useState<string | null>(null)

  const categories = [
    { id: 'foods', name: 'Foods' },
    { id: 'drinks', name: 'Drinks' },
    { id: 'retail', name: 'Retail' },
  ]

  const sampleProducts: POSProduct[] = [
    // kept as fallback only
    { id: 'p1', name: 'Espresso', price: 4.5, available: true },
    { id: 'p2', name: 'Croissant', price: 3.0, available: true },
    { id: 'p3', name: 'Bottled Water', price: 2.25, available: true },
  ]

  const handleAdd = (p: POSProduct) => {
    const existing = cart.find((c) => c.productId === p.id)
    if (existing) {
      setCart((s) => s.map((l) => (l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l)))
      return
    }
    setCart((s) => [
      ...s,
      { lineId: Math.random().toString(36).slice(2), productId: p.id, productName: p.name, quantity: 1, unitPrice: p.price },
    ])
  }

  const handleRemove = (lineId: string) => setCart((s) => s.filter((l) => l.lineId !== lineId))
  const handleQty = (lineId: string, qty: number) => setCart((s) => s.map((l) => (l.lineId === lineId ? { ...l, quantity: Math.max(1, qty) } : l)))

  const subtotal = cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0)
  const tax = subtotal * 0.1
  const total = subtotal + tax

  const handlePaymentComplete = (payment: any) => {
    ;(async () => {
      try {
        const payload = {
          sectionCode: departmentSection?.id ?? null,
          departmentCode: departmentSection?.departmentCode ?? null,
          sectionId: departmentSection?.defaultSectionId ?? null,
          items: cart,
          subtotal,
          tax,
          total,
          payment,
        }

        const res = await fetch('/api/mock/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        const json = await res.json()
        if (res.ok && json && json.success) {
          setReceipt(json.data)
          setCart([])
        } else {
          const receipt = {
            orderNumber: `T-${Date.now()}`,
            items: cart,
            subtotal,
            tax,
            total,
            payment,
          }
          setReceipt(receipt)
        }
      } catch (err) {
        console.error('Error posting order:', err)
        const receipt = {
          orderNumber: `T-${Date.now()}`,
          items: cart,
          subtotal,
          tax,
          total,
          payment,
        }
        setReceipt(receipt)
      } finally {
        setShowPayment(false)
      }
    })()
  }

  // Helper: slugify terminal names for human-friendly routes
  const slugify = (s: string) =>
    s
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-]/g, '')

  useEffect(() => {
    // Fetch available department-sections from server and auto-select first one
    let mounted = true
    setLoadingDepartments(true)
    setDepartmentsError(null)
    fetch('/api/admin/pos/terminals')
      .then((r) => r.json())
      .then((json) => {
        if (!mounted) return
        if (json && json.success && Array.isArray(json.data) && json.data.length > 0) {
          // Auto-select the first available department-section
          setDepartmentSection(json.data[0])
        } else {
          setDepartmentsError('No sales points available')
          setDepartmentSection(null)
        }
      })
      .catch((err) => {
        console.error('Failed to fetch sales points', err)
        if (!mounted) return
        setDepartmentsError('Failed to load sales points (network)')
        setDepartmentSection(null)
      })
      .finally(() => mounted && setLoadingDepartments(false))

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    // If a department-section is selected, fetch its products/menu
    const code = departmentSection?.departmentCode
    if (!code) {
      setProducts([])
      return
    }

    let mounted = true
    setLoadingProducts(true)
    setTerminalError(null)

    // Use the real departments menu API (DB-backed) instead of the mock
    fetch(`/api/departments/${encodeURIComponent(code)}/menu`)
      .then((r) => r.json())
      .then((json) => {
        if (!mounted) return
        if (json && json.success && Array.isArray(json.data)) {
          const mapped: POSProduct[] = json.data.map((m: any) => ({ id: m.id, name: m.name, price: Number(m.price || 0), available: !!m.available, type: m.type }))
          setProducts(mapped)
        } else {
          setTerminalError('Failed to load products')
          setProducts(sampleProducts)
        }
      })
      .catch((err) => {
        console.error('Failed to fetch products', err)
        if (!mounted) return
        setTerminalError('Failed to load products (network)')
        setProducts(sampleProducts)
      })
      .finally(() => mounted && setLoadingProducts(false))

    return () => {
      mounted = false
    }
  }, [departmentSection?.id])

  useEffect(() => {
    // fetch sales summary for today for the selected department section
    const sectionId = departmentSection?.id ?? ''
    let mounted = true
    const fetchSummary = async () => {
      if (!sectionId) {
        setSalesSummary(null)
        return
      }
      setLoadingSummary(true)
      setSummaryError(null)
      try {
        // primary endpoint
        const res = await fetch(`/api/admin/pos/sales-summary?terminalId=${encodeURIComponent(sectionId)}`)
        if (res.ok) {
          const json = await res.json()
          if (mounted && json && json.success && json.data) {
            setSalesSummary({ count: Number(json.data.count || 0), total: Number(json.data.total || 0) })
            return
          }
        }

        // fallback to mock endpoint
        const mock = await fetch(`/api/mock/sales-summary?terminalId=${encodeURIComponent(sectionId)}`)
        if (mock.ok) {
          const mj = await mock.json()
          if (mounted && mj && mj.success && mj.data) {
            setSalesSummary({ count: Number(mj.data.count || 0), total: Number(mj.data.total || 0) })
            return
          }
        }

        if (mounted) {
          setSummaryError('No summary available')
          setSalesSummary(null)
        }
      } catch (err) {
        console.error('Failed to fetch sales summary', err)
        if (mounted) {
          setSummaryError('Failed to load sales summary')
          setSalesSummary(null)
        }
      } finally {
        mounted && setLoadingSummary(false)
      }
    }

    fetchSummary()
    return () => {
      mounted = false
    }
  }, [departmentSection?.id, summaryRefreshKey])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {loadingDepartments && <div className="text-sm text-muted-foreground">Loading sales platform...</div>}
          {departmentsError && <div className="text-sm text-red-600">{departmentsError}</div>}

          <div className="flex items-center gap-3">
            <div className="text-sm font-medium">Department:</div>
            <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded text-sm font-semibold">{departmentSection?.name || '—'}</div>
            {loadingProducts && <div className="text-sm text-muted-foreground">Loading menu...</div>}
            {terminalError && <div className="text-sm text-red-600">{terminalError}</div>}
          </div>

          <POSCategorySelector categories={categories} selectedId={category ?? undefined} onSelect={(id) => setCategory(id)} />

          {/* determine displayed products: prefer fetched products, fall back to sample */}
          {(() => {
            const source = products.length ? products : sampleProducts
            let displayed = source
            if (category) {
              const mapCategoryToType: Record<string, string> = { foods: 'food', drinks: 'drink', retail: 'retail' }
              const t = mapCategoryToType[category]
              if (t) {
                displayed = source.filter((p: any) => {
                  // fetched menu items include a `type` field; sample items do not — handle both
                  // @ts-ignore
                  if (p.type) return p.type === t
                  // fallback: infer by name keywords
                  return t === 'drink' ? /coffee|espresso|tea|water|juice|soda/i.test(p.name) : /croissant|sandwich|salad|burger|wrap|pastry/i.test(p.name) || t === 'retail'
                })
              }
            }
            return <POSProductGrid products={loadingProducts ? sampleProducts : displayed} onAdd={handleAdd} />
          })()}
        </div>

        <div>
          <div className="mb-4 p-3 border rounded bg-white shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Today's Sales</div>
                <div className="text-lg font-semibold">{departmentSection?.name}</div>
              </div>
              <div>
                <button
                  onClick={() => {
                    setSummaryRefreshKey((k) => k + 1)
                  }}
                  className="text-sm text-sky-600 underline"
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="mt-3">
              {loadingSummary ? (
                <div className="text-sm text-muted-foreground">Loading summary...</div>
              ) : summaryError ? (
                <div className="text-sm text-red-600">{summaryError}</div>
              ) : salesSummary ? (
                <div className="flex gap-4">
                  <div className="text-sm">
                    <div className="text-2xl font-bold">{salesSummary.count}</div>
                    <div className="text-xs text-muted-foreground">transactions</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-2xl font-bold">{new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(salesSummary.total)}</div>
                    <div className="text-xs text-muted-foreground">gross</div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No data</div>
              )}
            </div>
          </div>

          <POSCart items={cart} onRemove={handleRemove} onQty={handleQty} />
          <div className="mt-4">
            <button onClick={() => setShowPayment(true)} disabled={cart.length === 0} className="w-full py-2 bg-emerald-600 text-white rounded">Proceed to Payment</button>
          </div>
        </div>
      </div>

      {showPayment && <POSPayment total={total} onComplete={handlePaymentComplete} onCancel={() => setShowPayment(false)} />}
      {receipt && <POSReceipt receipt={receipt} onClose={() => setReceipt(null)} />}
    </div>
  )
}

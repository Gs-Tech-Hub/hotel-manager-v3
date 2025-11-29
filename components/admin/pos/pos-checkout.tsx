"use client"

import { useEffect, useState } from "react"
import { POSCategorySelector } from "@/components/admin/pos/pos-category-selector"
import { POSProductGrid, POSProduct } from "@/components/admin/pos/pos-product-grid"
import { POSCart, CartLine } from "@/components/admin/pos/pos-cart"
import { POSPayment } from "@/components/admin/pos/pos-payment"
import { POSReceipt } from "@/components/admin/pos/pos-receipt"
import { normalizeToCents, calculateTax, calculateTotal } from "@/lib/price"
import { formatPriceDisplay, formatOrderTotal } from "@/lib/formatters"

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
  const [discountCode, setDiscountCode] = useState<string>('')
  const [appliedDiscountCodes, setAppliedDiscountCodes] = useState<string[]>([])

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

  // Calculate prices in cents for consistency
  const subtotal = cart.reduce((s, c) => {
    const unitCents = normalizeToCents(c.unitPrice)
    return s + (unitCents * c.quantity)
  }, 0)
  const tax = calculateTax(subtotal, 10) // 10% tax rate
  const total = calculateTotal(subtotal, 0, tax)

  const handlePaymentComplete = (payment: any) => {
    ;(async () => {
      try {
        // Ensure a department/terminal is selected — server requires departmentCode
        if (!departmentSection?.departmentCode) {
          console.log('[POS] aborting payment - no departmentSection selected')
          setTerminalError('No terminal or department selected. Cannot complete payment.')
          return
        }

        console.log('[POS] handlePaymentComplete - start')
        console.log('[POS] departmentSection:', departmentSection)
        console.log('[POS] cart:', cart)
        console.log('[POS] payment:', payment)

        // Build items shaped for the server Order API
        const items = cart.map((c) => ({
          productId: c.productId,
          productType: (c as any).type || 'inventory',
          productName: c.productName,
          departmentCode: departmentSection.id, // Use section code (e.g., "restaurant:main") not parent code
          quantity: c.quantity,
          unitPrice: c.unitPrice,
        }))
        console.log('[POS] built items:', items)

        const payload: any = {
          // customerId is optional for walk-in / guest purchases; server will create guest customer if missing
          items,
          discounts: appliedDiscountCodes,
          notes: `POS sale - terminal ${terminalId || departmentSection?.id || 'unknown'}`,
          payment,
        }

        console.log('[POS] sending payload to /api/orders:', payload)
        const res = await fetch('/api/orders', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        console.log('[POS] fetch completed, status:', res.status)

        const json = await res.json().catch((e) => { console.log('[POS] failed to parse JSON:', e); return null })
        console.log('[POS] parsed json:', json)
        if (res.status === 401 || res.status === 403 || (json && json.error && json.error.code === 'UNAUTHORIZED')) {
          // Authentication/authorization failed — surface error and do NOT print a receipt
          const msg = (json && json.error && json.error.message) ? json.error.message : 'Not authorized'
          console.log('[POS] auth failure, msg:', msg)
          setTerminalError(`Order failed: ${msg}`)
          return
        }

        if (res.ok && json && json.success && json.data) {
          // The server returns the created order header (or success payload)
          console.log('[POS] order created successfully:', json.data)
          setReceipt(json.data)
          setCart([])
        } else {
          // API failure — surface error and DO NOT print a receipt
          const msg = (json && json.error && json.error.message) ? json.error.message : `Order API error (${res.status})`
          console.log('[POS] api failure, msg:', msg, 'status:', res.status)
          setTerminalError(`Order failed: ${msg}`)
          return
        }
      } catch (err) {
        console.error('[POS] Error posting order:', err)
        setTerminalError('Order failed due to network or unexpected error')
        return
      } finally {
        console.log('[POS] handlePaymentComplete - finished')
        setShowPayment(false)
      }
    })()
  }

  // Helper: slugify terminal names for human-friendly routes
  const slugify = (s: string) =>
    s
      .toString()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

  useEffect(() => {
    // Fetch available department-sections from server and auto-select first one
    let mounted = true
    setLoadingDepartments(true)
    setDepartmentsError(null)
    fetch('/api/admin/pos/terminals', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        if (!mounted) return
        if (json && json.success && Array.isArray(json.data) && json.data.length > 0) {
          // If a terminalId was provided via route params, prefer that terminal
          let selected: any = null
          if (terminalId) {
            selected = json.data.find((d: any) => d.id === terminalId || d.departmentCode === terminalId || slugify(d.name) === terminalId)
          }
          // Fallback to the first available department-section
          if (!selected) selected = json.data[0]
          setDepartmentSection(selected)
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
        .finally(() => { if (mounted) setLoadingDepartments(false) })
 
    return () => {
      mounted = false
    }
  }, [terminalId])

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

    // Use the real departments menu API (DB-backed)
    fetch(`/api/departments/${encodeURIComponent(code)}/menu`, { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        if (!mounted) return
        if (json && json.success && Array.isArray(json.data)) {
          const mapped: POSProduct[] = json.data.map((m: any) => ({ id: m.id, name: m.name, price: Number(m.price || 0), available: !!m.available, type: m.type }))
          setProducts(mapped)
        } else {
          setTerminalError('Failed to load products')
          setProducts([])
        }
      })
      .catch((err) => {
        console.error('Failed to fetch products', err)
        if (!mounted) return
        setTerminalError('Failed to load products (network)')
        setProducts([])
      })
      .finally(() => { if (mounted) setLoadingProducts(false) })

    return () => {
      mounted = false
    }
  }, [departmentSection?.departmentCode])

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
        const res = await fetch(`/api/admin/pos/sales-summary?terminalId=${encodeURIComponent(sectionId)}`, { credentials: 'include' })
        if (res.ok) {
          const json = await res.json()
          if (mounted && json && json.success && json.data) {
            setSalesSummary({ count: Number(json.data.count || 0), total: Number(json.data.total || 0) })
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
        if (mounted) setLoadingSummary(false)
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

          {/* determine displayed products: use fetched products only (no demo fallbacks) */}
          {(() => {
            const source = products
            let displayed = source || []
            if (category) {
              const mapCategoryToType: Record<string, string> = { foods: 'food', drinks: 'drink', retail: 'retail' }
              const t = mapCategoryToType[category]
              if (t) {
                displayed = source.filter((p: any) => {
                    // fetched menu items include a `type` field; sample items do not — handle both
                    if (p.type) return p.type === t
                    // if product missing type, conservatively don't include it
                    return false
                })
              }
            }
            return <POSProductGrid products={displayed} onAdd={handleAdd} />
          })()}
        </div>

        <div>
          <div className="mb-4 p-3 border rounded bg-white shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Today&apos;s Sales</div>
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
                    {/* salesSummary.total is stored as cents in backend; convert to dollars for display */}
                    <div className="text-2xl font-bold">{new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(salesSummary.total) / 100)}</div>
                    <div className="text-xs text-muted-foreground">gross</div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No data</div>
              )}
            </div>
          </div>

          <POSCart items={cart} onRemove={handleRemove} onQty={handleQty} />

          <div className="mt-3 p-3 bg-white border rounded">
            <div className="text-sm font-medium mb-2">Apply Discount</div>
            <div className="flex gap-2">
              <input value={discountCode} onChange={(e) => setDiscountCode(e.target.value)} placeholder="Enter promo code" className="flex-1 border rounded px-2 py-1" />
              <button
                onClick={() => {
                  const code = (discountCode || '').trim()
                  if (!code) return
                  if (!appliedDiscountCodes.includes(code)) setAppliedDiscountCodes((s) => [...s, code])
                  setDiscountCode('')
                }}
                className="px-3 py-1 bg-sky-600 text-white rounded"
              >
                Add
              </button>
            </div>
            {appliedDiscountCodes.length > 0 && (
              <div className="mt-2 text-sm">
                <div className="text-xs text-muted-foreground">Applied codes (final discount amounts calculated at payment)</div>
                <div className="flex gap-2 mt-1">
                  {appliedDiscountCodes.map((c) => (
                    <div key={c} className="px-2 py-1 bg-green-50 border border-green-100 rounded flex items-center gap-2">
                      <span className="font-semibold text-sm">{c}</span>
                      <button onClick={() => setAppliedDiscountCodes((s) => s.filter((x) => x !== c))} className="text-red-500 text-xs">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

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

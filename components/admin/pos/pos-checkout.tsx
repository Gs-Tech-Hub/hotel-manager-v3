"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { POSCategorySelector } from "@/components/admin/pos/pos-category-selector"
import { POSProductGrid, POSProduct } from "@/components/admin/pos/pos-product-grid"
import { POSCart, CartLine } from "@/components/admin/pos/pos-cart"
import { POSPayment } from "@/components/admin/pos/pos-payment"
import { POSReceipt } from "@/components/admin/pos/pos-receipt"
import { normalizeToCents, calculateTax, calculateTotal, centsToDollars } from "@/lib/price"
import Price from '@/components/ui/Price'
import { formatPriceDisplay, formatOrderTotal } from "@/lib/formatters"

interface SelectedSection {
  id: string
  name: string
  departmentCode: string
  departmentName: string
}

export default function POSCheckoutShell({ terminalId }: { terminalId?: string }) {
  const searchParams = useSearchParams()
  const terminalIdFromQuery = searchParams.get('terminal')
  
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
  const [loadingTerminal, setLoadingTerminal] = useState(false)

  const [departmentSection, setDepartmentSection] = useState<SelectedSection | null>(null)
  const [discountCode, setDiscountCode] = useState<string>('')
  const [appliedDiscountCodes, setAppliedDiscountCodes] = useState<string[]>([])

  const categories = [
    { id: 'foods', name: 'Foods' },
    { id: 'drinks', name: 'Drinks' },
    { id: 'retail', name: 'Retail' },
  ]

  const handleAdd = (p: POSProduct) => {
    const existing = cart.find((c) => c.productId === p.id)
    const totalQty = (existing?.quantity ?? 0) + 1
    const availableQty = p.quantity ?? 0
    
    // Client-side stock validation
    if (availableQty <= 0) {
      setTerminalError(`"${p.name}" is out of stock`)
      return
    }
    
    if (totalQty > availableQty) {
      setTerminalError(`Only ${availableQty} of "${p.name}" available. Cannot add more.`)
      return
    }
    
    if (existing) {
      setCart((s) => s.map((l) => (l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l)))
      return
    }
    setCart((s) => [
      ...s,
      { lineId: Math.random().toString(36).slice(2), productId: p.id, productName: p.name, quantity: 1, unitPrice: p.price, type: p.type },
    ])
  }

  const handleRemove = (lineId: string) => setCart((s) => s.filter((l) => l.lineId !== lineId))
  
  const handleQty = (lineId: string, qty: number) => {
    const cartItem = cart.find((c) => c.lineId === lineId)
    if (!cartItem) return
    
    const product = products.find((p) => p.id === cartItem.productId)
    if (!product) return
    
    const newQty = Math.max(1, qty)
    const availableQty = product.quantity ?? 0
    
    // Validate against available stock
    if (newQty > availableQty) {
      setTerminalError(`Only ${availableQty} of "${product.name}" available`)
      return
    }
    
    setCart((s) => s.map((l) => (l.lineId === lineId ? { ...l, quantity: newQty } : l)))
  }

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
        // Ensure a section is selected
        if (!departmentSection?.departmentCode) {
          console.log('[POS] aborting payment - no section selected')
          setTerminalError('No section selected. Cannot complete payment.')
          return
        }

        console.log('[POS] handlePaymentComplete - start')
        console.log('[POS] section:', departmentSection)
        console.log('[POS] cart:', cart)
        console.log('[POS] payment:', payment)

        // Build items shaped for the server Order API
        const items = cart.map((c) => ({
          productId: c.productId,
          productType: (c as any).type || 'inventory',
          productName: c.productName,
          departmentCode: departmentSection.departmentCode,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
        }))
        console.log('[POS] built items:', items)

        // Determine if this is a deferred (pay later) order
        const isDeferred = payment.isDeferred === true || payment.method === 'deferred'
        
        // Format payment for API
        const apiPayment: any = {
          method: payment.method,
          isDeferred: isDeferred,
        }
        
        // Add amount and method only for immediate payment
        if (!isDeferred) {
          // payment.amount is now in cents (from pos-payment.tsx)
          // payment.isMinor tells us if it's already in minor units
          const amountCents = payment.isMinor ? payment.amount : normalizeToCents(payment.amount)
          apiPayment.amount = amountCents
          apiPayment.paymentMethod = payment.method
        }

        const payload: any = {
          items,
          discounts: appliedDiscountCodes,
          notes: `POS sale - ${departmentSection.name}`,
          payment: apiPayment,
        }

        const orderTypeLabel = isDeferred ? 'deferred' : 'immediate'
        console.log(`[POS] Creating ${orderTypeLabel} order`)
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
          const msg = (json && json.error && json.error.message) ? json.error.message : 'Not authorized'
          console.log('[POS] auth failure, msg:', msg)
          setTerminalError(`Order failed: ${msg}`)
          return
        }

        if (res.ok && json && json.success && json.data) {
          console.log('[POS] order created successfully:', json.data)
          
          // For deferred orders, show special receipt indicating payment pending
          if (isDeferred) {
            const receipt = {
              ...json.data,
              isDeferred: true,
              orderStatus: 'pending',
              paymentStatus: 'pending_settlement',
              orderTypeDisplay: 'DEFERRED ORDER - PAYMENT PENDING',
            }
            setReceipt(receipt)
          } else {
            setReceipt(json.data)
          }
          
          setCart([])
          setAppliedDiscountCodes([])
        } else {
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

  // Load terminal data from query parameter
  useEffect(() => {
    if (!terminalIdFromQuery) {
      setTerminalError('No terminal specified. Please select a terminal from the dashboard.')
      return
    }

    let mounted = true
    setLoadingTerminal(true)
    setTerminalError(null)

    // Fetch all terminals to find the one with this terminal ID
    fetch('/api/pos/terminals', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        if (!mounted) return
        if (json && json.success && Array.isArray(json.data)) {
          // Find the terminal matching the terminalIdFromQuery
          const foundTerminal = json.data.find((t: any) => t.id === terminalIdFromQuery)
          if (foundTerminal) {
            setDepartmentSection({
              id: foundTerminal.id,
              name: foundTerminal.name,
              departmentCode: foundTerminal.departmentCode,
              departmentName: foundTerminal.departmentName
            })
          } else {
            setTerminalError('Terminal not found')
          }
        } else {
          setTerminalError('Failed to load terminals')
        }
      })
      .catch((err) => {
        console.error('Failed to fetch terminals', err)
        if (!mounted) return
        setTerminalError('Failed to load terminals (network)')
      })
      .finally(() => { if (mounted) setLoadingTerminal(false) })

    return () => {
      mounted = false
    }
  }, [terminalIdFromQuery])

  // Load products for selected section
  useEffect(() => {
    const code = departmentSection?.departmentCode
    if (!code) {
      setProducts([])
      return
    }

    let mounted = true
    setLoadingProducts(true)
    setTerminalError(null)

    fetch(`/api/departments/${encodeURIComponent(code)}/menu`, { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        if (!mounted) return
        if (json && json.success && Array.isArray(json.data)) {
          const mapped: POSProduct[] = json.data.map((m: any) => ({
            id: m.id,
            name: m.name,
            price: Number(m.price || 0),  // price is already in dollars from getDepartmentMenu
            available: !!m.available,
            type: m.type,
            quantity: Number(m.quantity || 0) || (m.available ? 1 : 0),  // Real-time stock quantity
          }))
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

  // Fetch sales summary
  useEffect(() => {
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
        const res = await fetch(`/api/pos/sales-summary?terminalId=${encodeURIComponent(sectionId)}`, { credentials: 'include' })
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
          {loadingTerminal && <div className="text-sm text-muted-foreground">Loading terminal...</div>}
          {terminalError && <div className="text-sm text-red-600 p-2 bg-red-50 border border-red-200 rounded">{terminalError}</div>}
          {loadingProducts && <div className="text-sm text-muted-foreground">Loading menu...</div>}

          {departmentSection && (
            <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded">
              <div>
                <div className="text-sm font-medium text-gray-700">Section</div>
                <div className="text-lg font-semibold text-gray-900">{departmentSection.name}</div>
                <div className="text-xs text-gray-500">{departmentSection.departmentName}</div>
              </div>
            </div>
          )}

          <POSCategorySelector categories={categories} selectedId={category ?? undefined} onSelect={(id) => setCategory(id)} />

          {(() => {
            const source = products
            let displayed = source || []
            if (category) {
              const mapCategoryToType: Record<string, string> = { foods: 'food', drinks: 'drink', retail: 'retail' }
              const t = mapCategoryToType[category]
              if (t) {
                displayed = source.filter((p: any) => {
                    if (p.type) return p.type === t
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
                    <div className="text-2xl font-bold"><Price amount={salesSummary.total} isMinor={true} /></div>
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

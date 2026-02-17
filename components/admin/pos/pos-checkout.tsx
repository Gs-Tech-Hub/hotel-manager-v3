"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { POSCategorySelector } from "@/components/admin/pos/pos-category-selector"
import { POSProductGrid, POSProduct } from "@/components/admin/pos/pos-product-grid"
import { POSCart, CartLine } from "@/components/admin/pos/pos-cart"
import { POSPayment } from "@/components/admin/pos/pos-payment"
import { POSReceipt } from "@/components/admin/pos/pos-receipt"
import { DiscountDropdown } from "@/components/pos/orders/DiscountDropdown"
import { EmployeeTargeting } from "@/components/pos/orders/EmployeeDiscountSelector"
import { normalizeToCents, centsToDollars } from "@/lib/price"
import { formatPriceDisplay, formatOrderTotal, formatTablePrice } from "@/lib/formatters"

interface SelectedSection {
  id: string
  name: string
  departmentCode: string
  departmentName: string
  sectionCode?: string
}

export default function POSCheckoutShell({ terminalId }: { terminalId?: string }) {
  const searchParams = useSearchParams()
  const terminalIdFromQuery = searchParams.get('terminal')
  const addToOrderId = searchParams.get('addToOrder')
  const existingOrderId = searchParams.get('orderId')
  
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
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)

  const [departmentSection, setDepartmentSection] = useState<SelectedSection | null>(null)
  const [appliedDiscountIds, setAppliedDiscountIds] = useState<string[]>([])
  const [validatedDiscounts, setValidatedDiscounts] = useState<any[]>([])
  const [discountMap, setDiscountMap] = useState<Map<string, any>>(new Map())
  const [taxEnabled, setTaxEnabled] = useState(true)
  const [taxRate, setTaxRate] = useState(10)
  const [showEmployeeTargeting, setShowEmployeeTargeting] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null)
  const [isChargingEmployee, setIsChargingEmployee] = useState(false)
  const [existingOrder, setExistingOrder] = useState<any | null>(null)
  const [loadingExistingOrder, setLoadingExistingOrder] = useState(false)

  const categories = [
    { id: 'foods', name: 'Foods' },
    { id: 'drinks', name: 'Drinks' },
    { id: 'retail', name: 'Retail' },
    { id: 'services', name: 'Services' },
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
    // c.unitPrice is already in cents from the API, don't normalize
    return s + (c.unitPrice * c.quantity)
  }, 0)
  // Tax is calculated on the backend during order creation, not in checkout
  const total = subtotal

  // Calculate total discount from applied codes
  const totalDiscountAmount = validatedDiscounts.reduce((sum, d) => sum + (d.discountAmount || 0), 0)
  const discountedSubtotal = Math.max(0, subtotal - totalDiscountAmount)
  // Only apply tax if enabled in settings
  const estimatedTax = taxEnabled ? Math.round(discountedSubtotal * (taxRate / 100)) : 0
  const estimatedTotal = discountedSubtotal + estimatedTax

  // Check if all applied discount IDs are validated
  const hasUnvalidatedCodes = appliedDiscountIds.length > validatedDiscounts.length
  const canProceedToPayment = cart.length > 0 && !hasUnvalidatedCodes

  const handlePaymentComplete = (payment: any) => {
    ;(async () => {
      // Prevent duplicate payment submissions
      if (isProcessingPayment) {
        setTerminalError('Payment is being processed. Please wait...')
        return
      }
      
      setIsProcessingPayment(true)
      
      try {
        // Ensure a section is selected
        if (!departmentSection?.departmentCode) {
          console.log('[POS] aborting payment - no section selected')
          setTerminalError('No section selected. Cannot complete payment.')
          setIsProcessingPayment(false)
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
          departmentSectionId: departmentSection.id,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
        }))
        console.log('[POS] built items:', items)

        // Determine if this is a deferred (pay later) order
        const isDeferred = payment.isDeferred === true || payment.method === 'deferred'
        
        // When adding items to existing order, skip payment entirely
        const isAddingItems = addToOrderId && payment.method === 'none'
        
        // Format payment for API
        const apiPayment: any = {
          method: payment.method,
          isDeferred: isDeferred,
        }
        
        // Add amount and method only for immediate payment (skip for adding items)
        if (!isDeferred && !isAddingItems) {
          // payment.amount is now in cents (from pos-payment.tsx)
          // payment.isMinor tells us if it's already in minor units
          const amountCents = payment.isMinor ? payment.amount : normalizeToCents(payment.amount)
          apiPayment.amount = amountCents
          apiPayment.paymentMethod = payment.method
        }

        const payload: any = {
          items,
          discounts: appliedDiscountIds,
          notes: `POS sale - ${departmentSection.name}`,
          departmentSectionId: departmentSection.id,
        }
        
        // Only add payment if not adding items to existing order
        if (!isAddingItems) {
          payload.payment = apiPayment
        }

        const orderTypeLabel = isDeferred ? 'deferred' : 'immediate'
        console.log(`[POS] ${addToOrderId ? 'Adding items to existing order' : 'Creating new'} ${orderTypeLabel} order`)
        console.log('[POS] sending payload to /api/orders:', payload)
        
        // If addToOrderId is present, add items to existing order instead of creating new one
        if (addToOrderId) {
          console.log('[POS] Adding items to existing order:', addToOrderId)
          
          // Add each item individually to the existing order
          for (const item of items) {
            console.log('[POS] Adding item:', item)
            const addRes = await fetch(`/api/orders/${addToOrderId}/items`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                productId: item.productId,
                productType: item.productType,
                productName: item.productName,
                departmentCode: item.departmentCode,
                departmentSectionId: departmentSection.id,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
              }),
            })
            
            const addJson = await addRes.json().catch((e) => { console.log('[POS] failed to parse JSON:', e); return null })
            console.log('[POS] add item response:', addJson, 'status:', addRes.status)
            
            if (!addRes.ok || !addJson?.success) {
              const msg = (addJson && addJson.error && addJson.error.message) ? addJson.error.message : `Failed to add item (${addRes.status})`
              console.log('[POS] add item failure, msg:', msg)
              setTerminalError(`Failed to add "${item.productName}": ${msg}`)
              return
            }
          }
          
          console.log('[POS] all items added successfully, fetching updated order')
          // Fetch the updated order to show in receipt
          const fetchRes = await fetch(`/api/orders/${addToOrderId}`, {
            credentials: 'include',
          })
          const fetchJson = await fetchRes.json()
          
          if (fetchRes.ok && fetchJson?.success && fetchJson.data) {
            console.log('[POS] items added to order successfully:', fetchJson.data)
            setReceipt({
              ...fetchJson.data,
              isDeferred: false,
              orderTypeDisplay: 'ITEMS ADDED',
            })
            setCart([])
            setAppliedDiscountIds([])
          } else {
            const msg = (fetchJson && fetchJson.error && fetchJson.error.message) ? fetchJson.error.message : `Failed to fetch updated order`
            console.log('[POS] fetch order failure, msg:', msg)
            setTerminalError(`Items added but failed to fetch updated order: ${msg}`)
            return
          }
        } else {
          // Create new order
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
            
            // Format discount data for receipt display
            const formattedDiscounts = (json.data.discounts || []).map((d: any) => ({
              code: d.discountCode || d.code,
              type: d.discountType || d.type,
              value: d.discountRule?.value || d.value,
              description: d.discountRule?.description || d.description,
              discountAmount: d.discountAmount,
              minorUnit: d.discountRule?.minorUnit || 100,
            }))
            
            // Format items for receipt display
            const formattedItems = (json.data.lines || []).map((line: any) => ({
              lineId: line.id,
              productName: line.productName,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
            }))
            
            // For deferred orders, show special receipt indicating payment pending
            if (isDeferred) {
              const receipt = {
                ...json.data,
                items: formattedItems,
                discounts: formattedDiscounts,
                isDeferred: true,
                orderStatus: 'pending',
                paymentStatus: 'pending_settlement',
                orderTypeDisplay: 'DEFERRED ORDER - PAYMENT PENDING',
              }
              setReceipt(receipt)
            } else {
              const receipt = {
                ...json.data,
                items: formattedItems,
                discounts: formattedDiscounts,
              }
              setReceipt(receipt)
            }
            
            setCart([])
            setAppliedDiscountIds([])
          } else {
            const msg = (json && json.error && json.error.message) ? json.error.message : `Order API error (${res.status})`
            console.log('[POS] api failure, msg:', msg, 'status:', res.status)
            setTerminalError(`Order failed: ${msg}`)
            return
          }
        }
      } catch (err) {
        console.error('[POS] Error posting order:', err)
        setTerminalError('Order failed due to network or unexpected error')
        return
      } finally {
        console.log('[POS] handlePaymentComplete - finished')
        setShowPayment(false)
        setIsProcessingPayment(false)
      }
    })()
  }

  // Load existing order if orderId is provided (games/services checkout)
  useEffect(() => {
    if (!existingOrderId) return

    let mounted = true
    setLoadingExistingOrder(true)

    fetch(`/api/orders/${existingOrderId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        if (!mounted) return
        if (json?.success && json.data) {
          setExistingOrder(json.data)
          // Skip directly to payment for existing orders
          setShowPayment(true)
        } else {
          setTerminalError('Failed to load order for payment')
        }
      })
      .catch((err) => {
        console.error('Failed to load existing order:', err)
        if (!mounted) return
        setTerminalError('Failed to load order for payment')
      })
      .finally(() => { if (mounted) setLoadingExistingOrder(false) })

    return () => {
      mounted = false
    }
  }, [existingOrderId])

  // Fetch tax settings on mount
  useEffect(() => {
    const fetchTaxSettings = async () => {
      try {
        const response = await fetch('/api/settings/tax')
        const data = await response.json()
        if (data.success && data.data?.settings) {
          setTaxEnabled(data.data.settings.enabled ?? true)
          setTaxRate(data.data.settings.taxRate ?? 10)
        }
      } catch (err) {
        console.warn('Failed to fetch tax settings, using defaults:', err)
      }
    }
    fetchTaxSettings()
  }, [])

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
              departmentName: foundTerminal.departmentName,
              sectionCode: foundTerminal.sectionCode
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
    // Construct the code: if section is specified use section code, otherwise use department code
    const code = departmentSection?.sectionCode ? `${departmentSection.departmentCode}:${departmentSection.sectionCode}` : departmentSection?.departmentCode
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
            // API returns price in cents (minor units) already, don't normalize
            price: Number(m.price || 0),
            available: !!m.available,
            type: m.type,
            quantity: Number(m.quantity || 0) || (m.available ? 1 : 0),  // Real-time stock quantity,
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
  }, [departmentSection?.sectionCode, departmentSection?.departmentCode])

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

  // Validate applied discount IDs
  useEffect(() => {
    if (appliedDiscountIds.length === 0) {
      setValidatedDiscounts([])
      return
    }

    let mounted = true

    const validateDiscounts = async () => {
      const validated: any[] = []
      const errors: string[] = []
      
      for (const discountId of appliedDiscountIds) {
        try {
          // Get discount details from map (already loaded)
          const discount = discountMap.get(discountId)
          if (!discount) {
            errors.push(`Discount not found`)
            continue
          }

          console.log(`[POS] Validating discount ID via API: ${discountId}`)
          const res = await fetch(`/api/discounts/${encodeURIComponent(discountId)}`, {
            credentials: 'include'
          })
          
          const json = await res.json()
          console.log(`[POS] Discount validation for ${discountId}:`, { status: res.status, json })
          
          if (!res.ok) {
            // Error response
            const errorMsg = json?.error?.message || `Discount ${discountId} is invalid`
            errors.push(errorMsg)
            console.warn(`[POS] Discount validation failed for ${discountId}: ${errorMsg}`)
            continue
          }

          if (json && json.success && json.data) {
            // Successfully validated
            const rule = json.data
            let discountAmount = 0
            
            if (rule.type === 'percentage') {
              discountAmount = Math.round((subtotal * rule.value) / 100)
            } else {
              // Fixed amount discount (already in cents)
              discountAmount = Math.round(rule.value * (rule.minorUnit || 100))
            }
            
            validated.push({
              id: discountId,
              code: discount.code,
              type: rule.type,
              value: rule.value,
              description: rule.description,
              discountAmount,
              minorUnit: rule.minorUnit || 100
            })
            console.log(`[POS] Discount validated (API): ${discountId} = ${discountAmount} cents`)
          } else {
            errors.push(`Discount ${discountId} validation returned no data`)
            console.warn(`[POS] Discount ${discountId} returned no data:`, json)
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          errors.push(`Failed to validate discount: ${msg}`)
          console.error(`[POS] Failed to validate discount ${discountId}:`, err)
        }
      }

      if (mounted) {
        setValidatedDiscounts(validated)
        // If there are any validation errors, show them
        if (errors.length > 0) {
          console.warn('[POS] Discount validation errors:', errors)
          // Optionally show validation errors in terminal error
          if (errors.length > 0) {
            setTerminalError(`Discount issue: ${errors[0]}`)
          }
        }
      }
    }

    validateDiscounts()
    return () => {
      mounted = false
    }
  }, [appliedDiscountIds, subtotal, discountMap])


  return (
    <div className="space-y-4">
      {/* If we have an existing order (from games/services checkout), skip straight to payment */}
      {existingOrderId && existingOrder && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded">
              <h3 className="text-lg font-semibold mb-2">Payment Processing</h3>
              <p className="text-sm text-gray-700 mb-3">
                Processing order for payment. This order was created externally and is ready for payment.
              </p>
              <div className="text-sm space-y-1">
                <div><strong>Order ID:</strong> {existingOrder.id}</div>
                <div><strong>Items:</strong> {existingOrder.lines?.length || 0}</div>
                <div><strong>Amount:</strong> {formatTablePrice(existingOrder.totalAmountCents || 0)}</div>
              </div>
            </div>
          </div>
          <div>
            {/* Only show payment UI when explicitly requested */}
            {showPayment && (
              <POSPayment
                total={existingOrder.totalAmountCents || 0}
                onComplete={handlePaymentComplete}
                onCancel={() => setShowPayment(false)}
              />
            )}
            {!showPayment && (
              <button
                onClick={() => setShowPayment(true)}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded"
              >
                Process Payment
              </button>
            )}
          </div>
        </div>
      )}

      {/* Regular POS checkout flow - only show if no existing order */}
      {!existingOrderId && (
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
              const mapCategoryToType: Record<string, string> = { foods: 'food', drinks: 'drink', retail: 'retail', services: 'service' }
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
                    <div className="text-2xl font-bold">{formatTablePrice(salesSummary.total)}</div>
                    <div className="text-xs text-muted-foreground">gross</div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No data</div>
              )}
            </div>
          </div>

          <POSCart items={cart} onRemove={handleRemove} onQty={handleQty} />

          {/* Price Breakdown with Discounts */}
          <div className="mt-3 p-3 bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded">
            <div className="text-sm font-medium mb-3 text-gray-900">Price Summary</div>
            
            {/* Base Price */}
            <div className="space-y-2 mb-3 pb-3 border-b border-blue-200">
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Subtotal</span>
                <span className="font-semibold">{formatTablePrice(subtotal)}</span>
              </div>
              
              {/* Applied Discounts - Visual Impact */}
              {validatedDiscounts.length > 0 && (
                <div className="space-y-2 mt-2">
                  {validatedDiscounts.map((d) => (
                    <div key={d.code} className="flex justify-between text-sm">
                      <span className="flex items-center gap-1 text-green-700">
                        <span className="text-green-600 font-bold">✓</span> 
                        {d.code}
                        <span className="text-xs text-green-600 bg-green-100 px-1.5 py-0.5 rounded">
                          {d.type === 'percentage' ? `${d.value}%` : 'fixed'}
                        </span>
                      </span>
                      <span className="font-semibold text-green-700">-{formatTablePrice(d.discountAmount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Discounted Subtotal */}
            {validatedDiscounts.length > 0 && (
              <div className="flex justify-between text-sm mb-2 p-2 bg-green-50 rounded border border-green-200">
                <span className="font-semibold text-green-700">After Discounts</span>
                <span className="font-bold text-green-700">{formatTablePrice(discountedSubtotal)}</span>
              </div>
            )}

            {/* Tax & Total */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Tax (estimated)</span>
                <span className="font-semibold">{formatTablePrice(estimatedTax)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-blue-200">
                <span>Total Due</span>
                <span className="text-blue-600">{formatTablePrice(estimatedTotal)}</span>
              </div>
              
              {/* Savings Display */}
              {totalDiscountAmount > 0 && (
                <div className="mt-2 p-2 bg-green-100 border border-green-300 rounded text-center">
                  <span className="text-xs text-green-800">
                    💰 You saved <span className="font-bold">{formatTablePrice(totalDiscountAmount)}</span>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Discount Dropdown Component */}
          <div className="mt-3 p-3 bg-white border rounded">
            <DiscountDropdown
              departmentCode={departmentSection?.departmentCode}
              subtotal={subtotal}
              appliedDiscounts={appliedDiscountIds}
              onAddDiscount={(id, discount) => {
                console.log(`[POS] Adding discount ID: ${id}`, discount)
                setAppliedDiscountIds((s) => [...s, id])
                // Populate the discount map for validation
                if (discount) {
                  setDiscountMap((map) => new Map(map).set(id, discount))
                }
              }}
              onRemoveDiscount={(id) => {
                console.log(`[POS] Removing discount ID: ${id}`)
                setAppliedDiscountIds((s) => s.filter((x) => x !== id))
                setValidatedDiscounts((s) => s.filter((d) => d.id !== id))
                // Remove from map
                setDiscountMap((map) => {
                  const newMap = new Map(map)
                  newMap.delete(id)
                  return newMap
                })
              }}
              disabled={false}
            />
          </div>

          {/* Discount Validation Status */}
          {appliedDiscountIds.length > 0 && appliedDiscountIds.length !== validatedDiscounts.length && (
            <div className="mt-3 p-2 bg-yellow-50 border border-yellow-300 rounded text-xs text-yellow-800">
              ⚠️ {appliedDiscountIds.length - validatedDiscounts.length} discount(s) pending validation...
            </div>
          )}

          <div className="mt-4">
            {addToOrderId ? (
              // When adding items to existing order, skip payment and just add
              <button 
                onClick={() => handlePaymentComplete({ method: 'none', isDeferred: false })} 
                disabled={cart.length === 0} 
                className="w-full py-2 bg-blue-600 text-white rounded"
              >
                Add Items to Order
              </button>
            ) : (
              // When creating new order, show employee targeting then payment
              <>
                <button 
                  onClick={() => setShowEmployeeTargeting(true)} 
                  disabled={!canProceedToPayment || isProcessingPayment}
                  className={`w-full py-2 rounded font-medium transition-colors ${
                    !canProceedToPayment || isProcessingPayment
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer'
                  }`}
                  title={isProcessingPayment ? 'Payment is being processed...' : hasUnvalidatedCodes ? `Please wait for discounts to validate` : cart.length === 0 ? 'Add items to proceed' : ''}
                >
                  {isProcessingPayment ? 'Processing...' : 'Proceed to Payment'}
                </button>
                {hasUnvalidatedCodes && (
                  <p className="text-xs text-red-600 mt-2">
                    ✗ Cannot proceed: {appliedDiscountIds.length - validatedDiscounts.length} discount(s) not yet verified
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Employee Targeting Modal - SINGLE ENTRY POINT for payment flow */}
      {showEmployeeTargeting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <EmployeeTargeting
              orderTotal={centsToDollars(estimatedTotal)}
              onEmployeeSelected={(emp) => {
                console.log('[POS] Employee selected:', emp)
                setSelectedEmployee(emp)
              }}
              onCancel={() => {
                console.log('[POS] Employee targeting cancelled')
                setShowEmployeeTargeting(false)
                setSelectedEmployee(null)
              }}
              onChargeToEmployee={async (employeeId) => {
                try {
                  setIsChargingEmployee(true)
                  
                  const chargeAmount = estimatedTotal
                  console.log('[POS] EMPLOYEE CHARGE FLOW: Creating order and charge for employee:', employeeId, 'amount:', chargeAmount)
                  
                  // Step 1: Create order with payment recorded as 'employee'
                  const orderRes = await fetch('/api/orders', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      items: cart.map((item) => ({
                        productId: item.productId,
                        productType: item.type,
                        productName: item.productName,
                        departmentCode: departmentSection?.departmentCode,
                        departmentSectionId: departmentSection?.id,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                      })),
                      discounts: appliedDiscountIds,
                      payment: {
                        amount: chargeAmount,
                        paymentMethod: 'employee',
                        isDeferred: false,
                      },
                    }),
                  })
                  
                  const orderJson = await orderRes.json()
                  if (!orderRes.ok || !orderJson?.success || !orderJson.data) {
                    throw new Error((orderJson?.error?.message) || 'Failed to create order')
                  }
                  
                  const orderId = orderJson.data.id
                  console.log('[POS] Order created:', orderId)
                  
                  // Step 2: Create employee charge
                  const chargeRes = await fetch(`/api/employees/${employeeId}/charges`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      chargeType: 'order_discount',
                      amount: chargeAmount / 100,
                      description: `Order ${orderId} - Employee Discount Charge`,
                      reason: 'Employee discount auto-charge from POS',
                      date: new Date().toISOString(),
                    }),
                  })
                  
                  const chargeJson = await chargeRes.json()
                  console.log('[POS] Charge response:', { status: chargeRes.status, body: chargeJson })
                  
                  if (!chargeRes.ok || !chargeJson?.success) {
                    throw new Error((chargeJson?.error?.message) || 'Failed to charge employee')
                  }
                  
                  // Charge object is in chargeJson.data due to successResponse format
                  const chargeData = chargeJson.data
                  if (!chargeData) {
                    console.error('[POS] chargeData is null:', chargeJson)
                    throw new Error('Invalid charge response structure - missing data')
                  }
                  
                  // Ensure chargeData has id
                  if (!chargeData.id) {
                    console.error('[POS] chargeData missing id field:', { chargeData, fullResponse: chargeJson })
                    throw new Error('Invalid charge response - missing id field')
                  }
                  
                  console.log('[POS] Employee charged successfully:', { 
                    chargeId: chargeData.id, 
                    hasEmploymentData: !!chargeData.employmentData,
                    hasUser: !!chargeData.employmentData?.user
                  })
                  
                  // Step 3: Prepare and show receipt
                  const formattedItems = (orderJson.data.lines || []).map((line: any) => ({
                    lineId: line.id,
                    productName: line.productName,
                    quantity: line.quantity,
                    unitPrice: line.unitPrice,
                  }))
                  
                  const formattedDiscounts = (orderJson.data.discounts || []).map((d: any) => ({
                    code: d.discountCode || d.code,
                    type: d.discountType || d.type,
                    value: d.discountRule?.value || d.value,
                    discountAmount: d.discountAmount,
                  }))
                  
                  // Clear all state and show receipt
                  setCart([])
                  setAppliedDiscountIds([])
                  setShowEmployeeTargeting(false)
                  setSelectedEmployee(null)
                  
                  // Build receipt carefully with defensive checks
                  try {
                    const receiptData = {
                      ...orderJson.data,
                      items: formattedItems,
                      discounts: formattedDiscounts,
                      isDeferred: false,
                      orderTypeDisplay: 'EMPLOYEE CHARGE',
                      employeeChargeId: chargeData?.id,
                      chargeAmount: chargeAmount,
                      employee: chargeData?.employmentData?.user || null,
                      employmentData: chargeData?.employmentData || null,
                    }
                    
                    console.log('[POS] Receipt data built:', {
                      chargeId: receiptData.employeeChargeId,
                      employeeId: receiptData.employee?.id,
                      employeeName: receiptData.employee?.firstname,
                    })
                    
                    setReceipt(receiptData)
                  } catch (receiptErr) {
                    console.error('[POS] Error building receipt:', receiptErr)
                    throw new Error(`Failed to build receipt: ${receiptErr instanceof Error ? receiptErr.message : 'Unknown error'}`)
                  }
                } catch (err) {
                  console.error('[POS] Employee charge error:', err)
                  setTerminalError(err instanceof Error ? err.message : 'Failed to charge employee')
                } finally {
                  setIsChargingEmployee(false)
                }
              }}
              onProceedToPayment={() => {
                console.log('[POS] NORMAL PAYMENT FLOW: User chose to proceed with normal payment')
                // Close employee modal, open payment modal
                setShowEmployeeTargeting(false)
                setSelectedEmployee(null)
                setShowPayment(true)
              }}
              isSubmitting={isChargingEmployee}
            />
          </div>
        </div>
      )}

      {showPayment && <POSPayment total={estimatedTotal} onComplete={handlePaymentComplete} onCancel={() => setShowPayment(false)} isProcessing={isProcessingPayment} />}
      {receipt && <POSReceipt receipt={receipt} onClose={() => setReceipt(null)} />}
      )
    </div>
  )
}

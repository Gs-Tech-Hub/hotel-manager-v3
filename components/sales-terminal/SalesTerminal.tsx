"use client"

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatTablePrice, formatOrderTotal } from '@/lib/formatters'
import { normalizeToCents } from '@/lib/price'
import { POSPayment } from '@/components/admin/pos/pos-payment'
import { DiscountDropdown } from '@/components/pos/orders/DiscountDropdown'
import { EmployeeTargeting } from '@/components/pos/orders/EmployeeDiscountSelector'

type Terminal = {
  id: string
  name: string
  slug: string
  description?: string | null
  type: 'consolidated' | 'section'
  isDefault?: boolean
  isActive?: boolean
  allowedSectionIds?: string[]
  sections?: {
    id: string
    name: string
    slug: string | null
    isActive: boolean
    departmentId: string
  }[]
}

type Section = {
  id: string
  name: string
  slug?: string
  departmentId: string
  hasTerminal: boolean
  isActive: boolean
}

type Department = {
  id: string
  code: string
  name: string
  type: string
}

type Product = {
  id: string
  name: string
  price: number
  quantity?: number
  sectionId: string
  sectionName: string
  departmentCode: string
}

type CartItem = {
  id: string
  productId: string
  productName: string
  basePrice: number
  quantity: number
  subtotal: number
  sectionId: string
  sectionName: string
  departmentCode: string
}

export default function SalesTerminal() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Add-to-order mode support
  const addToOrderId = searchParams.get('addToOrder')
  
  // State
  const [terminals, setTerminals] = useState<Terminal[]>([])
  const [selectedTerminal, setSelectedTerminal] = useState<Terminal | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set())
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [view, setView] = useState<'terminal-select' | 'scope-select' | 'terminal' | 'receipt'>('terminal-select')
  const [taxEnabled, setTaxEnabled] = useState(true)
  const [taxRate, setTaxRate] = useState(10)
  const [appliedDiscountIds, setAppliedDiscountIds] = useState<string[]>([])
  const [validatedDiscounts, setValidatedDiscounts] = useState<any[]>([])
  const [discountMap, setDiscountMap] = useState<Map<string, any>>(new Map())
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [receipt, setReceipt] = useState<any | null>(null)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [showEmployeeTargeting, setShowEmployeeTargeting] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null)
  const [isChargingEmployee, setIsChargingEmployee] = useState(false)

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
        console.warn('[SalesTerminal] Failed to fetch tax settings, using defaults:', err)
      }
    }
    fetchTaxSettings()
  }, [])

  // Validate discounts when applied or subtotal changes
  const subtotal = cart.reduce((sum, item) => sum + (normalizeToCents(item.basePrice) * item.quantity), 0)
  
  useEffect(() => {
    if (appliedDiscountIds.length === 0) {
      setValidatedDiscounts([])
      return
    }

    let mounted = true

    const validateDiscounts = async () => {
      const validated = []
      const errors = []

      for (const discountId of appliedDiscountIds) {
        try {
          const discount = discountMap.get(discountId)
          if (!discount) {
            console.warn(`[SalesTerminal] Discount ${discountId} not in map`)
            continue
          }

          // Hit the validation endpoint with discount code
          const res = await fetch(`/api/discounts/validate?code=${encodeURIComponent(discount.code || discountId)}&subtotal=${subtotal}`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          })

          const json = await res.json()

          if (!res.ok || !json?.success) {
            const errorMsg = json?.error?.message || `Discount ${discountId} is invalid`
            errors.push(errorMsg)
            console.warn(`[SalesTerminal] Discount validation failed for ${discountId}: ${errorMsg}`)
            continue
          }

          if (json && json.success && json.data) {
            const rule = json.data
            let discountAmount = 0

            if (rule.type === 'percentage') {
              discountAmount = Math.round((subtotal * rule.value) / 100)
            } else {
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
            console.log(`[SalesTerminal] Discount validated: ${discountId} = ${discountAmount} cents`)
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          errors.push(`Failed to validate discount: ${msg}`)
          console.error(`[SalesTerminal] Failed to validate discount:`, err)
        }
      }

      if (mounted) {
        setValidatedDiscounts(validated)
        if (errors.length > 0) {
          console.warn('[SalesTerminal] Discount validation errors:', errors)
          if (errors.length > 0) {
            setCheckoutError(`Discount issue: ${errors[0]}`)
          }
        }
      }
    }

    validateDiscounts()
    return () => {
      mounted = false
    }
  }, [appliedDiscountIds, subtotal, discountMap])

  // Load terminals, departments, and sections
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        
        // Ensure consolidated terminal exists
        try {
          await fetch('/api/terminals/consolidated', { method: 'POST' })
        } catch (e) {
          console.warn('Could not ensure consolidated terminal:', e)
        }
        
        // Fetch terminals
        const terminalRes = await fetch('/api/terminals')
        if (terminalRes.ok) {
          const terminalData = await terminalRes.json()
          const allTerminals = terminalData.data?.terminals || []
          setTerminals(allTerminals)

          // Set default consolidated terminal
          const consolidated = allTerminals.find((t: Terminal) => t.type === 'consolidated' && t.isDefault)
          if (consolidated) {
            setSelectedTerminal(consolidated)
          }
        }

        // Fetch all departments
        const deptRes = await fetch('/api/departments')
        if (deptRes.ok) {
          const deptData = await deptRes.json()
          setDepartments(deptData.data || [])
        }

        // Fetch all sections
        const secRes = await fetch('/api/departments/sections?limit=200')
        if (secRes.ok) {
          const secData = await secRes.json()
          const filteredSections = (secData.data || []).filter((s: Section) => s.hasTerminal && s.isActive)
          setSections(filteredSections)
        }
      } catch (e) {
        console.error('Failed to fetch data:', e)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Load products based on selected sections
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const allProducts: Product[] = []

        if (selectedTerminal?.type === 'consolidated') {
          // Consolidated mode: load from selected sections
          for (const sectionId of selectedSections) {
            const section = sections.find(s => s.id === sectionId)
            if (!section) continue

            const dept = departments.find(d => d.id === section.departmentId)
            if (!dept) continue

            try {
              // Construct section code as parent:slug format for API
              const sectionCode = section.slug ? `${dept.code}:${section.slug}` : `${dept.code}:${section.id}`
              const res = await fetch(
                `/api/departments/${encodeURIComponent(dept.code)}/products?section=${encodeURIComponent(sectionCode)}&pageSize=200`
              )
              if (res.ok) {
                const data = await res.json()
                const items = data.data?.items || data.data || []
                const sectionProducts = items.map((p: any) => ({
                  id: p.id,
                  name: p.name,
                  price: Math.round(Number(p.unitPrice) || 0),
                  quantity: Number(p.quantity || p.available || 0),
                  sectionId: section.id,
                  sectionName: section.name,
                  departmentCode: dept.code,
                }))
                allProducts.push(...sectionProducts)
              }
            } catch (e) {
              console.error(`Failed to fetch products for section ${sectionId}:`, e)
            }
          }
        } else if (selectedTerminal?.type === 'section') {
          // Section-based mode: load from the terminal's associated sections
          const terminalSections = selectedTerminal.sections || []
          
          for (const section of terminalSections) {
            const dept = departments.find(d => d.id === section.departmentId)
            if (!dept) continue

            try {
              // Construct section code as parent:slug format for API
              const sectionCode = section.slug ? `${dept.code}:${section.slug}` : `${dept.code}:${section.id}`
              const res = await fetch(
                `/api/departments/${encodeURIComponent(dept.code)}/products?section=${encodeURIComponent(sectionCode)}&pageSize=200`
              )
              if (res.ok) {
                const data = await res.json()
                const items = data.data?.items || data.data || []
                const sectionProducts = items.map((p: any) => ({
                  id: p.id,
                  name: p.name,
                  price: Math.round(Number(p.unitPrice) || 0),
                  quantity: Number(p.quantity || p.available || 0),
                  sectionId: section.id,
                  sectionName: section.name,
                  departmentCode: dept.code,
                }))
                allProducts.push(...sectionProducts)
              }
            } catch (e) {
              console.error(`Failed to fetch products for section ${section.id}:`, e)
            }
          }
        }

        setProducts(allProducts)
      } catch (e) {
        console.error('Failed to load products:', e)
      }
    }

    if (selectedTerminal && (selectedSections.size > 0 || selectedTerminal.type === 'section')) {
      loadProducts()
    }
  }, [selectedTerminal, selectedSections, sections, departments])

  const handleToggleSection = (sectionId: string) => {
    const newSelected = new Set(selectedSections)
    if (newSelected.has(sectionId)) {
      newSelected.delete(sectionId)
    } else {
      newSelected.add(sectionId)
    }
    setSelectedSections(newSelected)
  }

  const handleSelectAllSections = () => {
    const availableSections = selectedTerminal?.type === 'consolidated' 
      ? sections.filter(s => 
          (selectedTerminal.allowedSectionIds?.length === 0) || 
          selectedTerminal.allowedSectionIds?.includes(s.id)
        )
      : []

    if (selectedSections.size === availableSections.length) {
      setSelectedSections(new Set())
    } else {
      setSelectedSections(new Set(availableSections.map(s => s.id)))
    }
  }

  const handleAddToCart = (product: Product) => {
    // CRITICAL: Validate stock before adding to cart - prevent adding items we don't have
    const availableQty = product.quantity ?? 0
    const currentInCart = cart.filter(item => item.productId === product.id).reduce((sum, item) => sum + item.quantity, 0)
    
    if (availableQty <= 0) {
      // Product is out of stock - cannot add
      setCheckoutError(`"${product.name}" is out of stock and cannot be added`)
      return
    }
    
    // Check if adding one more would exceed available quantity
    if (currentInCart + 1 > availableQty) {
      const errorMsg = `Only ${availableQty} of "${product.name}" available (already have ${currentInCart} in cart)`
      setCheckoutError(errorMsg)
      return
    }
    
    // Clear error on successful add
    setCheckoutError(null)
    
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id)
      if (existing) {
        const newQuantity = existing.quantity + 1
        const maxAllowed = product.quantity ?? 0
        
        // Enforce inventory limit on quantity increase
        if (newQuantity > maxAllowed) {
          return prev
        }
        
        return prev.map(item =>
          item.productId === product.id
            ? {
                ...item,
                quantity: newQuantity,
                subtotal: newQuantity * item.basePrice,
              }
            : item
        )
      } else {
        return [
          ...prev,
          {
            id: `${product.id}-${Date.now()}`,
            productId: product.id,
            productName: product.name,
            basePrice: product.price,
            quantity: 1,
            subtotal: product.price,
            sectionId: product.sectionId,
            sectionName: product.sectionName,
            departmentCode: product.departmentCode,
          },
        ]
      }
    })
  }

  const handleUpdateQuantity = (cartId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(prev => prev.filter(item => item.id !== cartId))
      setCheckoutError(null)
      return
    }
    
    // CRITICAL: Validate quantity against available stock
    const cartItem = cart.find(item => item.id === cartId)
    if (!cartItem) return
    
    // Find the product to get max available quantity
    const product = products.find(p => p.id === cartItem.productId)
    const maxAllowed = product?.quantity ?? 0
    
    if (quantity > maxAllowed) {
      setCheckoutError(`Cannot exceed ${maxAllowed} available units of "${cartItem.productName}"`)
      return
    }
    
    // Clear error on successful update
    setCheckoutError(null)
    
    setCart(prev =>
      prev.map(item =>
        item.id === cartId
          ? { ...item, quantity, subtotal: quantity * item.basePrice }
          : item
      )
    )
  }

  const handleRemoveFromCart = (cartId: string) => {
    setCart(prev => prev.filter(item => item.id !== cartId))
  }

  // Pre-checkout inventory validation: verify live stock in section before order creation
  const validateCartInventory = async () => {
    try {
      console.log('[SalesTerminal] Validating live inventory for cart items')
      
      // Group items by department code (to call endpoint for each dept)
      const itemsByDept = new Map<string, typeof cart>()
      for (const item of cart) {
        const key = item.departmentCode
        if (!itemsByDept.has(key)) {
          itemsByDept.set(key, [])
        }
        itemsByDept.get(key)!.push(item)
      }
      
      // Check inventory for each department's section
      for (const [deptCode, items] of itemsByDept) {
        for (const item of items) {
          try {
            // Endpoint: GET /api/departments/[code]/section/inventory?productId=X&sectionId=Y
            const url = new URL(`/api/departments/${deptCode}/section/inventory`, window.location.origin)
            url.searchParams.set('productId', item.productId)
            url.searchParams.set('sectionId', item.sectionId)
            
            const inventoryRes = await fetch(url.toString(), { credentials: 'include' })
            
            if (!inventoryRes.ok) {
              console.warn(`[SalesTerminal] Could not verify inventory for ${item.productName} in dept ${deptCode}`)
              continue // Continue if inventory check fails - backend will validate
            }
            
            const inventoryData = await inventoryRes.json()
            // Expected: { success: true, data: {..., quantity: 5 } }
            const currentQty = inventoryData.data?.quantity ?? inventoryData.quantity ?? 0
            
            // Check if we have enough stock
            if (currentQty < item.quantity) {
              const msg = `Insufficient stock: "${item.productName}" has ${currentQty} available but you need ${item.quantity}`
              setCheckoutError(msg)
              console.error('[SalesTerminal] Inventory validation failed:', msg)
              return false
            }
          } catch (err) {
            console.warn(`[SalesTerminal] Failed to check inventory for ${item.productName}:`, err)
            continue // Continue if this specific check fails
          }
        }
      }
      
      console.log('[SalesTerminal] Inventory validation passed for all items')
      return true
    } catch (err) {
      console.warn('[SalesTerminal] Inventory pre-validation failed (non-blocking):', err)
      // Don't block checkout if validation request fails - let backend validate
      return true
    }
  }

  const handleCheckout = async () => {
    if (cart.length === 0) {
      setCheckoutError('Cart is empty')
      return
    }

    setIsCheckingOut(true)
    setCheckoutError(null)

    try {
      // Pre-checkout: validate live inventory before proceeding
      const inventoryValid = await validateCartInventory()
      if (!inventoryValid) {
        setIsCheckingOut(false)
        return
      }
      // If adding to existing order, add items one by one
      if (addToOrderId) {
        const items = cart.map(item => ({
          productId: item.productId,
          productType: 'inventory',
          productName: item.productName,
          departmentCode: item.departmentCode,
          departmentSectionId: item.sectionId,
          quantity: item.quantity,
          unitPrice: normalizeToCents(item.basePrice),
        }))

        console.log('[SalesTerminal] Adding items to existing order:', addToOrderId)
        
        for (const item of items) {
          const addRes = await fetch(`/api/orders/${addToOrderId}/items`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item),
          })

          const addJson = await addRes.json()

          if (!addRes.ok || !addJson?.success) {
            const msg = addJson?.error?.message || `Failed to add item (${addRes.status})`
            setCheckoutError(`Failed to add "${item.productName}": ${msg}`)
            return
          }
        }

        // Fetch updated order
        const fetchRes = await fetch(`/api/orders/${addToOrderId}`, {
          credentials: 'include',
        })
        const fetchJson = await fetchRes.json()

        if (fetchRes.ok && fetchJson?.success && fetchJson.data) {
          setReceipt({
            ...fetchJson.data,
            isDeferred: false,
            orderTypeDisplay: 'ITEMS ADDED',
          })
          setCart([])
          setAppliedDiscountIds([])
          setValidatedDiscounts([])
          setView('receipt')
        } else {
          const msg = fetchJson?.error?.message || 'Failed to fetch updated order'
          setCheckoutError(`Items added but failed to fetch updated order: ${msg}`)
          return
        }
      } else {
        // NEW ORDER FLOW: Check if any applied discounts are employee discounts
        const hasEmployeeDiscount = validatedDiscounts.some(d => d.type === 'employee')
        
        if (hasEmployeeDiscount && !selectedEmployee?.id) {
          // Show employee targeting modal to select employee for charge
          setShowEmployeeTargeting(true)
          // Don't proceed to payment - return to checkout to allow adding items
        } else if (!hasEmployeeDiscount) {
          // Only go to payment if no employee discount required
          setShowPayment(true)
        }
        // If employee discount AND employee IS selected: stay in checkout to allow adding items
      }
    } catch (e: any) {
      console.error('[SalesTerminal] Checkout error:', e)
      setCheckoutError(e?.message || 'Failed to complete checkout')
    } finally {
      setIsCheckingOut(false)
    }
  }

  const handlePaymentComplete = async (payment: any) => {
    setIsProcessingPayment(true)
    try {
      const amountCents = payment.isMinor ? payment.amount : normalizeToCents(payment.amount)

      // Step 1: Create order with items and discounts
      const items = cart.map(item => ({
        productId: item.productId,
        productType: 'inventory',
        productName: item.productName,
        departmentCode: item.departmentCode,
        departmentSectionId: item.sectionId,
        quantity: item.quantity,
        unitPrice: normalizeToCents(item.basePrice),
      }))

      const payload = {
        items,
        discounts: appliedDiscountIds,
        notes: `Sales Terminal Order (${selectedTerminal?.name || 'Terminal'})`,
      }

      console.log('[SalesTerminal] Creating order with payload:', payload)

      const createRes = await fetch('/api/orders', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const createJson = await createRes.json()

      if (!createRes.ok || !createJson?.success) {
        const msg = createJson?.error?.message || `Order creation failed (${createRes.status})`
        console.error('[SalesTerminal] Order creation failed:', msg)
        throw new Error(msg)
      }

      const orderId = createJson.data.id
      console.log('[SalesTerminal] Order created successfully:', orderId)

      // Step 2: Process payment for the created order
      const settleRes = await fetch('/api/orders/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          paymentMethod: payment.method,
          amount: amountCents,
        }),
        credentials: 'include',
      })

      if (!settleRes.ok) {
        const json = await settleRes.json()
        throw new Error(json.error?.message || 'Payment settlement failed')
      }

      const settleJson = await settleRes.json()
      const paymentDetails = settleJson.data || {}
      console.log('[SalesTerminal] Payment settled with allocations:', paymentDetails.sectionAllocations)

      // Step 2.5: Create employee charge if employee was selected
      if (selectedEmployee?.id) {
        try {
          const chargeAmountDollars = estimatedTotal / 100 // Convert cents to dollars
          console.log('[SalesTerminal] Creating employee charge for order:', orderId, 'employee:', selectedEmployee.id, 'amount:', chargeAmountDollars)
          
          const chargeRes = await fetch(`/api/employees/${selectedEmployee.id}/charges`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chargeType: 'order_discount',
              amount: chargeAmountDollars,
              description: `Sales Terminal Order ${orderId} - Employee Discount Charge`,
              reason: 'Employee discount auto-charge from Sales Terminal',
              date: new Date().toISOString(),
            }),
          })
          
          const chargeJson = await chargeRes.json()
          
          if (!chargeRes.ok || !chargeJson?.success) {
            console.warn('[SalesTerminal] Failed to create employee charge (non-blocking):', chargeJson?.error?.message)
            // Don't fail order if charge creation fails - charge is secondary to order
          } else {
            console.log('[SalesTerminal] Employee charge created:', chargeJson.data?.id)
          }
        } catch (chargeErr) {
          console.warn('[SalesTerminal] Exception creating employee charge (non-blocking):', chargeErr)
          // Don't throw - employee charge failure should not block order completion
        }
      }

      // Step 3: Fetch complete order with all details for receipt
      let finalReceipt = createJson.data
      try {
        const fetchRes = await fetch(`/api/orders/${orderId}`, {
          credentials: 'include',
        })
        if (fetchRes.ok) {
          const fetchData = await fetchRes.json()
          if (fetchData.success && fetchData.data) {
            finalReceipt = {
              ...fetchData.data,
              ...paymentDetails,
              paymentMethod: payment.method,
              sectionAllocations: paymentDetails.sectionAllocations,
            }
          }
        }
      } catch (fetchErr) {
        console.warn('[SalesTerminal] Failed to refetch order, using settlement response:', fetchErr)
        finalReceipt = {
          ...createJson.data,
          ...paymentDetails,
          paymentMethod: payment.method,
          sectionAllocations: paymentDetails.sectionAllocations,
        }
      }

      // Clear state and show receipt
      setShowPayment(false)
      setShowEmployeeTargeting(false)
      setSelectedEmployee(null) // Reset after charge is created
      setCart([])
      setAppliedDiscountIds([])
      setValidatedDiscounts([])
      setSelectedSections(new Set())
      setReceipt(finalReceipt)
      setView('receipt')
      
      // Auto-reset after 5 seconds
      setTimeout(() => {
        setView('terminal-select')
        setSelectedTerminal(null)
      }, 5000)
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Payment failed')
    } finally {
      setIsProcessingPayment(false)
    }
  }

  const totalAmount = cart.reduce((sum, item) => sum + item.subtotal, 0)
  const discountedSubtotal = Math.max(0, subtotal - validatedDiscounts.reduce((sum, d) => sum + (d.discountAmount || 0), 0))
  const estimatedTax = taxEnabled ? Math.round((discountedSubtotal * taxRate) / 100) : 0
  const estimatedTotal = discountedSubtotal + estimatedTax
  const totalDiscountAmount = validatedDiscounts.reduce((sum, d) => sum + (d.discountAmount || 0), 0)
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sectionName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Terminal selection view
  if (view === 'terminal-select') {
    const consolidatedTerminal = terminals.find(t => t.type === 'consolidated' && t.isDefault)
    const sectionTerminals = terminals.filter(t => t.type === 'section' && t.isActive)

    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Sales Terminal</h1>
            <p className="text-sm text-gray-600 mt-2">Choose Consolidated Terminal for multi-section sales, or a specific section terminal</p>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <p className="text-gray-600">Loading terminals...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Consolidated Terminal */}
              {consolidatedTerminal && (
                <div className="bg-white rounded-lg p-6 border-2 border-blue-500">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-blue-700">{consolidatedTerminal.name}</h2>
                      <p className="text-gray-600 mt-2">Make sales across multiple sections simultaneously. Select which sections to sell from.</p>
                      <p className="text-sm text-green-600 font-medium mt-2">✓ Default Terminal - Consolidated Multi-Section Sales</p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedTerminal(consolidatedTerminal)
                        setView('scope-select')
                      }}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
                    >
                      Use This Terminal
                    </button>
                  </div>
                </div>
              )}

              {/* Section Terminals */}
              {sectionTerminals.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Section Terminals</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {sectionTerminals.map(terminal => {
                      // For section terminals, get sections from the terminal's sections relation
                      const terminalSections = terminal.sections || []
                      const terminalDept = terminalSections.length > 0 
                        ? departments.find(d => d.id === terminalSections[0].departmentId) 
                        : null
                      
                      return (
                        <div
                          key={terminal.id}
                          className="bg-white rounded-lg p-4 border border-gray-200 hover:border-gray-400 hover:shadow-md transition-all"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold">{terminal.name}</h3>
                              <p className="text-sm text-gray-600 mt-1">
                                {terminalDept?.name || (terminalSections.length > 0 ? terminalSections.map(s => s.name).join(', ') : 'No sections')}
                              </p>
                              {terminal.description && (
                                <p className="text-xs text-gray-500 mt-2">{terminal.description}</p>
                              )}
                              {terminalSections.length > 0 && (
                                <p className="text-xs text-blue-600 mt-2">
                                  {terminalSections.map(s => s.name).join(', ')}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => {
                                setSelectedTerminal(terminal)
                                setView('scope-select')
                              }}
                              className="px-4 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700"
                            >
                              Use
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {!consolidatedTerminal && sectionTerminals.length === 0 && (
                <div className="bg-white rounded-lg p-8 text-center">
                  <p className="text-gray-600">No terminals available</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Scope selection view (section selection for consolidated, or auto-proceed for section-based)
  if (view === 'scope-select') {
    if (!selectedTerminal) {
      return <div className="min-h-screen bg-gray-50 p-6"><p>Loading...</p></div>
    }

    if (selectedTerminal.type === 'section') {
      // Auto-proceed for section-based terminals
      setView('terminal')
      return <div className="min-h-screen bg-gray-50 p-6"><p>Loading...</p></div>
    }

    // Consolidated terminal: show section selection
    const availableSections = selectedTerminal.allowedSectionIds && selectedTerminal.allowedSectionIds.length > 0
      ? sections.filter(s => selectedTerminal.allowedSectionIds?.includes(s.id))
      : sections

    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">{selectedTerminal.name}</h1>
              <p className="text-sm text-gray-600 mt-2">Select sections to sell from</p>
            </div>
            <button
              onClick={() => setView('terminal-select')}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium"
            >
              Change Terminal
            </button>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={handleSelectAllSections}
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 font-medium text-sm"
            >
              {selectedSections.size === availableSections.length
                ? 'Deselect All'
                : `Select All (${availableSections.length})`}
            </button>
            <span className="text-sm font-medium">
              Selected: {selectedSections.size} / {availableSections.length}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {availableSections.map(section => {
              const isSelected = selectedSections.has(section.id)
              const dept = departments.find(d => d.id === section.departmentId)
              return (
                <div
                  key={section.id}
                  onClick={() => handleToggleSection(section.id)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="w-5 h-5 mt-1"
                    />
                    <div className="flex-1">
                      <h3 className="font-semibold">{section.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{dept?.name}</p>
                      {section.slug && <p className="text-xs text-gray-500 mt-1">{section.slug}</p>}
                      <p className={`text-xs mt-2 ${section.isActive ? 'text-green-600' : 'text-red-600'}`}>
                        {section.isActive ? '✓ Active' : '✕ Inactive'}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <button
            onClick={() => selectedSections.size > 0 && setView('terminal')}
            disabled={selectedSections.size === 0}
            className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Start Terminal ({selectedSections.size} selected)
          </button>
        </div>
      </div>
    )
  }

  // Terminal view
  if (view === 'receipt' && receipt) {
    const paymentStatusColor = receipt.paymentStatus === 'paid' ? 'text-green-600 bg-green-50' :
                                receipt.paymentStatus === 'partial' ? 'text-yellow-600 bg-yellow-50' :
                                'text-gray-600 bg-gray-50';
    
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-green-600">✓ Order Complete</h1>
            <p className="text-gray-600 mt-2">Order #{receipt.orderNumber}</p>
          </div>

          <div className="space-y-4 mb-6">
            {/* Primary Info Grid */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded">
              <div>
                <div className="text-sm text-gray-600">Subtotal</div>
                <div className="text-lg font-bold">{formatTablePrice(receipt.subtotal || 0)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Payment Status</div>
                <div className={`text-lg font-semibold ${paymentStatusColor} px-2 py-1 rounded`}>
                  {receipt.paymentStatus ? receipt.paymentStatus.toUpperCase() : 'PENDING'}
                </div>
              </div>
            </div>

            {/* Discount and Tax Summary */}
            {(receipt.discountTotal || receipt.tax) && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                <h3 className="font-semibold mb-3 text-blue-900">Pricing Summary</h3>
                <div className="space-y-2 text-sm">
                  {receipt.discountTotal > 0 && (
                    <>
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span className="font-medium">{formatTablePrice(receipt.subtotal || 0)}</span>
                      </div>
                      <div className="flex justify-between text-green-700 font-medium">
                        <span>Discount Applied:</span>
                        <span>-{formatTablePrice(receipt.discountTotal)}</span>
                      </div>
                    </>
                  )}
                  {receipt.tax > 0 && (
                    <div className="flex justify-between">
                      <span>Tax:</span>
                      <span>{formatTablePrice(receipt.tax)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg border-t pt-2 text-blue-600">
                    <span>Total Amount:</span>
                    <span>{formatTablePrice(receipt.total || 0)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Items */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded">
              <h3 className="font-semibold mb-3">Items</h3>
              <div className="space-y-2">
                {(receipt.lines || []).map((line: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{line.productName} x{line.quantity}</span>
                    <span>{formatTablePrice(line.lineTotal || 0)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Section Payment Breakdown */}
            {receipt.sectionAllocations && receipt.sectionAllocations.length > 0 && (
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded">
                <h3 className="font-semibold mb-3 text-indigo-900">Payment Allocation by Section</h3>
                <div className="space-y-2">
                  {receipt.sectionAllocations.map((allocation: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-white rounded border border-indigo-100">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{allocation.sectionName || allocation.sectionCode || 'Section'}</div>
                        <div className="text-xs text-gray-600">
                          Order: {formatTablePrice(allocation.lineTotal)}
                          {allocation.discountAllocated > 0 && ` → After discount: ${formatTablePrice(allocation.finalAmount)}`}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-indigo-600">{formatTablePrice(allocation.paymentAllocated)}</div>
                        <div className={`text-xs font-medium ${
                          allocation.paymentStatus === 'paid' ? 'text-green-600' :
                          allocation.paymentStatus === 'partial' ? 'text-yellow-600' :
                          'text-gray-600'
                        }`}>
                          {allocation.paymentStatus === 'paid' && '✓ Paid'}
                          {allocation.paymentStatus === 'partial' && '⚠ Partial'}
                          {allocation.paymentStatus === 'unpaid' && '○ Unpaid'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Payment Method Details */}
            {receipt.paymentMethod && (
              <div className="p-4 bg-purple-50 border border-purple-200 rounded">
                <div className="text-sm">
                  <span className="text-gray-600">Payment Method:</span>
                  <span className="font-medium ml-2">{receipt.paymentMethod.toUpperCase()}</span>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              setView('terminal-select')
              setSelectedTerminal(null)
              setReceipt(null)
            }}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
          >
            New Order
          </button>
        </div>
      </div>
    )
  }

  // Terminal view
  if (view === 'terminal') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{selectedTerminal?.name}</h1>
            <p className="text-sm text-gray-600">
              {selectedTerminal?.type === 'consolidated'
                ? `${selectedSections.size} section${selectedSections.size !== 1 ? 's' : ''} selected`
                : 'Section Terminal'}
            </p>
          </div>
          <button
            onClick={() => {
              setView('terminal-select')
              setSelectedTerminal(null)
              setSelectedSections(new Set())
              setCart([])
            }}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium"
          >
            Change Terminal
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 max-w-7xl mx-auto w-full p-6">
        {/* Products Section */}
        <div className="flex-1">
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredProducts.length === 0 ? (
              <div className="col-span-full text-center py-12 bg-white rounded-lg">
                <p className="text-gray-600">
                  {products.length === 0 ? 'No products available' : 'No products match your search'}
                </p>
              </div>
            ) : (
              filteredProducts.map(product => (
                <button
                  key={product.id}
                  onClick={() => handleAddToCart(product)}
                  className="p-4 bg-white rounded-lg border hover:shadow-md transition-shadow text-left"
                >
                  <div className="font-semibold">{product.name}</div>
                  <div className="text-sm text-gray-600 mt-1">{product.sectionName}</div>
                  <div className="text-lg font-bold text-blue-600 mt-2">
                    {formatTablePrice(normalizeToCents(product.price))}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Cart Section */}
        <div className="w-96 bg-white rounded-lg shadow-lg p-6 flex flex-col max-h-screen sticky top-24 overflow-y-auto">
          <h2 className="text-xl font-bold mb-4">Cart</h2>

          <div className="flex-1 overflow-y-auto mb-4 space-y-2">
            {cart.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>Cart is empty</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.id} className="p-3 bg-gray-50 rounded border">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-medium">{item.productName}</div>
                      <div className="text-xs text-gray-600">{item.sectionName}</div>
                    </div>
                    <button
                      onClick={() => handleRemoveFromCart(item.id)}
                      className="text-red-600 hover:text-red-700 text-sm font-medium"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                        className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={e => handleUpdateQuantity(item.id, parseInt(e.target.value) || 1)}
                        className="w-12 text-center border rounded py-1 text-sm"
                        min="1"
                        max={products.find(p => p.id === item.productId)?.quantity || 999}
                      />
                      <button
                        onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                        className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
                      >
                        +
                      </button>
                    </div>
                    <div className="font-medium">
                      {formatTablePrice(normalizeToCents(item.subtotal))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Price Breakdown Section */}
          <div className="border-t pt-4 space-y-3">
            {checkoutError && (
              <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                {checkoutError}
              </div>
            )}

            {/* Price Summary */}
            <div className="space-y-2 pb-3 border-b">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>{formatTablePrice(subtotal)}</span>
              </div>
              
              {validatedDiscounts.length > 0 && (
                <div className="space-y-1">
                  {validatedDiscounts.map((d, i) => (
                    <div key={i} className="flex justify-between text-sm text-green-700">
                      <span>{d.code}:</span>
                      <span>-{formatTablePrice(d.discountAmount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {taxEnabled && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Tax ({taxRate}%):</span>
                  <span>{formatTablePrice(estimatedTax)}</span>
                </div>
              )}
            </div>

            <div className="flex justify-between font-bold text-lg bg-blue-50 p-3 rounded">
              <span>Total:</span>
              <span className="text-blue-600">{formatTablePrice(estimatedTotal)}</span>
            </div>

            {/* Employee Selected for Charge Status */}
            {selectedEmployee?.id && (
              <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-sm text-orange-700">
                <span className="font-medium">💳 Employee Charge Selected</span>
                <p className="text-xs mt-1">Amount will be charged to employee account during payment</p>
              </div>
            )}
          </div>

          {/* Discount Dropdown */}
          {cart.length > 0 && !showPayment && (
            <div className="mt-4 p-3 bg-gray-50 border rounded">
              <DiscountDropdown
                departmentCode={Array.from(selectedSections).length > 0 
                  ? departments.find(d => d.id === sections.find(s => s.id === Array.from(selectedSections)[0])?.departmentId)?.code 
                  : undefined}
                subtotal={subtotal}
                appliedDiscounts={appliedDiscountIds}
                onAddDiscount={(id, discount) => {
                  console.log(`[SalesTerminal] Adding discount ID: ${id}`, discount)
                  setAppliedDiscountIds((s) => [...s, id])
                  if (discount) {
                    setDiscountMap((map) => new Map(map).set(id, discount))
                  }
                  // Show employee targeting immediately when ANY discount is applied
                  console.log(`[SalesTerminal] Discount applied, showing employee targeting for charge option`)
                  setShowEmployeeTargeting(true)
                }}
                onRemoveDiscount={(id) => {
                  console.log(`[SalesTerminal] Removing discount ID: ${id}`)
                  setAppliedDiscountIds((s) => s.filter((x) => x !== id))
                  setValidatedDiscounts((s) => s.filter((d) => d.id !== id))
                  setDiscountMap((map) => {
                    const newMap = new Map(map)
                    newMap.delete(id)
                    return newMap
                  })
                }}
                disabled={false}
              />
            </div>
          )}

          {/* Checkout Button or Payment UI */}
          {showPayment ? (
            <div className="mt-4">
              <POSPayment
                total={estimatedTotal}
                onComplete={handlePaymentComplete}
                onCancel={() => setShowPayment(false)}
              />
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {/* Show Proceed to Payment button if employee is selected for charge */}
              {selectedEmployee?.id ? (
                <>
                  <button
                    onClick={() => setShowPayment(true)}
                    disabled={isCheckingOut || isProcessingPayment}
                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-lg"
                  >
                    {isProcessingPayment ? 'Processing Payment...' : 'Proceed to Payment'}
                  </button>
                  <p className="text-xs text-gray-600 text-center py-2">
                    You can still add items. Click Checkout again or proceed to payment.
                  </p>
                </>
              ) : (
                <button
                  onClick={handleCheckout}
                  disabled={cart.length === 0 || isCheckingOut || isProcessingPayment}
                  className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-lg"
                >
                  {isCheckingOut ? 'Processing...' : addToOrderId ? 'Add Items' : 'Checkout'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Employee Targeting Modal for Employee Discounts */}
      {showEmployeeTargeting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <EmployeeTargeting
              orderTotal={estimatedTotal / 100}
              onEmployeeSelected={(emp) => {
                console.log('[SalesTerminal] Employee selected:', emp)
                setSelectedEmployee(emp)
              }}
              onCancel={() => {
                console.log('[SalesTerminal] Employee targeting cancelled')
                setShowEmployeeTargeting(false)
                setSelectedEmployee(null)
              }}
              onChargeToEmployee={async (employeeId, chargeAmountDollars) => {
                try {
                  console.log('[SalesTerminal] Employee selected for charge:', employeeId, 'amount:', chargeAmountDollars)
                  
                  // Just persist the employee selection - actual charge creation happens during payment
                  setSelectedEmployee({ id: employeeId })
                  setShowEmployeeTargeting(false)
                  setCheckoutError(null)
                  console.log('[SalesTerminal] Employee selected, closing modal and returning to cart')
                } catch (err: any) {
                  const msg = err?.message || 'Unknown error'
                  console.error('[SalesTerminal] Error selecting employee:', err)
                  setCheckoutError(`Error: ${msg}`)
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
}
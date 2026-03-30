"use client"

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatTablePrice, formatOrderTotal } from '@/lib/formatters'
import { normalizeToCents } from '@/lib/price'
import { POSPayment } from '@/components/admin/pos/pos-payment'
import { POSReceipt } from '@/components/admin/pos/pos-receipt'
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
  slug?: string | null
  departmentId: string
  departmentName?: string
  sectionCode?: string
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
  isService?: boolean // true for services, false/undefined for regular items
  pricingModel?: 'per_count' | 'per_time' // service pricing model
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
  isService?: boolean
}

export default function SalesTerminal() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Add-to-order mode support
  const addToOrderId = searchParams.get('addToOrder')
  
  // State
  const [sections, setSections] = useState<Section[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set())
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [view, setView] = useState<'terminal-select' | 'terminal' | 'receipt'>('terminal-select')
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

  // Load sections using same approach as POS Terminal
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        
        // Use same endpoint as POS Terminal - /api/pos/terminals returns all available sections
        const sectionsRes = await fetch('/api/pos/terminals?limit=200')
        if (sectionsRes.ok) {
          const sectionsData = await sectionsRes.json()
          const allPOSTerminals = sectionsData.data || []
          
          // Map POS terminals (which are sections) to our sections format
          const mappedSections = allPOSTerminals.map((section: any) => ({
            id: section.id,
            name: section.name,
            slug: section.slug,
            departmentId: section.departmentCode,
            departmentName: section.departmentName,
            sectionCode: section.sectionCode,
            hasTerminal: true,
            isActive: true,
          }))
          setSections(mappedSections)
        }

        // Fetch all departments
        const deptRes = await fetch('/api/departments')
        if (deptRes.ok) {
          const deptData = await deptRes.json()
          setDepartments(deptData.data || [])
        }
      } catch (e) {
        console.error('Failed to fetch data:', e)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Load products and services based on selected sections
  // Includes: regular products, transferred inventory items, and transferred services
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const allProducts: Product[] = []
        const productIds = new Set<string>() // Track product IDs to prevent duplicates

        // Load products and services from each selected section
        for (const sectionId of selectedSections) {
          const section = sections.find(s => s.id === sectionId)
          if (!section) continue

          const dept = departments.find(d => d.code === section.departmentId)
          if (!dept) continue

          try {
            // Construct section code as parent:slug format for API
            const sectionCode = section.slug ? `${dept.code}:${section.slug}` : `${dept.code}:${section.id}`
            
            // Load regular products for the section (inventoryItems, drinks, food, extras)
            // NOTE: This may also return services if section has no items
            const productsRes = await fetch(
              `/api/departments/${encodeURIComponent(dept.code)}/products?section=${encodeURIComponent(sectionCode)}&pageSize=200`
            )
            if (productsRes.ok) {
              const data = await productsRes.json()
              const items = data.data?.items || data.data || []
              const sectionProducts = items.map((p: any) => ({
                id: p.id,
                name: p.name,
                price: Math.round(Number(p.unitPrice) || 0),
                quantity: p.isService ? 999 : Number(p.available || 0), // Services have unlimited availability
                sectionId: section.id,
                sectionName: section.name,
                departmentCode: dept.code,
                isService: p.type === 'service' || p.isService || false, // Mark services from first fetch
                pricingModel: p.pricingModel || undefined,
              }))
              
              // Add products and track their IDs
              for (const product of sectionProducts) {
                if (!productIds.has(product.id)) {
                  productIds.add(product.id)
                  allProducts.push(product)
                }
              }
            }

            // Load services for the section (services transferred to this section)
            // Services include games, activities, and other service offerings
            // Skip if no services were returned in the first fetch
            const servicesRes = await fetch(
              `/api/departments/${encodeURIComponent(dept.code)}/products?type=service&section=${encodeURIComponent(sectionCode)}&pageSize=200`
            )
            if (servicesRes.ok) {
              const data = await servicesRes.json()
              const items = data.data?.items || data.data || []
              
              // Only add services that weren't already added (avoid duplicates)
              for (const s of items) {
                if (!productIds.has(s.id)) {
                  productIds.add(s.id)
                  allProducts.push({
                    id: s.id,
                    name: s.name,
                    price: Math.round(Number(s.unitPrice) || 0),
                    quantity: 999, // Services have unlimited availability
                    sectionId: section.id,
                    sectionName: section.name,
                    departmentCode: dept.code,
                    isService: true, // Flag as service
                    pricingModel: s.pricingModel, // 'per_count' or 'per_time'
                  })
                }
              }
            }
          } catch (e) {
            console.error(`Failed to fetch products/services for section ${sectionId}:`, e)
          }
        }

        setProducts(allProducts)
      } catch (e) {
        console.error('Failed to load products:', e)
      }
    }

    // Only load products when sections are selected
    if (selectedSections.size > 0) {
      loadProducts()
    } else {
      // Ensure no products/services load when no sections selected
      setProducts([])
    }
  }, [selectedSections, sections, departments])

  // Helper to check if a product is a service
  const isProductService = (productId: string): boolean => {
    return products.find(p => p.id === productId)?.isService ?? false
  }

  const handleToggleSection = (sectionId: string) => {
    const newSelected = new Set(selectedSections)
    if (newSelected.has(sectionId)) {
      newSelected.delete(sectionId)
    } else {
      newSelected.add(sectionId)
    }
    setSelectedSections(newSelected)
  }

  const handleAddToCart = (product: Product) => {
    // Services have unlimited availability and don't need inventory checks
    if (product.isService) {
      setCheckoutError(null) // Clear any prior errors
      setCart(prev => {
        const existing = prev.find(item => item.productId === product.id)
        if (existing) {
          return prev.map(item =>
            item.productId === product.id
              ? {
                  ...item,
                  quantity: item.quantity + 1,
                  subtotal: (item.quantity + 1) * item.basePrice,
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
              isService: true, // Mark as service
            },
          ]
        }
      })
      return
    }
    
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
            isService: false, // Regular inventory item
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
    
    // Get the cart item and check if it's a service
    const cartItem = cart.find(item => item.id === cartId)
    if (!cartItem) return
    
    // Services have unlimited quantity - no validation needed
    if (isProductService(cartItem.productId)) {
      setCheckoutError(null)
      setCart(prev =>
        prev.map(item =>
          item.id === cartId
            ? { ...item, quantity, subtotal: quantity * item.basePrice }
            : item
        )
      )
      return
    }
    
    // CRITICAL: Validate quantity against available stock for regular items
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
  // NOTE: Services (isService=true) are skipped from inventory checks as they have unlimited availability
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
          // SKIP INVENTORY CHECK FOR SERVICES: Services have unlimited availability
          if (isProductService(item.productId)) {
            console.log(`[SalesTerminal] Skipping inventory check for service: ${item.productName}`)
            continue
          }
          
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
        productType: item.isService ? 'service' : 'inventory',
        productName: item.productName,
        departmentCode: item.departmentCode,
        departmentSectionId: item.sectionId,
        quantity: item.quantity,
        unitPrice: normalizeToCents(item.basePrice),
      }))

      const payload = {
        items,
        discounts: appliedDiscountIds,
        notes: 'Sales Terminal Order',
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
          const isChargesPayment = payment.method === 'charges' // Check if payment method is 'charges'
          
          console.log('[SalesTerminal] Creating employee charge for order:', orderId, 'employee:', selectedEmployee.id, 'amount:', chargeAmountDollars, 'payment method:', payment.method)
          
          const chargeRes = await fetch(`/api/employees/${selectedEmployee.id}/charges`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chargeType: 'order_discount',
              amount: chargeAmountDollars,
              description: `Sales Terminal Order ${orderId} - ${isChargesPayment ? 'Employee Charge Payment' : 'Employee Discount Charge'}`,
              reason: isChargesPayment ? 'Employee charge payment from Sales Terminal' : 'Employee discount auto-charge from Sales Terminal',
              date: new Date().toISOString(),
              status: 'pending', // Always start with pending status
            }),
          })
          
          const chargeJson = await chargeRes.json()
          
          if (!chargeRes.ok || !chargeJson?.success) {
            console.warn('[SalesTerminal] Failed to create employee charge (non-blocking):', chargeJson?.error?.message)
            // Don't fail order if charge creation fails - charge is secondary to order
          } else {
            const chargeId = chargeJson.data?.id
            console.log('[SalesTerminal] Employee charge created:', chargeId)
            
            // Charge created in 'pending' status and remains unpaid
            // Will be deducted from salary or paid separately
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

      // Clear state and show receipt (via modal, not page change)
      setShowPayment(false)
      setShowEmployeeTargeting(false)
      setSelectedEmployee(null) // Reset after charge is created
      
      // Format receipt data for POSReceipt component
      const formattedReceipt = {
        ...finalReceipt,
        items: (finalReceipt.lines || []).map((line: any) => ({
          lineId: line.id,
          productName: line.productName,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
        })),
        discounts: (finalReceipt.discounts || []).map((d: any) => ({
          code: d.discountCode || d.code,
          type: d.discountType || d.type,
          value: d.discountRule?.value || d.value,
          description: d.discountRule?.description || d.description,
          discountAmount: d.discountAmount,
          minorUnit: d.discountRule?.minorUnit || 100,
        })),
        taxAmount: estimatedTax, // Add calculated tax to receipt
      }
      
      setReceipt(formattedReceipt)
      // Keep user in terminal view with receipt modal open
      // DO NOT change view or auto-reset - let user close receipt manually
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

  // Terminal selection view - show available sections from POS terminals
  if (view === 'terminal-select') {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Sales Terminal</h1>
            <p className="text-sm text-gray-600 mt-2">Select sections to make sales from</p>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <p className="text-gray-600">Loading sections...</p>
            </div>
          ) : sections.length > 0 ? (
            <>
              <div className="mb-4 flex items-center justify-between">
                <button
                  onClick={() => {
                    if (selectedSections.size === sections.length) {
                      setSelectedSections(new Set())
                    } else {
                      setSelectedSections(new Set(sections.map(s => s.id)))
                    }
                  }}
                  className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 font-medium text-sm"
                >
                  {selectedSections.size === sections.length ? 'Deselect All' : `Select All (${sections.length})`}
                </button>
                <button
                  onClick={() => {
                    if (selectedSections.size > 0) {
                      setView('terminal')
                    }
                  }}
                  disabled={selectedSections.size === 0}
                  className="px-6 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Start Sales ({selectedSections.size} selected)
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sections.map(section => {
                  const isSelected = selectedSections.has(section.id)
                  return (
                    <div
                      key={section.id}
                      onClick={() => {
                        const newSelected = new Set(selectedSections)
                        if (newSelected.has(section.id)) {
                          newSelected.delete(section.id)
                        } else {
                          newSelected.add(section.id)
                        }
                        setSelectedSections(newSelected)
                      }}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 bg-white hover:border-gray-400'
                      }`}
                    >
                      <h3 className="font-semibold">{section.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{section.departmentName}</p>
                      {isSelected && (
                        <p className="text-xs text-blue-600 font-medium mt-2">✓ Selected</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="bg-white rounded-lg p-8 text-center">
              <p className="text-gray-600">No sections available</p>
            </div>
          )}
        </div>
      </div>
    )
  }



  // Receipt modal is displayed as overlay while remaining in terminal view
  // This allows user to continue shopping after viewing receipt

  // Terminal view
  if (view === 'terminal') {
    const selectedSectionNames = Array.from(selectedSections)
      .map(id => sections.find(s => s.id === id)?.name)
      .filter(Boolean)
      .join(', ')
    
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Sales Terminal</h1>
            <p className="text-sm text-gray-600">
              {selectedSectionNames || 'No sections selected'}
            </p>
          </div>
          <button
            onClick={() => {
              setView('terminal-select')
              setSelectedSections(new Set())
              setCart([])
            }}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium"
          >
            Change Sections
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
                  className={`p-4 rounded-lg border transition-all text-left hover:shadow-md ${
                    product.isService
                      ? 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-300 hover:border-purple-400'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">{product.name}</div>
                      <div className="text-sm text-gray-600 mt-1">{product.sectionName}</div>
                      {product.isService && (
                        <div className="text-xs font-medium text-purple-600 mt-1">
                          ⭐ Service {product.pricingModel ? `(${product.pricingModel === 'per_count' ? 'per count' : 'per minute'})` : ''}
                        </div>
                      )}
                    </div>
                    {product.isService && (
                      <span className="ml-2 px-2 py-1 text-xs font-bold bg-purple-500 text-white rounded">
                        SVC
                      </span>
                    )}
                  </div>
                  <div className={`text-lg font-bold mt-2 ${
                    product.isService ? 'text-purple-600' : 'text-blue-600'
                  }`}>
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
                  ? sections.find(s => s.id === Array.from(selectedSections)[0])?.departmentId
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
                isProcessing={isProcessingPayment}
                selectedEmployee={selectedEmployee}
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
              onProceedToPayment={() => {
                console.log('[SalesTerminal] Proceeding to payment with selected employee:', selectedEmployee)
                // Close employee targeting modal and open payment modal
                // selectedEmployee is already set via onEmployeeSelected callback
                setShowEmployeeTargeting(false)
                setShowPayment(true)
              }}
            />
          </div>
        </div>
      )}

      {/* Receipt Modal - displayed while in terminal view */}
      {receipt && (
        <POSReceipt
          receipt={receipt}
          onClose={() => {
            setReceipt(null)
            // Clear cart when receipt is closed
            setCart([])
            setAppliedDiscountIds([])
            setValidatedDiscounts([])
            setSelectedSections(new Set())
          }}
        />
      )}
    </div>
  )
}
}
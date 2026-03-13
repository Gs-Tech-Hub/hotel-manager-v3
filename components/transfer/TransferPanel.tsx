"use client"

import React, { useEffect, useState } from 'react'
import { mapDeptCodeToCategory } from '@/lib/utils'
import { formatTablePrice } from '@/lib/formatters'
import Pagination from '@/components/ui/Pagination'
import Cart from '@/components/transfer/Cart'

type MenuItem = { 
  id: string
  name: string
  available?: number | boolean
  unitPrice?: number
  type?: 'item' | 'service'
  quantity?: number
  reserved?: number
  pricingModel?: 'per_count' | 'per_time'
  pricePerCount?: number
  pricePerMinute?: number
  productType?: 'drink' | 'food' | 'inventoryItem' | 'extra'  // New field for actual product type
}

export default function TransferPanel({ sourceCode, onClose, initialTarget }: { sourceCode: string; onClose: () => void; initialTarget?: string | null }) {
  const [inventoryType, setInventoryType] = useState<'all' | 'drinks' | 'food' | 'items' | 'services'>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(12)
  const [allProducts, setAllProducts] = useState<MenuItem[]>([])  // Store ALL items from API
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const [sections, setSections] = useState<Array<{ id: string; code: string; name: string }>>([])
  const [targetDept, setTargetDept] = useState<string | null>(initialTarget ?? null)

  useEffect(() => {
    if (initialTarget) setTargetDept(initialTarget)
  }, [initialTarget])

  const [cart, setCart] = useState<{ id: string; name: string; type: 'item' | 'service'; quantity: number; inventoryType: 'item' | 'service'; productType?: 'drink' | 'food' | 'inventoryItem' | 'extra' }[]>([])

  useEffect(() => { 
    fetchDepartmentsAndSections()
    // Fetch ALL products once - no filtering based on category
    fetchAllProducts() 
  }, [sourceCode, search])

  // Filter products based on selected category (client-side)
  const products = allProducts.filter((p) => {
    if (inventoryType === 'all') return true
    if (inventoryType === 'drinks') return p.productType === 'drink'
    if (inventoryType === 'food') return p.productType === 'food'
    if (inventoryType === 'items') return p.productType === 'inventoryItem'
    if (inventoryType === 'services') return p.productType === 'extra'
    return true
  })

  async function fetchDepartmentsAndSections() {
    try {
      // Fetch sections for the source department (if it exists)
      if (sourceCode) {
        const sectionsRes = await fetch(`/api/departments/${sourceCode}/sections`)
        const sectionsData = await sectionsRes.json()
        if (sectionsRes.ok && sectionsData?.data?.sections) {
          const sectionsList = sectionsData.data.sections.map((s: any) => ({ 
            id: s.id, 
            code: s.slug,
            name: s.name 
          }))
          setSections(sectionsList)
        }
      }
    } catch (e) {
      console.error('failed to load sections', e)
    }
  }

  async function fetchAllProducts() {
    if (!sourceCode) return
    setLoading(true)
    try {
      const searchParam = search ? `&search=${encodeURIComponent(search)}` : ''
      
      // Always fetch ALL items - filter on frontend
      const res = await fetch(`/api/departments/${sourceCode}/products?type=all${searchParam}&pageSize=100`)
      const j = await res.json()
      
      if (res.ok && j?.success) {
        // Map all discoverable items with their product types
        const items = (j.data?.items || []).map((it: any) => ({ 
          id: it.id, 
          name: it.name, 
          available: it.available ?? 0,
          unitPrice: it.unitPrice,
          type: determineItemType(it.type),
          productType: mapProductType(it.type)  // Use type returned from API
        }))
        
        setAllProducts(items)
        setTotal(items.length)
      } else {
        setAllProducts([])
        setTotal(0)
      }
    } catch (e) {
      console.error('fetchAllProducts error', e)
      setAllProducts([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  // Map API item type/category to product type for cart
  function mapProductType(itemType?: string): 'drink' | 'food' | 'inventoryItem' | 'extra' {
    // Handle drink types
    if (itemType === 'drink' || itemType === 'drinks') return 'drink'
    
    // Handle food types
    if (itemType === 'food') return 'food'
    
    // Handle service/extra types
    if (itemType === 'extra' || itemType === 'service') return 'extra'
    
    // Handle supply/inventory categories as generic items
    if (itemType === 'supplies' || itemType === 'toiletries' || itemType === 'misc' || 
        itemType === 'equipment' || itemType === 'linens' || itemType === 'inventory' ||
        itemType === 'inventoryItem') {
      return 'inventoryItem'
    }
    
    // Default to inventoryItem for unknown types
    return 'inventoryItem'
  }

  // Determine if item is service or regular item based on type
  function determineItemType(itemType?: string): 'item' | 'service' {
    if (itemType === 'extra' || itemType === 'service') return 'service'
    return 'item'
  }

  function addToCart(item: MenuItem) {
    if (!item.type) return
    
    setCart((c) => {
      const found = c.find((x) => x.id === item.id)
      
      if (item.type === 'service') {
        // Services: all-or-nothing, can only have qty 1
        if (found) return c // Already added
        return [...c, { id: item.id, name: item.name, type: 'service', quantity: 1, inventoryType: 'service', productType: item.productType }]
      } else {
        // Items: quantity-aware
        const avail = typeof item.available === 'boolean' ? (item.available ? 1 : 0) : Number(item.available ?? 0)
        if (found) return c.map((x) => x.id === item.id ? { ...x, quantity: Math.min(avail, x.quantity + 1) } : x)
        return [...c, { id: item.id, name: item.name, type: 'item', quantity: 1, inventoryType: 'item', productType: item.productType }]
      }
    })
  }

  function updateQty(id: string, qty: number) {
    setCart((c) => c.map((x) => x.id === id ? { ...x, quantity: qty } : x))
  }

  function removeItem(id: string) { setCart((c) => c.filter((x) => x.id !== id)) }

  async function submit() {
    if (!targetDept) return alert('Choose a destination section or department')
    if (cart.length === 0) return alert('Add items to transfer')
    
    try {
      // Map cart items to the transfer API format
      const items = cart.map((c) => ({
        type: c.inventoryType === 'service' ? 'extra' : (c.productType || 'inventoryItem'),
        id: c.id,
        quantity: c.quantity
      }))
      
      // Build the target department code
      // If it's a section (matches a section ID), format as PARENT_CODE:section_code
      const isSection = sections.some(s => s.id === targetDept)
      let toDepartmentCode = targetDept
      if (isSection) {
        const section = sections.find(s => s.id === targetDept)
        toDepartmentCode = `${sourceCode}:${section?.code || targetDept}`
      }
      
      const res = await fetch(`/api/departments/${sourceCode}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toDepartmentCode,
          items
        })
      })
      
      const j = await res.json()
      if (!res.ok || !j?.success) {
        alert(j?.error?.message || j?.data?.message || 'Failed to create transfer')
      } else {
        alert('Transfer created successfully')
        setCart([])
        fetchAllProducts() // Refresh inventory
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
          <h3 className="text-lg font-semibold">Transfer Inventory</h3>
          <div>
            <button onClick={onClose} className="px-2 py-1 border rounded">Close</button>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {/* Category Filter Buttons */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Filter by Category</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setInventoryType('all')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  inventoryType === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Products
              </button>
              <button
                onClick={() => setInventoryType('drinks')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  inventoryType === 'drinks'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                🍹 Drinks
              </button>
              <button
                onClick={() => setInventoryType('food')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  inventoryType === 'food'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                🍽️ Food
              </button>
              <button
                onClick={() => setInventoryType('items')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  inventoryType === 'items'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                📦 Items
              </button>
              <button
                onClick={() => setInventoryType('services')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  inventoryType === 'services'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                ⭐ Services
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex gap-2">
            <input 
              className="p-2 border rounded flex-1" 
              placeholder="Search products..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
            />
            <button className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 font-medium text-sm">Search</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium mb-2">Products</div>
              <div className="space-y-2 max-h-80 overflow-auto">
                {loading ? (
                  <div className="text-sm">Loading...</div>
                ) : (
                  products.map((p) => {
                    const isAvailable = p.type === 'service' || (typeof p.available === 'boolean' ? p.available : Number(p.available ?? 0) > 0)
                    
                    // Get category badge for the product type
                    const categoryBadge = {
                      'drink': { icon: '🍹', label: 'Drink', color: 'bg-blue-100 text-blue-800' },
                      'food': { icon: '🍽️', label: 'Food', color: 'bg-green-100 text-green-800' },
                      'inventoryItem': { icon: '📦', label: 'Item', color: 'bg-gray-100 text-gray-800' },
                      'extra': { icon: '⭐', label: 'Service', color: 'bg-purple-100 text-purple-800' }
                    }[p.productType || 'inventoryItem'] || { icon: '📦', label: 'Item', color: 'bg-gray-100 text-gray-800' }
                    
                    return (
                      <div key={p.id} className="flex items-center justify-between p-2 border rounded hover:bg-gray-50">
                        <div className="flex-1">
                          <div className="font-medium flex items-center gap-2">
                            {p.name}
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${categoryBadge.color}`}>
                              {categoryBadge.icon} {categoryBadge.label}
                            </span>
                          </div>
                          {p.type === 'item' && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Available: {typeof p.available === 'boolean' ? (p.available ? '1' : '0') : String(p.available ?? 0)} | 
                              Qty: {p.quantity ?? 0} | Reserved: {p.reserved ?? 0}
                              {p.unitPrice !== undefined && <div>Price: {formatTablePrice(p.unitPrice)}</div>}
                            </div>
                          )}
                          {p.type === 'service' && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {p.pricingModel === 'per_count' ? `${formatTablePrice(Math.round((p.pricePerCount || 0) * 100))} per count` : `${formatTablePrice(Math.round((p.pricePerMinute || 0) * 100))} per min`}
                            </div>
                          )}
                        </div>
                        <button 
                          className="px-2 py-1 border rounded ml-2" 
                          onClick={() => addToCart(p)} 
                          disabled={!isAvailable}
                        >
                          Add
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium mb-2">Destination</div>
              <select 
                className="w-full p-2 border rounded" 
                value={targetDept ?? ''} 
                onChange={(e) => setTargetDept(e.target.value || null)}
              >
                <option value="">Select destination section...</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>

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

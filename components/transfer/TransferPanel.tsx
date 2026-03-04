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
  const [inventoryType, setInventoryType] = useState<'all' | 'items' | 'services'>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(12)
  const [products, setProducts] = useState<MenuItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const [sections, setSections] = useState<Array<{ id: string; code: string; name: string }>>([])
  const [departments, setDepartments] = useState<Array<{ id: string; code: string; name: string }>>([])
  const [targetDept, setTargetDept] = useState<string | null>(initialTarget ?? null)

  useEffect(() => {
    if (initialTarget) setTargetDept(initialTarget)
  }, [initialTarget])

  const [cart, setCart] = useState<{ id: string; name: string; type: 'item' | 'service'; quantity: number; inventoryType: 'item' | 'service'; productType?: 'drink' | 'food' | 'inventoryItem' | 'extra' }[]>([])

  useEffect(() => { 
    fetchDepartmentsAndSections()
    // Fetch products from the SOURCE DEPARTMENT to enable universal discovery
    // Don't wait for section selection - show all items at department level
    fetchProducts(1) 
  }, [inventoryType, sourceCode, search])

  async function fetchDepartmentsAndSections() {
    try {
      const deptRes = await fetch('/api/departments')
      const deptData = await deptRes.json()
      
      // Map departments
      const list = deptData.data || deptData || []
      const depts = list.map((d: any) => ({ id: d.id, code: d.code, name: d.name }))
      setDepartments(depts)
    } catch (e) {
      console.error('failed to load departments', e)
    }
  }

  async function fetchProducts(p = 1) {
    if (!sourceCode) return
    setLoading(true)
    try {
      // Fetch all discoverable products from the SOURCE DEPARTMENT
      // This includes drinks, food, inventory items, and extras that can be transferred
      // We query the department level (not section) to see all available items for transfer
      const typeParam = inventoryType === 'items' ? 'type=inventoryItem' : inventoryType === 'services' ? 'type=extra' : ''
      const searchParam = search ? `&search=${encodeURIComponent(search)}` : ''
      
      // Use the products endpoint which now supports universal discovery
      const res = await fetch(`/api/departments/${sourceCode}/products?${typeParam}${searchParam}&pageSize=100`)
      const j = await res.json()
      
      if (res.ok && j?.success) {
        // Map all discoverable items from the unified endpoint
        // The items returned include: drinks, food, inventoryItems depending on type filter
        const items = (j.data?.items || []).map((it: any) => ({ 
          id: it.id, 
          name: it.name, 
          available: it.available ?? 0,
          unitPrice: it.unitPrice,
          type: 'item',
          productType: determineProductType(sourceCode, it.type)  // Infer from result or context
        }))
        
        setProducts(items)
        setTotal(items.length)
        setPage(p)
      } else {
        setProducts([])
        setTotal(0)
      }
    } catch (e) {
      console.error('fetchProducts error', e)
      setProducts([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  // Infer product type based on the response data
  function determineProductType(deptCode: string, itemType?: string): 'drink' | 'food' | 'inventoryItem' {
    // If API explicitly returns type, use it
    if (itemType === 'drink') return 'drink'
    if (itemType === 'food') return 'food'
    if (itemType === 'inventoryItem') return 'inventoryItem'
    // Default based on department
    return 'inventoryItem'
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
    if (!targetDept) return alert('Choose a destination department or section')
    if (cart.length === 0) return alert('Add items to transfer')
    
    try {
      // Map cart items to the transfer API format
      // The API expects: { type: 'drink' | 'food' | 'inventoryItem' | 'extra', id, quantity }
      const items = cart.map((c) => ({
        type: c.inventoryType === 'service' ? 'extra' : (c.productType || 'inventoryItem' as 'drink' | 'food' | 'inventoryItem' | 'extra'),
        id: c.id,
        quantity: c.quantity
      }))
      
      // Use the standard department transfer endpoint
      const res = await fetch(`/api/departments/${sourceCode}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toDepartmentCode: targetDept,
          items
        })
      })
      
      const j = await res.json()
      if (!res.ok || !j?.success) {
        alert(j?.error?.message || j?.data?.message || 'Failed to create transfer')
      } else {
        alert('Transfer created successfully')
        setCart([])
        fetchProducts(1) // Refresh inventory
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
          <div className="flex items-center gap-3 flex-wrap">
            <select className="p-2 border rounded" value={inventoryType} onChange={(e) => setInventoryType(e.target.value as any)}>
              <option value="all">All Items & Services</option>
              <option value="items">Items Only</option>
              <option value="services">Services Only</option>
            </select>
            
            <input 
              className="p-2 border rounded flex-1 min-w-[200px]" 
              placeholder="Search products" 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
            />
            <button className="px-3 py-2 border rounded" onClick={() => fetchProducts(1)}>Search</button>
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
                    return (
                      <div key={p.id} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex-1">
                          <div className="font-medium">{p.name}</div>
                          {p.type === 'item' && (
                            <div className="text-xs text-muted-foreground">
                              Available: {typeof p.available === 'boolean' ? (p.available ? '1' : '0') : String(p.available ?? 0)} | 
                              Qty: {p.quantity ?? 0} | Reserved: {p.reserved ?? 0}
                              {p.unitPrice !== undefined && <div>Price: {formatTablePrice(p.unitPrice)}</div>}
                            </div>
                          )}
                          {p.type === 'service' && (
                            <div className="text-xs text-muted-foreground">
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
                <optgroup label="Other Departments">
                  {departments.map((d) => (
                    <option key={d.id} value={d.code}>{d.name}</option>
                  ))}
                </optgroup>
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

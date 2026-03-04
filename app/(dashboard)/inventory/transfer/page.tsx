"use client"

export const dynamic = 'force-dynamic'

import React, { useEffect, useState } from 'react'
import { mapDeptCodeToCategory } from '@/lib/utils'
import { formatTablePrice } from '@/lib/formatters'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Item = { id: string; name: string; quantity?: number; available?: number; unitPrice?: number; itemType?: 'inventory' | 'extra'; sku?: string; unit?: string; category?: string; productType?: 'drink' | 'food' | 'inventoryItem' | 'extra' }

export default function InventoryTransferPage() {
  const router = useRouter()
  const [source, setSource] = useState<string | null>(null)

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      setSource(params.get('source'))
    } catch (e) {
      // window might be undefined during some rendering lifecycles; ignore
    }
  }, [])

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Item[]>([])
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [products, setProducts] = useState<Item[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [sections, setSections] = useState<Array<{ id: string; code: string; name: string }>>([])
  const [destination, setDestination] = useState<string | null>(null)

  const [cart, setCart] = useState<{ id: string; name: string; quantity: number; productType: 'drink' | 'food' | 'inventoryItem' | 'extra' }[]>([])
  const [sourceDeptId, setSourceDeptId] = useState<string | null>(null)

  useEffect(() => {
    if (!source) return
    // Load source department info (to get its ID) and fetch sections for it
    fetchSourceDepartment()
    fetchProducts(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source])

  useEffect(() => {
    if (!source) return
    // Refetch products when category selection changes
    fetchProducts(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory])

  async function fetchSourceDepartment() {
    if (!source) return
    try {
      const res = await fetch(`/api/departments/${encodeURIComponent(source)}`)
      const j = await res.json()
      if (res.ok && j?.success) {
        const deptId = j.data?.id || null
        setSourceDeptId(deptId)
        // Now fetch sections for this department
        if (deptId) {
          await fetchSectionsForDepartment(deptId)
        }
      }
    } catch (e) {
      console.error('failed to fetch source department', e)
    }
  }

  async function fetchSectionsForDepartment(deptId: string) {
    try {
      const res = await fetch(`/api/departments/sections?departmentId=${encodeURIComponent(deptId)}&limit=100`)
      const j = await res.json()
      const secList = j.data || []
      // Map sections to include code which is formatted as parent:slug
      const mapped = (secList || []).map((s: any) => ({
        id: s.id,
        code: source ? `${source}:${s.slug || s.id}` : s.code,
        name: s.name
      }))
      setSections(mapped)
    } catch (e) {
      console.error('failed to load sections', e)
      setSections([])
    }
  }

  async function fetchProducts(p = 1) {
    if (!source) return
    setLoading(true)
    try {
      // Use the products endpoint which now supports universal discovery
      // This returns all discoverable items: drinks, food, inventory items, extras
      let url = `/api/departments/${encodeURIComponent(source)}/products?pageSize=100`
      if (selectedCategory !== 'all') {
        url += `&type=${encodeURIComponent(selectedCategory)}`
      }
      console.log('Fetching products from:', url)
      const res = await fetch(url)
      const j = await res.json()
      console.log('Response status:', res.ok, 'Success:', j?.success, 'Data items:', (j.data?.items || []).length)
      
      if (res.ok && j?.success) {
        // Transform products endpoint response to items format for display
        const items = (j.data?.items || []).map((product: any) => ({
          id: product.id,
          name: product.name,
          sku: product.sku || '',
          category: product.type || 'inventory',
          quantity: product.available || 0,
          available: product.available || 0,
          itemType: 'inventory' as const,
          productType: product.type as 'drink' | 'food' | 'inventoryItem' | 'extra',
          unitPrice: product.unitPrice
        }))
        console.log('Transformed items:', items.length, 'Items:', items)
        
        // Extract unique categories from all items
        const uniqueCategories: string[] = ([...new Set(items.map((item: any) => item.category as string))] as string[]).sort()
        setCategories(uniqueCategories)
        console.log('Categories found:', uniqueCategories)
        
        // Filter to only show items with available > 0
        const filtered = items.filter((item: any) => Number(item.available ?? 0) > 0)
        console.log('Filtered items (available > 0):', filtered.length)
        setProducts(filtered)
        setTotal(filtered.length)
        setPage(p)
      } else {
        console.error('Response not ok or no success flag:', res.ok, j?.success)
        setProducts([])
        setTotal(0)
      }
    } catch (e) {
      console.error('failed to load products', e)
      setProducts([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  async function quickSearch(qs: string) {
    try {
      // Search in department products (universal discovery)
      let url = `/api/departments/${encodeURIComponent(source || '')}/products?pageSize=100`
      if (selectedCategory !== 'all') {
        url += `&type=${encodeURIComponent(selectedCategory)}`
      }
      const res = await fetch(url)
      const j = await res.json()
      const all = (j.data?.items || []).map((product: any) => ({
        id: product.id,
        name: product.name,
        sku: product.sku || '',
        category: product.type || 'inventory',
        quantity: product.available || 0,
        available: product.available || 0,
        itemType: 'inventory' as const,
        productType: product.type as 'drink' | 'food' | 'inventoryItem' | 'extra',
        unitPrice: product.unitPrice
      }))
      // Filter locally by search term AND by available quantity > 0
      const filtered = all.filter((item: any) => 
        (Number(item.available ?? 0) > 0) &&
        (item.name.toLowerCase().includes(qs.toLowerCase()) ||
         item.sku?.toLowerCase().includes(qs.toLowerCase()))
      )
      setResults(filtered)
    } catch (e) {
      console.error('quick search failed', e)
    }
  }

  function addToCart(item: Item) {
    const productType = item.productType || 'inventoryItem'
    setCart((c) => {
      const found = c.find((x) => x.id === item.id && x.productType === productType)
      if (found) return c.map((x) => x.id === item.id && x.productType === productType ? { ...x, quantity: Math.min((item.available ?? 0), x.quantity + 1) } : x)
      return [...c, { id: item.id, name: item.name, quantity: 1, productType }]
    })
  }

  function updateQty(id: string, productType: 'drink' | 'food' | 'inventoryItem' | 'extra', qty: number) {
    setCart((c) => c.map((x) => x.id === id && x.productType === productType ? { ...x, quantity: qty } : x))
  }

  function removeItem(id: string, productType: 'drink' | 'food' | 'inventoryItem' | 'extra') { 
    setCart((c) => c.filter((x) => !(x.id === id && x.productType === productType))) 
  }

  async function submit() {
    if (!source) return alert('Missing source department')
    if (!destination) return alert('Choose a destination section')
    if (cart.length === 0) return alert('Add items')
    setSubmitting(true)
    try {
      const items = cart.map((c) => ({ type: c.productType, id: c.id, quantity: c.quantity }))
      const res = await fetch(`/api/departments/${encodeURIComponent(source)}/transfer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toDepartmentCode: destination, items })
      })
      const j = await res.json()
      if (!res.ok || !j?.success) {
        alert(j?.error?.message || 'Failed')
      } else {
        alert('Transfer created')
        // navigate back to inventory and preserve the source department so UI refreshes department stock
        router.push(`/inventory?department=${encodeURIComponent(source)}`)
      }
    } catch (e) {
      console.error('submit error', e)
      alert('Failed to create transfer')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Create Transfer</h1>
          <div className="text-sm text-muted-foreground">Source: <span className="font-mono">{source ?? '—'}</span></div>
        </div>
        <div>
          <button onClick={() => router.back()} className="px-3 py-1 border rounded">Back</button>
        </div>
      </div>

      {!source && (
        <div className="text-sm text-red-600">No source department selected. Go back to <Link className="text-sky-600" href="/inventory">Inventory</Link> and pick a source department.</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <div className="mb-4">
            <label className="text-sm block font-medium mb-2">Filter by category</label>
            <select 
              className="w-full p-2 border rounded mb-4" 
              value={selectedCategory} 
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="all">All items</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'drink' && '🍷 Drinks'}
                  {cat === 'food' && '🍽️ Food'}
                  {cat === 'inventoryItem' && '📦 Inventory'}
                  {cat === 'extra' && '⭐ Extras'}
                  {!['drink', 'food', 'inventoryItem', 'extra'].includes(cat) && cat}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-2">
            <label className="text-sm">Quick product search</label>
            <input value={query} onChange={(e) => { setQuery(e.target.value); quickSearch(e.target.value) }} className="w-full p-2 border rounded" placeholder="Search products by name or SKU" />
            <div className="bg-white border rounded mt-1 max-h-40 overflow-auto">
              {results.map((r) => (
                <div key={`${r.productType}_${r.id}`} className="p-2 flex items-center justify-between hover:bg-gray-50 border-b">
                  <div className="flex-1">
                    <div className="font-medium text-sm flex items-center gap-2">
                      {r.name}
                      {r.productType === 'extra' && <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">Extra</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Stock: {r.available ?? 0}
                      {r.unitPrice !== undefined && <span className="ml-2">| Price: {formatTablePrice(r.unitPrice)}</span>}
                    </div>
                  </div>
                  <button className="px-2 py-1 border rounded text-sm whitespace-nowrap ml-2" onClick={() => addToCart(r)}>Add</button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm font-medium mb-2">All items</div>
            <div className="space-y-2 max-h-[60vh] overflow-auto border rounded p-2 bg-white">
              {loading ? <div className="text-sm">Loading...</div> : products.map((p) => (
                <div key={`${p.productType}_${p.id}`} className="p-2 flex items-center justify-between border-b hover:bg-gray-50">
                  <div className="flex-1">
                    <div className="font-medium flex items-center gap-2">
                      {p.name}
                      {p.productType === 'extra' && <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">Extra</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Available: <span className="font-mono bg-blue-50 px-2 py-0.5 rounded">{String(p.available ?? p.quantity ?? 0)}</span>
                      {p.productType === 'extra' ? (
                        <span className="ml-3">Unit: {p.unit || 'portion'} | Price: {formatTablePrice(p.unitPrice || 0)}</span>
                      ) : (
                        p.unitPrice !== undefined && <span className="ml-3">Price: {formatTablePrice(p.unitPrice)}</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <button className="px-2 py-1 border rounded text-sm hover:bg-gray-100" onClick={() => addToCart(p)}>Add</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="text-sm">Total: {total}</div>
              <div className="space-x-2">
                <button className="px-2 py-1 border rounded" onClick={() => fetchProducts(Math.max(1, page - 1))}>Prev</button>
                <button className="px-2 py-1 border rounded" onClick={() => fetchProducts(page + 1)}>Next</button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="text-sm font-medium">Destination section</div>
          <div className="mt-2">
            <select className="w-full p-2 border rounded" value={destination ?? ''} onChange={(e) => setDestination(e.target.value || null)}>
              <option value="">Select destination section (must belong to selected department)</option>
              {sections.map((s) => (<option key={s.code} value={s.code}>{s.name} — {s.code}</option>))}
            </select>
          </div>

          <div className="mt-4">
            <div className="text-sm font-medium">Cart</div>
            <div className="mt-2 space-y-2">
              {cart.map((c) => (
                <div key={`${c.productType}_${c.id}`} className="flex items-center justify-between border rounded p-2">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {c.name}
                      {c.productType === 'extra' && <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">Extra</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="number" min={1} value={c.quantity} onChange={(e) => updateQty(c.id, c.productType, Math.max(1, Number(e.target.value || 1)))} className="w-20 p-1 border rounded" />
                    <button className="px-2 py-1 border rounded" onClick={() => removeItem(c.id, c.productType)}>Remove</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <button onClick={submit} disabled={submitting} className="px-3 py-2 bg-sky-600 text-white rounded hover:bg-sky-700 disabled:opacity-60 disabled:cursor-not-allowed">{submitting ? 'Creating...' : 'Create Transfer'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

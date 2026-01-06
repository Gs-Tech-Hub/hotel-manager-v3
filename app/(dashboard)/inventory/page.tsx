"use client"

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-context'
import { mapDeptCodeToCategory } from '@/lib/utils'
import { getDisplayUnit, formatQuantityWithUnit } from '@/src/lib/unit-mapper'
// avoid next/navigation useSearchParams here to prevent prerender/suspense issues
import TransferAuditPanel from '@/components/departments/TransferAuditPanel'
import Price from '@/components/ui/Price'
import { Plus, Trash2, Zap } from 'lucide-react'
import { ExtrasFormDialog } from '@/components/admin/ExtrasFormDialog'

type Department = { id: string; code: string; name: string }

type InventoryItem = {
  id: string
  name: string
  sku: string
  category: string
  itemType?: string
  quantity: number
  unitPrice: number
  usedAsExtras?: Array<{ id: string }> // extras linked to this inventory item
}

export default function InventoryPage() {
  const { hasPermission } = useAuth()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedDept, setSelectedDept] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ name: '', sku: '', category: '', quantity: '0', unitPrice: '0', unit: 'pieces' })
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [categories, setCategories] = useState<string[]>([])
  const [autoGenSku, setAutoGenSku] = useState(true)
  const [extrasFormOpen, setExtrasFormOpen] = useState(false)
  const [selectedItemForExtra, setSelectedItemForExtra] = useState<InventoryItem | null>(null)

  const generateSku = (cat: string) => {
    if (!cat) return ''
    const timestamp = Date.now().toString().slice(-6)
    const prefix = cat.slice(0, 3).toUpperCase()
    return `${prefix}-${timestamp}`
  }

  const handleConvertToExtra = (item: InventoryItem) => {
    setSelectedItemForExtra(item)
    setExtrasFormOpen(true)
  }
  

  const fetchItems = async (dept?: string | null) => {
    setLoading(true)
    setError(null)
    try {
      const url = new URL('/api/inventory', window.location.origin)
      // backend filters by category (department code mapped to category) so send category param
      if (dept) {
        const cat = mapDeptCodeToCategory(dept)
        if (cat) url.searchParams.set('category', cat)
      }
      const res = await fetch(url.toString())
      if (!res.ok) throw new Error(`Failed to fetch inventory (${res.status})`)
      const json = await res.json()
      if (!json?.success) throw new Error(json?.error || 'Invalid response')
      const fetched: any[] = json.data?.items || []
      // If a department is selected, show only available items (quantity > 0)
      if (dept) {
        setItems(fetched.filter((it) => Number(it?.quantity ?? 0) > 0))
      } else {
        setItems(fetched)
      }
    } catch (err: any) {
      console.error('Failed to load inventory', err)
      setError(err?.message || 'Failed to load inventory')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateInventoryItem = async () => {
    if (!formData.name || !formData.category) {
      setFormError('Please fill in all required fields (name and category)')
      return
    }
    // Use auto-generated SKU or manual, but at least one must exist
    const finalSku = autoGenSku && !formData.sku ? generateSku(formData.category) : formData.sku
    if (!finalSku) {
      setFormError('SKU is required. Enable auto-generation or enter a manual SKU.')
      return
    }
    // enforce strict category selection when categories are available
    if (categories.length > 0 && !categories.includes(formData.category)) {
      setFormError('Invalid category selected. Choose one of the available categories.')
      return
    }
    
    setFormLoading(true)
    setFormError(null)
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          sku: finalSku,
          category: formData.category,
          quantity: Number(formData.quantity),
          unitPrice: Number(formData.unitPrice),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        const errMsg = json?.error || json?.message || `Failed to create item (${res.status})`
        throw new Error(errMsg)
      }
      setFormData({ name: '', sku: '', category: '', quantity: '0', unitPrice: '0', unit: 'pieces' })
      setShowForm(false)
      await fetchItems(selectedDept)
    } catch (err: any) {
      console.error('Failed to create inventory item:', err)
      setFormError(err?.message || 'Failed to create item')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDeleteInventoryItem = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this inventory item?')) return
    
    try {
      const res = await fetch(`/api/inventory?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `Failed to delete item (${res.status})`)
      await fetchItems(selectedDept)
    } catch (err: any) {
      console.error('Failed to delete inventory item:', err)
      setError(err?.message || 'Failed to delete item')
    }
  }

  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/departments')
      if (!res.ok) throw new Error('Failed to fetch departments')
      const json = await res.json()
      const data = json.data || json
      const depts = data || []
      setDepartments(depts)
      // derive categories strictly from department codes
      const cats = Array.from(
        new Set(
          depts
            .map((d: any) => mapDeptCodeToCategory(d.code))
            .filter(Boolean)
        )
      ) as string[]
      setCategories(cats)
      // if a department is currently selected, prefill the category to its mapped value
      if (selectedDept) {
        const mapped = mapDeptCodeToCategory(selectedDept)
        if (mapped) setFormData((f) => ({ ...f, category: mapped }))
      }
    } catch (err) {
      console.warn('Could not load departments for inventory filter', err)
    }
  }

  useEffect(() => {
    fetchDepartments()
    fetchItems(selectedDept)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDept])

  // Initialize selected department from the URL query (so returning from a transfer keeps the selection)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const dept = params.get('department')
      if (dept) setSelectedDept(dept)
    } catch (e) {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // when selected department changes, prefill category in form to keep categorization strict
  useEffect(() => {
    if (!selectedDept) return
    const mapped = mapDeptCodeToCategory(selectedDept)
    if (mapped) {
      setFormData((f) => ({ ...f, category: mapped }))
      // auto-generate SKU when category is set via department selection
      if (autoGenSku) {
        setFormData((f) => ({ ...f, sku: generateSku(mapped) }))
      }
    }
  }, [selectedDept])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventory</h1>
        <div>
          {hasPermission('inventory_items.create') && (
            <button 
              onClick={() => setShowForm(!showForm)}
              className="px-3 py-1 bg-green-600 text-white rounded text-sm mr-2 inline-flex items-center gap-2 hover:bg-green-700"
            >
              <Plus size={16} /> Add Item
            </button>
          )}
          <button
            onClick={() => {
              setSelectedItemForExtra(null)
              setExtrasFormOpen(true)
            }}
            className="px-3 py-1 bg-amber-600 text-white rounded text-sm mr-2 inline-flex items-center gap-2 hover:bg-amber-700"
          >
            <Plus size={16} /> Add Extra
          </button>
          <button onClick={() => fetchItems(selectedDept)} className="px-3 py-1 border rounded text-sm mr-2">Refresh</button>
          <Link href={selectedDept ? `/inventory/transfer?source=${encodeURIComponent(selectedDept)}` : '#'} className={`px-3 py-1 border rounded text-sm mr-2 ${!selectedDept ? 'opacity-60 pointer-events-none' : ''}`}>Transfer</Link>
          <Link href="/inventory/movements" className="px-3 py-1 border rounded text-sm">Movements</Link>
        </div>
      </div>

      {showForm && hasPermission('inventory_items.create') && (
        <div className="border rounded p-4 bg-gray-50 space-y-4">
          <h3 className="font-semibold">Create New Inventory Item</h3>
          {formError && <div className="text-sm text-red-600">{formError}</div>}
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Item Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="border rounded px-3 py-2"
            />
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="border rounded px-3 py-2"
            >
              <option value="">Select Category *</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <div className="col-span-2 flex items-center gap-3 p-3 border rounded bg-blue-50">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoGenSku}
                  onChange={(e) => setAutoGenSku(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">Auto-generate SKU</span>
              </label>
              <span className="text-xs text-gray-600">
                {autoGenSku && formData.category
                  ? `Preview: ${generateSku(formData.category)}`
                  : 'Uncheck to enter manual SKU'}
              </span>
            </div>
            {!autoGenSku && (
              <input
                type="text"
                placeholder="Manual SKU *"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="border rounded px-3 py-2"
              />
            )}
            <input
              type="number"
              placeholder="Quantity"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              className="border rounded px-3 py-2"
            />
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <input
                  type="number"
                  placeholder="0.00"
                  value={formData.unitPrice}
                  onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  step="0.01"
                  min="0"
                />
                <div className="text-xs text-muted-foreground mt-1">Unit Price (USD) — e.g., 3000.00, 19.99, 0.50</div>
              </div>
              <div>
                <select
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="border rounded px-3 py-2 bg-white"
                >
                  <option value="pieces">pieces</option>
                  <option value="bottles">bottles</option>
                  <option value="boxes">boxes</option>
                  <option value="liters">liters</option>
                  <option value="kg">kg</option>
                  <option value="grams">grams</option>
                  <option value="rolls">rolls</option>
                  <option value="servings">servings</option>
                  <option value="units">units</option>
                </select>
              </div>
            </div>
            {formData.unitPrice && (
              <div className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded border border-green-200">
                Price: ${Number(formData.unitPrice).toFixed(2)} per {formData.unit}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreateInventoryItem}
              disabled={formLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60"
            >
              {formLoading ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border rounded hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading && <div className="text-sm text-muted-foreground">Loading inventory...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="flex items-center gap-4">
        <div>
          <label className="text-sm mr-2">Filter by department</label>
          <select value={selectedDept ?? ''} onChange={(e) => setSelectedDept(e.target.value || null)} className="border px-2 py-1">
            <option value="">All Departments</option>
            {departments
              .filter((d) => !String(d.code).includes(':')) // only top-level departments
              .map((d) => (
                <option key={d.code} value={d.code}>{d.name} ({d.code})</option>
              ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full table-auto border-collapse">
          <thead>
            <tr className="text-left">
              <th className="p-2">Name</th>
              <th className="p-2">SKU</th>
              <th className="p-2">Category</th>
              <th className="p-2">Quantity</th>
              <th className="p-2">Price</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t hover:bg-gray-50">
                <td className="p-2">
                  <div className="font-medium">{it.name}</div>
                </td>
                <td className="p-2 text-xs text-muted-foreground">{it.sku}</td>
                <td className="p-2 text-sm">{it.category}</td>
                <td className="p-2 text-right">
                  <span className="inline-block bg-blue-50 px-3 py-1 rounded font-mono text-sm">
                    {formatQuantityWithUnit(it.quantity, getDisplayUnit(it.category, it.itemType))}
                  </span>
                </td>
                <td className="p-2 font-medium">
                  <Price amount={Number(it.unitPrice)} isMinor={false} />
                </td>
                <td className="p-2 space-x-2">
                  <Link href={`/inventory/${encodeURIComponent(it.id)}`} className="px-2 py-1 bg-sky-600 text-white rounded text-sm inline-block">Open</Link>
                  {hasPermission('inventory_items.delete') && (
                    <button
                      onClick={() => handleDeleteInventoryItem(it.id)}
                      className="px-2 py-1 bg-red-600 text-white rounded text-sm inline-flex items-center gap-1 hover:bg-red-700"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  )}
                  {it.usedAsExtras && it.usedAsExtras.length > 0 && (
                    <button
                      onClick={() => handleConvertToExtra(it)}
                      className="px-2 py-1 bg-amber-600 text-white rounded text-sm inline-flex items-center gap-1 hover:bg-amber-700"
                      title="Edit Extra"
                    >
                      <Zap size={14} /> Extra
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Transfer audit removed from inventory page to avoid movement artifact */}

      {/* Extras Form Dialog */}
      <ExtrasFormDialog
        open={extrasFormOpen}
        onOpenChange={setExtrasFormOpen}
        extra={selectedItemForExtra ? {
          name: selectedItemForExtra.name,
          description: '',
          unit: 'portion',
          price: Math.round(parseFloat(selectedItemForExtra.unitPrice.toString()) * 100),
          productId: selectedItemForExtra.id,
          trackInventory: true,
          isActive: true,
        } : null}
        onSuccess={() => {
          setExtrasFormOpen(false)
          setSelectedItemForExtra(null)
        }}
      />
      
    </div>
  )
}

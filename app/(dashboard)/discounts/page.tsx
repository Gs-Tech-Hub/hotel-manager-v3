"use client"

import React, { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/components/auth-context'
import { useCurrencyClient } from '@/context/CurrencyClientContext'
import { formatTablePrice, formatDiscount, formatPriceDisplay } from '@/lib/formatters'

type Discount = {
  id: string
  code: string
  name?: string
  type: string
  value: number
  description?: string
  startDate?: string
  endDate?: string
  isActive: boolean
  maxUsageTotal?: number
  maxUsagePerCustomer?: number
}

export default function DiscountsPage() {
  const { hasPermission } = useAuth()
  const { displayCurrency } = useCurrencyClient()
  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: 'percentage',
    value: 0,
    description: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    maxUsageTotal: undefined,
    maxUsagePerCustomer: undefined,
  })

  const fetchDiscounts = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/discounts')
      if (!res.ok) throw new Error(`Failed to fetch discounts (${res.status})`)
      const json = await res.json()
      // API may return either an array (legacy) or a paginated object { rules, pagination }
      let items: any[] = []
      if (Array.isArray(json.data)) {
        items = json.data
      } else if (json.data && Array.isArray(json.data.rules)) {
        items = json.data.rules
      } else if (json?.rules && Array.isArray(json.rules)) {
        // In case the response wasn't wrapped in successResponse
        items = json.rules
      }
      setDiscounts(items.filter((d: any) => d.isActive !== false))
    } catch (err: any) {
      console.error('Failed to load discounts', err)
      setError(err?.message || 'Failed to load discounts')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateDiscount = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    try {
      // For fixed discounts, multiply by 100 to store in expanded minor units
      // For percentage discounts, keep value as-is (0-100 range)
      const baseValue = Number(formData.value)
      const finalValue = formData.type === 'fixed' ? Math.round(baseValue * 100) : baseValue

      const payload = {
        ...formData,
        value: finalValue,
        startDate: new Date(formData.startDate).toISOString(),
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : undefined,
        maxUsageTotal: formData.maxUsageTotal ? Number(formData.maxUsageTotal) : undefined,
        maxUsagePerCustomer: formData.maxUsagePerCustomer ? Number(formData.maxUsagePerCustomer) : undefined,
        currency: displayCurrency,
      }
      const res = await fetch('/api/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to create discount')
      }
      const json = await res.json()
      setDiscounts([json.data, ...discounts])
      setFormData({
        code: '',
        name: '',
        type: 'percentage',
        value: 0,
        description: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        maxUsageTotal: undefined,
        maxUsagePerCustomer: undefined,
      })
      setShowForm(false)
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Failed to create discount')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDeleteDiscount = async (id: string) => {
    if (!confirm('Are you sure you want to delete this discount?')) return
    try {
      const res = await fetch(`/api/discounts/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete discount')
      setDiscounts(discounts.filter(d => d.id !== id))
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Failed to delete discount')
    }
  }

  useEffect(() => { fetchDiscounts() }, [])

  const canManage = hasPermission('discounts.create') || hasPermission('discounts.delete')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Discounts</h1>
        <div className="flex gap-2">
          {canManage && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Add Discount
            </button>
          )}
          <button onClick={fetchDiscounts} className="px-3 py-2 border rounded text-sm hover:bg-muted">Refresh</button>
        </div>
      </div>

      {/* Create Form */}
      {showForm && canManage && (
        <div className="border rounded-lg p-4 bg-muted">
          <form onSubmit={handleCreateDiscount} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Code (e.g., 'SUMMER20')"
                value={formData.code}
                onChange={e => setFormData({ ...formData, code: e.target.value })}
                className="px-3 py-2 border rounded text-sm"
                required
              />
              <input
                type="text"
                placeholder="Name (optional)"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="px-3 py-2 border rounded text-sm"
              />
              <select
                value={formData.type}
                onChange={e => setFormData({ ...formData, type: e.target.value })}
                className="px-3 py-2 border rounded text-sm"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount</option>
                <option value="tiered">Tiered</option>
                <option value="employee">Employee</option>
                <option value="bulk">Bulk</option>
              </select>
              <input
                type="number"
                placeholder={formData.type === 'percentage' ? 'Value (0-100)' : 'Value'}
                value={formData.value}
                onChange={e => setFormData({ ...formData, value: parseFloat(e.target.value) })}
                className="px-3 py-2 border rounded text-sm"
                required
              />
              <input
                type="date"
                value={formData.startDate}
                onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                className="px-3 py-2 border rounded text-sm"
                required
              />
              <input
                type="date"
                placeholder="End Date (optional)"
                value={formData.endDate}
                onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                className="px-3 py-2 border rounded text-sm"
              />
              <textarea
                placeholder="Description (optional)"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="px-3 py-2 border rounded text-sm col-span-2"
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={formLoading} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50">
                {formLoading ? 'Creating...' : 'Create'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded text-sm hover:bg-muted">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && <div className="text-sm text-muted-foreground">Loading discounts...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b bg-muted">
              <th className="text-left p-3 font-semibold">Code</th>
              <th className="text-left p-3 font-semibold">Name</th>
              <th className="text-left p-3 font-semibold">Type</th>
              <th className="text-left p-3 font-semibold">Value</th>
              <th className="text-left p-3 font-semibold">Start Date</th>
              <th className="text-left p-3 font-semibold">End Date</th>
              {canManage && <th className="text-left p-3 font-semibold">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {discounts.map(d => (
              <tr key={d.id} className="border-b hover:bg-muted">
                <td className="p-3 font-mono text-sm">{d.code}</td>
                <td className="p-3">{d.name || '-'}</td>
                <td className="p-3 capitalize text-sm">{d.type}</td>
                <td className="p-3 font-medium">
                  {d.type === 'percentage' ? `${d.value}%` : formatTablePrice(d.value, undefined, displayCurrency || undefined)}
                </td>
                <td className="p-3 text-sm">{d.startDate ? new Date(d.startDate).toLocaleDateString() : '-'}</td>
                <td className="p-3 text-sm">{d.endDate ? new Date(d.endDate).toLocaleDateString() : '-'}</td>
                {canManage && (
                  <td className="p-3">
                    <button
                      onClick={() => handleDeleteDiscount(d.id)}
                      className="px-2 py-1 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200 flex items-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {discounts.length === 0 && !loading && (
          <div className="text-center py-8 text-muted-foreground">No discounts found</div>
        )}
      </div>
    </div>
  )
}

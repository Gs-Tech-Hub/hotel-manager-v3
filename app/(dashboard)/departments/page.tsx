"use client"

import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import { Utensils, Coffee, Activity, Gamepad, BookOpen, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/components/auth-context'

type Department = {
  id: string
  code: string
  name: string
  description?: string
  type?: string
  icon?: string
  totalOrders?: number
  pendingOrders?: number
  referenceType?: string | null
  referenceId?: string | null
  metadata?: any
}

// Prefer mapping by department.type (these values come from the prisma model)
const iconForType: Record<string, any> = {
  restaurants: Utensils,
  bars: Coffee,
  gyms: Activity,
  games: Gamepad,
}

export default function DepartmentsPage() {
  const { hasPermission } = useAuth()
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({ code: '', name: '', description: '', type: '' })
  const [formLoading, setFormLoading] = useState(false)
  const [editingDept, setEditingDept] = useState<Department | null>(null)

  const fetchDepartments = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/departments')
      if (!res.ok) throw new Error(`Failed to fetch departments (${res.status})`)
      const json = await res.json()
      if (!json) throw new Error('Invalid response')
      const data = json.data || json // handle legacy shapes
      // Keep only canonical/top-level departments (exclude per-entity sections)
      const canonical = (data || []).filter((dd: any) => {
        // prefer explicit reference fields, otherwise fall back to code pattern
        if (dd.referenceType) return false
        if (dd.metadata && dd.metadata.section) return false
        if (typeof dd.code === 'string' && dd.code.includes(':')) return false
        return true
      })
      setDepartments(canonical || [])
    } catch (err: any) {
      console.error('Failed to load departments', err)
      setError(err?.message || 'Failed to load departments')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    try {
      const res = await fetch('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!res.ok) throw new Error('Failed to create department')
      const json = await res.json()
      setDepartments([json.data, ...departments])
      setFormData({ code: '', name: '', description: '', type: '' })
      setShowForm(false)
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Failed to create department')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDeleteDepartment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this department? This action cannot be undone.')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/departments/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) {
        alert(json?.error?.message || 'Failed to delete department')
        return
      }
      setDepartments(departments.filter(d => d.id !== id))
      setEditingDept(null)
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Failed to delete department')
    } finally {
      setDeletingId(null)
    }
  }

  useEffect(() => { fetchDepartments() }, [])

  const canManage = hasPermission('departments.create') || hasPermission('departments.delete')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Departments</h1>
        <div className="flex gap-2">
          {canManage && (
            <button 
              onClick={() => setShowForm(!showForm)}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Plus className="h-4 w-4" />
              Add Department
            </button>
          )}
          <button onClick={fetchDepartments} className="px-3 py-2 border rounded text-sm hover:bg-muted" disabled={loading}>Refresh</button>
        </div>
      </div>

      {/* Create Form */}
      {showForm && canManage && (
        <div className="border rounded-lg p-4 bg-muted">
          <form onSubmit={handleCreateDepartment} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Code (e.g., 'restaurant')"
                value={formData.code}
                onChange={e => setFormData({ ...formData, code: e.target.value })}
                className="px-3 py-2 border rounded text-sm"
                required
              />
              <input
                type="text"
                placeholder="Name"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="px-3 py-2 border rounded text-sm"
                required
              />
              <input
                type="text"
                placeholder="Type (optional)"
                value={formData.type}
                onChange={e => setFormData({ ...formData, type: e.target.value })}
                className="px-3 py-2 border rounded text-sm col-span-2"
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

      {loading && <div className="text-sm text-muted-foreground">Loading departments...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {departments.map((d) => {
          const key = (d.type || d.code || '').toString().toLowerCase()
          const Icon = iconForType[key] ?? BookOpen
          return (
            <div key={d.id} className="border rounded-lg p-5 bg-card hover:shadow-lg transition-shadow">
              <Link
                href={`/departments/${encodeURIComponent(d.code)}`}
                className="block"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="p-2 bg-muted rounded-md">
                      <Icon className="h-6 w-6 text-foreground" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">{d.name}</h3>
                      {d.description ? (
                        <p className="text-sm text-muted-foreground mt-1">{d.description}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground mt-1">Manage inventory, orders and KPIs for this department.</p>
                      )}
                      <div className="text-sm text-muted-foreground mt-3">Code: <span className="font-mono">{d.code}</span></div>
                    </div>
                  </div>
                </div>
              </Link>

              {/* Edit Button */}
              {canManage && (
                <div className="mt-3">
                  <button
                    onClick={() => setEditingDept(d)}
                    className="w-full px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded hover:bg-blue-200"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Edit Department Modal */}
      {editingDept && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-lg">
            <h2 className="text-xl font-bold mb-4">Manage Department</h2>
            <div className="space-y-2 mb-6">
              <p><strong>Name:</strong> {editingDept.name}</p>
              <p><strong>Code:</strong> <span className="font-mono">{editingDept.code}</span></p>
              {editingDept.description && <p><strong>Description:</strong> {editingDept.description}</p>}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleDeleteDepartment(editingDept.id)}
                disabled={deletingId === editingDept.id}
                className="flex-1 px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
              >
                {deletingId === editingDept.id ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => setEditingDept(null)}
                className="flex-1 px-3 py-2 border rounded text-sm hover:bg-muted"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

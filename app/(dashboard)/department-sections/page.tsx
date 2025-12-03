"use client"

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-context'
import { Plus, Trash2 } from 'lucide-react'

type Department = { id: string; code: string; name: string }

type DepartmentSection = {
  id: string
  name: string
  departmentId: string
  isActive: boolean
}

export default function DepartmentSectionsPage() {
  const { hasPermission } = useAuth()
  const [sections, setSections] = useState<DepartmentSection[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ name: '', departmentId: '' })
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const fetchSections = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/department-sections')
      if (!res.ok) throw new Error(`Failed to fetch sections (${res.status})`)
      const json = await res.json()
      if (!json?.success) throw new Error(json?.error || 'Invalid response')
      setSections(json.data || [])
    } catch (err: any) {
      console.error('Failed to load sections', err)
      setError(err?.message || 'Failed to load sections')
    } finally {
      setLoading(false)
    }
  }

  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/departments')
      if (!res.ok) throw new Error('Failed to fetch departments')
      const json = await res.json()
      const data = json.data || json
      // Filter to top-level departments only
      setDepartments((data || []).filter((d: any) => !String(d.code).includes(':')))
    } catch (err) {
      console.warn('Could not load departments', err)
    }
  }

  useEffect(() => {
    fetchDepartments()
    fetchSections()
  }, [])

  const handleCreateSection = async () => {
    if (!formData.name || !formData.departmentId) {
      setFormError('Please fill in all required fields')
      return
    }

    setFormLoading(true)
    setFormError(null)
    try {
      const res = await fetch('/api/admin/department-sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          departmentId: formData.departmentId,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `Failed to create section (${res.status})`)
      setFormData({ name: '', departmentId: '' })
      setShowForm(false)
      await fetchSections()
    } catch (err: any) {
      console.error('Failed to create section:', err)
      setFormError(err?.message || 'Failed to create section')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDeleteSection = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this section?')) return

    try {
      const res = await fetch(`/api/admin/department-sections?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `Failed to delete section (${res.status})`)
      await fetchSections()
    } catch (err: any) {
      console.error('Failed to delete section:', err)
      setError(err?.message || 'Failed to delete section')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Department Sections</h1>
        <div>
          {hasPermission('department_sections.create') && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-3 py-1 bg-green-600 text-white rounded text-sm mr-2 inline-flex items-center gap-2 hover:bg-green-700"
            >
              <Plus size={16} /> Add Section
            </button>
          )}
          <button onClick={() => fetchSections()} className="px-3 py-1 border rounded text-sm">Refresh</button>
        </div>
      </div>

      {showForm && hasPermission('department_sections.create') && (
        <div className="border rounded p-4 bg-gray-50 space-y-4">
          <h3 className="font-semibold">Create New Department Section</h3>
          {formError && <div className="text-sm text-red-600">{formError}</div>}
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Section Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="border rounded px-3 py-2"
            />
            <select
              value={formData.departmentId}
              onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
              className="border rounded px-3 py-2"
            >
              <option value="">Select Department *</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreateSection}
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

      {loading && <div className="text-sm text-muted-foreground">Loading sections...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="overflow-x-auto">
        <table className="w-full table-auto border-collapse">
          <thead>
            <tr className="text-left bg-gray-50">
              <th className="p-2">Section Name</th>
              <th className="p-2">Department</th>
              <th className="p-2">Status</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => {
              const dept = departments.find((d) => d.id === section.departmentId)
              return (
                <tr key={section.id} className="border-t hover:bg-gray-50">
                  <td className="p-2 font-medium">{section.name}</td>
                  <td className="p-2">{dept?.name || 'Unknown'}</td>
                  <td className="p-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${section.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {section.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-2">
                    {hasPermission('department_sections.delete') && (
                      <button
                        onClick={() => handleDeleteSection(section.id)}
                        className="px-2 py-1 bg-red-600 text-white rounded text-sm inline-flex items-center gap-1 hover:bg-red-700"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {sections.length === 0 && !loading && (
        <div className="text-center py-8 text-muted-foreground">
          No department sections found. {hasPermission('department_sections.create') && 'Create one to get started.'}
        </div>
      )}
    </div>
  )
}

"use client"

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-context'
import { Plus, Trash2 } from 'lucide-react'

type Employee = {
  id: string
  username: string
  email: string
  firstname?: string
  lastname?: string
  blocked: boolean
}

export default function EmployeesPage() {
  const { hasPermission } = useAuth()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    firstname: '',
    lastname: '',
    password: '',
  })
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const fetchEmployees = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/employees')
      if (!res.ok) throw new Error(`Failed to fetch employees (${res.status})`)
      const json = await res.json()
      if (!json?.success) throw new Error(json?.error || 'Invalid response')
      setEmployees(json.data || [])
    } catch (err: any) {
      console.error('Failed to load employees', err)
      setError(err?.message || 'Failed to load employees')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEmployees()
  }, [])

  const handleCreateEmployee = async () => {
    if (!formData.username || !formData.email || !formData.password) {
      setFormError('Please fill in all required fields')
      return
    }

    // Basic email validation
    if (!formData.email.includes('@')) {
      setFormError('Please enter a valid email address')
      return
    }

    setFormLoading(true)
    setFormError(null)
    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password,
          firstname: formData.firstname || null,
          lastname: formData.lastname || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `Failed to create employee (${res.status})`)
      setFormData({
        username: '',
        email: '',
        firstname: '',
        lastname: '',
        password: '',
      })
      setShowForm(false)
      await fetchEmployees()
    } catch (err: any) {
      console.error('Failed to create employee:', err)
      setFormError(err?.message || 'Failed to create employee')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDeleteEmployee = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this employee?')) return

    try {
      const res = await fetch(`/api/employees/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `Failed to delete employee (${res.status})`)
      await fetchEmployees()
    } catch (err: any) {
      console.error('Failed to delete employee:', err)
      setError(err?.message || 'Failed to delete employee')
    }
  }

  const fullName = (emp: Employee) => {
    const parts = [emp.firstname, emp.lastname].filter(Boolean)
    return parts.length > 0 ? parts.join(' ') : emp.username
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Employees</h1>
        <div>
          {hasPermission('employees.create') && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-3 py-1 bg-green-600 text-white rounded text-sm mr-2 inline-flex items-center gap-2 hover:bg-green-700"
            >
              <Plus size={16} /> Add Employee
            </button>
          )}
          <button onClick={() => fetchEmployees()} className="px-3 py-1 border rounded text-sm">Refresh</button>
        </div>
      </div>

      {showForm && hasPermission('employees.create') && (
        <div className="border rounded p-4 bg-gray-50 space-y-4">
          <h3 className="font-semibold">Create New Employee</h3>
          {formError && <div className="text-sm text-red-600">{formError}</div>}
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Username *"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="border rounded px-3 py-2"
            />
            <input
              type="email"
              placeholder="Email *"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="border rounded px-3 py-2"
            />
            <input
              type="password"
              placeholder="Password *"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="border rounded px-3 py-2"
            />
            <input
              type="text"
              placeholder="First Name"
              value={formData.firstname}
              onChange={(e) => setFormData({ ...formData, firstname: e.target.value })}
              className="border rounded px-3 py-2"
            />
            <input
              type="text"
              placeholder="Last Name"
              value={formData.lastname}
              onChange={(e) => setFormData({ ...formData, lastname: e.target.value })}
              className="border rounded px-3 py-2"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreateEmployee}
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

      {loading && <div className="text-sm text-muted-foreground">Loading employees...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="overflow-x-auto">
        <table className="w-full table-auto border-collapse">
          <thead>
            <tr className="text-left bg-gray-50">
              <th className="p-2">Name</th>
              <th className="p-2">Username</th>
              <th className="p-2">Email</th>
              <th className="p-2">Status</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id} className="border-t hover:bg-gray-50">
                <td className="p-2 font-medium">{fullName(emp)}</td>
                <td className="p-2 text-sm text-muted-foreground">{emp.username}</td>
                <td className="p-2 text-sm">{emp.email}</td>
                <td className="p-2">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${emp.blocked ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}
                  >
                    {emp.blocked ? 'Blocked' : 'Active'}
                  </span>
                </td>
                <td className="p-2">
                  {hasPermission('employees.delete') && (
                    <button
                      onClick={() => handleDeleteEmployee(emp.id)}
                      className="px-2 py-1 bg-red-600 text-white rounded text-sm inline-flex items-center gap-1 hover:bg-red-700"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {employees.length === 0 && !loading && (
        <div className="text-center py-8 text-muted-foreground">
          No employees found. {hasPermission('employees.create') && 'Create one to get started.'}
        </div>
      )}
    </div>
  )
}

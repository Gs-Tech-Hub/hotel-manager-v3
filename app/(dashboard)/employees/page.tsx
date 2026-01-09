"use client"

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-context'
import { Plus, Trash2, Edit } from 'lucide-react'
import { EmployeeForm } from '@/components/admin/employee-form'

type Employee = {
  id: string
  username: string
  email: string
  firstname?: string
  lastname?: string
  blocked: boolean
  roles?: Array<{
    roleId: string
    departmentId?: string
  }>
}

export default function EmployeesPage() {
  const { hasPermission } = useAuth()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)

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

  const handleEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp)
    setShowForm(true)
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditingEmployee(null)
  }

  const handleFormSuccess = () => {
    fetchEmployees()
  }

  const fullName = (emp: Employee) => {
    const parts = [emp.firstname, emp.lastname].filter(Boolean)
    return parts.length > 0 ? parts.join(' ') : emp.username
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Employee Management</h1>
        <div className="flex gap-2">
          {hasPermission('employees.create') && (
            <button
              onClick={() => {
                setEditingEmployee(null)
                setShowForm(true)
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus size={18} /> Add Employee
            </button>
          )}
          <button 
            onClick={() => fetchEmployees()} 
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">⚠️ {error}</p>
        </div>
      )}

      {/* Employee Form Modal */}
      <EmployeeForm
        isOpen={showForm}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
        employeeId={editingEmployee?.id}
        initialData={
          editingEmployee
            ? {
                email: editingEmployee.email,
                firstName: editingEmployee.firstname || '',
                lastName: editingEmployee.lastname || '',
                username: editingEmployee.username,
                roles: editingEmployee.roles || [],
              }
            : undefined
        }
      />

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
            <p className="text-gray-600">Loading employees...</p>
          </div>
        </div>
      )}

      {/* Employee Table */}
      {!loading && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {employees.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">
                {hasPermission('employees.create')
                  ? 'No employees found. Create one to get started.'
                  : 'No employees found.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Username
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900">
                            {emp.firstname || emp.lastname
                              ? `${emp.firstname || ''} ${emp.lastname || ''}`.trim()
                              : emp.username}
                          </p>
                          <p className="text-sm text-gray-500">{emp.username}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{emp.email}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{emp.username}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                            emp.blocked
                              ? 'bg-red-100 text-red-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {emp.blocked ? 'Blocked' : 'Active'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {hasPermission('employees.update') && (
                            <button
                              onClick={() => handleEditEmployee(emp)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded hover:text-blue-700"
                              title="Edit"
                            >
                              <Edit size={16} />
                            </button>
                          )}
                          {hasPermission('employees.delete') && (
                            <button
                              onClick={() => handleDeleteEmployee(emp.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded hover:text-red-700"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-context'
import { Plus, AlertCircle } from 'lucide-react'
import { EmployeeForm } from '@/components/admin/employee-form'
import { EmployeeListCard } from '@/components/admin/employee-list-card'

type Employee = {
  id: string
  username: string
  email: string
  firstname?: string
  lastname?: string
  blocked: boolean
  employmentData?: {
    employmentDate: string
    position: string
    department?: string
    salary: number
    salaryType: string
    salaryFrequency: string
    employmentStatus: string
    totalCharges?: number
  } | null
  summary?: any
  roles?: Array<{
    roleId: string
    roleName: string
    departmentId?: string
    departmentName?: string
  }>
  totalCharges: number
  totalOutstandingCharges: number
  totalPaidCharges: number
  chargesBreakdown: Record<string, { count: number; total: number }>
  lastPaidDate?: string | null
  nextSalaryDueDate?: string | null
  activeLeaves: number
  createdAt?: string
}

export default function EmployeesPage() {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)

  // Filtering & Sorting
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'name' | 'salary' | 'charges' | 'outstanding'>('name')
  const [searchQuery, setSearchQuery] = useState('')

  const fetchEmployees = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/employees')
      if (!res.ok) throw new Error(`Failed to fetch employees (${res.status})`)
      const json = await res.json()
      if (!json?.success) throw new Error(json?.error || 'Invalid response')

      const employeeList = json.data?.employees || json.data || []
      if (!Array.isArray(employeeList)) {
        console.error('[EmployeesPage] employeeList is not an array:', employeeList)
        setEmployees([])
      } else {
        setEmployees(employeeList)
      }
    } catch (err: any) {
      console.error('Failed to load employees', err)
      setError(err?.message || 'Failed to load employees')
      setEmployees([])
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

  const handleViewEmployee = (id: string) => {
    router.push(`/employees/${id}`)
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditingEmployee(null)
  }

  const handleFormSuccess = () => {
    fetchEmployees()
  }

  // Filter and sort employees
  const filteredAndSortedEmployees = employees
    .filter((emp) => {
      // Status filter
      const empStatus = emp.employmentData?.employmentStatus || 'inactive'
      if (statusFilter !== 'all' && empStatus !== statusFilter) {
        return false
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const fullName = `${emp.firstname || ''} ${emp.lastname || ''}`.toLowerCase()
        return (
          fullName.includes(query) ||
          emp.email.toLowerCase().includes(query) ||
          emp.username.toLowerCase().includes(query)
        )
      }

      return true
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'salary':
          return (Number(b.employmentData?.salary) || 0) - (Number(a.employmentData?.salary) || 0)
        case 'charges':
          return b.totalCharges - a.totalCharges
        case 'outstanding':
          return b.totalOutstandingCharges - a.totalOutstandingCharges
        case 'name':
        default: {
          const aName = `${a.firstname || ''} ${a.lastname || ''}`.trim() || a.username
          const bName = `${b.firstname || ''} ${b.lastname || ''}`.trim() || b.username
          return aName.localeCompare(bName)
        }
      }
    })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Employee Management</h1>
          <p className="text-gray-600 mt-1">
            {filteredAndSortedEmployees.length} of {employees.length} employees
          </p>
        </div>
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
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
          <p className="text-red-700">{error}</p>
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

      {/* Filters and Sorting */}
      {!loading && employees.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              placeholder="Search by name, email, or username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filters and Sorting Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Employment Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="on_leave">On Leave</option>
                <option value="terminated">Terminated</option>
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="name">Name (A-Z)</option>
                <option value="salary">Salary (High to Low)</option>
                <option value="charges">Total Charges</option>
                <option value="outstanding">Outstanding Amount</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Employee Cards Grid */}
      {!loading && (
        <>
          {!Array.isArray(employees) || employees.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <p className="text-gray-600">
                {hasPermission('employees.create')
                  ? 'No employees found. Create one to get started.'
                  : 'No employees found.'}
              </p>
            </div>
          ) : filteredAndSortedEmployees.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <p className="text-gray-600">No employees match your filter criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredAndSortedEmployees.map((emp) => (
                <EmployeeListCard
                  key={emp.id}
                  id={emp.id}
                  firstname={emp.firstname}
                  lastname={emp.lastname}
                  email={emp.email}
                  username={emp.username}
                  employmentData={emp.employmentData}
                  totalOutstandingCharges={emp.totalOutstandingCharges}
                  roles={emp.roles}
                  blocked={emp.blocked}
                  onClick={() => handleViewEmployee(emp.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

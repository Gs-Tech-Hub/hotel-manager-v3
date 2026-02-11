"use client"

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-context'
import { ArrowLeft, Save, X, AlertCircle, Plus, Trash2 } from 'lucide-react'

interface Role {
  id: string
  code: string
  name: string
}

interface UserRole {
  id: string
  roleId: string
  roleName?: string
  roleCode?: string
  departmentId?: string
  departmentName?: string
}

interface EmployeeData {
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
  } | null
  roles?: Array<{ roleName: string; departmentName?: string }>
  userRoles?: UserRole[]
}

interface EditFormData {
  firstname?: string
  lastname?: string
  blocked: boolean
  position?: string
  department?: string
  salary?: number
  salaryStatus?: string
}

export default function EmployeeEditPage() {
  const params = useParams()
  const router = useRouter()
  const { hasPermission } = useAuth()
  const employeeId = params.id as string

  const [employee, setEmployee] = useState<EmployeeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<EditFormData>({
    firstname: '',
    lastname: '',
    blocked: false,
    position: '',
    department: '',
    salary: 0,
    salaryStatus: 'active',
  })
  const [saving, setSaving] = useState(false)
  
  // Role management state
  const [userRoles, setUserRoles] = useState<UserRole[]>([])
  const [availableRoles, setAvailableRoles] = useState<Role[]>([])
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('')
  const [loadingRoles, setLoadingRoles] = useState(true)
  const [assigningRole, setAssigningRole] = useState(false)
  const [removingRoleId, setRemovingRoleId] = useState<string | null>(null)

  useEffect(() => {
    if (!hasPermission('employees.update')) {
      setError('You do not have permission to edit employees')
      return
    }

    fetchEmployee()
    fetchAvailableRoles()
  }, [employeeId])

  const fetchEmployee = async () => {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch('/api/employees?limit=100')
      if (!res.ok) throw new Error(`Failed to fetch employees (${res.status})`)

      const json = await res.json()
      if (!json?.success) throw new Error(json?.error || 'Invalid response')

      const employees = json.data?.employees || []
      const found = employees.find((emp: EmployeeData) => emp.id === employeeId)

      if (!found) {
        throw new Error('Employee not found')
      }

      setEmployee(found)
      setUserRoles(found.userRoles || found.roles?.map((r: any) => ({ id: '', roleId: '', roleName: r.roleName, departmentName: r.departmentName })) || [])
      setFormData({
        firstname: found.firstname || '',
        lastname: found.lastname || '',
        blocked: found.blocked || false,
        position: found.employmentData?.position || '',
        department: found.employmentData?.department || '',
        salary: found.employmentData?.salary || 0,
        salaryStatus: found.employmentData?.employmentStatus || 'active',
      })
    } catch (err: any) {
      console.error('Failed to load employee:', err)
      setError(err?.message || 'Failed to load employee')
    } finally {
      setLoading(false)
    }
  }

  const fetchAvailableRoles = async () => {
    try {
      setLoadingRoles(true)
      const res = await fetch('/api/roles?limit=100')
      if (!res.ok) throw new Error('Failed to fetch roles')
      
      const json = await res.json()
      setAvailableRoles(json.roles || [])
    } catch (err: any) {
      console.error('Failed to load roles:', err)
    } finally {
      setLoadingRoles(false)
    }
  }

  const handleAssignRole = async () => {
    if (!selectedRoleId) {
      setError('Please select a role')
      return
    }

    setAssigningRole(true)
    try {
      const res = await fetch(`/api/users/${employeeId}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roleCode: selectedRoleId,
          departmentId: selectedDepartmentId || undefined,
        }),
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Failed to assign role')
      }

      setSelectedRoleId('')
      setSelectedDepartmentId('')
      await fetchEmployee()
    } catch (err: any) {
      setError(err?.message || 'Failed to assign role')
    } finally {
      setAssigningRole(false)
    }
  }

  const handleRemoveRole = async (roleId: string) => {
    setRemovingRoleId(roleId)
    try {
      const res = await fetch(`/api/users/${employeeId}/roles/${roleId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Failed to remove role')
      }

      await fetchEmployee()
    } catch (err: any) {
      setError(err?.message || 'Failed to remove role')
    } finally {
      setRemovingRoleId(null)
    }
  }

  const handleSave = async () => {
    if (!employee) return

    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/employees/${encodeURIComponent(employeeId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstname: formData.firstname,
          lastname: formData.lastname,
          blocked: formData.blocked,
          employmentData: {
            position: formData.position,
            department: formData.department,
            salary: formData.salary,
            employmentStatus: formData.salaryStatus,
          },
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to save changes')

      // Redirect back to employee details
      router.push(`/employees/${employeeId}`)
    } catch (err: any) {
      console.error('Failed to save:', err)
      setError(err?.message || 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
          <p className="text-gray-600">Loading employee...</p>
        </div>
      </div>
    )
  }

  if (error && !employee) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
        >
          <ArrowLeft size={18} /> Back
        </button>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
        >
          <ArrowLeft size={18} /> Back
        </button>
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-700">Employee not found.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
        >
          <ArrowLeft size={18} /> Back
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            <X size={16} /> Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
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

      {/* Form */}
      <div className="bg-white rounded-lg border border-gray-200 p-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Edit Employee</h1>
          <p className="text-gray-600 mt-2">{employee.email}</p>
        </div>

        {/* Basic Information */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
              <input
                type="text"
                value={formData.firstname}
                onChange={(e) => setFormData({ ...formData, firstname: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
              <input
                type="text"
                value={formData.lastname}
                onChange={(e) => setFormData({ ...formData, lastname: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={employee.email}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
              <input
                type="text"
                value={employee.username}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">Username cannot be changed</p>
            </div>
          </div>
        </div>

        {/* Employment Information */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Employment Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Position</label>
              <input
                type="text"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Manager, Staff"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., HR, Sales"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Monthly Salary</label>
              <input
                type="number"
                step="0.01"
                value={formData.salary}
                onChange={(e) => setFormData({ ...formData, salary: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Employment Status</label>
              <select
                value={formData.salaryStatus}
                onChange={(e) => setFormData({ ...formData, salaryStatus: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="on_leave">On Leave</option>
                <option value="terminated">Terminated</option>
              </select>
            </div>
          </div>
        </div>

        {/* Roles & Permissions */}
        <div className="space-y-4 pt-4 border-t border-gray-200">
          <h2 className="text-xl font-semibold">Roles & Permissions</h2>
          
          {/* Current Roles */}
          <div>
            <h3 className="font-medium text-gray-700 mb-3">Assigned Roles</h3>
            {userRoles.length === 0 ? (
              <p className="text-gray-500 text-sm">No roles assigned yet</p>
            ) : (
              <div className="space-y-2">
                {userRoles.map((userRole) => (
                  <div
                    key={userRole.id || userRole.roleId}
                    className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-800">{userRole.roleName || userRole.roleCode}</p>
                      {userRole.departmentName && (
                        <p className="text-sm text-gray-600">Department: {userRole.departmentName}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveRole(userRole.id)}
                      disabled={removingRoleId === userRole.id}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Remove role"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add New Role */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
            <h3 className="font-medium text-gray-700">Assign New Role</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Role</label>
                {loadingRoles ? (
                  <p className="text-sm text-gray-600">Loading roles...</p>
                ) : (
                  <select
                    value={selectedRoleId}
                    onChange={(e) => setSelectedRoleId(e.target.value)}
                    disabled={assigningRole}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">-- Select a role --</option>
                    {availableRoles.map((role) => (
                      <option key={role.id} value={role.code}>
                        {role.name} ({role.code})
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Department (Optional)</label>
                <input
                  type="text"
                  value={selectedDepartmentId}
                  onChange={(e) => setSelectedDepartmentId(e.target.value)}
                  placeholder="Leave empty for global role"
                  disabled={assigningRole}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>
            <button
              onClick={handleAssignRole}
              disabled={assigningRole || !selectedRoleId}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <Plus size={16} /> {assigningRole ? 'Assigning...' : 'Assign Role'}
            </button>
          </div>
        </div>

        {/* Account Status */}
        <div className="space-y-4 pt-4 border-t border-gray-200">
          <h2 className="text-xl font-semibold">Account Status</h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.blocked}
              onChange={(e) => setFormData({ ...formData, blocked: e.target.checked })}
              className="w-5 h-5 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-700 font-medium">Block this account</span>
          </label>
          <p className="text-sm text-gray-600">
            When blocked, this employee cannot log in or perform any actions in the system.
          </p>
        </div>
      </div>
    </div>
  )
}

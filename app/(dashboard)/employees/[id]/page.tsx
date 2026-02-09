"use client"

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, AlertCircle, Loader, Edit2, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/components/auth-context'
import { formatTablePrice } from '@/lib/formatters'

interface EmployeeDetailData {
  id: string
  email: string
  username: string
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
    contractType?: string
    reportsTo?: string
    totalCharges?: number
    totalDebts?: number
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

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  on_leave: 'bg-blue-100 text-blue-800',
  terminated: 'bg-red-100 text-red-800',
}

export default function EmployeeDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { hasPermission } = useAuth()
  const employeeId = params.id as string

  const [employee, setEmployee] = useState<EmployeeDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch from employees API and filter for this ID
        const res = await fetch('/api/employees?limit=100')
        if (!res.ok) throw new Error(`Failed to fetch employees (${res.status})`)

        const json = await res.json()
        if (!json?.success) throw new Error(json?.error || 'Invalid response')

        const employees = json.data?.employees || []
        const found = employees.find((emp: any) => emp.id === employeeId)

        if (!found) {
          throw new Error('Employee not found')
        }

        setEmployee(found)
      } catch (err: any) {
        console.error('Failed to load employee:', err)
        setError(err?.message || 'Failed to load employee')
      } finally {
        setLoading(false)
      }
    }

    if (employeeId) {
      fetchEmployee()
    }
  }, [employeeId])

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this employee? This action cannot be undone.')) {
      return
    }

    setDeleting(true)
    setError(null)

    try {
      const res = await fetch(`/api/employees/${encodeURIComponent(employeeId)}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json?.error || `Failed to delete employee (${res.status})`)
      }

      // Redirect to employees list
      router.push('/employees')
    } catch (err: any) {
      console.error('Failed to delete employee:', err)
      setError(err?.message || 'Failed to delete employee')
      setDeleting(false)
    }
  }

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return 'N/A'
    try {
      const d = new Date(date)
      return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    } catch {
      return 'N/A'
    }
  }

  const fullName = employee
    ? [employee.firstname, employee.lastname].filter(Boolean).join(' ') || employee.username
    : 'Loading...'

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader className="animate-spin mx-auto mb-4" size={32} />
          <p className="text-gray-600">Loading employee details...</p>
        </div>
      </div>
    )
  }

  if (error || !employee) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6"
        >
          <ArrowLeft size={18} /> Back
        </button>
        <div className="bg-white rounded-lg border border-red-200 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <h2 className="font-semibold text-red-900">Error</h2>
              <p className="text-red-700 mt-1">{error || 'Employee not found'}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const empStatus = employee.employmentData?.employmentStatus || 'inactive'
  const statusColor = statusColors[empStatus] || statusColors.inactive
  const salary = employee.employmentData?.salary ? Number(employee.employmentData.salary) : 0

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6"
      >
        <ArrowLeft size={18} /> Back to Employees
      </button>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">{fullName}</h1>
              <p className="text-gray-600 mt-2">{employee.email}</p>
              <p className="text-gray-600">@{employee.username}</p>
            </div>
            <div className="flex flex-col gap-2 items-end">
              <span className={`px-4 py-2 rounded-full text-sm font-medium ${statusColor}`}>
                {empStatus.replace('_', ' ').charAt(0).toUpperCase() + empStatus.slice(1).replace('_', ' ')}
              </span>
              {employee.blocked && (
                <span className="px-4 py-2 rounded-full text-sm font-medium bg-red-100 text-red-800">
                  Blocked
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Employment Information */}
        {employee.employmentData && (
          <div className="bg-white rounded-lg border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Employment Information</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm font-medium text-gray-600 uppercase">Position</p>
                <p className="text-lg font-semibold text-gray-900 mt-2">
                  {employee.employmentData.position}
                </p>
              </div>

              {employee.employmentData.department && (
                <div>
                  <p className="text-sm font-medium text-gray-600 uppercase">Department</p>
                  <p className="text-lg font-semibold text-gray-900 mt-2">
                    {employee.employmentData.department}
                  </p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-gray-600 uppercase">Employment Status</p>
                <p className="text-lg font-semibold text-gray-900 mt-2 capitalize">
                  {employee.employmentData.employmentStatus.replace('_', ' ')}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-600 uppercase">Monthly Salary</p>
                <p className="text-lg font-semibold text-gray-900 mt-2">
                  {formatTablePrice(salary * 100)}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  {employee.employmentData.salaryType} / {employee.employmentData.salaryFrequency}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-600 uppercase">Employed Since</p>
                <p className="text-lg font-semibold text-gray-900 mt-2">
                  {formatDate(employee.employmentData.employmentDate)}
                </p>
              </div>

              {employee.employmentData.contractType && (
                <div>
                  <p className="text-sm font-medium text-gray-600 uppercase">Contract Type</p>
                  <p className="text-lg font-semibold text-gray-900 mt-2 capitalize">
                    {employee.employmentData.contractType}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Salary & Payment Information */}
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Salary & Payment</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
              <p className="text-sm font-medium text-blue-700 uppercase">Last Paid</p>
              <p className="text-2xl font-bold text-blue-900 mt-3">
                {formatDate(employee.lastPaidDate)}
              </p>
              <p className="text-sm text-blue-700 mt-2">Last salary payment date</p>
            </div>

            <div className={`rounded-lg p-6 border-2 ${
              employee.nextSalaryDueDate &&
              Math.ceil((new Date(employee.nextSalaryDueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) <= 7
                ? 'bg-yellow-50 border-yellow-200'
                : 'bg-green-50 border-green-200'
            }`}>
              <p className={`text-sm font-medium uppercase ${
                employee.nextSalaryDueDate &&
                Math.ceil((new Date(employee.nextSalaryDueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) <= 7
                  ? 'text-yellow-700'
                  : 'text-green-700'
              }`}>
                Next Salary Due
              </p>
              <p className={`text-2xl font-bold mt-3 ${
                employee.nextSalaryDueDate &&
                Math.ceil((new Date(employee.nextSalaryDueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) <= 7
                  ? 'text-yellow-900'
                  : 'text-green-900'
              }`}>
                {formatDate(employee.nextSalaryDueDate)}
              </p>
              {employee.nextSalaryDueDate && (
                <p className={`text-sm mt-2 ${
                  Math.ceil((new Date(employee.nextSalaryDueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) <= 7
                    ? 'text-yellow-700'
                    : 'text-green-700'
                }`}>
                  {(() => {
                    const days = Math.ceil(
                      (new Date(employee.nextSalaryDueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                    )
                    return days <= 0 ? 'Due now' : `In ${days} days`
                  })()}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Charges Summary */}
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Financial Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-orange-50 rounded-lg p-6 border border-orange-200">
              <p className="text-sm font-medium text-orange-700 uppercase">Total Charges</p>
              <p className="text-3xl font-bold text-orange-900 mt-3">
                {formatTablePrice(employee.totalCharges * 100)}
              </p>
              <p className="text-sm text-orange-700 mt-2">
                {Object.values(employee.chargesBreakdown).reduce((sum, c) => sum + c.count, 0)} items
              </p>
            </div>

            <div className="bg-red-50 rounded-lg p-6 border border-red-200">
              <p className="text-sm font-medium text-red-700 uppercase">Outstanding</p>
              <p className="text-3xl font-bold text-red-900 mt-3">
                {formatTablePrice(employee.totalOutstandingCharges * 100)}
              </p>
              <p className="text-sm text-red-700 mt-2">Due for payment</p>
            </div>

            <div className="bg-green-50 rounded-lg p-6 border border-green-200">
              <p className="text-sm font-medium text-green-700 uppercase">Settled</p>
              <p className="text-3xl font-bold text-green-900 mt-3">
                {formatTablePrice(employee.totalPaidCharges * 100)}
              </p>
              <p className="text-sm text-green-700 mt-2">Already paid</p>
            </div>
          </div>

          {/* Charge Types Breakdown */}
          {Object.keys(employee.chargesBreakdown).length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Charge Types Breakdown</h3>
              <div className="space-y-3">
                {Object.entries(employee.chargesBreakdown).map(([type, data]) => (
                  <div key={type} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div>
                      <p className="font-medium text-gray-900 capitalize">{type}</p>
                      <p className="text-sm text-gray-600">{data.count} charge(s)</p>
                    </div>
                    <p className="text-xl font-bold text-gray-900">{formatTablePrice(data.total * 100)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Roles & Leaves */}
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Roles & Leaves</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Assigned Roles</h3>
              {employee.roles && employee.roles.length > 0 ? (
                <div className="space-y-2">
                  {employee.roles.map((role, idx) => (
                    <div key={idx} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="font-medium text-blue-900">{role.roleName}</p>
                      {role.departmentName && (
                        <p className="text-sm text-blue-700 mt-1">📍 {role.departmentName}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600">No roles assigned</p>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Leave Status</h3>
              <div className="p-6 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-4xl font-bold text-blue-900">{employee.activeLeaves}</p>
                <p className="text-blue-700 mt-2">Active approved leave(s)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          {hasPermission('employees.update') && (
            <Link
              href={`/employees/${employee.id}/edit`}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
            >
              <Edit2 size={18} /> Edit Employee
            </Link>
          )}
          {hasPermission('employees.delete') && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
            >
              <Trash2 size={18} /> {deleting ? 'Deleting...' : 'Delete Employee'}
            </button>
          )}
          <button
            onClick={() => router.back()}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
          >
            Back to List
          </button>
        </div>
      </div>
    </div>
  )
}

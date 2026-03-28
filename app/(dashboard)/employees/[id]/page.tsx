'use client'

import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, AlertCircle, Loader2, Edit2, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/components/auth-context'
import { EmployeeConsolidationView } from '@/components/admin/employee-consolidation-view'
import { EmployeeTerminationForm } from '@/components/admin/employee-termination-form'
import { useEmployee } from '@/hooks/useEmployee'
import { useAttendance } from '@/hooks/useAttendance'
import { useSalary } from '@/hooks/useSalary'
import { employeeApi } from '@/../app/api/employees/employee.api'
import { EmployeeHeader } from '@/components/employees/EmployeeHeader'
import { EmploymentInfo } from '@/components/employees/EmploymentInfo'
import { SalarySection } from '@/components/employees/SalarySection'
import { AttendanceSection } from '@/components/employees/AttendanceSection'
import { useState, useEffect } from 'react'

export default function EmployeeDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { hasPermission } = useAuth()
  const employeeId = params.id as string

  // Use custom hooks
  const { employee, loading, error } = useEmployee(employeeId)
  const { activeCheckIn, monthlyCheckIns, monthlyCheckOuts, clockInLoading, dataLoading, checkIn, checkOut, error: attendanceError } =
    useAttendance(employeeId)
  const { salaryData, loading: salaryLoading, fetchSalary } = useSalary()

  const [deleting, setDeleting] = useState(false)
  const [termination, setTermination] = useState<any>(null)
  const [loadingTermination, setLoadingTermination] = useState(false)

  // Fetch termination data
  useEffect(() => {
    if (!employeeId) return

    const fetchTermination = async () => {
      try {
        setLoadingTermination(true)
        const res = await fetch(`/api/employees/${employeeId}/termination`)
        const data = await res.json()
        if (data.success && data.data) {
          setTermination(data.data)
        }
      } catch (err) {
        console.error('Failed to load termination data:', err)
      } finally {
        setLoadingTermination(false)
      }
    }

    fetchTermination()
  }, [employeeId])

  // Check if employee is terminated
  const isTerminated = employee?.employmentData?.employmentStatus === 'terminated' || termination

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this employee? This action cannot be undone.')) {
      return
    }

    setDeleting(true)

    try {
      await employeeApi.delete(employeeId)
      router.push('/employees')
    } catch (err: any) {
      alert(`Error: ${err.message || 'Failed to delete employee'}`)
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto mb-4" size={32} />
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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6"
      >
        <ArrowLeft size={18} /> Back to Employees
      </button>

      {/* Terminated Employee Banner */}
      {isTerminated && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <h3 className="font-semibold text-red-900">Employee Terminated</h3>
            <p className="text-red-700 mt-1 text-sm">
              This employee has been terminated and can no longer perform any work-related activities. 
              The view below shows read-only information and termination details.
            </p>
            {termination?.terminationDate && (
              <p className="text-red-700 mt-1 text-sm">
                <strong>Termination Date:</strong> {new Date(termination.terminationDate).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header with Clock In/Out - DISABLED if terminated */}
        {isTerminated ? (
          <div className="bg-gray-100 rounded-lg border border-gray-300 p-8 text-center">
            <p className="text-gray-600">Clock in/out is disabled for terminated employees</p>
          </div>
        ) : (
          <EmployeeHeader
            employee={employee}
            activeCheckIn={activeCheckIn}
            monthlyCheckIns={monthlyCheckIns}
            monthlyCheckOuts={monthlyCheckOuts}
            onCheckIn={checkIn}
            onCheckOut={checkOut}
            loading={clockInLoading}
            dataLoading={dataLoading}
            error={attendanceError}
          />
        )}

        {/* Employment Information - READ ONLY if terminated */}
        <div className={isTerminated ? 'opacity-60 pointer-events-none' : ''}>
          <EmploymentInfo employee={employee} />
        </div>

        {/* Salary & Payment - DISABLED if terminated, derive settlement from salary service */}
        <div className={isTerminated ? 'opacity-60 pointer-events-none' : ''}>
          <SalarySection
            employee={employee}
            onViewDetails={() => fetchSalary(employee.id)}
            loading={salaryLoading}
          />
        </div>

        {/* Monthly Attendance - HIDDEN if terminated */}
        {!isTerminated && (
          <>
            {/* Placeholder for future attendance features */}
          </>
        )}

        {/* Consolidated Employee View - Charges Summary - DISABLED if terminated */}
        <div className={isTerminated ? 'opacity-60 pointer-events-none' : ''}>
          <EmployeeConsolidationView employeeId={employee.id} />
        </div>

        {/* Roles & Leaves - READ ONLY if terminated */}
        <div className={`bg-white rounded-lg border border-gray-200 p-8 ${isTerminated ? 'opacity-60' : ''}`}>
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
                <p className="text-4xl font-bold text-blue-900">{isTerminated ? 0 : employee.activeLeaves}</p>
                <p className="text-blue-700 mt-2">{isTerminated ? 'No active leaves (Employee terminated)' : 'Active approved leave(s)'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons - DISABLED if terminated */}
        <div className="flex gap-4">
          {!isTerminated && hasPermission('employees.update') && (
            <Link
              href={`/employees/${employee.id}/edit`}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
            >
              <Edit2 size={18} /> Edit Employee
            </Link>
          )}
          {!isTerminated && hasPermission('employees.delete') && (
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

        {/* Terminate Employment Section - ALWAYS VISIBLE for admins */}
        {hasPermission('employees.delete') && (
          <EmployeeTerminationForm
            employeeId={employee.id}
            termination={termination}
          />
        )}
      </div>
    </div>
  )
}

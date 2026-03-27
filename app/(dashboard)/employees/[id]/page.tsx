"use client"

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, AlertCircle, Loader, Edit2, Trash2, DollarSign, LogIn, LogOut } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/components/auth-context'
import { formatTablePrice } from '@/lib/formatters'
import { EmployeeConsolidationView } from '@/components/admin/employee-consolidation-view'

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
  const [checkInLoading, setCheckInLoading] = useState(false)
  const [activeCheckIn, setActiveCheckIn] = useState<any>(null)
  const [monthlyCheckIns, setMonthlyCheckIns] = useState(0)
  const [monthlyCheckOuts, setMonthlyCheckOuts] = useState(0)
  const [showSalaryModal, setShowSalaryModal] = useState(false)
  const [salaryData, setSalaryData] = useState<any>(null)
  const [salaryLoading, setSalaryLoading] = useState(false)
  const [showClockInDetails, setShowClockInDetails] = useState(false)
  const [clockInDetails, setClockInDetails] = useState<any[]>([])
  const [clockInDetailsLoading, setClockInDetailsLoading] = useState(false)

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

  useEffect(() => {
    if (employee) {
      fetchMonthlyAttendance()
    }
  }, [employee])

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

  const handleCheckIn = async () => {
    if (!employee) return
    
    try {
      setCheckInLoading(true)
      const res = await fetch('/api/employees/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: employee.id }),
      })

      if (!res.ok) throw new Error('Failed to check in')
      
      const json = await res.json()
      setActiveCheckIn(json.data?.checkIn)
      // Show success notification
      alert('Check-in successful!')
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    } finally {
      setCheckInLoading(false)
    }
  }

  const handleCheckOut = async () => {
    if (!activeCheckIn) return

    try {
      setCheckInLoading(true)
      const res = await fetch('/api/employees/attendance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkInId: activeCheckIn.id }),
      })

      if (!res.ok) throw new Error('Failed to check out')

      setActiveCheckIn(null)
      // Show success notification
      alert('Check-out successful!')
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    } finally {
      setCheckInLoading(false)
    }
  }

  const fetchSalaryData = async () => {
    if (!employee) return

    try {
      setSalaryLoading(true)
      // Fetch from consolidated endpoint to get complete salary data
      const res = await fetch(`/api/employees/${employee.id}/consolidated`)

      if (!res.ok) throw new Error('Failed to fetch salary data')

      const json = await res.json()
      setSalaryData(json.data)
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    } finally {
      setSalaryLoading(false)
    }
  }

  const handleViewSalaryModal = () => {
    fetchSalaryData()
    setShowSalaryModal(true)
  }

  const fetchClockInDetailsData = async () => {
    if (!employee) return

    try {
      setClockInDetailsLoading(true)
      // Get current month's clock-in details
      const now = new Date()
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString()

      const res = await fetch(
        `/api/employees/attendance?employeeId=${employee.id}&fromDate=${startDate}&toDate=${endDate}`
      )

      if (!res.ok) throw new Error('Failed to fetch clock-in details')

      const json = await res.json()
      const records = json.data?.checkIns || []
      
      // Sort by check-in time descending (most recent first)
      const sorted = records.sort((a: any, b: any) => {
        return new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime()
      })
      
      setClockInDetails(sorted)
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    } finally {
      setClockInDetailsLoading(false)
    }
  }

  const handleViewClockInDetails = () => {
    fetchClockInDetailsData()
    setShowClockInDetails(true)
  }

  const fetchMonthlyAttendance = async () => {
    if (!employee) return

    try {
      // Get first day of current month
      const now = new Date()
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString()

      const res = await fetch(
        `/api/employees/attendance?employeeId=${employee.id}&fromDate=${startDate}&toDate=${endDate}`
      )

      if (!res.ok) throw new Error('Failed to fetch attendance')

      const json = await res.json()
      const records = json.data?.checkIns || []
      
      // Calculate days worked from completed check-in/check-out cycles
      // Each record with daysCounted = 1 day
      let daysWorkedInMonth = 0
      let completedCycles = 0
      
      for (const record of records) {
        if (record.checkOutTime) {
          // Completed check-in/check-out cycle
          daysWorkedInMonth += record.daysCounted || 1
          completedCycles += 1
        }
      }
      
      setMonthlyCheckIns(daysWorkedInMonth)
      setMonthlyCheckOuts(completedCycles)
    } catch (err: any) {
      console.error('Failed to fetch monthly attendance:', err)
    }
  }

  const handleSalaryPayment = async () => {
    if (!employee || !salaryData?.currentSalary) {
      alert('Unable to process payment: Missing salary data')
      return
    }

    const confirmed = confirm(
      `Process salary payment of ₦${Number(salaryData.currentSalary.netSalary).toFixed(2)} for ${employee.firstname || employee.username}?`
    )
    
    if (!confirmed) return

    try {
      setSalaryLoading(true)
      
      const res = await fetch('/api/employees/salary-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: employee.id,
          amount: salaryData.currentSalary.netSalary,
          paymentMethod: 'bank_transfer',
          notes: `Monthly salary payment for ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
        }),
      })

      if (!res.ok) {
        const errJson = await res.json()
        throw new Error(errJson?.message || 'Failed to process payment')
      }
      
      // Refresh salary data and employee info
      await fetchSalaryData()
      const updatedRes = await fetch(`/api/employees?limit=100`)
      if (updatedRes.ok) {
        const updatedJson = await updatedRes.json()
        const employees = updatedJson.data?.employees || []
        const updatedEmployee = employees.find((emp: any) => emp.id === employeeId)
        if (updatedEmployee) setEmployee(updatedEmployee)
      }
      
      alert(`Salary payment of ₦${Number(salaryData.currentSalary.netSalary).toFixed(2)} processed successfully!`)
      setShowSalaryModal(false)
    } catch (err: any) {
      console.error('Payment error:', err)
      alert(`Error: ${err.message || 'Failed to process payment'}`)
    } finally {
      setSalaryLoading(false)
    }
  }

  const handleEarlyPayout = async () => {
    if (!employee || !salaryData?.currentSalary) {
      alert('Unable to process early payout: Missing salary data')
      return
    }

    const payoutAmount = Number(salaryData.currentSalary.grossSalary) * 0.5 // 50% advance
    
    const confirmed = confirm(
      `Process early salary payout of ₦${payoutAmount.toFixed(2)} (50% advance) for ${employee.firstname || employee.username}?`
    )
    
    if (!confirmed) return

    try {
      setSalaryLoading(true)
      
      const res = await fetch('/api/employees/early-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: employee.id,
          amount: payoutAmount,
          paymentMethod: 'bank_transfer',
          notes: `Early salary advance (50% of gross) for ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
        }),
      })

      if (!res.ok) {
        const errJson = await res.json()
        throw new Error(errJson?.message || 'Failed to process early payout')
      }
      
      // Refresh salary data and employee info
      await fetchSalaryData()
      const updatedRes = await fetch(`/api/employees?limit=100`)
      if (updatedRes.ok) {
        const updatedJson = await updatedRes.json()
        const employees = updatedJson.data?.employees || []
        const updatedEmployee = employees.find((emp: any) => emp.id === employeeId)
        if (updatedEmployee) setEmployee(updatedEmployee)
      }
      
      alert(`Early salary payout of ₦${payoutAmount.toFixed(2)} processed successfully!`)
    } catch (err: any) {
      console.error('Early payout error:', err)
      alert(`Error: ${err.message || 'Failed to process early payout'}`)
    } finally {
      setSalaryLoading(false)
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
              <div className="flex gap-2 mt-2">
                {activeCheckIn ? (
                  <button
                    onClick={handleCheckOut}
                    disabled={checkInLoading}
                    className="flex items-center gap-2 px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
                  >
                    <LogOut size={16} /> Check Out
                  </button>
                ) : (
                  <button
                    onClick={handleCheckIn}
                    disabled={checkInLoading}
                    className="flex items-center gap-2 px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                  >
                    <LogIn size={16} /> Clock In
                  </button>
                )}
              </div>
              <div className="flex gap-4 mt-3 text-xs">
                <div className="flex items-center gap-1">
                  <LogIn size={14} className="text-green-600" />
                  <span className="text-gray-700">Days Worked: <strong>{monthlyCheckIns}</strong></span>
                </div>
                <div className="flex items-center gap-1">
                  <LogOut size={14} className="text-amber-600" />
                  <span className="text-gray-700">Cycles: <strong>{monthlyCheckOuts}</strong></span>
                </div>
              </div>
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
            </div>
          </div>
          <div className="flex gap-3 mt-6 flex-wrap">
            <button
              onClick={handleViewSalaryModal}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              disabled={salaryLoading}
            >
              <DollarSign size={18} /> View Salary Calculation
            </button>
            <button
              onClick={handleViewClockInDetails}
              className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              disabled={salaryLoading}
            >
              <LogIn size={18} /> Clock-in Details
            </button>
            <button
              onClick={handleSalaryPayment}
              className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              disabled={salaryLoading}
            >
              {salaryLoading ? 'Processing...' : (<><DollarSign size={18} /> Pay Salary</>)}
            </button>
            <button
              onClick={handleEarlyPayout}
              className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              disabled={salaryLoading}
            >
              {salaryLoading ? 'Processing...' : (<><DollarSign size={18} /> Early Payout</>)}
            </button>
          </div>
        </div>

        {/* Consolidated Employee View - Replaces Charges Summary */}
        <EmployeeConsolidationView employeeId={employee.id} />
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

        {/* Salary Calculation Modal */}
        {showSalaryModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">Salary Calculation</h2>
                <button
                  onClick={() => setShowSalaryModal(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Modal Content */}
              {salaryLoading ? (
                <div className="p-8 text-center">
                  <div className="inline-block animate-spin round">
                    <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
                  </div>
                  <p className="mt-4 text-gray-600">Loading salary calculation...</p>
                </div>
              ) : salaryData ? (
                <div className="p-6 space-y-6">
                  {/* Gross Salary */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                    <p className="text-sm font-medium text-green-700 uppercase">Gross Salary</p>
                    <p className="text-3xl font-bold text-green-900 mt-2">
                      {salaryData.currentSalary?.grossSalary
                        ? `₦${Number(salaryData.currentSalary.grossSalary).toFixed(2)}`
                        : 'N/A'}
                    </p>
                  </div>

                  {/* Charges/Deductions */}
                  {salaryData.charges && salaryData.charges.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                      <p className="text-sm font-medium text-red-700 uppercase mb-4">Pending Charges (Deductions)</p>
                      <div className="space-y-2">
                        {salaryData.charges.map((charge: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center p-3 bg-white rounded border border-red-100">
                            <div>
                              <span className="text-gray-700 capitalize font-medium">{charge.chargeType}</span>
                              <p className="text-xs text-gray-500 mt-1">Status: {charge.status}</p>
                            </div>
                            <span className="font-semibold text-red-700">-₦{Number(charge.amount).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 pt-4 border-t border-red-200 flex justify-between">
                        <span className="font-semibold text-red-700">Total Pending Charges</span>
                        <span className="font-bold text-red-900">
                          -₦{salaryData.currentSalary?.totalCharges
                            ? Number(salaryData.currentSalary.totalCharges).toFixed(2)
                            : '0.00'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Net Salary */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <p className="text-sm font-medium text-blue-700 uppercase">Net Salary (After Deductions)</p>
                    <p className="text-3xl font-bold text-blue-900 mt-2">
                      {salaryData.currentSalary?.netSalary
                        ? `₦${Number(salaryData.currentSalary.netSalary).toFixed(2)}`
                        : 'N/A'}
                    </p>
                  </div>

                  {/* Salary Due Date */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                    <p className="text-sm font-medium text-gray-700 uppercase">Next Salary Due Date</p>
                    <p className="text-lg font-semibold text-gray-900 mt-2">
                      {employee.nextSalaryDueDate ? formatDate(employee.nextSalaryDueDate) : 'Not set'}
                    </p>
                  </div>

                  {/* Salary History */}
                  {salaryData.salaryHistory && salaryData.salaryHistory.length > 0 && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                      <p className="text-sm font-medium text-purple-700 uppercase mb-4">Recent Salary Payments</p>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {salaryData.salaryHistory.slice(0, 5).map((payment: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center p-3 bg-white rounded border border-purple-100">
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {new Date(payment.paymentDate).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </p>
                              <p className="text-xs text-gray-600">Status: {payment.status}</p>
                            </div>
                            <span className="font-semibold text-green-700">₦{Number(payment.amountPaid).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-gray-600">Failed to load salary calculation</p>
                </div>
              )}

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowSalaryModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Clock-in Details Modal */}
        {showClockInDetails && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">Clock-in Details</h2>
                <button
                  onClick={() => setShowClockInDetails(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Modal Content */}
              {clockInDetailsLoading ? (
                <div className="p-8 text-center">
                  <div className="inline-block animate-spin">
                    <div className="h-8 w-8 border-4 border-purple-600 border-t-transparent rounded-full" />
                  </div>
                  <p className="mt-4 text-gray-600">Loading clock-in details...</p>
                </div>
              ) : clockInDetails.length > 0 ? (
                <div className="p-6 space-y-4">
                  {/* Summary */}
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
                    <p className="text-sm font-medium text-purple-700 uppercase">Total this month</p>
                    <div className="mt-3 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-2xl font-bold text-purple-900">
                          {clockInDetails.filter((r: any) => r.checkOutTime).length}
                        </p>
                        <p className="text-sm text-purple-700">Days worked</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-purple-900">
                          {clockInDetails
                            .filter((r: any) => r.checkOutTime)
                            .reduce((sum: number, r: any) => sum + (r.hoursWorked || 0), 0)
                            .toFixed(2)}
                        </p>
                        <p className="text-sm text-purple-700">Total hours</p>
                      </div>
                    </div>
                  </div>

                  {/* Clock-in Records */}
                  <div className="space-y-3">
                    {clockInDetails.map((record: any, idx: number) => (
                      <div key={idx} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-semibold text-gray-900">
                              {new Date(record.checkInTime).toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                              {new Date(record.checkInTime).toLocaleDateString('en-US', { year: 'numeric' })}
                            </p>
                          </div>
                          {record.checkOutTime && (
                            <div className="text-right bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-medium">
                              1 Day
                            </div>
                          )}
                          {!record.checkOutTime && (
                            <div className="text-right bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-medium">
                              In Progress
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs font-medium text-gray-600 uppercase">Check-in</p>
                            <p className="text-sm font-semibold text-gray-900 mt-1">
                              {new Date(record.checkInTime).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true,
                              })}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-600 uppercase">Check-out</p>
                            <p className="text-sm font-semibold text-gray-900 mt-1">
                              {record.checkOutTime
                                ? new Date(record.checkOutTime).toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: true,
                                  })
                                : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-600 uppercase">Hours Worked</p>
                            <p className="text-sm font-semibold text-gray-900 mt-1">
                              {record.checkOutTime ? `${record.hoursWorked}h` : '—'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-gray-600">No clock-in records for this month</p>
                </div>
              )}

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowClockInDetails(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

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

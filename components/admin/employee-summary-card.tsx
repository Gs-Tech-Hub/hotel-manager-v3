"use client"

import { AlertCircle, Clock, DollarSign, FileText, User } from 'lucide-react'
import { formatTablePrice } from '@/lib/formatters'

interface EmploymentDataType {
  position: string
  department?: string
  salary: number | string
  salaryType: string
  salaryFrequency: string
  employmentStatus: string
  employmentDate: Date | string
  totalCharges?: number | string
  totalDebts?: number | string
}

interface ChargeBreakdown {
  [key: string]: { count: number; total: number }
}

interface EmployeeSummaryCardProps {
  id: string
  firstname?: string
  lastname?: string
  email: string
  username: string
  employmentData?: EmploymentDataType | null
  totalCharges: number
  totalOutstandingCharges: number
  totalPaidCharges: number
  chargesBreakdown: ChargeBreakdown
  lastPaidDate?: Date | string | null
  nextSalaryDueDate?: Date | string | null
  activeLeaves: number
  blocked: boolean
  roles?: Array<{ roleName: string; departmentName?: string }>
}

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  on_leave: 'bg-blue-100 text-blue-800',
  terminated: 'bg-red-100 text-red-800',
}

export function EmployeeSummaryCard({
  id,
  firstname,
  lastname,
  email,
  username,
  employmentData,
  totalCharges,
  totalOutstandingCharges,
  totalPaidCharges,
  chargesBreakdown,
  lastPaidDate,
  nextSalaryDueDate,
  activeLeaves,
  blocked,
  roles = [],
}: EmployeeSummaryCardProps) {
  const fullName = [firstname, lastname].filter(Boolean).join(' ') || username
  const salary = employmentData?.salary ? Number(employmentData.salary) : 0
  const empStatus = employmentData?.employmentStatus || 'inactive'
  const statusColor = statusColors[empStatus] || statusColors.inactive

  // Helper to format date
  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return null
    try {
      const d = new Date(date)
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return null
    }
  }

  // Format dates
  const empDateStr = formatDate(employmentData?.employmentDate)
  const lastPaidStr = formatDate(lastPaidDate) || 'Never'
  const nextDueStr = formatDate(nextSalaryDueDate) || 'N/A'
  const daysUntilDue = nextSalaryDueDate
    ? Math.ceil((new Date(nextSalaryDueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
      {/* Header with Name and Status */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">{fullName}</h3>
          <p className="text-sm text-gray-600">{email}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor}`}>
            {empStatus.replace('_', ' ').charAt(0).toUpperCase() + empStatus.slice(1).replace('_', ' ')}
          </span>
          {blocked && (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
              Blocked
            </span>
          )}
        </div>
      </div>

      {/* Employment Info Grid */}
      {employmentData && (
        <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-gray-200">
          {/* Position */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-600 uppercase flex items-center gap-1">
              <User size={14} /> Position
            </p>
            <p className="text-sm font-semibold text-gray-900">{employmentData.position}</p>
          </div>

          {/* Department */}
          {employmentData.department && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-600 uppercase flex items-center gap-1">
                <FileText size={14} /> Department
              </p>
              <p className="text-sm font-semibold text-gray-900">{employmentData.department}</p>
            </div>
          )}

          {/* Salary */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-600 uppercase flex items-center gap-1">
              <DollarSign size={14} /> Monthly Salary
            </p>
            <p className="text-sm font-semibold text-gray-900">{formatTablePrice(salary * 100)}</p>
            <p className="text-xs text-gray-500">
              {employmentData.salaryType} / {employmentData.salaryFrequency}
            </p>
          </div>

          {/* Employment Date */}
          {empDateStr && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-600 uppercase flex items-center gap-1">
                <Clock size={14} /> Employed Since
              </p>
              <p className="text-sm font-semibold text-gray-900">{empDateStr}</p>
            </div>
          )}
        </div>
      )}

      {/* Salary Payment Status */}
      {lastPaidDate || nextSalaryDueDate ? (
        <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-gray-200">
          <div className="bg-blue-50 rounded p-3">
            <p className="text-xs font-medium text-blue-700 uppercase">Last Paid</p>
            <p className="text-sm font-semibold text-blue-900 mt-1">{lastPaidStr}</p>
          </div>
          <div className={`rounded p-3 ${daysUntilDue && daysUntilDue <= 7 ? 'bg-yellow-50' : 'bg-green-50'}`}>
            <p className={`text-xs font-medium uppercase ${daysUntilDue && daysUntilDue <= 7 ? 'text-yellow-700' : 'text-green-700'}`}>
              Next Due
            </p>
            <p className={`text-sm font-semibold mt-1 ${daysUntilDue && daysUntilDue <= 7 ? 'text-yellow-900' : 'text-green-900'}`}>
              {nextDueStr}
            </p>
            {daysUntilDue !== null && (
              <p className="text-xs mt-1 opacity-75">
                {daysUntilDue <= 0 ? 'Due now' : `in ${daysUntilDue} days`}
              </p>
            )}
          </div>
        </div>
      ) : null}

      {/* Charges Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 pb-4 border-b border-gray-200">
        {/* Total Charges */}
        <div className="bg-orange-50 rounded p-3">
          <p className="text-xs font-medium text-orange-700 uppercase flex items-center gap-1">
            <AlertCircle size={14} /> Total Charges
          </p>
          <p className="text-lg font-bold text-orange-900 mt-1">{formatTablePrice(totalCharges * 100)}</p>
          <p className="text-xs text-orange-700 mt-1">
            {Object.values(chargesBreakdown).reduce((sum, c) => sum + c.count, 0)} items
          </p>
        </div>

        {/* Outstanding */}
        <div className="bg-red-50 rounded p-3">
          <p className="text-xs font-medium text-red-700 uppercase flex items-center gap-1">
            <AlertCircle size={14} /> Outstanding
          </p>
          <p className="text-lg font-bold text-red-900 mt-1">{formatTablePrice(totalOutstandingCharges * 100)}</p>
          <p className="text-xs text-red-700 mt-1">Due for payment</p>
        </div>

        {/* Paid */}
        <div className="bg-green-50 rounded p-3">
          <p className="text-xs font-medium text-green-700 uppercase">Settled</p>
          <p className="text-lg font-bold text-green-900 mt-1">{formatTablePrice(totalPaidCharges * 100)}</p>
          <p className="text-xs text-green-700 mt-1">Already paid</p>
        </div>
      </div>

      {/* Charges Breakdown */}
      {Object.keys(chargesBreakdown).length > 0 && (
        <div className="mb-4 pb-4 border-b border-gray-200">
          <p className="text-xs font-medium text-gray-600 uppercase mb-2">Charge Types</p>
          <div className="space-y-1">
            {Object.entries(chargesBreakdown).map(([type, data]) => (
              <div key={type} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 capitalize">{type}</span>
                <span className="flex gap-2">
                  <span className="text-gray-600">({data.count})</span>
                  <span className="font-semibold text-gray-900">{formatTablePrice(data.total * 100)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Roles and Leaves */}
      <div className="grid grid-cols-2 gap-4">
        {/* Roles */}
        <div>
          <p className="text-xs font-medium text-gray-600 uppercase mb-2">Roles</p>
          {roles.length > 0 ? (
            <div className="space-y-1">
              {roles.map((role, idx) => (
                <div key={idx} className="text-sm">
                  <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                    {role.roleName}
                  </span>
                  {role.departmentName && (
                    <span className="text-xs text-gray-600 ml-1">({role.departmentName})</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No roles assigned</p>
          )}
        </div>

        {/* Active Leaves */}
        <div>
          <p className="text-xs font-medium text-gray-600 uppercase mb-2">Active Leaves</p>
          <p className="text-2xl font-bold text-blue-600">{activeLeaves}</p>
          <p className="text-xs text-gray-600">approved leave(s)</p>
        </div>
      </div>
    </div>
  )
}

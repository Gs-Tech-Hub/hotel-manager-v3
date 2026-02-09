"use client"

import { AlertCircle, ChevronRight } from 'lucide-react'
import { formatTablePrice } from '@/lib/formatters'

interface EmployeeListCardProps {
  id: string
  firstname?: string
  lastname?: string
  email: string
  username: string
  employmentData?: {
    position: string
    department?: string
    salary: number
    employmentStatus: string
  } | null
  totalOutstandingCharges: number
  roles?: Array<{ roleName: string }>
  blocked: boolean
  onClick?: () => void
}

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  on_leave: 'bg-blue-100 text-blue-800',
  terminated: 'bg-red-100 text-red-800',
}

export function EmployeeListCard({
  id,
  firstname,
  lastname,
  email,
  username,
  employmentData,
  totalOutstandingCharges,
  roles = [],
  blocked,
  onClick,
}: EmployeeListCardProps) {
  const fullName = [firstname, lastname].filter(Boolean).join(' ') || username
  const empStatus = employmentData?.employmentStatus || 'inactive'
  const statusColor = statusColors[empStatus] || statusColors.inactive
  const hasOutstandingCharges = totalOutstandingCharges > 0

  return (
    <div
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Name and Email */}
          <div className="mb-2">
            <h3 className="text-lg font-semibold text-gray-900">{fullName}</h3>
            <p className="text-sm text-gray-600">{email}</p>
          </div>

          {/* Position and Department */}
          {employmentData && (
            <div className="mb-3 space-y-1">
              <p className="text-sm text-gray-700">
                <span className="font-medium">{employmentData.position}</span>
                {employmentData.department && (
                  <span className="text-gray-600"> • {employmentData.department}</span>
                )}
              </p>
              <p className="text-xs text-gray-500">Salary: {formatTablePrice(Number(employmentData.salary) * 100)}</p>
            </div>
          )}

          {/* Status and Roles */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor}`}>
              {empStatus.replace('_', ' ').charAt(0).toUpperCase() + empStatus.slice(1).replace('_', ' ')}
            </span>

            {blocked && (
              <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
                Blocked
              </span>
            )}

            {roles.length > 0 && (
              <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                {roles.length} role{roles.length > 1 ? 's' : ''}
              </span>
            )}

            {hasOutstandingCharges && (
              <span className="px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800 flex items-center gap-1">
                <AlertCircle size={12} />
                {formatTablePrice(totalOutstandingCharges * 100)} due
              </span>
            )}
          </div>
        </div>

        {/* Chevron Icon */}
        <ChevronRight className="text-gray-400 group-hover:text-blue-600 transition-colors flex-shrink-0 ml-2" size={20} />
      </div>
    </div>
  )
}

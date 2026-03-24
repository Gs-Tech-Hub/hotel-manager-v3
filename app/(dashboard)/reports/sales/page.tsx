"use client"

import { useAuth } from "@/components/auth-context"
import { SalesReportPanel } from "@/components/admin/sales-report-panel"

export default function SalesReportPage() {
  const { user } = useAuth()
  
  // Employees with orders.read but not reports.read can only view their department's sales
  // The SalesReportPanel will handle restricting department visibility
  const isLimitedToOwnDepartment = user && user.permissions?.includes("orders.read") && !user.permissions?.includes("reports.read")
  
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8">
      <SalesReportPanel departmentFilter={isLimitedToOwnDepartment ? "" : undefined} />
    </div>
  )
}

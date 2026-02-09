"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AlertCircle, DollarSign, Download, Users, TrendingUp } from "lucide-react"
import { DashboardChart } from "./dashboard-chart"
import { DashboardDataTable } from "./dashboard-data-table"
import { StatsCard } from "./dashboard-stats-card"
import { formatTablePrice } from "@/lib/formatters"

interface EmployeeReport {
  summary: {
    totalEmployees: number
    activeEmployees: number
    onLeave: number
    terminated: number
    totalSalaryExpense: number
    totalCharges: number
    outstandingCharges: number
    averageSalary: number
  }
  byStatus: Array<{ status: string; count: number }>
  byDepartment: Array<{ department: string; count: number }>
  byRole: Array<{ role: string; count: number }>
  leaveBreakdown: Array<{ type: string; count: number }>
  topEarners: Array<{
    id: string
    name: string
    salary: number
    salaryFrequency: string
    department: string
    status: string
  }>
  employees: Array<any>
}

export function EmployeeReportPanel() {
  const [report, setReport] = useState<EmployeeReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setMonth(date.getMonth() - 1)
    return date.toISOString().split("T")[0]
  })
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0])

  const fetchReport = async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({
        startDate,
        endDate,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      const response = await fetch(`/api/analytics/employees?${params}`)
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || "Failed to fetch report")
      }
      const data = await response.json()
      setReport(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport()
  }, [startDate, endDate])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Employee Report</h2>
          <p className="mt-1 text-sm text-gray-500">HR analytics and employee management</p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Export Report
        </Button>
      </div>

      {/* Date Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Date Range</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3 sm:items-end">
            <div>
              <label className="text-sm font-medium text-gray-700">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button onClick={fetchReport} disabled={loading}>
              {loading ? "Loading..." : "Apply Filter"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <p className="text-red-800">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      {report && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="Total Employees"
              value={report.summary.totalEmployees}
              icon={Users}
              color="blue"
            />
            <StatsCard
              title="Active"
              value={report.summary.activeEmployees}
              icon={Users}
              color="green"
            />
            <StatsCard
              title="On Leave"
              value={report.summary.onLeave}
              icon={Users}
              color="yellow"
            />
            <StatsCard
              title="Salary Expense"
              value={formatTablePrice(report.summary.totalSalaryExpense)}
              icon={DollarSign}
              color="blue"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <StatsCard
              title="Total Charges"
              value={formatTablePrice(report.summary.totalCharges)}
              icon={DollarSign}
              color="orange"
            />
            <StatsCard
              title="Outstanding"
              value={formatTablePrice(report.summary.outstandingCharges)}
              icon={AlertCircle}
              color="red"
            />
            <StatsCard
              title="Avg Salary"
              value={formatTablePrice(report.summary.averageSalary)}
              icon={TrendingUp}
              color="purple"
            />
          </div>

          {/* Employees by Status */}
          {report.byStatus.length > 0 && (
            <DashboardChart
              title="Employees by Status"
              type="pie"
              data={report.byStatus}
              dataKey="count"
            />
          )}

          {/* Employees by Department */}
          {report.byDepartment.length > 0 && (
            <DashboardChart
              title="Employees by Department"
              type="bar"
              data={report.byDepartment}
              dataKey="count"
              xAxisKey="department"
              color="#3b82f6"
            />
          )}

          {/* Top Earners */}
          {report.topEarners.length > 0 && (
            <DashboardDataTable
              title="Top Earners"
              columns={[
                { key: "name", label: "Name" },
                { key: "department", label: "Department" },
                {
                  key: "salary",
                  label: "Salary",
                  format: (v) => formatTablePrice(v),
                  align: "right",
                },
                { key: "salaryFrequency", label: "Frequency" },
              ]}
              data={report.topEarners}
              maxRows={10}
            />
          )}

          {/* Employees by Role */}
          {report.byRole.length > 0 && (
            <DashboardDataTable
              title="Employees by Role"
              columns={[
                { key: "role", label: "Role" },
                { key: "count", label: "Count", align: "right" },
              ]}
              data={report.byRole}
            />
          )}

          {/* Leave Breakdown */}
          {report.leaveBreakdown.length > 0 && (
            <DashboardDataTable
              title="Leave Breakdown"
              columns={[
                { key: "type", label: "Leave Type" },
                { key: "count", label: "Count", align: "right" },
              ]}
              data={report.leaveBreakdown}
            />
          )}
        </>
      )}

      {loading && (
        <div className="flex h-96 items-center justify-center">
          <p className="text-gray-500">Loading report...</p>
        </div>
      )}
    </div>
  )
}

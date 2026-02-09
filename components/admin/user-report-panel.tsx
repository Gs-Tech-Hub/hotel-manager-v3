"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AlertCircle, Users, Download, UserCheck, AlertTriangle } from "lucide-react"
import { DashboardChart } from "./dashboard-chart"
import { DashboardDataTable } from "./dashboard-data-table"
import { StatsCard } from "./dashboard-stats-card"

interface UserReport {
  summary: {
    totalUsers: number
    activeUsers: number
    blockedUsers: number
    inactiveUsers: number
    newUsersThisPeriod: number
    totalAdminUsers: number
    activationRate: number
  }
  byRole: Array<{ role: string; count: number }>
  byStatus: Array<{ status: string; count: number }>
  byDepartment: Array<{ department: string; count: number }>
  recentUsers: Array<any>
  users: Array<any>
}

export function UserReportPanel() {
  const [report, setReport] = useState<UserReport | null>(null)
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
      const response = await fetch(`/api/analytics/users?${params}`)
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
          <h2 className="text-2xl font-bold text-gray-900">User Report</h2>
          <p className="mt-1 text-sm text-gray-500">User management and access analytics</p>
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
              title="Total Users"
              value={report.summary.totalUsers}
              icon={Users}
              color="blue"
              description={`${report.summary.newUsersThisPeriod} new this period`}
            />
            <StatsCard
              title="Active Users"
              value={report.summary.activeUsers}
              icon={UserCheck}
              color="green"
              description={`${report.summary.activationRate}% activation rate`}
            />
            <StatsCard
              title="Blocked Users"
              value={report.summary.blockedUsers}
              icon={AlertTriangle}
              color="red"
            />
            <StatsCard
              title="Admin Users"
              value={report.summary.totalAdminUsers}
              icon={Users}
              color="purple"
            />
          </div>

          {/* Users by Status */}
          {report.byStatus.length > 0 && (
            <DashboardChart
              title="Users by Status"
              type="pie"
              data={report.byStatus}
              dataKey="count"
              colors={["#10b981", "#ef4444", "#6b7280"]}
            />
          )}

          {/* Users by Role */}
          {report.byRole.length > 0 && (
            <DashboardChart
              title="Users by Role"
              type="bar"
              data={report.byRole}
              dataKey="count"
              xAxisKey="role"
              color="#3b82f6"
            />
          )}

          {/* Users by Department */}
          {report.byDepartment.length > 0 && (
            <DashboardChart
              title="Users by Department"
              type="bar"
              data={report.byDepartment}
              dataKey="count"
              xAxisKey="department"
              color="#8b5cf6"
            />
          )}

          {/* Recent Users */}
          {report.recentUsers.length > 0 && (
            <DashboardDataTable
              title="Recently Added Users"
              columns={[
                { key: "name", label: "Name" },
                { key: "email", label: "Email" },
                {
                  key: "createdAt",
                  label: "Join Date",
                  format: (v) => new Date(v).toLocaleDateString("en-US"),
                },
              ]}
              data={report.recentUsers}
              maxRows={10}
            />
          )}

          {/* All Users Table */}
          {report.users.length > 0 && (
            <DashboardDataTable
              title="All Users"
              columns={[
                { key: "name", label: "Name" },
                { key: "email", label: "Email" },
                { key: "username", label: "Username" },
                { key: "department", label: "Department" },
                {
                  key: "isActive",
                  label: "Status",
                  format: (v) => (v ? "Active" : "Inactive"),
                },
                {
                  key: "blocked",
                  label: "Blocked",
                  format: (v) => (v ? "Yes" : "No"),
                },
              ]}
              data={report.users}
              maxRows={20}
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

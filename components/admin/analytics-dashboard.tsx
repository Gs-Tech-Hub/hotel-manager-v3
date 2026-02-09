"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DollarSign, Users, TrendingUp, AlertCircle, Briefcase, UserCheck, Download, Calendar } from "lucide-react"
import { StatsCard } from "./dashboard-stats-card"
import { DashboardChart } from "./dashboard-chart"
import { DashboardDataTable } from "./dashboard-data-table"
import { formatTablePrice } from "@/lib/formatters"
import { useAuth } from "@/components/auth-context"

interface DashboardMetrics {
  salesData: {
    totalRevenue: number
    totalOrders: number
    averageOrderValue: number
    totalItems: number
    byDepartment: Array<{ department: string; revenue: number; orders: number; items: number }>
    topProducts: Array<{ id: string; name: string; quantity: number; revenue: number }>
    dailyRevenue: Array<{ date: string; revenue: number; orders: number }>
  }
  taxData: {
    totalTaxCollected: number
    taxBreakdown: Array<{ type: string; amount: number; percentage: number }>
    byPaymentMethod: Array<{ method: string; amount: number; taxAmount: number }>
  }
  userData: {
    totalUsers: number
    activeUsers: number
    blockedUsers: number
    usersByRole: Array<{ role: string; count: number }>
    newUsersThisPeriod: number
  }
  employeeData: {
    totalEmployees: number
    activeEmployees: number
    onLeave: number
    terminated: number
    byDepartment: Array<{ department: string; count: number }>
    salaryExpense: number
    totalCharges: number
    outstandingCharges: number
    topEarners: Array<{ id: string; firstname: string; lastname: string; salary: number; salaryFrequency: string }>
  }
  discountData: {
    totalDiscounts: number
    discountAmount: number
    discountPercentage: number
    topDiscounts: Array<{ id: string; name: string; timesUsed: number; totalDiscount: number }>
  }
  performanceMetrics: {
    peakHours: Array<{ hour: number; orders: number; revenue: number }>
    topDays: Array<{ dayOfWeek: string; orders: number; revenue: number }>
  }
}

export function AnalyticsDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setMonth(date.getMonth() - 1)
    return date.toISOString().split("T")[0]
  })
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0])
  const { user } = useAuth()

  const fetchMetrics = async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({
        startDate,
        endDate,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      const response = await fetch(`/api/analytics/dashboard?${params}`)
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || "Failed to fetch metrics")
      }
      const data = await response.json()
      setMetrics(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMetrics()
  }, [startDate, endDate])

  if (!user) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-800">You are not authenticated. Please log in.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">View comprehensive business metrics and insights</p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Export Report
        </Button>
      </div>

      {/* Date Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Date Range Filter</CardTitle>
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
            <Button onClick={fetchMetrics} disabled={loading} className="w-full">
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

      {/* Loading State */}
      {loading && (
        <div className="flex h-96 items-center justify-center">
          <p className="text-gray-500">Loading dashboard data...</p>
        </div>
      )}

      {/* Dashboard Content */}
      {metrics && !loading && (
        <>
          {/* Sales Overview */}
          <div>
            <h2 className="mb-4 text-xl font-semibold text-gray-900">Sales Overview</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatsCard
                title="Total Revenue"
                value={formatTablePrice(metrics.salesData.totalRevenue)}
                icon={DollarSign}
                color="green"
                trend="up"
                trendValue="+12.5% from last month"
              />
              <StatsCard
                title="Total Orders"
                value={metrics.salesData.totalOrders}
                icon={TrendingUp}
                color="blue"
                trend="up"
                trendValue="+8.2% from last month"
              />
              <StatsCard
                title="Avg Order Value"
                value={formatTablePrice(metrics.salesData.averageOrderValue)}
                icon={DollarSign}
                color="purple"
                description={`${metrics.salesData.totalItems} items sold`}
              />
              <StatsCard
                title="Total Items"
                value={metrics.salesData.totalItems}
                icon={TrendingUp}
                color="orange"
                description={`Avg ${metrics.salesData.totalOrders > 0 ? (metrics.salesData.totalItems / metrics.salesData.totalOrders).toFixed(1) : 0} per order`}
              />
            </div>
          </div>

          {/* Sales by Department */}
          {metrics.salesData.byDepartment.length > 0 && (
            <DashboardChart
              title="Revenue by Department"
              type="bar"
              data={metrics.salesData.byDepartment}
              dataKey="revenue"
              xAxisKey="department"
              color="#3b82f6"
              height={300}
            />
          )}

          {/* Tax Collections */}
          <div>
            <h2 className="mb-4 text-xl font-semibold text-gray-900">Tax Collections</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <StatsCard
                title="Total Tax Collected"
                value={formatTablePrice(metrics.taxData.totalTaxCollected)}
                icon={DollarSign}
                color="red"
                description={`${metrics.taxData.taxBreakdown[0]?.percentage || 0}% of revenue`}
              />
              {metrics.taxData.byPaymentMethod.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Tax by Payment Method</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {metrics.taxData.byPaymentMethod.slice(0, 3).map((method, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">{method.method}</span>
                          <span className="font-semibold">{formatTablePrice(method.taxAmount)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* User Management */}
          <div>
            <h2 className="mb-4 text-xl font-semibold text-gray-900">User Management</h2>
            <div className="grid gap-4 md:grid-cols-4">
              <StatsCard
                title="Total Users"
                value={metrics.userData.totalUsers}
                icon={Users}
                color="blue"
                description={`${metrics.userData.newUsersThisPeriod} new this period`}
              />
              <StatsCard
                title="Active Users"
                value={metrics.userData.activeUsers}
                icon={UserCheck}
                color="green"
                description={`${((metrics.userData.activeUsers / metrics.userData.totalUsers) * 100).toFixed(1)}% of total`}
              />
              <StatsCard
                title="Blocked Users"
                value={metrics.userData.blockedUsers}
                icon={AlertCircle}
                color="red"
                description={`${((metrics.userData.blockedUsers / metrics.userData.totalUsers) * 100).toFixed(1)}% of total`}
              />
              <StatsCard
                title="User Roles"
                value={metrics.userData.usersByRole.length}
                icon={Briefcase}
                color="purple"
                description="Active role categories"
              />
            </div>
          </div>

          {/* Users by Role */}
          {metrics.userData.usersByRole.length > 0 && (
            <DashboardChart
              title="Users by Role"
              type="pie"
              data={metrics.userData.usersByRole}
              dataKey="count"
              colors={["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"]}
            />
          )}

          {/* Employee Data */}
          <div>
            <h2 className="mb-4 text-xl font-semibold text-gray-900">Employee Management</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatsCard
                title="Total Employees"
                value={metrics.employeeData.totalEmployees}
                icon={Users}
                color="blue"
              />
              <StatsCard
                title="Active Employees"
                value={metrics.employeeData.activeEmployees}
                icon={UserCheck}
                color="green"
              />
              <StatsCard
                title="On Leave"
                value={metrics.employeeData.onLeave}
                icon={Calendar}
                color="yellow"
              />
              <StatsCard
                title="Terminated"
                value={metrics.employeeData.terminated}
                icon={AlertCircle}
                color="red"
              />
            </div>
          </div>

          {/* Salary & Charges */}
          <div>
            <h2 className="mb-4 text-xl font-semibold text-gray-900">Salary & Charges</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <StatsCard
                title="Total Salary Expense"
                value={formatTablePrice(metrics.employeeData.salaryExpense)}
                icon={DollarSign}
                color="blue"
              />
              <StatsCard
                title="Total Employee Charges"
                value={formatTablePrice(metrics.employeeData.totalCharges)}
                icon={DollarSign}
                color="orange"
              />
              <StatsCard
                title="Outstanding Charges"
                value={formatTablePrice(metrics.employeeData.outstandingCharges)}
                icon={AlertCircle}
                color="red"
              />
            </div>
          </div>

          {/* Top Earners */}
          {metrics.employeeData.topEarners.length > 0 && (
            <DashboardDataTable
              title="Top 5 Earners"
              columns={[
                { key: "firstname", label: "Name" },
                { key: "lastname", label: "Last Name" },
                {
                  key: "salary",
                  label: "Salary",
                  format: (v) => formatTablePrice(v),
                  align: "right",
                },
                { key: "salaryFrequency", label: "Frequency" },
              ]}
              data={metrics.employeeData.topEarners.map((e) => ({
                ...e,
                firstname: e.firstname + " " + e.lastname,
                lastname: e.salaryFrequency,
              }))}
              maxRows={5}
            />
          )}

          {/* Discount Analytics */}
          <div>
            <h2 className="mb-4 text-xl font-semibold text-gray-900">Discount Analytics</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <StatsCard
                title="Total Discounts"
                value={metrics.discountData.totalDiscounts}
                icon={TrendingUp}
                color="blue"
              />
              <StatsCard
                title="Discount Amount"
                value={formatTablePrice(metrics.discountData.discountAmount)}
                icon={DollarSign}
                color="red"
              />
              <StatsCard
                title="% of Revenue"
                value={`${metrics.discountData.discountPercentage.toFixed(2)}%`}
                icon={TrendingUp}
                color="orange"
              />
            </div>
          </div>

          {/* Top Discounts */}
          {metrics.discountData.topDiscounts.length > 0 && (
            <DashboardDataTable
              title="Top Applied Discounts"
              columns={[
                { key: "name", label: "Discount Name" },
                { key: "timesUsed", label: "Times Used", align: "right" },
                {
                  key: "totalDiscount",
                  label: "Total Amount",
                  format: (v) => formatTablePrice(v),
                  align: "right",
                },
              ]}
              data={metrics.discountData.topDiscounts}
              maxRows={5}
            />
          )}

          {/* Employees by Department */}
          {metrics.employeeData.byDepartment.length > 0 && (
            <DashboardChart
              title="Employees by Department"
              type="bar"
              data={metrics.employeeData.byDepartment}
              dataKey="count"
              xAxisKey="department"
              color="#10b981"
            />
          )}
        </>
      )}
    </div>
  )
}

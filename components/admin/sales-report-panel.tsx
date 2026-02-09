"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AlertCircle, DollarSign, Download, TrendingUp } from "lucide-react"
import { DashboardChart } from "./dashboard-chart"
import { DashboardDataTable } from "./dashboard-data-table"
import { StatsCard } from "./dashboard-stats-card"
import { formatTablePrice } from "@/lib/formatters"

interface SalesReport {
  summary: {
    totalOrders: number
    totalRevenue: number
    totalItems: number
    averageOrderValue: number
    totalTax: number
  }
  byHour: Array<{ hour: number; orders: number; revenue: number; items: number }>
  byDay: Array<{ day: string; orders: number; revenue: number; items: number }>
  byPaymentMethod: Array<{ method: string; count: number; amount: number; taxAmount: number; effectiveRate: number }>
  topProducts: Array<{ name: string; quantity: number; revenue: number }>
  orders: Array<any>
}

interface SalesReportProps {
  departmentFilter?: string
}

export function SalesReportPanel({ departmentFilter }: SalesReportProps) {
  const [report, setReport] = useState<SalesReport | null>(null)
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
        ...(departmentFilter && { department: departmentFilter }),
      })
      const response = await fetch(`/api/analytics/sales?${params}`)
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
          <h2 className="text-2xl font-bold text-gray-900">Sales Report</h2>
          <p className="mt-1 text-sm text-gray-500">Detailed sales analysis and trends</p>
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
              title="Total Orders"
              value={report.summary.totalOrders}
              icon={TrendingUp}
              color="blue"
            />
            <StatsCard
              title="Total Revenue"
              value={formatTablePrice(report.summary.totalRevenue)}
              icon={DollarSign}
              color="green"
            />
            <StatsCard
              title="Avg Order Value"
              value={formatTablePrice(report.summary.averageOrderValue)}
              icon={DollarSign}
              color="purple"
            />
            <StatsCard
              title="Total Tax"
              value={formatTablePrice(report.summary.totalTax)}
              icon={DollarSign}
              color="red"
            />
          </div>

          {/* Revenue by Hour */}
          {report.byHour.length > 0 && (
            <DashboardChart
              title="Revenue by Hour"
              type="line"
              data={report.byHour.map((h) => ({ hourLabel: h.hour + ":00", ...h }))}
              dataKey="revenue"
              xAxisKey="hourLabel"
              color="#10b981"
            />
          )}

          {/* Revenue by Day */}
          {report.byDay.length > 0 && (
            <DashboardChart
              title="Daily Revenue"
              type="bar"
              data={report.byDay.map((d) => ({ date: new Date(d.day).toLocaleDateString("en-US", { month: "short", day: "numeric" }), ...d }))}
              dataKey="revenue"
              xAxisKey="date"
              color="#3b82f6"
            />
          )}

          {/* Top Products */}
          {report.topProducts.length > 0 && (
            <DashboardDataTable
              title="Top 10 Products"
              columns={[
                { key: "name", label: "Product Name" },
                { key: "quantity", label: "Quantity Sold", align: "right" },
                {
                  key: "revenue",
                  label: "Revenue",
                  format: (v) => formatTablePrice(v),
                  align: "right",
                },
              ]}
              data={report.topProducts}
              maxRows={10}
            />
          )}

          {/* Payment Methods */}
          {report.byPaymentMethod.length > 0 && (
            <DashboardDataTable
              title="Revenue by Payment Method"
              columns={[
                { key: "method", label: "Payment Method" },
                { key: "count", label: "Transactions", align: "right" },
                {
                  key: "amount",
                  label: "Amount",
                  format: (v) => formatTablePrice(v),
                  align: "right",
                },
                {
                  key: "taxAmount",
                  label: "Tax Collected",
                  format: (v) => formatTablePrice(v),
                  align: "right",
                },
              ]}
              data={report.byPaymentMethod}
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

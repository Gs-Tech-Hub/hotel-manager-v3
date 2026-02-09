"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AlertCircle, DollarSign, Download, Users, Percent } from "lucide-react"
import { DashboardChart } from "./dashboard-chart"
import { DashboardDataTable } from "./dashboard-data-table"
import { StatsCard } from "./dashboard-stats-card"
import { formatTablePrice } from "@/lib/formatters"

interface TaxReport {
  summary: {
    totalTaxCollected: number
    totalTaxableAmount: number
    effectiveTaxRate: number
    paymentCount: number
    averageTaxPerPayment: number
  }
  byPaymentMethod: Array<{ method: string; count: number; amount: number; taxAmount: number; effectiveRate: number }>
  dailyTax: Array<{ date: string; collected: number; baseAmount: number; rate: number }>
  taxSettings: any
  paymentDetails: Array<any>
}

export function TaxReportPanel() {
  const [report, setReport] = useState<TaxReport | null>(null)
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
      const response = await fetch(`/api/analytics/tax?${params}`)
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
          <h2 className="text-2xl font-bold text-gray-900">Tax Report</h2>
          <p className="mt-1 text-sm text-gray-500">Tax collection analysis and compliance</p>
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
              title="Total Tax Collected"
              value={formatTablePrice(report.summary.totalTaxCollected)}
              icon={DollarSign}
              color="green"
            />
            <StatsCard
              title="Taxable Amount"
              value={formatTablePrice(report.summary.totalTaxableAmount)}
              icon={DollarSign}
              color="blue"
            />
            <StatsCard
              title="Effective Tax Rate"
              value={`${report.summary.effectiveTaxRate}%`}
              icon={Percent}
              color="purple"
            />
            <StatsCard
              title="Avg Tax per Payment"
              value={formatTablePrice(report.summary.averageTaxPerPayment)}
              icon={DollarSign}
              color="orange"
            />
          </div>

          {/* Daily Tax */}
          {report.dailyTax.length > 0 && (
            <DashboardChart
              title="Daily Tax Collection"
              type="line"
              data={report.dailyTax.map((d) => ({
                dateLabel: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                ...d,
              }))}
              dataKey="collected"
              xAxisKey="dateLabel"
              color="#ef4444"
            />
          )}

          {/* Tax by Payment Method */}
          {report.byPaymentMethod.length > 0 && (
            <DashboardDataTable
              title="Tax Collection by Payment Method"
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
                {
                  key: "effectiveRate",
                  label: "Rate %",
                  format: (v) => `${v}%`,
                  align: "right",
                },
              ]}
              data={report.byPaymentMethod}
            />
          )}

          {/* Tax Settings */}
          {report.taxSettings && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tax Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-gray-600">Tax Rate</p>
                    <p className="text-lg font-semibold">{report.taxSettings.taxRate || "N/A"}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Tax Type</p>
                    <p className="text-lg font-semibold">{report.taxSettings.taxType || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <p className={`text-lg font-semibold ${report.taxSettings.isEnabled ? "text-green-600" : "text-red-600"}`}>
                      {report.taxSettings.isEnabled ? "Active" : "Inactive"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
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

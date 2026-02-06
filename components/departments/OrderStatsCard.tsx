"use client"

import Price from '@/components/ui/Price'

type StatsType = {
  totalOrders: number
  pendingOrders: number
  processingOrders: number
  fulfilledOrders: number
  totalUnits: number
  fulfilledUnits: number
  totalAmount: number
  fulfillmentRate: number
}

type OrderStatsCardProps = {
  unpaidStats?: StatsType | null
  paidStats?: StatsType | null
  aggregatedStats?: {
    totalOrders: number
    totalPending: number
    totalProcessing: number
    totalFulfilled: number
    totalUnits: number
    totalFulfilledUnits: number
    totalAmount: number
  } | null
  // Legacy props for backward compatibility
  totalOrders?: number
  pendingOrders?: number
  processingOrders?: number
  fulfilledOrders?: number
  totalAmount?: number
  amountFulfilled?: number
  amountPaid?: number
}

export default function OrderStatsCard({
  unpaidStats,
  paidStats,
  aggregatedStats,
  // Legacy props
  totalOrders = 0,
  pendingOrders = 0,
  processingOrders = 0,
  fulfilledOrders = 0,
  totalAmount = 0,
  amountFulfilled = 0,
  amountPaid = 0,
}: OrderStatsCardProps) {
  // If new split stats provided, use those; otherwise use legacy props
  const hasNewStats = unpaidStats || paidStats

  if (hasNewStats) {
    // PAYMENT STATUS (financial dimension)
    // Use aggregated total if available, otherwise calculate from paid + unpaid
    const totalOrderAmount = aggregatedStats?.totalAmount || ((unpaidStats?.totalAmount || 0) + (paidStats?.totalAmount || 0))
    const paidAmount = paidStats?.totalAmount || 0
    const owedAmount = unpaidStats?.totalAmount || 0

    // ORDER FULFILLMENT (operational dimension - independent of payment)
    // Use aggregated counts if available
    const totalOrders = aggregatedStats?.totalOrders || ((unpaidStats?.totalOrders || 0) + (paidStats?.totalOrders || 0))
    const totalPending = aggregatedStats?.totalPending || ((unpaidStats?.pendingOrders || 0) + (paidStats?.pendingOrders || 0))
    const totalProcessing = aggregatedStats?.totalProcessing || ((unpaidStats?.processingOrders || 0) + (paidStats?.processingOrders || 0))
    const totalFulfilled = aggregatedStats?.totalFulfilled || ((unpaidStats?.fulfilledOrders || 0) + (paidStats?.fulfilledOrders || 0))
    const totalUnits = aggregatedStats?.totalUnits || ((unpaidStats?.totalUnits || 0) + (paidStats?.totalUnits || 0))
    const totalFulfilledUnits = aggregatedStats?.totalFulfilledUnits || ((unpaidStats?.fulfilledUnits || 0) + (paidStats?.fulfilledUnits || 0))
    const fulfillmentRate = totalUnits > 0 ? Math.round((totalFulfilledUnits / totalUnits) * 100) : 0

    return (
      <div className="space-y-4">
        {/* PAYMENT STATS TABLE */}
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-blue-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-blue-900">💳 Payment Stats</th>
                <th className="text-right px-4 py-3 font-semibold text-blue-900">Total Amount</th>
                <th className="text-right px-4 py-3 font-semibold text-blue-900">Paid</th>
                <th className="text-right px-4 py-3 font-semibold text-blue-900">Owed</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100 hover:bg-blue-50/30">
                <td className="px-4 py-3 text-gray-600">Current Period</td>
                <td className="px-4 py-3 text-right font-medium"><Price amount={totalOrderAmount} isMinor={true} /></td>
                <td className="px-4 py-3 text-right font-medium text-green-600"><Price amount={paidAmount} isMinor={true} /></td>
                <td className="px-4 py-3 text-right font-medium text-orange-600"><Price amount={owedAmount} isMinor={true} /></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* FULFILLMENT STATS TABLE */}
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-purple-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-purple-900">📦 Fulfillment Stats</th>
                <th className="text-center px-4 py-3 font-semibold text-purple-900">Pending</th>
                <th className="text-center px-4 py-3 font-semibold text-purple-900">Processing</th>
                <th className="text-center px-4 py-3 font-semibold text-purple-900">Fulfilled</th>
                <th className="text-center px-4 py-3 font-semibold text-purple-900">Rate</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100 hover:bg-purple-50/30">
                <td className="px-4 py-3 text-gray-600">Orders ({totalOrders})</td>
                <td className="px-4 py-3 text-center font-medium">{totalPending}</td>
                <td className="px-4 py-3 text-center font-medium">{totalProcessing}</td>
                <td className="px-4 py-3 text-center font-medium text-green-600">{totalFulfilled}</td>
                <td className="px-4 py-3 text-center font-medium">{fulfillmentRate}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // Legacy format (single stats)
  return (
    <div className="overflow-x-auto rounded border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-100 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 font-semibold">Order Stats</th>
            <th className="text-center px-4 py-3 font-semibold">Total</th>
            <th className="text-center px-4 py-3 font-semibold">Pending</th>
            <th className="text-center px-4 py-3 font-semibold">Processing</th>
            <th className="text-center px-4 py-3 font-semibold">Fulfilled</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-gray-100">
            <td className="px-4 py-3 text-gray-600">Orders</td>
            <td className="px-4 py-3 text-center font-medium">{totalOrders}</td>
            <td className="px-4 py-3 text-center font-medium">{pendingOrders}</td>
            <td className="px-4 py-3 text-center font-medium">{processingOrders}</td>
            <td className="px-4 py-3 text-center font-medium text-green-600">{fulfilledOrders}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
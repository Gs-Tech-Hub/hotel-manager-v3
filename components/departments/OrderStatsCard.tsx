"use client"

import Price from '@/components/ui/Price'

type OrderStatsCardProps = {
  totalOrders: number
  pendingOrders: number
  processingOrders: number
  fulfilledOrders: number
  totalAmount: number
}

export default function OrderStatsCard({
  totalOrders,
  pendingOrders,
  processingOrders,
  fulfilledOrders,
  totalAmount,
}: OrderStatsCardProps) {
  return (
    <div className="p-4 bg-green-50 rounded border border-green-200">
      <div className="text-sm font-medium text-green-900">Order Fulfillment Stats</div>
      <div className="text-sm text-green-800 mt-2 grid grid-cols-2 md:grid-cols-5 gap-3">
        <div>
          <span className="font-semibold">{totalOrders}</span>
          <span className="block text-xs text-green-700">Total Orders</span>
        </div>
        <div>
          <span className="font-semibold">{pendingOrders}</span>
          <span className="block text-xs text-green-700">Pending</span>
        </div>
        <div>
          <span className="font-semibold">{processingOrders}</span>
          <span className="block text-xs text-green-700">Processing</span>
        </div>
        <div>
          <span className="font-semibold">{fulfilledOrders}</span>
          <span className="block text-xs text-green-700">Fulfilled</span>
        </div>
        <div>
          <span className="font-semibold">
            <Price amount={totalAmount} isMinor={true} />
          </span>
          <span className="block text-xs text-green-700">Total Revenue</span>
        </div>
      </div>
    </div>
  )
}

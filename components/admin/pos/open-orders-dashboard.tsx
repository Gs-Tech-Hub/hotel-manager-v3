"use client"

import { useEffect, useState } from 'react'
import Price from '@/components/ui/Price'
import { OrderPaymentDialog } from './order-payment-dialog'

interface OpenOrder {
  id: string
  orderNumber: string
  customerId: string
  customerName: string
  customerEmail: string
  customerPhone: string
  status: string
  subtotal: number
  discountTotal: number
  tax: number
  total: number
  itemCount: number
  departmentCodes: string[]
  departmentNames: string[]
  totalPaid: number
  amountDue: number
  createdAt: Date
  createdAtFormatted: string
  notes: string
  lineItems: Array<{
    id: string
    productName: string
    quantity: number
    unitPrice: number
    lineTotal: number
  }>
}

interface SettlementPayload {
  orderId: string
  amount: number
  paymentMethod: 'cash' | 'card' | 'check'
  transactionReference?: string
  notes?: string
}

export function OpenOrdersDashboard() {
  const [orders, setOrders] = useState<OpenOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'overdue'>('all')
  const [selectedOrder, setSelectedOrder] = useState<OpenOrder | null>(null)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [showAddItems, setShowAddItems] = useState(false)
  const [addingItemsToOrderId, setAddingItemsToOrderId] = useState<string | null>(null)
  const [newItemProductId, setNewItemProductId] = useState('')
  const [newItemProductName, setNewItemProductName] = useState('')
  const [newItemQuantity, setNewItemQuantity] = useState(1)
  const [newItemUnitPrice, setNewItemUnitPrice] = useState(0)

  // Load open orders
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch('/api/orders/open?limit=100', {
          credentials: 'include',
        })

        if (!res.ok) {
          const json = await res.json()
          throw new Error(json.error?.message || 'Failed to load open orders')
        }

        const json = await res.json()
        if (json.success && json.data?.orders) {
          setOrders(json.data.orders)
        } else {
          throw new Error('Invalid response format')
        }
      } catch (err) {
        console.error('Failed to fetch open orders:', err)
        setError(err instanceof Error ? err.message : 'Failed to load open orders')
        setOrders([])
      } finally {
        setLoading(false)
      }
    }

    fetchOrders()
    const interval = setInterval(fetchOrders, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  // Calculate totals
  const totalOpenAmount = orders.reduce((sum, o) => sum + o.amountDue, 0)
  const totalFullyPaid = orders.filter((o) => o.amountDue <= 0).length
  const totalPending = orders.length - totalFullyPaid

  const handleAddItem = async () => {
    if (!selectedOrder || !newItemProductId || !newItemProductName || newItemQuantity <= 0 || newItemUnitPrice <= 0) {
      setError('Please fill in all item fields')
      return
    }

    try {
      setAddingItemsToOrderId(selectedOrder.id)
      const res = await fetch(`/api/orders/${selectedOrder.id}/items`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: newItemProductId,
          productType: 'inventory',
          productName: newItemProductName,
          departmentCode: selectedOrder.departmentCodes[0], // Use first department
          quantity: newItemQuantity,
          unitPrice: newItemUnitPrice,
        }),
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error?.message || 'Failed to add item')
      }

      // Refresh orders list
      const freshRes = await fetch('/api/orders/open?limit=100', {
        credentials: 'include',
      })
      const freshJson = await freshRes.json()
      if (freshJson.success && freshJson.data?.orders) {
        setOrders(freshJson.data.orders)
        // Update selected order with fresh data
        const updatedOrder = freshJson.data.orders.find((o: OpenOrder) => o.id === selectedOrder.id)
        if (updatedOrder) setSelectedOrder(updatedOrder)
      }

      // Reset form
      setShowAddItems(false)
      setNewItemProductId('')
      setNewItemProductName('')
      setNewItemQuantity(1)
      setNewItemUnitPrice(0)
      setError(null)
    } catch (err) {
      console.error('Failed to add item:', err)
      setError(err instanceof Error ? err.message : 'Failed to add item')
    } finally {
      setAddingItemsToOrderId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading open orders...</div>
      </div>
    )
  }

  const displayOrders =
    filter === 'overdue'
      ? orders.filter((o) => {
          const createdTime = new Date(o.createdAt).getTime()
          const hoursOld = (Date.now() - createdTime) / (1000 * 60 * 60)
          return hoursOld > 24
        })
      : orders

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Open Orders Dashboard</h1>
        <p className="text-gray-600">Manage pending and deferred payment orders</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-700">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Total Pending</div>
          <div className="text-2xl font-bold text-amber-600">{totalPending}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Amount Due</div>
          <div className="text-2xl font-bold text-red-600">
            <Price amount={totalOpenAmount} isMinor={true} />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Fully Paid</div>
          <div className="text-2xl font-bold text-green-600">{totalFullyPaid}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Total Orders</div>
          <div className="text-2xl font-bold text-blue-600">{orders.length}</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded transition ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-white border border-gray-200 hover:bg-gray-50'
          }`}
        >
          All Orders ({orders.length})
        </button>
        <button
          onClick={() => setFilter('overdue')}
          className={`px-4 py-2 rounded transition ${
            filter === 'overdue'
              ? 'bg-amber-600 text-white'
              : 'bg-white border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Overdue (24+ hrs)
        </button>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {displayOrders.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {filter === 'overdue'
              ? 'No overdue orders'
              : 'No open orders found'}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Order #</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Customer</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Items</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Total</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Paid</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Due</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Created</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {displayOrders.map((order) => (
                <tr key={order.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm">{order.orderNumber}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="font-semibold">{order.customerName}</div>
                    <div className="text-gray-500 text-xs">{order.customerEmail}</div>
                  </td>
                  <td className="px-4 py-3 text-sm">{order.itemCount} items</td>
                  <td className="px-4 py-3 text-right font-semibold">
                    <Price amount={order.total} isMinor={true} />
                  </td>
                  <td className="px-4 py-3 text-right text-green-600 font-semibold">
                    <Price amount={order.totalPaid} isMinor={true} />
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold ${order.amountDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    <Price amount={order.amountDue} isMinor={true} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{order.createdAtFormatted}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setSelectedOrder(order)
                          setShowAddItems(true)
                        }}
                        title="Add more items to this order"
                        className="px-2 py-1 bg-sky-500 text-white rounded text-xs hover:bg-sky-600 transition"
                      >
                        +Item
                      </button>
                      <button
                        onClick={() => {
                          setSelectedOrder(order)
                          setShowPaymentDialog(true)
                        }}
                        disabled={order.amountDue <= 0}
                        className={`px-3 py-1 rounded text-sm transition ${
                          order.amountDue <= 0
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {order.amountDue <= 0 ? '✓ Paid' : 'Pay'}
                      </button>
                    </div>
                    {order.amountDue <= 0 && (
                      <div className="text-xs text-green-600 mt-1 font-semibold">Payment Complete</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Payment Dialog */}
      <OrderPaymentDialog
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        order={selectedOrder}
        departmentCode={selectedOrder?.departmentCodes?.[0] || ''}
        onPaymentComplete={() => {
          setShowPaymentDialog(false)
          setSelectedOrder(null)
        }}
      />

      {/* Add Items Modal */}
      {showAddItems && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Add Item to Order</h2>

            <div className="bg-blue-50 rounded p-4 mb-4">
              <div className="text-sm text-gray-600">Order Number</div>
              <div className="font-mono font-semibold">{selectedOrder.orderNumber}</div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">Product Name *</label>
              <input
                type="text"
                value={newItemProductName}
                onChange={(e) => setNewItemProductName(e.target.value)}
                placeholder="e.g., Coffee"
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">Quantity *</label>
              <input
                type="number"
                value={newItemQuantity}
                onChange={(e) => setNewItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                min="1"
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">Unit Price (in dollars) *</label>
              <div className="flex items-center gap-2">
                <span className="text-xl">$</span>
                <input
                  type="number"
                  value={newItemUnitPrice}
                  onChange={(e) => setNewItemUnitPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                  step="0.01"
                  min="0"
                  className="flex-1 border rounded px-3 py-2"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowAddItems(false)
                  setNewItemProductName('')
                  setNewItemQuantity(1)
                  setNewItemUnitPrice(0)
                  setError(null)
                }}
                className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddItem}
                disabled={addingItemsToOrderId === selectedOrder.id}
                className="flex-1 px-4 py-2 bg-sky-600 text-white rounded hover:bg-sky-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {addingItemsToOrderId === selectedOrder.id ? 'Adding...' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


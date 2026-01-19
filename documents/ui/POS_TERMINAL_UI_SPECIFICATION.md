# 🛒 POS Terminal UI Specification
## Complete Point-of-Sale Interface Design

**Date**: November 18, 2025  
**Status**: ✅ Production-Ready Specification  
**Scope**: Complete POS checkout flow + management interface

---

## Table of Contents

1. [Overview](#overview)
2. [POS Checkout Interface](#pos-checkout-interface)
3. [POS Management Dashboard](#pos-management-dashboard)
4. [Component Architecture](#component-architecture)
5. [Integration Points](#integration-points)
6. [Implementation Phases](#implementation-phases)
7. [Code Examples](#code-examples)

---

## Overview

Complete POS system covering:
- **Checkout Interface**: Full transaction flow (items → cart → payment → receipt)
- **Management**: Terminal configuration, transaction history, shift management
- **Features**: Multi-payment, discounts, refunds, inventory sync
- **Integration**: Orders API, Inventory API, Departments API, Payments API

### Key Capabilities

✅ **Product Selection** - Browse items by category/department  
✅ **Cart Management** - Add, modify, remove items with real-time totals  
✅ **Discount Application** - Promo codes, employee discounts, manager overrides  
✅ **Payment Processing** - Multiple payment methods (cash, card, split)  
✅ **Receipt Generation** - Print or digital receipt  
✅ **Refund/Void** - Complete or partial refunds  
✅ **Offline Mode** - Queue transactions when offline  
✅ **User Management** - Cashier login, permission-based actions  
✅ **Reporting** - Sales summaries, transaction history  

---

## POS Checkout Interface

### 1. Checkout Layout (Main Screen)

```
┌─────────────────────────────────────────────────────────────────┐
│  🏨 Paradise Hotel POS                    [Current Time]        │
│  Cashier: John Smith | Terminal: POS-001                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────┐     ┌──────────────────────────┐  │
│  │   PRODUCT CATEGORIES     │     │   CART SUMMARY           │  │
│  │                          │     │                          │  │
│  │ [Foods]  [Drinks]        │     │ Item             Qty  Amt│  │
│  │ [Retail] [Services]      │     │ ─────────────────────────│  │
│  │                          │     │ Espresso         x2  $12  │  │
│  │ FOODS                    │     │ Croissant        x1  $5   │  │
│  │ ┌────────────────────┐   │     │ Bottled Water    x3  $9   │  │
│  │ │ [Burger]  $15.99   │   │     │                          │  │
│  │ │ [Pizza]    $18.99  │   │     │ ─────────────────────────│  │
│  │ │ [Pasta]    $16.99  │   │     │ Subtotal:       $26.00  │  │
│  │ │ [Salad]    $12.99  │   │     │ Discount:       -$5.00  │  │
│  │ │ [Sandwich] $10.99  │   │     │ Tax (10%):      $2.10   │  │
│  │ └────────────────────┘   │     │ ─────────────────────────│  │
│  │                          │     │ TOTAL:          $23.10  │  │
│  │ DRINKS                   │     │ Tendered:       $25.00  │  │
│  │ ┌────────────────────┐   │     │ Change:         $1.90   │  │
│  │ │ [Coffee]   $4.99   │   │     │                          │  │
│  │ │ [Tea]      $3.99   │   │     │ ┌──────────────────────┐ │  │
│  │ │ [Juice]    $5.99   │   │     │ │ [Remove] [Qty] [Clr]│ │  │
│  │ │ [Beer]     $6.99   │   │     │ └──────────────────────┘ │  │
│  │ └────────────────────┘   │     │                          │  │
│  │ [More Categories ▼]      │     └──────────────────────────┘  │
│  └──────────────────────────┘                                   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ NUMERIC KEYPAD FOR PRICE ENTRY                            │ │
│  │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │ │
│  │ │    1     │ │    2     │ │    3     │ │  CLEAR   │       │ │
│  │ ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤       │ │
│  │ │    4     │ │    5     │ │    6     │ │ DISCOUNT │       │ │
│  │ ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤       │ │
│  │ │    7     │ │    8     │ │    9     │ │ QUANTITY │       │ │
│  │ ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤       │ │
│  │ │    0     │ │    .     │ │   VOID   │ │  RETURN  │       │ │
│  │ └──────────┘ └──────────┘ └──────────┘ └──────────┘       │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────┐ ┌───────────┐  │
│  │ [Promo Code] │ │ [Void Item]  │ │ [Refund] │ │ [Payment] │  │
│  └──────────────┘ └──────────────┘ └──────────┘ └───────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Sections:**
1. **Product Categories** - Select category to browse items
2. **Product Grid** - Buttons for each item (tap to add)
3. **Cart Summary** - Running total with line items
4. **Numeric Keypad** - Price entry, quantities, discounts
5. **Action Buttons** - Promo codes, refunds, payment

---

### 2. Product Category Selection

**File**: `components/admin/pos/pos-category-selector.tsx`

```typescript
interface POSCategory {
  id: string
  name: string
  icon: LucideIcon
  color: 'blue' | 'purple' | 'green' | 'orange'
  items: POSProduct[]
}

interface POSProduct {
  id: string
  name: string
  price: number
  departmentCode: string
  image?: string
  description?: string
  available: boolean
  inventory?: number
}

export function POSCategorySelector({ 
  categories, 
  selectedCategory, 
  onSelectCategory 
}: {
  categories: POSCategory[]
  selectedCategory: POSCategory | null
  onSelectCategory: (category: POSCategory) => void
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {categories.map((category) => (
        <button
          key={category.id}
          onClick={() => onSelectCategory(category)}
          className={`p-4 rounded-lg font-semibold transition-all ${
            selectedCategory?.id === category.id
              ? 'bg-sky-500 text-white scale-105 shadow-lg'
              : 'bg-slate-200 text-slate-900 hover:bg-slate-300'
          }`}
        >
          <category.icon className="h-6 w-6 mx-auto mb-2" />
          {category.name}
        </button>
      ))}
    </div>
  )
}
```

---

### 3. Product Grid & Item Selection

**File**: `components/admin/pos/pos-product-grid.tsx`

```typescript
interface AddToCartItem {
  productId: string
  productName: string
  departmentCode: string
  quantity: number
  unitPrice: number
}

export function POSProductGrid({ 
  products, 
  onAddItem 
}: {
  products: POSProduct[]
  onAddItem: (item: AddToCartItem) => void
}) {
  const [quantity, setQuantity] = useState(1)
  const [selectedProduct, setSelectedProduct] = useState<POSProduct | null>(null)

  const handleAddItem = (product: POSProduct) => {
    if (!product.available) return

    onAddItem({
      productId: product.id,
      productName: product.name,
      departmentCode: product.departmentCode,
      quantity,
      unitPrice: product.price,
    })

    setQuantity(1)
  }

  return (
    <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
      {products.map((product) => (
        <button
          key={product.id}
          onClick={() => {
            setSelectedProduct(product)
            handleAddItem(product)
          }}
          disabled={!product.available}
          className={`p-3 rounded-lg text-center font-semibold transition-all ${
            !product.available
              ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
              : 'bg-white border-2 border-slate-300 hover:border-sky-500 hover:shadow-md active:scale-95'
          }`}
        >
          {product.image && (
            <img src={product.image} alt={product.name} className="w-full h-12 object-cover rounded mb-2" />
          )}
          <div className="text-xs font-bold">{product.name}</div>
          <div className="text-sm text-sky-600">${product.price.toFixed(2)}</div>
          {product.inventory !== undefined && (
            <div className="text-xs text-slate-500">Stock: {product.inventory}</div>
          )}
        </button>
      ))}
    </div>
  )
}
```

---

### 4. Shopping Cart Component

**File**: `components/admin/pos/pos-cart.tsx`

```typescript
interface CartItem extends AddToCartItem {
  lineId: string
  subtotal: number
}

interface CartState {
  items: CartItem[]
  subtotal: number
  discountTotal: number
  tax: number
  total: number
  appliedDiscounts: Array<{ id: string; code: string; amount: number }>
}

export function POSCart({ 
  cart, 
  onRemoveItem, 
  onUpdateQuantity,
  onApplyDiscount,
  onPayment
}: {
  cart: CartState
  onRemoveItem: (lineId: string) => void
  onUpdateQuantity: (lineId: string, quantity: number) => void
  onApplyDiscount: (code: string) => Promise<void>
  onPayment: () => void
}) {
  const [discountCode, setDiscountCode] = useState('')

  return (
    <div className="border-2 border-slate-300 rounded-lg p-4 bg-white">
      <h2 className="font-bold text-lg mb-4">Order Summary</h2>

      {/* Cart Items */}
      <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
        {cart.items.map((item) => (
          <div key={item.lineId} className="flex items-center justify-between text-sm border-b pb-2">
            <div>
              <div className="font-semibold">{item.productName}</div>
              <div className="text-slate-600">Dept: {item.departmentCode}</div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                value={item.quantity}
                onChange={(e) => onUpdateQuantity(item.lineId, parseInt(e.target.value))}
                className="w-12 px-2 py-1 border rounded text-center"
              />
              <div className="w-16 text-right font-semibold">
                ${item.subtotal.toFixed(2)}
              </div>
              <button
                onClick={() => onRemoveItem(item.lineId)}
                className="text-red-500 hover:text-red-700 font-bold"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Applied Discounts */}
      {cart.appliedDiscounts.length > 0 && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
          <div className="font-semibold text-sm mb-2">Applied Discounts:</div>
          {cart.appliedDiscounts.map((discount) => (
            <div key={discount.id} className="text-sm flex justify-between">
              <span>{discount.code}</span>
              <span className="text-green-600 font-semibold">-${discount.amount.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Discount Entry */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Promo code"
          value={discountCode}
          onChange={(e) => setDiscountCode(e.target.value)}
          className="flex-1 px-3 py-2 border rounded text-sm"
        />
        <button
          onClick={() => onApplyDiscount(discountCode)}
          className="px-4 py-2 bg-sky-500 text-white rounded font-semibold hover:bg-sky-600"
        >
          Apply
        </button>
      </div>

      {/* Totals */}
      <div className="border-t-2 pt-3 space-y-1 text-sm font-semibold">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>${cart.subtotal.toFixed(2)}</span>
        </div>
        {cart.discountTotal > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Discount:</span>
            <span>-${cart.discountTotal.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Tax (10%):</span>
          <span>${cart.tax.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-lg text-sky-600 border-t-2 pt-2 mt-2">
          <span>TOTAL:</span>
          <span>${cart.total.toFixed(2)}</span>
        </div>
      </div>

      {/* Payment Button */}
      <button
        onClick={onPayment}
        disabled={cart.items.length === 0}
        className="w-full mt-4 py-3 bg-emerald-500 text-white font-bold rounded-lg hover:bg-emerald-600 disabled:bg-slate-300 disabled:cursor-not-allowed"
      >
        Proceed to Payment
      </button>
    </div>
  )
}
```

---

### 5. Payment Processing

**File**: `components/admin/pos/pos-payment.tsx`

```typescript
type PaymentMethod = 'cash' | 'card' | 'check' | 'other'

interface PaymentRecord {
  method: PaymentMethod
  amount: number
  timestamp: Date
}

export function POSPayment({ 
  total, 
  onPaymentComplete 
}: {
  total: number
  onPaymentComplete: (payment: PaymentRecord) => void
}) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [amountTendered, setAmountTendered] = useState<number>(total)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const change = amountTendered - total
  const isValid = amountTendered >= total

  const handlePayment = async () => {
    if (!isValid) {
      setError('Amount tendered must be at least the total')
      return
    }

    setIsProcessing(true)
    try {
      // Process payment based on method
      if (paymentMethod === 'card') {
        // Card processor integration
        await processCardPayment(amountTendered)
      }

      onPaymentComplete({
        method: paymentMethod,
        amount: amountTendered,
        timestamp: new Date(),
      })

      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justifyify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
        <h2 className="text-2xl font-bold mb-6">Payment Method</h2>

        {/* Payment Methods */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {(['cash', 'card', 'check', 'other'] as const).map((method) => (
            <button
              key={method}
              onClick={() => setPaymentMethod(method)}
              className={`p-3 rounded-lg font-semibold capitalize transition-all ${
                paymentMethod === method
                  ? 'bg-sky-500 text-white'
                  : 'bg-slate-200 text-slate-900 hover:bg-slate-300'
              }`}
            >
              {method === 'card' ? '💳 Card' : method === 'cash' ? '💵 Cash' : method}
            </button>
          ))}
        </div>

        {/* Amount Entry */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-semibold mb-2">Total Due:</label>
            <input
              type="number"
              value={total}
              disabled
              className="w-full px-4 py-2 border rounded text-lg font-semibold bg-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Amount Tendered:</label>
            <input
              type="number"
              value={amountTendered}
              onChange={(e) => setAmountTendered(parseFloat(e.target.value))}
              className="w-full px-4 py-2 border-2 border-sky-400 rounded text-lg font-semibold"
              disabled={paymentMethod !== 'cash'}
            />
          </div>

          {paymentMethod === 'cash' && (
            <div className={`p-3 rounded-lg font-semibold text-lg ${
              change >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              Change: ${change.toFixed(2)}
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-800 rounded">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => setAmountTendered(0)}
            className="flex-1 px-4 py-2 border-2 border-slate-300 rounded font-semibold hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={handlePayment}
            disabled={!isValid || isProcessing}
            className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded font-semibold hover:bg-emerald-600 disabled:bg-slate-300"
          >
            {isProcessing ? 'Processing...' : 'Complete Payment'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

### 6. Receipt Display & Printing

**File**: `components/admin/pos/pos-receipt.tsx`

```typescript
interface ReceiptData {
  orderId: string
  orderNumber: string
  terminalId: string
  cashierId: string
  timestamp: Date
  items: CartItem[]
  subtotal: number
  discounts: Array<{ code: string; amount: number }>
  tax: number
  total: number
  payment: PaymentRecord
  change?: number
}

export function POSReceipt({ 
  receipt, 
  onPrint, 
  onClose 
}: {
  receipt: ReceiptData
  onPrint: () => void
  onClose: () => void
}) {
  const receiptRef = useRef<HTMLDivElement>(null)

  const handlePrint = () => {
    if (receiptRef.current) {
      const printWindow = window.open('', '', 'width=600,height=800')
      if (printWindow) {
        printWindow.document.write(receiptRef.current.innerHTML)
        printWindow.document.close()
        printWindow.print()
      }
    }
    onPrint()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 shadow-xl max-h-96 overflow-y-auto">
        <div ref={receiptRef} className="receipt font-mono text-sm space-y-1">
          {/* Header */}
          <div className="text-center border-b pb-2">
            <div className="font-bold text-lg">🏨 Paradise Hotel</div>
            <div>Receipt</div>
            <div className="text-xs">{format(receipt.timestamp, 'MMM dd, yyyy HH:mm:ss')}</div>
          </div>

          {/* Order Info */}
          <div className="text-xs space-y-1 border-b pb-2">
            <div>Order: {receipt.orderNumber}</div>
            <div>Terminal: {receipt.terminalId}</div>
            <div>Cashier: {receipt.cashierId}</div>
          </div>

          {/* Items */}
          <div className="border-b py-2 space-y-1">
            {receipt.items.map((item) => (
              <div key={item.lineId} className="flex justify-between text-xs">
                <span>{item.productName} x{item.quantity}</span>
                <span>${item.subtotal.toFixed(2)}</span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="space-y-1 border-b pb-2">
            <div className="flex justify-between font-semibold">
              <span>Subtotal:</span>
              <span>${receipt.subtotal.toFixed(2)}</span>
            </div>
            {receipt.discounts.length > 0 && (
              <>
                {receipt.discounts.map((discount, idx) => (
                  <div key={idx} className="flex justify-between text-green-600">
                    <span>{discount.code}</span>
                    <span>-${discount.amount.toFixed(2)}</span>
                  </div>
                ))}
              </>
            )}
            <div className="flex justify-between">
              <span>Tax:</span>
              <span>${receipt.tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-1">
              <span>TOTAL:</span>
              <span>${receipt.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment */}
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span>Payment ({receipt.payment.method}):</span>
              <span>${receipt.payment.amount.toFixed(2)}</span>
            </div>
            {receipt.change !== undefined && (
              <div className="flex justify-between font-semibold">
                <span>Change:</span>
                <span>${receipt.change.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="text-center text-xs border-t pt-2 text-slate-600">
            <div>Thank you for your purchase!</div>
            <div className="mt-1">Visit us again</div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handlePrint}
            className="flex-1 px-4 py-2 bg-sky-500 text-white rounded font-semibold hover:bg-sky-600"
          >
            🖨️ Print Receipt
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border-2 border-slate-300 rounded font-semibold hover:bg-slate-100"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

### 7. Refund & Void Operations

**File**: `components/admin/pos/pos-refund.tsx`

```typescript
type RefundType = 'full' | 'partial' | 'exchange'

export function POSRefund({ 
  order, 
  onRefundComplete, 
  onCancel 
}: {
  order: OrderData
  onRefundComplete: (refund: RefundData) => void
  onCancel: () => void
}) {
  const [refundType, setRefundType] = useState<RefundType>('full')
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [refundAmount, setRefundAmount] = useState(order.total)
  const [reason, setReason] = useState('')
  const [managerApproval, setManagerApproval] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const requiresApproval = refundAmount > 50 || refundType === 'exchange'

  const handleRefund = async () => {
    if (requiresApproval && !managerApproval) {
      alert('Manager approval required for this refund')
      return
    }

    setIsProcessing(true)
    try {
      const refundData = {
        orderId: order.id,
        type: refundType,
        amount: refundAmount,
        items: selectedItems,
        reason,
        managerId: managerApproval,
        timestamp: new Date(),
      }

      // Call API to process refund
      await processRefund(refundData)

      onRefundComplete(refundData)
    } catch (error) {
      console.error('Refund failed:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
        <h2 className="text-2xl font-bold mb-6">Process Refund</h2>

        {/* Refund Type */}
        <div className="space-y-3 mb-6">
          <label className="block text-sm font-semibold">Refund Type:</label>
          {(['full', 'partial', 'exchange'] as const).map((type) => (
            <label key={type} className="flex items-center gap-2">
              <input
                type="radio"
                name="refundType"
                value={type}
                checked={refundType === type}
                onChange={() => setRefundType(type)}
                className="w-4 h-4"
              />
              <span className="capitalize">{type === 'full' ? 'Full Refund' : type === 'partial' ? 'Partial Refund' : 'Exchange'}</span>
            </label>
          ))}
        </div>

        {/* Item Selection for Partial Refunds */}
        {refundType === 'partial' && (
          <div className="mb-6 space-y-2">
            <label className="block text-sm font-semibold">Select Items to Refund:</label>
            {order.items.map((item) => (
              <label key={item.lineId} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedItems.includes(item.lineId)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedItems([...selectedItems, item.lineId])
                    } else {
                      setSelectedItems(selectedItems.filter((id) => id !== item.lineId))
                    }
                  }}
                  className="w-4 h-4"
                />
                <span className="text-sm">{item.productName} - ${item.subtotal.toFixed(2)}</span>
              </label>
            ))}
          </div>
        )}

        {/* Refund Amount */}
        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2">Refund Amount:</label>
          <input
            type="number"
            value={refundAmount}
            onChange={(e) => setRefundAmount(parseFloat(e.target.value))}
            className="w-full px-4 py-2 border-2 rounded text-lg font-semibold"
            step="0.01"
          />
        </div>

        {/* Reason */}
        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2">Reason:</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-4 py-2 border rounded resize-none h-24"
            placeholder="Customer complaint, item not received, etc."
          />
        </div>

        {/* Manager Approval */}
        {requiresApproval && (
          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2">Manager Approval:</label>
            <select
              value={managerApproval}
              onChange={(e) => setManagerApproval(e.target.value)}
              className="w-full px-4 py-2 border rounded"
            >
              <option value="">Select Manager...</option>
              <option value="mgr-001">John Doe (Manager)</option>
              <option value="mgr-002">Jane Smith (Manager)</option>
            </select>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border-2 border-slate-300 rounded font-semibold hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={handleRefund}
            disabled={isProcessing || (requiresApproval && !managerApproval)}
            className="flex-1 px-4 py-2 bg-red-500 text-white rounded font-semibold hover:bg-red-600 disabled:bg-slate-300"
          >
            {isProcessing ? 'Processing...' : 'Confirm Refund'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

## POS Management Dashboard

### 8. Terminal Management Interface

**File**: `app/(dashboard)/pos-terminals/page.tsx`

Complete terminal management covering:
- Terminal status and health
- Transaction history
- Configuration management
- Drawer reconciliation
- Offline transaction queue

```typescript
'use client'

import { useState, useEffect } from 'react'
import { POSTerminalList } from '@/components/admin/pos/pos-terminal-list'
import { POSTerminalDetail } from '@/components/admin/pos/pos-terminal-detail'
import { POSTransactionHistory } from '@/components/admin/pos/pos-transaction-history'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, RotateCcw } from 'lucide-react'

export default function POSTerminalsPage() {
  const [selectedTerminal, setSelectedTerminal] = useState<string | null>(null)
  const [terminals, setTerminals] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTerminals()
  }, [])

  const fetchTerminals = async () => {
    const res = await fetch('/api/pos-terminals')
    const data = await res.json()
    setTerminals(data)
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">POS Terminal Management</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchTerminals}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Configure Terminal
          </Button>
        </div>
      </div>

      <Tabs defaultValue="list" className="w-full">
        <TabsList>
          <TabsTrigger value="list">All Terminals</TabsTrigger>
          <TabsTrigger value="detail">Terminal Detail</TabsTrigger>
          <TabsTrigger value="transactions">Transaction History</TabsTrigger>
          <TabsTrigger value="reports">Reports & Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <POSTerminalList 
            terminals={terminals} 
            onSelectTerminal={setSelectedTerminal}
          />
        </TabsContent>

        <TabsContent value="detail">
          {selectedTerminal ? (
            <POSTerminalDetail terminalId={selectedTerminal} />
          ) : (
            <div className="text-center py-8 text-slate-500">
              Select a terminal from the list to view details
            </div>
          )}
        </TabsContent>

        <TabsContent value="transactions">
          <POSTransactionHistory />
        </TabsContent>

        <TabsContent value="reports">
          <POSReportsAndAnalytics />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

---

### 9. Cashier Login & Shift Management

**File**: `components/admin/pos/pos-cashier-login.tsx`

```typescript
interface CashierShift {
  cashierId: string
  terminalId: string
  startTime: Date
  endTime?: Date
  startingCash: number
  endingCash?: number
  transactionCount: number
  totalSales: number
}

export function POSCashierLogin({ 
  terminalId, 
  onLoginSuccess 
}: {
  terminalId: string
  onLoginSuccess: (cashier: CashierShift) => void
}) {
  const [userId, setUserId] = useState('')
  const [pin, setPin] = useState('')
  const [startingCash, setStartingCash] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async () => {
    if (!userId || !pin || startingCash <= 0) {
      setError('Please fill all fields')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/pos-terminals/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          terminalId,
          cashierId: userId,
          pin,
          startingCash,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        onLoginSuccess(data)
        setError(null)
      } else {
        setError(data.error || 'Login failed')
      }
    } catch (err) {
      setError('Login error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100">
      <div className="bg-white rounded-lg p-8 shadow-lg w-96">
        <h2 className="text-2xl font-bold mb-6 text-center">Cashier Login</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-2">Employee ID:</label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="Enter your ID"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">PIN:</label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="Enter your PIN"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Starting Cash ($):</label>
            <input
              type="number"
              value={startingCash}
              onChange={(e) => setStartingCash(parseFloat(e.target.value))}
              className="w-full px-4 py-2 border rounded-lg"
              step="0.01"
              placeholder="0.00"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-800 rounded">
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full py-3 bg-sky-500 text-white font-semibold rounded-lg hover:bg-sky-600 disabled:bg-slate-300"
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

## Component Architecture

### File Structure

```
components/admin/pos/
├── pos-checkout.tsx              # Main checkout interface
├── pos-category-selector.tsx      # Category selection
├── pos-product-grid.tsx           # Product grid display
├── pos-cart.tsx                   # Shopping cart
├── pos-payment.tsx                # Payment processing
├── pos-receipt.tsx                # Receipt display
├── pos-refund.tsx                 # Refund operations
├── pos-drawer.tsx                 # Drawer management
├── pos-cashier-login.tsx          # Cashier login
├── pos-terminal-list.tsx          # Terminal management
├── pos-terminal-detail.tsx        # Terminal detail view
├── pos-transaction-history.tsx    # Transaction history
├── pos-reports.tsx                # Reports & analytics
└── types.ts                       # POS data types

app/(dashboard)/pos-terminals/
├── page.tsx                       # Main management page
├── [id]/
│   ├── page.tsx                   # Terminal detail
│   ├── checkout/
│   │   └── page.tsx               # Live checkout interface
│   ├── transactions/
│   │   └── page.tsx               # Transaction history
│   └── configuration/
│       └── page.tsx               # Terminal settings

api/
└── pos-terminals/
    ├── route.ts                   # GET/POST terminals
    ├── [id]/
    │   ├── route.ts               # GET/PUT terminal
    │   ├── checkout/
    │   │   └── route.ts           # POST transaction
    │   ├── transactions/
    │   │   └── route.ts           # GET transactions
    │   ├── drawer/
    │   │   ├── route.ts           # GET drawer
    │   │   └── reconcile/
    │   │       └── route.ts       # POST reconciliation
    │   └── refund/
    │       └── route.ts           # POST refund
    ├── login/
    │   └── route.ts               # POST cashier login
    └── offline-queue/
        └── route.ts               # POST sync offline orders
```

---

## Integration Points

### API Endpoints

```typescript
// Order Creation
POST /api/orders
{
  customerId: string
  items: Array<{
    productId: string
    productType: string
    productName: string
    departmentCode: string
    quantity: number
    unitPrice: number
  }>
  discounts?: string[]
  notes?: string
}

// Apply Discount
POST /api/orders/[id]/discounts
{
  discountCode: string
  discountType: 'percentage' | 'fixed' | 'employee' | 'bulk'
  discountAmount?: number
}

// Record Payment
POST /api/orders/[id]/payments
{
  amount: number
  paymentMethod: 'cash' | 'card' | 'check'
  reference?: string
}

// Process Refund
POST /api/pos-terminals/[id]/refund
{
  orderId: string
  amount: number
  reason: string
  managerId?: string
}

// Inventory Check
GET /api/inventory?category=drinks&lowStock=false

// Sync Offline Orders
POST /api/pos-terminals/offline-queue
{
  transactions: Array<OfflineTransaction>
}
```

---

## Implementation Phases

### Phase 1: Core Checkout (Week 1-2)
- ✅ Category & product selection
- ✅ Shopping cart
- ✅ Payment processing
- ✅ Receipt generation

### Phase 2: Advanced Features (Week 3)
- ✅ Discount & promo codes
- ✅ Refund & void operations
- ✅ Multiple payment methods
- ✅ Drawer management

### Phase 3: Management (Week 4)
- ✅ Terminal status dashboard
- ✅ Transaction history
- ✅ Cashier login/shifts
- ✅ Offline transaction queue

### Phase 4: Analytics (Week 5)
- ✅ Sales reports
- ✅ Revenue by category/department
- ✅ Cashier performance
- ✅ Real-time dashboards

---

## Summary

This POS Terminal UI Specification provides:

✅ **Complete checkout flow** - From item selection to receipt  
✅ **Payment processing** - Multiple methods with validation  
✅ **Discount system** - Promo codes, employee discounts  
✅ **Refund handling** - Full/partial refunds with approval workflow  
✅ **Terminal management** - Status, configuration, transactions  
✅ **Cashier operations** - Login, shifts, drawer reconciliation  
✅ **Offline support** - Queue transactions when disconnected  
✅ **Reporting** - Sales analytics and performance metrics  

**All components integrate with existing backend APIs** (Orders, Payments, Discounts, Departments, Inventory)

**Status**: ✅ Ready for Implementation  
**Estimated Duration**: 5 weeks for full implementation

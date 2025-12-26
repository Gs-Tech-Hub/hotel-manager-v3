# Order Fulfillment & Payment System Implementation

## Overview
This document describes the implementation of proper order fulfillment and payment tracking to ensure only fulfilled orders are recorded as sold, with payment status determining visibility and availability for refunds.

## Key Changes

### 1. **Section Service (`src/services/section.service.ts`)**

**Change:** Updated `getProducts()` method to filter "sold" items by both fulfillment status AND payment status.

**Before:**
```typescript
const soldGroups = await prisma.orderLine.groupBy({
  by: ['productId'],
  where: {
    productId: { in: allPossibleIds },
    OR: [ { orderHeader: { status: { in: ['completed', 'fulfilled'] } } }, { status: 'fulfilled' } ],
  },
  _sum: { quantity: true, lineTotal: true },
})
```

**After:**
```typescript
const soldGroups = await prisma.orderLine.groupBy({
  by: ['productId'],
  where: {
    productId: { in: allPossibleIds },
    status: 'fulfilled',
    orderHeader: { 
      status: { in: ['fulfilled', 'completed'] },
      paymentStatus: { in: ['paid', 'partial'] }
    },
  },
  _sum: { quantity: true, lineTotal: true },
})
```

**Applies to:**
- Drink items (lines 56-80)
- Food items (lines 119-143)
- Inventory items (lines 228-252)

**Impact:** Products now only show as sold when:
1. Order line status is `fulfilled`
2. Order header status is `fulfilled` or `completed`
3. Payment status is `paid` or `partial` (payment was made)

---

### 2. **Department Service (`src/services/department.service.ts`)**

**Change:** Updated `recalculateSectionStats()` to include payment status in amount calculation.

**Before:**
```typescript
const amountRes: any = await client.orderLine.aggregate({ 
  _sum: { lineTotal: true }, 
  where: { departmentCode, status: { in: ['fulfilled', 'completed'] } } 
});
```

**After:**
```typescript
const amountRes: any = await client.orderLine.aggregate({ 
  _sum: { lineTotal: true }, 
  where: { 
    departmentCode, 
    status: 'fulfilled', 
    orderHeader: { 
      status: { in: ['fulfilled', 'completed'] }, 
      paymentStatus: { in: ['paid', 'partial'] } 
    } 
  } 
});
```

**Impact:** Department statistics now accurately reflect only paid fulfilled orders in totalAmount calculations.

---

### 3. **Order Service (`src/services/order.service.ts`)**

#### 3a. Enhanced `cancelOrder()` Method

**Changes:**
- Only allows cancellation of **pending** orders
- Prevents cancellation of fulfilled/completed orders (must use refund instead)
- Cancels all order lines that haven't been fulfilled yet
- Returns clear error message if order status prevents cancellation

**Key Logic:**
```typescript
// Only allow cancellation of pending orders
if (order.status !== 'pending') {
  return errorResponse(ErrorCodes.VALIDATION_ERROR, 
    `Cannot cancel ${order.status} orders. Use refund for fulfilled orders with payment.`);
}
```

#### 3b. New `refundOrder()` Method

**Purpose:** Handle refunds for fulfilled orders with payment made

**Requirements:**
- Order must be `fulfilled` or `completed`
- Payment status must be `paid` or `partial`

**Process:**
1. Sets order status to `refunded`
2. Sets payment status to `refunded`
3. Updates all order lines to `refunded`
4. Updates order departments to `refunded`
5. Updates fulfillments to `refunded`
6. Updates order payments to `refunded`
7. Recalculates section stats (refunded items no longer count as sold)

**Key Logic:**
```typescript
// Only allow refunds for fulfilled orders with payment made
if (order.status !== 'fulfilled' && order.status !== 'completed') {
  return errorResponse(ErrorCodes.VALIDATION_ERROR, 
    `Cannot refund ${order.status} orders. Only fulfilled/completed orders can be refunded.`);
}

if (!['paid', 'partial'].includes(order.paymentStatus)) {
  return errorResponse(ErrorCodes.VALIDATION_ERROR, 
    `Order payment status is ${order.paymentStatus}. Only paid/partial orders can be refunded.`);
}
```

---

### 4. **New Refund API Endpoint (`app/api/orders/[id]/refund/route.ts`)**

**Endpoint:** `POST /api/orders/[id]/refund`

**Access:** Admin/Manager only

**Request Body:**
```json
{
  "reason": "Optional refund reason"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Order refunded successfully"
  }
}
```

**Error Responses:**
- `400` - Invalid order status (not fulfilled/completed) or payment status (not paid/partial)
- `401` - Not authenticated
- `403` - Insufficient permissions (not admin/manager)
- `404` - Order not found
- `500` - Internal error

---

## Order Status Flow

### Pending Order → Fulfilled → Paid (with refund capability)

```
PENDING ORDERS:
- Can be cancelled
- Does NOT count as sold
- No amountSold shown

↓ (Fulfill)

FULFILLED ORDERS (Unpaid):
- Cannot be cancelled
- Can still be refunded
- Does NOT count as sold (payment not made)
- No amountSold shown

↓ (Process Payment)

FULFILLED + PAID:
- Cannot be cancelled
- CAN be refunded
- COUNTS as sold
- amountSold displayed

↓ (Optional Refund)

REFUNDED:
- No longer counts as sold
- amountSold removed from totals
- Refund recorded in system
```

---

## Database Queries Affected

### Sold Items Calculation
**File:** `section.service.ts` - `getProducts()`
- Filters by: `status: 'fulfilled'` + `orderHeader.status: ['fulfilled', 'completed']` + `orderHeader.paymentStatus: ['paid', 'partial']`
- Returns: `unitsSold`, `amountSold` only for items meeting all criteria

### Department Statistics
**File:** `department.service.ts` - `recalculateSectionStats()`
- Filters by: `status: 'fulfilled'` + `orderHeader.status: ['fulfilled', 'completed']` + `orderHeader.paymentStatus: ['paid', 'partial']`
- Aggregates: `totalAmount` (sum of lineTotal)

### Pending Items (for kitchen display)
**File:** `department.service.ts` - `getDepartmentPendingItems()`
- Unchanged: Still shows `pending` and `processing` items
- Useful for KDS (Kitchen Display System) operations

---

## UI/Display Implications

### Department Section Details Page
- **Units Sold:** Only shows count from fulfilled + paid orders
- **Amount Sold:** Only shows revenue from fulfilled + paid orders
- **Pending Quantity:** Shows items in pending/processing status (can still be cancelled)

### Order Management
- **Cancel Button:** Available for `pending` orders only
- **Refund Button:** Available for `fulfilled` or `completed` orders with `paid`/`partial` payment
- Status badges will show clear distinction between pending/fulfilled/refunded

---

## Testing Scenarios

### Scenario 1: Cancel Pending Order
1. Create order (status: `pending`)
2. Hit DELETE `/api/orders/[id]`
3. Order marked as `cancelled`
4. Inventory reservations released
5. Stats recalculated (nothing counted as sold)

### Scenario 2: Fulfill & Pay Order
1. Create order (status: `pending`)
2. Update status to `fulfilled`
3. Record payment (paymentStatus: `paid`)
4. Order now counts in **Units Sold** and **Amount Sold**
5. Department stats updated

### Scenario 3: Refund Paid Order
1. Order is `fulfilled` with `paid` payment
2. Hit POST `/api/orders/[id]/refund`
3. Order status: `refunded`, paymentStatus: `refunded`
4. Items removed from **Units Sold** and **Amount Sold**
5. Department stats recalculated

### Scenario 4: Try to Cancel Fulfilled Order
1. Order status: `fulfilled`
2. Hit DELETE `/api/orders/[id]`
3. Error: "Cannot cancel fulfilled orders. Use refund for fulfilled orders with payment."
4. Must use refund endpoint instead

---

## Payment Status Values

From `prisma/schema.prisma` OrderHeader model:
- `unpaid` - Default, no payment received
- `paid` - Full payment received
- `partial` - Partial payment received
- `refunded` - Payment refunded

Only `paid` and `partial` count as payment made for "sold" reporting.

---

## Summary of Changes

| Component | Change | Impact |
|-----------|--------|--------|
| `section.service.ts` | Add payment status filter to sold items | Accurate sold counts in section details |
| `department.service.ts` | Add payment status filter to amount aggregation | Correct revenue reporting |
| `order.service.ts` | Restrict cancel to pending orders only | Prevent cancelling fulfilled orders |
| `order.service.ts` | Add new refundOrder() method | Handle refunds for paid orders |
| `api/orders/[id]/refund` | New POST endpoint | Enable refund operations |
| `api/orders/[id]` | Updated DELETE error handling | Clear error for invalid cancellations |

---

## Configuration & Deployment

No environment variables or configuration changes required. This is a logical business rule implementation using existing database schema fields.

**Database:** No migration required - all fields exist in current schema
**Dependencies:** No new dependencies added
**Backward Compatibility:** Fully backward compatible - existing orders unaffected


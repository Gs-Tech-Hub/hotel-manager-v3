# 🍽️ POS Checkout & Order Management - Implementation Plan

**Date**: December 17, 2025  
**Scope**: Address permission errors, inventory validation, and deferred payment orders  
**Target Roles**: Restaurant & Bar staff with limited permissions

---

## 📋 Executive Summary

The Hotel Manager v3 POS system requires three critical fixes:

1. **Permission Errors** - "Order failed: Insufficient permissions to create orders" 
   - Current: Only admin/manager roles have `orders.create` permission
   - Issue: Staff/cashier users at terminals cannot create orders
   - Fix: Seed `orders.create` permission for cashier/staff roles

2. **Stock Validation** - Orders can exceed available inventory
   - Current: POS accepts items without checking stock
   - Issue: Can oversell inventory, leading to fulfillment failures
   - Fix: Validate stock before adding to cart and at payment time

3. **Deferred Payment Orders** - Restaurant/Bar orders need flexible payment model
   - Current: POS requires immediate payment (one-step checkout)
   - Issue: Restaurant/Bar staff need to: add items → send to kitchen → settle payment later
   - Fix: Implement "open order" system with order status tracking

---

## 🔐 Issue 1: Permission Error - "Insufficient permissions to create orders"

### Root Cause Analysis

**File**: `app/api/orders/route.ts` (lines 56-61)
```typescript
const canCreate = await checkPermission(permCtx, 'orders.create', 'orders');
if (!canCreate) {
  return NextResponse.json(
    errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions to create orders'),
    { status: getStatusCode(ErrorCodes.FORBIDDEN) }
  );
}
```

**Seeded Permissions** (`scripts/seed-permissions.ts`):
- **admin**: `orders.create` ✓
- **manager**: `orders.create` ✓
- **employee**: `orders.read` only ✗

### Solution

**1. Identify Role Requirements**
| Role | Should Create Orders | Current Permission |
|------|----------------------|-------------------|
| admin | Yes | ✓ orders.create |
| manager | Yes | ✓ orders.create |
| cashier/staff | Yes | ✗ Missing |
| employee | Maybe (depends on context) | ✗ Missing |
| front-desk | No | - |
| kitchen | No (only fulfills) | - |

**2. Update Permission Seeds**

File: `scripts/seed-permissions.ts` - Update `cashier` and `staff` role definitions:

```typescript
cashier: [
  // Orders (full CRUD for checkout)
  { action: "orders.read", subject: "orders", description: "View orders" },
  { action: "orders.create", subject: "orders", description: "Create orders" },
  { action: "orders.update", subject: "orders", description: "Update orders" },
  
  // Inventory (read only)
  { action: "inventory.read", subject: "inventory", description: "View inventory" },
  
  // Payments
  { action: "payments.process", subject: "payments", description: "Process payments" },
  { action: "payments.refund", subject: "payments", description: "Process refunds" },
  
  // Departments
  { action: "departments.read", subject: "departments", description: "View departments" },
],

staff: [
  // Orders (read + create for restaurant/bar)
  { action: "orders.read", subject: "orders", description: "View orders" },
  { action: "orders.create", subject: "orders", description: "Create orders" },
  
  // Inventory (read only for menu)
  { action: "inventory.read", subject: "inventory", description: "View inventory" },
  
  // Departments (read only)
  { action: "departments.read", subject: "departments", description: "View departments" },
],
```

**3. Seed Script Execution**
```bash
npm run seed:permissions
```

---

## 📦 Issue 2: Stock Validation - Prevent Overselling

### Root Cause Analysis

**Current Flow**:
```
POS Checkout Load Products
  ↓
GET /api/departments/{code}/menu
  ↓
Returns all items with "available" quantity
  ↓
User adds to cart (NO VALIDATION)
  ↓
User clicks "Proceed to Payment"
  ↓
POST /api/orders (NO STOCK CHECK)
  ↓
OrderService.createOrder() (LATE VALIDATION - if checked at all)
```

**Issue**: Multiple orders can be created simultaneously from different terminals, all unaware of each other's stock deductions.

### Solution Architecture

**1. Real-Time Stock Service Integration**

Leverage existing `StockService` (`src/services/stock.service.ts`):
```typescript
// Single source of truth for all inventory balances
class StockService {
  async checkAvailability(
    productType: string,
    productId: string,
    departmentId: string,
    requiredQuantity: number,
    sectionId?: string | null
  ): Promise<{ hasStock: boolean; available: number; required: number }>
}
```

**2. Three Validation Points**

#### Point A: Product Grid Load (Display)
```
GET /api/departments/{code}/menu
  ↓
Service queries DepartmentInventory via StockService
  ↓
Returns real-time availability
  ↓
Display shows current stock
```

#### Point B: Add to Cart (Client-Side)
```
User clicks "Add to Cart" for item with quantity X
  ↓
Client checks: currentCart.quantity + X <= displayed.available?
  ↓
If NO: Show error "Only {available} in stock"
  ↓
If YES: Add to cart
```

#### Point C: Payment (Server-Side - CRITICAL)
```
User clicks "Proceed to Payment"
  ↓
POST /api/orders with full cart
  ↓
OrderService validates EACH item:
  FOR each cartItem:
    StockService.checkAvailability(
      productType, productId, departmentId, 
      cartItem.quantity, sectionId
    )
    IF NOT available:
      REJECT entire order with clear message
  ↓
If ALL items available:
  Create order + deduct stock atomically
```

**3. Implementation Changes**

### File: `components/admin/pos/pos-checkout.tsx`

**Add to handleAdd()** - Client-side quantity validation:
```typescript
const handleAdd = (p: POSProduct) => {
  const existing = cart.find((c) => c.productId === p.id)
  const totalQty = (existing?.quantity ?? 0) + 1
  
  // Validate against available stock
  if (totalQty > p.available) {
    setTerminalError(`Only ${p.available} of ${p.name} available`)
    return
  }
  
  if (existing) {
    setCart((s) => s.map((l) => 
      l.productId === p.id ? { ...l, quantity: totalQty } : l
    ))
    return
  }
  
  setCart((s) => [
    ...s,
    { lineId: Math.random().toString(36).slice(2), productId: p.id, productName: p.name, quantity: 1, unitPrice: p.price },
  ])
}
```

**Update handleQty()** - Quantity update validation:
```typescript
const handleQty = (lineId: string, qty: number) => {
  const cartItem = cart.find((c) => c.lineId === lineId)
  if (!cartItem) return
  
  const product = products.find((p) => p.id === cartItem.productId)
  if (!product) return
  
  // Validate against available stock
  const newQty = Math.max(1, qty)
  if (newQty > product.available) {
    setTerminalError(`Only ${product.available} of ${product.name} available`)
    return
  }
  
  setCart((s) => s.map((l) => 
    l.lineId === lineId ? { ...l, quantity: newQty } : l
  ))
}
```

### File: `src/services/order.service.ts`

**Add validation before order creation**:
```typescript
async createOrder(
  data: {
    customerId: string
    items: OrderItemInput[]
    discounts?: string[]
    notes?: string
  },
  userWithRoles: any
): Promise<Order | ErrorResponse> {
  try {
    // VALIDATION STEP 1: Check stock availability for ALL items
    for (const item of data.items) {
      const availability = await stockService.checkAvailability(
        item.productType,      // 'drink', 'inventoryItem', etc.
        item.productId,
        departmentId,          // derived from departmentCode
        item.quantity,
        sectionId              // optional
      )
      
      if (!availability.hasStock) {
        return errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          `Insufficient stock for ${item.productName}: ` +
          `have ${availability.available}, need ${availability.required}`
        )
      }
    }
    
    // VALIDATION STEP 2: Check order amount (if configured)
    // ... validate minimum order amount, etc.
    
    // STEP 3: Create order in database
    const order = await prisma.order.create({ ... })
    
    // STEP 4: Deduct inventory (MUST be atomic)
    for (const item of data.items) {
      await stockService.deductInventory(
        item.productType,
        item.productId,
        departmentId,
        item.quantity,
        order.id  // reference for audit trail
      )
    }
    
    return order
  } catch (err) {
    // ... error handling
  }
}
```

---

## 💳 Issue 3: Deferred Payment Orders - Restaurant/Bar Model

### Current State vs. Required State

**Current (Immediate Payment)**:
```
Order Created → Payment Recorded → Order Complete
     (1 step)        (atomic)
```

**Required (Deferred Payment)**:
```
Step 1: Order Created (status: PENDING, totalDue)
Step 2: Items sent to kitchen
Step 3: Items prepared & fulfilled (status: PREPARED)
Step 4: Diner finishes eating
Step 5: Customer requests check
Step 6: Payment made (status: PAID, totalPaid)
Step 7: Order Complete (status: COMPLETED)
```

### Order Status Flow

```
PENDING (items added, waiting for kitchen)
  ↓
CONFIRMED (kitchen acknowledged)
  ↓
PREPARED (kitchen completed prep)
  ↓
READY_FOR_PAYMENT (payment not yet made)
  ↓
PAID (payment recorded)
  ↓
COMPLETED (fulfillment complete)
  ↓
CANCELLED (at any point)
```

### Implementation Architecture

**1. Update Order Schema** (`prisma/schema.prisma`)

Already in place per schema. Verify:
```prisma
model Order {
  id              String
  customerId      String
  items           OrderItem[]
  
  // Payment fields
  subtotal        BigInt      // in cents
  discountTotal   BigInt
  taxAmount       BigInt
  totalAmount     BigInt
  
  // Payment tracking
  payments        Payment[]
  totalPaid       BigInt      @default(0)
  paymentStatus   String      @default("unpaid")  // unpaid, partial, paid
  
  // Status
  status          String      @default("pending")
  
  createdAt       DateTime
  updatedAt       DateTime
  notes           String?
}

model Payment {
  id              String
  orderId         String
  amount          BigInt
  method          String      // cash, card, etc.
  reference       String?
  createdAt       DateTime
  updatedAt       DateTime
}
```

**2. POS Checkout Flow - Two Modes**

#### Mode A: Immediate Payment (Current)
```
User selects items
  ↓
User clicks "Checkout"
  ↓
Payment dialog appears
  ↓
Payment processed
  ↓
Order completed immediately
```

#### Mode B: Deferred Payment (New - Restaurant/Bar Default)
```
User selects items
  ↓
User clicks "Send Order"
  ↓
Order created in PENDING status (NO payment required)
  ↓
Items sent to kitchen via order status
  ↓
Staff can view "Open Orders" dashboard
  ↓
When customer ready: Click "Prepare Check" on order
  ↓
Payment dialog appears
  ↓
Payment recorded
  ↓
Order moves to COMPLETED
```

**3. New Components Required**

### Component A: Open Orders Panel

**File**: `components/admin/pos/open-orders-panel.tsx`

```typescript
export function OpenOrdersPanel({ 
  terminalId: string,
  departmentCode: string 
}) {
  // Displays all orders in: PENDING, CONFIRMED, PREPARED, READY_FOR_PAYMENT
  // Shows: Order #, Items, Time Open, Total Due, Actions (View, Prepare Check, Cancel)
}
```

### Component B: Order Details Modal

**File**: `components/admin/pos/order-details-modal.tsx`

```typescript
export function OrderDetailsModal({
  orderId: string,
  onPayment: (amount) => void,
  onClose: () => void
}) {
  // Shows full order details
  // Items breakdown, totals, applied discounts
  // Payment button (if not paid)
  // Cancel button (if allowed)
}
```

**4. Updated POS Checkout Component**

### File: `components/admin/pos/pos-checkout.tsx` (REVISED)

**Add mode selection**:
```typescript
const [paymentMode, setPaymentMode] = useState<'immediate' | 'deferred'>('deferred')

// Based on department type
useEffect(() => {
  if (departmentSection?.departmentName === 'Restaurant' || 
      departmentSection?.departmentName === 'Bar') {
    setPaymentMode('deferred')  // Default for restaurant/bar
  } else {
    setPaymentMode('immediate')  // Default for retail
  }
}, [departmentSection])
```

**Update "Proceed to Payment" button**:
```typescript
{paymentMode === 'immediate' ? (
  <button onClick={() => setShowPayment(true)} disabled={cart.length === 0}>
    Checkout
  </button>
) : (
  <button onClick={handleCreateOrder} disabled={cart.length === 0}>
    Send Order to Kitchen
  </button>
)}
```

**New handler for deferred payment**:
```typescript
const handleCreateOrder = async () => {
  try {
    if (!departmentSection?.departmentCode) {
      setTerminalError('No section selected')
      return
    }

    // Build items
    const items = cart.map((c) => ({
      productId: c.productId,
      productType: (c as any).type || 'inventory',
      productName: c.productName,
      departmentCode: departmentSection.departmentCode,
      quantity: c.quantity,
      unitPrice: c.unitPrice,
    }))

    // Create order WITHOUT payment (paymentMode=deferred, payment=null)
    const payload = {
      items,
      discounts: appliedDiscountCodes,
      notes: `Order - ${departmentSection.name}`,
      payment: null,  // Signal: no payment now, order is open
    }

    const res = await fetch('/api/orders', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const json = await res.json()
    if (res.ok && json.success && json.data) {
      // Order created successfully in PENDING status
      // Show confirmation and reset cart
      setReceipt(json.data)  // Show receipt with order #
      setCart([])
      setAppliedDiscountCodes([])
      
      // Optionally show open orders list
      setSummaryRefreshKey((k) => k + 1)
    } else {
      const msg = json?.error?.message || `Failed to create order`
      setTerminalError(`Order failed: ${msg}`)
    }
  } catch (err) {
    console.error('Error creating order:', err)
    setTerminalError('Network error')
  }
}
```

**5. Order Management API Updates**

### File: `app/api/orders/route.ts` (Update POST handler)

```typescript
export async function POST(request: NextRequest) {
  // ... existing auth/permission checks ...
  
  const body = await request.json()
  const { payment, ...orderData } = body
  
  // NEW: Check if payment is null or empty → Create OPEN order
  const isOpenOrder = !payment || Object.keys(payment).length === 0
  
  if (!isOpenOrder) {
    // EXISTING: Immediate payment flow
    // ... existing code for payment processing ...
  }
  
  // NEW: Open order flow
  if (isOpenOrder) {
    // Create order with status PENDING (no payment yet)
    // Don't record any payment
  }
}
```

### File: `app/api/orders/[id]/payment/route.ts` (NEW)

```typescript
/**
 * POST /api/orders/{id}/payment
 * Record payment for an open order
 * 
 * Body: { amount, paymentMethod, transactionReference }
 */
export async function POST(request: NextRequest, { params }: any) {
  try {
    const ctx = await extractUserContext(request)
    // ... auth checks ...
    
    const orderId = params.id
    const body = await request.json()
    
    // Use OrderService to record payment
    const result = await orderService.recordPayment(
      orderId,
      {
        amount: body.amount,
        paymentMethod: body.paymentMethod,
        transactionReference: body.transactionReference,
      },
      userWithRoles
    )
    
    // Return updated order
    return NextResponse.json(successResponse(result))
  } catch (err) {
    // ... error handling ...
  }
}
```

### File: `app/api/orders?status=open/route.ts` (NEW or Update GET)

```typescript
/**
 * GET /api/orders?status=pending,prepared&departmentId={id}
 * List open orders for a terminal/department
 */
export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get('status')?.split(',') || [
    'pending', 'confirmed', 'prepared', 'ready_for_payment'
  ]
  const departmentId = request.nextUrl.searchParams.get('departmentId')
  
  const orders = await prisma.order.findMany({
    where: {
      status: { in: status },
      items: {
        some: {
          departmentCode: departmentId
        }
      }
    },
    include: {
      items: true,
      payments: true,
      customer: true,
    },
    orderBy: { createdAt: 'desc' }
  })
  
  return NextResponse.json(successResponse(orders))
}
```

---

## 🎯 Implementation Roadmap

### Phase 1: Permission Fix (30 minutes)
- [ ] Update `scripts/seed-permissions.ts` with `cashier` and `staff` roles
- [ ] Run `npm run seed:permissions`
- [ ] Test POS checkout with staff user → should no longer get permission error

### Phase 2: Stock Validation (2-3 hours)
- [ ] Update `components/admin/pos/pos-checkout.tsx`:
  - Add client-side validation in `handleAdd()` and `handleQty()`
  - Display available stock limits
- [ ] Update `src/services/order.service.ts`:
  - Add stock availability check before order creation
  - Atomic inventory deduction after order creation
- [ ] Test: Attempt to order more than available → should fail with clear message

### Phase 3: Deferred Payment (3-4 hours)
- [ ] Add mode selection to `pos-checkout.tsx`
- [ ] Implement deferred order creation (`handleCreateOrder`)
- [ ] Create `open-orders-panel.tsx` component
- [ ] Create `order-details-modal.tsx` component
- [ ] Add payment endpoint: `POST /api/orders/[id]/payment`
- [ ] Add open orders list endpoint: `GET /api/orders?status=...`
- [ ] Update receipt component to show order # for open orders
- [ ] Test full flow: Create order → View in open orders → Pay → Complete

---

## 📊 Testing Checklist

### Test 1: Permission Error Fix
```
Login as staff/cashier user
Navigate to POS terminal
Add item to cart
Click "Send Order" (or "Checkout")
Expected: Order created (no permission error)
```

### Test 2: Stock Validation
```
Setup: Inventory item with 5 units available
Test A (Client-side): Click "Add" 6 times
Expected: 6th click blocked with "Only 5 available"

Test B (Server-side): 
  - Open 2 terminals simultaneously
  - Terminal 1: Order 5 units (succeeds, inventory depletes)
  - Terminal 2: Order 3 units (fails with insufficient stock error)
  
Expected: Terminal 2 rejected
```

### Test 3: Deferred Payment
```
Setup: Restaurant department
Test A (Create open order):
  Add items to cart
  Click "Send Order to Kitchen"
  Expected: Order created, shows in open orders list, status = PENDING

Test B (Pay open order):
  Open order detail
  Click "Prepare Check"
  Enter payment info
  Click "Complete Payment"
  Expected: Order moves to PAID status, then COMPLETED

Test C (Cancel open order):
  Click "Cancel" on open order
  Expected: Order status = CANCELLED, inventory returned
```

---

## 🔄 Integration Points

### Services Used
- `OrderService` - Order creation, payment recording
- `StockService` - Inventory availability checking
- `DiscountService` - Discount validation
- `PaymentService` - Payment processing

### Existing Components Extended
- `POSCheckoutShell` - Add mode switching + validation
- `POSCart` - Show stock warnings
- `POSPayment` - Handle deferred vs immediate

### New Database Queries
- `Order.findMany({ status: {...} })` - Open orders list
- `Payment.create()` - Record deferred payment
- `DepartmentInventory` - Real-time stock checks

---

## 🚀 Success Criteria

✅ **Permission Fixed**
- Staff/cashier users can create orders without permission error

✅ **Stock Validation**
- Cannot add more items than available to cart
- Cannot submit order exceeding available inventory
- Stock correctly shows across multiple terminals simultaneously

✅ **Deferred Payment**
- Orders can be created without immediate payment
- Open orders visible on dashboard with status/time
- Payment can be recorded later
- Order status progresses: PENDING → PREPARED → PAID → COMPLETED

---

## 📝 Notes & Considerations

1. **Atomic Transactions**: Stock deduction MUST be atomic with order creation to prevent race conditions
2. **Permission Seeding**: Must run `seed:permissions` before testing staff checkout
3. **Kitchen Display**: May need separate kitchen dashboard to show orders being prepared
4. **Order Timing**: Track order creation time for reporting (how long orders sat open)
5. **Audit Trail**: All order status changes should be logged for compliance
6. **Section vs Department**: Ensure `sectionId` passed correctly for fine-grained inventory tracking


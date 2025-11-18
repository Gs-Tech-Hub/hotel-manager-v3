# Enhanced Order System - Implementation Outline

## 1. Core Architecture

### 1.1 Order Domain Model
- **OrderHeader**: Master record (customer, department, status, totals)
- **OrderLine**: Line items with quantity, unit, discount, pricing
- **OrderDepartment**: Routing & fulfillment tracking (bar, restaurant, gym, booking)
- **OrderDiscount**: Applied discounts (employee, promo, special)
- **OrderPayment**: Payment tracking & settlement
- **OrderFulfillment**: Status tracking (pending → fulfilled → completed)

### 1.2 Department Types
### All 8 Explicit Departments
1. **HOTEL_BOOKING** (code: `hotel_booking`)
  - Room reservations, checkins/checkouts
  - Related: Room, Booking models
  - Inventory: None (service-based)
  - Tracking: Booking status

2. **RESTAURANT** (code: `restaurant`)
  - Food item orders, menu management
  - Related: FoodItem, MenuCategory, Restaurant models
  - Inventory: FoodItem (deduct on order)
  - Tracking: Active/completed orders, revenue

3. **BAR_CLUB** (code: `bar_club`)
  - Drink orders, happy hours, entry fees
  - Related: Drink, DrinkType, BarAndClub models
  - Inventory: Drink (deduct on order)
  - Tracking: Active/completed orders, revenue, debt

4. **GYM_MEMBERSHIP** (code: `gym_membership`)
  - Gym membership sales, session bookings
  - Related: GymMembership, MembershipPlan, GymAndSport models
  - Inventory: None (membership-based)
  - Tracking: Membership expiry, active status

5. **SPORT_MEMBERSHIP** (code: `sport_membership`)
  - Sport/fitness membership sales
  - Related: SportMembership, GymAndSport models
  - Inventory: None (membership-based)
  - Tracking: Membership expiry, active status

6. **HOTEL_SERVICE** (code: `hotel_service`)
  - Laundry, room service, amenities, spa services
  - Related: HotelService model
  - Inventory: May use supplies from InventoryItem
  - Tracking: Service completion, revenue

7. **GAMES_ENTERTAINMENT** (code: `games_entertainment`)
  - Game credits, entertainment packages, activities
  - Related: Game model
  - Inventory: None (credit-based)
  - Tracking: Amount paid, amount owed, game status

8. **EMPLOYEE_ORDER** (code: `employee_order`)
  - Employee purchases, discounts, debt tracking
  - Related: EmployeeOrder, EmployeeRecord models
  - Inventory: May use from any department
  - Tracking: Employee debt, salary adjustments, fines

---

## 2. Database Schema Changes

### New Models
```
OrderHeader (master)
├── OrderLine (items)
├── OrderDepartment (routing)
├── OrderDiscount (discounts)
├── OrderPayment (payments)
├── OrderFulfillment (status)
└── OrderInventoryAllocation (reserved inventory)

DiscountRule (promo codes, employee discounts)
Employee (enhanced for discount eligibility)
DepartmentInventory (per-department stock)
```

### Enhanced Existing Models
- `Order`: Add department, discount tracking, fulfillment status
- `OrderItem`: Add unit price, discount amount, fulfillment status
- `Payment`: Add installment support, partial payments
- `Inventory`: Add department allocation, reservation system

---

## 3. Key Features

### 3.1 Order Management
- [ ] Create multi-line orders with automatic line numbering
- [ ] Validate inventory availability per department
- [ ] Calculate totals with automatic tax/VAT
- [ ] Apply multiple discount types (employee, promo, bulk)
- [ ] Real-time order status tracking
- [ ] Batch order operations

### 3.2 Department Routing
- [ ] Auto-route to correct department based on item type
- [ ] Track fulfillment status per department
- [ ] Department-specific workflows
- [ ] Kitchen/bar display system integration ready

### 3.3 Inventory Management
- [ ] Atomic inventory transactions
- [ ] Per-department stock allocation
- [ ] Reservation system (hold inventory during order processing)
- [ ] Automatic reorder alerts
- [ ] Stock reconciliation

### 3.4 Discount Management
- [ ] Employee discounts (percentage-based, fixed)
- [ ] Promo codes (time-limited, usage limits)
- [ ] Bulk order discounts
- [ ] Tiered discounts
- [ ] Discount validation & conflict resolution

### 3.5 Payment & Fulfillment
- [ ] Multiple payment methods per order
- [ ] Partial payment support
- [ ] Installment plans
- [ ] Settlement tracking
- [ ] Fulfillment workflow with status transitions

---

## 4. Service Layer

### OrderService (Enhanced)
```typescript
// Order creation & management
createOrder(data, context)
updateOrder(id, data, context)
cancelOrder(id, reason, context)
getOrderById(id, context)
listOrders(filters, context)

// Line item operations
addLineItem(orderId, item, context)
removeLineItem(orderId, lineItemId, context)
updateLineItem(orderId, lineItemId, data, context)

// Discount operations
applyDiscount(orderId, discountId, context)
removeDiscount(orderId, discountId, context)
calculateTotalDiscount(orderId, context)

// Status & fulfillment
getOrderStatus(orderId, context)
transitionOrderStatus(orderId, newStatus, context)
getFulfillmentStatus(orderId, context)
markLineItemFulfilled(orderId, lineItemId, context)
```

### DiscountService
```typescript
validateDiscountCode(code, context)
getEmployeeDiscount(employeeId, context)
applyPromoCode(promoCode, orderId, context)
calculateDiscount(orderTotal, discountRule, context)
```

### DepartmentService
```typescript
routeOrderItem(item)
getDepartmentInventory(department)
trackDepartmentFulfillment(department)
getDepartmentOrders(department, filters, context)
```

### InventoryService (Enhanced)
```typescript
// Reservation system
reserveInventory(itemId, quantity, orderId)
releaseReservation(orderId)
confirmReservation(orderId)

// Stock management
deductStock(itemId, quantity, department)
restockItem(itemId, quantity, reason)
getStockByDepartment(itemId)
checkAvailability(itemId, quantity, department)
```

### PaymentService (Enhanced)
```typescript
// Multi-payment support
recordPayment(orderId, amount, method, context)
processRefund(orderId, amount, reason, context)
settleOrder(orderId, context)
getPaymentStatus(orderId, context)
setupInstallment(orderId, schedule, context)
```

---

## 5. API Endpoints

### Order CRUD
```
POST   /api/orders                    # Create order
GET    /api/orders                    # List orders (with filters)
GET    /api/orders/[id]               # Get order details
PUT    /api/orders/[id]               # Update order
DELETE /api/orders/[id]               # Cancel order
```

### Order Line Items
```
POST   /api/orders/[id]/items         # Add line item
PUT    /api/orders/[id]/items/[lineId] # Update line item
DELETE /api/orders/[id]/items/[lineId] # Remove line item
```

### Discounts
```
POST   /api/orders/[id]/discounts     # Apply discount
DELETE /api/orders/[id]/discounts/[discountId] # Remove discount
```

### Fulfillment
```
GET    /api/orders/[id]/fulfillment   # Get fulfillment status
PUT    /api/orders/[id]/fulfillment   # Update fulfillment
```

### Department-Specific
```
GET    /api/orders/department/[dept]  # List orders by department
PUT    /api/orders/[id]/route         # Change department routing
```

### Payments
```
POST   /api/orders/[id]/payments      # Record payment
GET    /api/orders/[id]/payments      # Get payment history
POST   /api/orders/[id]/refund        # Process refund
```

### Discounts & Codes
```
GET    /api/discounts                 # List discount rules
POST   /api/discounts                 # Create discount rule
GET    /api/discounts/validate/[code] # Validate promo code
```

### Inventory & Stock
```
GET    /api/inventory/stock/[itemId]  # Get stock by department
POST   /api/inventory/reserve         # Reserve items
POST   /api/inventory/release         # Release reservation
```

---

## 6. Request/Response Models

### CreateOrderRequest
```typescript
{
  customerId: string
  departmentId?: string  // Auto-determined from items
  items: [{
    productId: string
    quantity: number
    unitPrice: number
    departmentId?: string  // Can override
  }]
  discounts?: string[]    // Promo codes/rule IDs
  notes?: string
}
```

### OrderResponse
```typescript
{
  id: string
  orderNumber: string
  customerId: string
  department: string
  subtotal: number
  discount: { amount: number, rules: DiscountRule[] }
  tax: number
  total: number
  status: string  // pending, processing, fulfilled, completed
  fulfillment: {
    byDepartment: { [dept]: FulfillmentStatus }
    overall: FulfillmentStatus
  }
  payments: PaymentRecord[]
  items: OrderLineItem[]
  createdAt: Date
  updatedAt: Date
}
```

---

## 7. Business Logic & Rules

### Order Creation
1. Validate customer exists
2. Validate all items exist & are available
3. Check department routing for each item
4. Reserve inventory atomically
5. Create OrderHeader with pending status
6. Create OrderLines per item
7. Create OrderDepartment records
8. Apply discounts if provided

### Status Transitions
```
pending → processing → fulfilled → completed
              ↓ (if issue)
           on_hold → cancelled
```

### Discount Rules
- **Employee Discount**: 10-25% off (per employee tier)
- **Promo Code**: Custom % or fixed amount
- **Bulk Order**: Tiered discount at quantities
- **Conflict**: Use highest applicable discount

### Fulfillment Tracking
- Track per-department fulfillment
- Line item can be partially fulfilled
- Overall order complete when all lines fulfilled
- Department can confirm fulfillment independently

---

## 8. Implementation Phases

### Phase 1: Core Models & Schema
- [ ] Add new Prisma models
- [ ] Create migrations
- [ ] Update type definitions

### Phase 2: Service Layer
- [ ] Enhance OrderService
- [ ] Create DiscountService
- [ ] Enhance InventoryService
- [ ] Create DepartmentService

### Phase 3: API Routes
- [ ] Order CRUD endpoints
- [ ] Line item operations
- [ ] Discount application
- [ ] Fulfillment tracking

### Phase 4: Validation & Error Handling
- [ ] Input validation
- [ ] Business rule enforcement
- [ ] Atomic transactions
- [ ] Error recovery

### Phase 5: Testing & Optimization
- [ ] Unit tests for services
- [ ] Integration tests for workflows
- [ ] Performance optimization
- [ ] Edge case handling

---

## 9. Data Flow Examples

### Scenario 1: Restaurant Order with Employee Discount
```
1. Customer (waiter) creates order: 2 burgers, 1 salad
2. System identifies department: Restaurant
3. Inventory check: All items available
4. Apply employee discount: 15%
5. Calculate: Subtotal 500 → Discount 75 → Total 425
6. Create OrderHeader (pending)
7. Send to Kitchen (via department routing)
8. Kitchen marks fulfilled when ready
9. Waiter confirms payment
10. Order marked completed
```

### Scenario 2: Hotel Booking with Multiple Departments
```
1. Guest books: Room + Bar order + Gym pass
2. System auto-routes to 3 departments
3. Room dept: Reserve room, no inventory deduct
4. Bar dept: Reserve drinks from bar stock
5. Gym dept: Activate membership, no stock deduct
6. Payment split per department
7. Each dept tracks own fulfillment
8. Order complete when all depts fulfilled
```

### Scenario 3: Promo Code + Partial Payment
```
1. Order created: Total 1000
2. Apply promo code "SUMMER20": 200 off → 800
3. Customer pays 300 (partial)
4. Order status: pending_payment
5. Customer pays 500 more → 800 total
6. Status: payment_settled → processing
7. Fulfillment continues
```

---

## 10. Error Handling

### Validation Errors
- Invalid customer ID
- Product not found
- Insufficient inventory
- Invalid discount code
- Conflicting discounts

### Processing Errors
- Inventory allocation failed
- Department routing failed
- Payment processing failed
- Partial fulfillment conflicts

### Recovery Strategies
- Automatic rollback on failure
- Reservation cleanup on cancel
- Partial order handling
- Retry mechanisms

---

## 11. Security & Audit

### Authorization
- Customer can view/modify own orders only
- Staff can create/modify within department
- Manager can view/modify all
- Admin can override all

### Audit Trail
- Track order status changes
- Log discount applications
- Record payment transactions
- Track inventory movements

### Data Integrity
- Atomic transactions for all operations
- Inventory consistency checks
- Payment reconciliation
- Discount conflict prevention

---

## 12. Performance Considerations

- Index on: customerId, status, createdAt, department
- Pagination for list endpoints
- Lazy load related data
- Cache discount rules
- Batch inventory operations

---

## 13. File Structure

```
src/services/
├── order.service.ts (enhanced)
├── discount.service.ts (new)
├── department.service.ts (new)
├── inventory.service.ts (enhanced)
└── payment.service.ts (enhanced)

app/api/orders/
├── route.ts (list, create)
├── [id]/
│   ├── route.ts (get, update, delete)
│   ├── items/
│   │   └── route.ts (manage line items)
│   ├── discounts/
│   │   └── route.ts (manage discounts)
│   ├── fulfillment/
│   │   └── route.ts (track fulfillment)
│   └── payments/
│       └── route.ts (manage payments)
├── department/
│   └── [dept]/route.ts (dept-specific orders)
└── discounts/
    └── route.ts (discount rules)

src/types/
├── order.types.ts (new - order-specific types)
└── entities.ts (updated)

prisma/
└── schema.prisma (updated with new models)
```

---

## Summary

This robust order system provides:
✅ Multi-department order routing  
✅ Flexible discount management  
✅ Inventory allocation & reservation  
✅ Complete fulfillment tracking  
✅ Employee & promo discounts  
✅ Multi-payment support  
✅ Atomic transactions  
✅ Comprehensive audit trail  
✅ Scalable architecture  
✅ Easy to extend  

**Ready to implement in phases**

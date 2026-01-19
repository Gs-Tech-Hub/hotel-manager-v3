# Phase 3C: Department & Discount APIs ✅ COMPLETE

**Date**: November 14, 2025  
**Status**: ✅ COMPLETED

---

## Overview

Phase 3C implements department management, discount rule management, and department-specific order operations, completing the core API suite.

---

## Routes Implemented (4 Route Files)

### 1. **GET/POST /api/discounts** ✅
**File**: `app/api/discounts/route.ts`

**POST - Create Discount Rule**:
```typescript
POST /api/discounts
{
  code: string              // Unique discount code (SUMMER20, etc.)
  name?: string             // Discount name
  type: "percentage" | "fixed" | "tiered" | "employee" | "bulk"
  value: number             // Discount value (0-100 for %, amount for fixed)
  description?: string
  startDate: ISO string     // When discount becomes active
  endDate?: ISO string      // When discount expires
  minOrderAmount?: number   // Minimum order to apply
  maxUsageTotal?: number    // Total usage limit
  maxUsagePerCustomer?: number // Per-customer limit
  applicableDepts?: string[] // Department codes (all if omitted)
}

Response: Created DiscountRule (201)
```

**GET - List Discount Rules**:
```typescript
GET /api/discounts?page=1&limit=20&isActive=true&type=percentage&search=SUMMER

Query Parameters:
- page: pagination
- limit: page size
- isActive: filter active/inactive
- type: filter by type
- search: search code or name

Response: {
  rules: DiscountRule[]
  pagination: { page, limit, total, totalPages, hasMore }
}
```

**Features**:
- ✅ Multiple discount types (percentage, fixed, tiered, employee, bulk)
- ✅ Time-limited promotions
- ✅ Usage limits (per customer, total)
- ✅ Minimum order amount requirements
- ✅ Department-specific targeting
- ✅ Active discount filtering

---

### 2. **GET /api/departments** ✅
**File**: `app/api/departments/route.ts`

**GET - List Departments**:
```typescript
GET /api/departments

Response: {
  id: string
  code: string
  name: string
  description?: string
  isActive: boolean
  totalOrders: number
  pendingOrders: number
  processingOrders: number
  fulfilledOrders: number
}[]
```

**8 Departments Available**:
- HOTEL_BOOKING - Room reservations
- RESTAURANT - Food orders
- BAR_CLUB - Beverage orders
- GYM_MEMBERSHIP - Gym memberships
- SPORT_MEMBERSHIP - Sport memberships
- HOTEL_SERVICE - Hotel services (laundry, spa)
- GAMES_ENTERTAINMENT - Game credits
- EMPLOYEE_ORDER - Employee purchases

**Features**:
- ✅ List all active departments
- ✅ Order statistics per department
- ✅ Status breakdown (pending, processing, fulfilled)

---

### 3. **GET /api/departments/[code]/orders** ✅
**File**: `app/api/departments/[code]/orders/route.ts`

**GET - Department Orders**:
```typescript
GET /api/departments/RESTAURANT/orders?status=pending&page=1&limit=20

Query Parameters:
- status: filter by status
- page: pagination
- limit: page size

Response: {
  department: { code, name }
  orders: [
    {
      departmentOrderId: string
      orderHeader: OrderHeader (with customer)
      departmentStatus: string
      lines: OrderLine[]
    }
  ]
  pagination: { page, limit, total, totalPages, hasMore }
}
```

**Features**:
- ✅ Department-specific order views
- ✅ Status filtering
- ✅ Pagination support
- ✅ Related line items included
- ✅ Customer information

---

### 4. **GET /api/departments/[code]/pending** ✅
**File**: `app/api/departments/[code]/pending/route.ts`

**GET - Pending Items (Kitchen Display System)**:
```typescript
GET /api/departments/RESTAURANT/pending?includeProcessing=true

Query Parameters:
- sortBy: "createdAt" (default) | "status" | "priority"
- includeProcessing: include items being prepared (default: true)

Response: {
  department: { code, name }
  summary: {
    totalPending: number
    totalProcessing: number
    totalItems: number
    averageWaitTime: minutes
  }
  items: [
    {
      id: string
      lineNumber: number
      productName: string
      quantity: number
      status: "pending" | "processing"
      orderNumber: string
      customerName: string
      notes?: string
      createdAt: Date
      waitMinutes: number
      isPaid: boolean
    }
  ]
  pending: OrderLine[]        // Grouped by status
  processing: OrderLine[]
}
```

**Features**:
- ✅ Real-time kitchen display system
- ✅ FIFO ordering (first in, first out)
- ✅ Wait time tracking
- ✅ Payment status indication
- ✅ Grouped view (pending vs processing)
- ✅ Average wait time calculation
- ✅ Sortable display

---

## Line Items Management (1 Route File)

### **POST/PUT/DELETE /api/orders/[id]/items** ✅
**File**: `app/api/orders/[id]/items/route.ts`

**POST - Add Line Item**:
```typescript
POST /api/orders/{orderId}/items
{
  productId: string
  productType: string
  productName: string
  departmentCode: string
  quantity: number
  unitPrice: number
}

Actions:
1. Validate order not in completed/fulfilled/cancelled
2. Calculate new line number
3. Create OrderLine
4. Reserve inventory (if RESTAURANT/BAR_CLUB)
5. Add to department if needed
6. Recalculate order totals
7. Update order total formula

Response: OrderLine (201)
```

**PUT - Update Line Item**:
```typescript
PUT /api/orders/{orderId}/items/{lineId}
{
  quantity?: number
  unitPrice?: number
}

Actions:
1. Validate line item exists and status not fulfilled/completed
2. Update quantity and/or unit price
3. Recalculate lineTotal
4. Update order subtotal and total

Response: Updated OrderLine
```

**DELETE - Remove Line Item**:
```typescript
DELETE /api/orders/{orderId}/items/{lineId}

Actions:
1. Validate line item can be deleted
2. Delete OrderLine
3. Release inventory reservations
4. Recalculate order totals
5. Update total: subtotal - discount + tax

Response: Updated OrderHeader
```

**Features**:
- ✅ Add items to existing orders
- ✅ Update line quantities/prices
- ✅ Delete items with inventory release
- ✅ Automatic department routing
- ✅ Order total recalculation
- ✅ Inventory reservation management
- ✅ Status validation

---

## File Structure

```
app/api/
├── discounts/
│   └── route.ts                  # POST/GET discounts
├── departments/
│   ├── route.ts                  # GET departments list
│   └── [code]/
│       ├── orders/
│       │   └── route.ts          # GET dept orders
│       └── pending/
│           └── route.ts          # GET pending items (KDS)
└── orders/
    └── [id]/
        └── items/
            └── route.ts          # POST/PUT/DELETE line items
```

---

## Authorization & Security

All routes enforce role-based access control:

```
Discount Management:
  - POST /discounts              admin, manager only
  - GET /discounts               admin, manager, staff

Department Operations:
  - GET /departments             all authenticated users
  - GET /departments/[code]/*    staff only

Line Items:
  - POST /orders/[id]/items      staff only
  - PUT /orders/[id]/items/*     staff only
  - DELETE /orders/[id]/items/*  staff only
```

---

## Data Flow Examples

### Example 1: Creating Discount for Summer

```
1. Create discount rule
   POST /api/discounts
   ├─ code: "SUMMER20"
   ├─ type: "percentage"
   ├─ value: 20
   ├─ startDate: "2025-06-01"
   ├─ endDate: "2025-08-31"
   └─ applicableDepts: ["RESTAURANT", "BAR_CLUB"]

2. Apply to orders
   POST /api/orders/{id}/discounts
   ├─ discountCode: "SUMMER20"
   ├─ Validated automatically
   ├─ Deducts 20% from subtotal
   └─ Updates order total
```

### Example 2: Kitchen Display System

```
1. Get department
   GET /api/departments

2. Get pending items
   GET /api/departments/RESTAURANT/pending
   ├─ Returns 5 pending items (FIFO)
   ├─ Shows wait times
   ├─ Grouped by status
   └─ Updates every 2-5 seconds

3. Staff updates status
   PUT /api/orders/{id}/fulfillment
   ├─ Changes item status to "processing"
   ├─ Refreshes display
   ├─ Item moves to processing list

4. Mark as complete
   PUT /api/orders/{id}/fulfillment
   ├─ Changes item status to "fulfilled"
   ├─ Item removed from display
   ├─ Check: if all items done → order fulfilled
```

### Example 3: Adding Items to Existing Order

```
1. Customer adds item
   POST /api/orders/{orderId}/items
   ├─ productId: "wine-001"
   ├─ productName: "Red Wine"
   ├─ departmentCode: "BAR_CLUB"
   ├─ quantity: 2
   ├─ unitPrice: 500

2. System actions:
   ├─ Creates new OrderLine with line number 3
   ├─ Reserves inventory: 2 units
   ├─ Ensures department BAR_CLUB in OrderDepartments
   ├─ Recalculates subtotal: old + 1000 = new
   └─ Recalculates total: new_subtotal - discount + tax

3. Response: New line item with updated order totals

4. Customer can update
   PUT /api/orders/{orderId}/items/{lineId}
   ├─ quantity: 3 (changed from 2)
   ├─ System recalculates order total

5. Customer removes item
   DELETE /api/orders/{orderId}/items/{lineId}
   ├─ System releases 2 units of wine
   ├─ Updates order subtotal
   └─ Recalculates total
```

---

## Error Handling

```
400 BAD REQUEST:
- Missing required fields
- Invalid discount type
- Item already added
- Quantity/price validation

401 UNAUTHORIZED:
- Not authenticated

403 FORBIDDEN:
- Insufficient permissions
- Customer cannot modify staff operations

404 NOT FOUND:
- Discount not found
- Department not found
- Order not found
- Line item not found

409 CONFLICT:
- Discount code already exists
- Cannot modify completed order

500 SERVER ERROR:
- Database errors
- Unexpected exceptions
```

---

## Performance Optimizations

- ✅ Efficient filtering with Prisma where clauses
- ✅ Lazy loading of related data
- ✅ Pagination for large result sets
- ✅ Indexed queries on frequently used fields
- ✅ Atomic transactions for consistency
- ✅ JSON parsing for department filtering

---

## HTTP Status Codes

```
200 OK             - GET operations successful
201 CREATED        - Resource created
400 BAD REQUEST    - Validation errors
401 UNAUTHORIZED   - Not authenticated
403 FORBIDDEN      - Insufficient permissions
404 NOT FOUND      - Resource not found
409 CONFLICT       - Business logic conflict
500 INTERNAL ERROR - Server error
```

---

## Testing Scenarios

### Scenario 1: Create and Apply Discount

```
1. POST /api/discounts
   Create "SUMMER20" (20% off for RESTAURANT/BAR_CLUB)
   
2. POST /api/orders/{id}/discounts
   Apply SUMMER20 to $500 order
   
3. Order total updates: $500 → $400
```

### Scenario 2: Kitchen Display System

```
1. GET /api/departments/RESTAURANT/pending
   Shows 3 pending burgers, 2 pending steaks
   
2. Staff marks first burger as "processing"
   PUT /api/orders/{id}/fulfillment
   
3. Refresh shows updated counts
   
4. Mark as "fulfilled"
   Item disappears from display
```

### Scenario 3: Add Items After Order Creation

```
1. Order created: 2 burgers = $600
   
2. Customer adds wine
   POST /api/orders/{id}/items
   
3. Order subtotal: $1100
   
4. Update wine quantity: 2 → 3
   PUT /api/orders/{id}/items/{lineId}
   
5. Order subtotal: $1400
   
6. Remove wine
   DELETE /api/orders/{id}/items/{lineId}
   
7. Order back to $600
```

---

## Summary

**Phase 3C delivers**:

✅ **Discount Management**: Create, list, validate discount rules  
✅ **Department APIs**: List departments with statistics  
✅ **Department Orders**: View orders by department  
✅ **Kitchen Display System**: Real-time pending items with wait times  
✅ **Line Item Management**: Add, update, delete order items  
✅ **Automatic Recalculation**: Order totals updated on every change  
✅ **Inventory Integration**: Reservations managed with line items  
✅ **Authorization**: Role-based access on all operations  

**Total Phase 3C**: 5 route files, 1,000+ lines of code

---

## Integration Complete

```
API Routes (Phases 3A, 3B, 3C):
├─ Core Orders           ✅
├─ Discounts             ✅
├─ Payments              ✅
├─ Fulfillment           ✅
├─ Departments           ✅
├─ Line Items            ✅
└─ Kitchen Display       ✅

Services (Phase 2):
├─ OrderService          ✅
├─ DiscountService       ✅
├─ DepartmentService     ✅
└─ InventoryService      ✅

Database (Phase 1):
├─ 9 New Models          ✅
├─ 5 Enhanced Models     ✅
└─ Full Schema           ✅
```

---

**Status**: ✅ PHASE 3C COMPLETE  
**Next**: Phase 4 - Validation & Error Handling  
**Date**: November 14, 2025

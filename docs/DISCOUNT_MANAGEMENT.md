# Discount Management System Documentation

## Overview

The Hotel Manager v3 discount system provides comprehensive discount management capabilities including:

- **Multiple discount types**: percentage, fixed amount, tiered, employee, bulk
- **Time-based controls**: activation dates, expiration dates, upcoming promotions
- **Usage limits**: per-customer limits, global usage caps
- **Department-specific rules**: apply discounts to specific departments only
- **Real-time validation**: validate codes at checkout before applying
- **Post-checkout application**: apply discounts after order creation if needed
- **Audit trail**: track all discount applications

## Discount Model

All discounts are stored in the `DiscountRule` table with the following structure:

```typescript
{
  id: string              // Unique identifier
  code: string            // Unique discount code (e.g., "SUMMER2025")
  name: string            // Display name
  description?: string    // Optional description
  type: string            // "percentage" | "fixed" | "tiered" | "employee" | "bulk"
  value: Decimal          // Discount value (0-100 for percentage, cents for fixed)
  maxUsagePerCustomer?: number  // How many times one customer can use
  maxTotalUsage?: number   // Global usage limit
  currentUsage: number    // Current count of applications
  minOrderAmount?: number  // Minimum order total in cents to apply
  applicableDepts: JSON   // Array of department codes (empty = all departments)
  isActive: boolean       // Whether discount is currently usable
  startDate?: DateTime    // When discount becomes active
  endDate?: DateTime      // When discount expires
  createdAt: DateTime
  updatedAt: DateTime
}
```

## API Endpoints

### 1. Create Discount Rule
**POST** `/api/discounts`

Create a new discount rule (admin/manager only).

**Request:**
```json
{
  "code": "SUMMER2025",
  "name": "Summer Special",
  "description": "15% off all items",
  "type": "percentage",
  "value": 15,
  "minOrderAmount": 1000,
  "maxUsagePerCustomer": 5,
  "maxTotalUsage": 100,
  "applicableDepts": ["RESTAURANT", "BAR_CLUB"],
  "startDate": "2025-06-01T00:00:00Z",
  "endDate": "2025-08-31T23:59:59Z"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "clu...",
    "code": "SUMMER2025",
    "name": "Summer Special",
    ...
  }
}
```

### 2. List All Discounts
**GET** `/api/discounts`

List all discount rules with optional filtering.

**Query Parameters:**
- `isActive` (boolean) - Filter by active status
- `type` (string) - Filter by type (percentage, fixed, tiered, etc.)
- `page` (number) - Pagination page (default: 1)
- `limit` (number) - Results per page (default: 20)
- `search` (string) - Search in code or name

**Example:**
```bash
GET /api/discounts?isActive=true&type=percentage&page=1&limit=20
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "clu...",
      "code": "SUMMER2025",
      "name": "Summer Special",
      "type": "percentage",
      "value": 15,
      "isActive": true,
      ...
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "pages": 3
  }
}
```

### 3. Get Single Discount
**GET** `/api/discounts/[id]`

Get details for a specific discount rule.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "clu...",
    "code": "SUMMER2025",
    "name": "Summer Special",
    ...
  }
}
```

### 4. Update Discount Rule
**PUT** `/api/discounts/[id]`

Update an existing discount rule (admin/manager only).

**Request (all fields optional):**
```json
{
  "name": "Summer Blast",
  "value": 20,
  "endDate": "2025-09-15T23:59:59Z",
  "isActive": true
}
```

**Response:**
```json
{
  "success": true,
  "data": { ... }
}
```

### 5. Delete/Deactivate Discount
**DELETE** `/api/discounts/[id]`

Soft delete a discount rule by marking it inactive (admin/manager only).

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Discount rule deactivated",
    "data": { ... }
  }
}
```

### 6. Validate Discount Code
**POST** `/api/discounts/validate`

Validate a discount code for use on an order. Checks all constraints before applying.

**Request:**
```json
{
  "code": "SUMMER2025",
  "orderTotal": 5000,           // Order total in cents
  "customerId": "cust123",
  "departmentCode": "RESTAURANT"
}
```

**Response (Valid):**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "rule": {
      "id": "clu...",
      "code": "SUMMER2025",
      "name": "Summer Special",
      "type": "percentage",
      "value": 15,
      ...
    },
    "discountAmount": 750  // Discount in cents
  }
}
```

**Response (Invalid):**
```json
{
  "success": true,
  "data": {
    "valid": false,
    "error": "Discount code has expired"
  }
}
```

### 7. Get Active Discounts
**GET** `/api/discounts/active`

Get all currently active discount codes (public endpoint).

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "clu...",
      "code": "SUMMER2025",
      "name": "Summer Special",
      "type": "percentage",
      "value": 15,
      "applicableDepts": ["RESTAURANT", "BAR_CLUB"],
      ...
    }
  ]
}
```

### 8. Get Discounts by Department
**GET** `/api/discounts/by-department/[departmentCode]`

Get all applicable discounts for a specific department.

**Query Parameters:**
- `includeInactive` (boolean) - Include inactive discounts (default: false)

**Example:**
```bash
GET /api/discounts/by-department/RESTAURANT?includeInactive=false
```

**Response:**
```json
{
  "success": true,
  "data": {
    "departmentCode": "RESTAURANT",
    "discounts": [ ... ],
    "count": 5
  }
}
```

### 9. Get Discounts by Type
**GET** `/api/discounts/by-type/[type]`

Get all discounts of a specific type.

**Valid Types:** `percentage`, `fixed`, `tiered`, `employee`, `bulk`

**Query Parameters:**
- `isActive` (boolean) - Filter by active status
- `page` (number) - Pagination page
- `limit` (number) - Results per page

**Example:**
```bash
GET /api/discounts/by-type/percentage?isActive=true&page=1&limit=20
```

### 10. Get Upcoming Discounts
**GET** `/api/discounts/upcoming`

Get discounts that are currently active or coming soon.

**Query Parameters:**
- `daysAhead` (number) - Look ahead N days for upcoming discounts (default: 7)
- `departmentCode` (string) - Filter by department
- `type` (string) - Filter by type

**Response:**
```json
{
  "success": true,
  "data": {
    "active": [ ... ],
    "upcoming": [ ... ],
    "metadata": {
      "lookAheadDays": 7,
      "departmentFilter": null,
      "typeFilter": null,
      "totalActive": 5,
      "totalUpcoming": 2,
      "asOf": "2025-01-14T10:30:00Z"
    }
  }
}
```

### 11. Apply Discount to Order (at creation)
**POST** `/api/orders`

Apply discounts when creating an order.

**Request:**
```json
{
  "customerId": "cust123",
  "items": [
    {
      "productId": "prod123",
      "productType": "food",
      "productName": "Burger",
      "departmentCode": "RESTAURANT",
      "quantity": 2,
      "unitPrice": 1500  // $15 in cents
    }
  ],
  "discounts": ["SUMMER2025", "LOYALTY25"],  // Array of discount codes
  "notes": "No onions please"
}
```

The order service will:
1. Validate each discount code
2. Check all constraints (time window, usage limits, department applicability)
3. Calculate discount amounts
4. Apply to order total
5. Prevent overlapping/stacking violations

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "ord123",
    "orderNumber": "ORD-...",
    "subtotal": 3000,
    "discountTotal": 450,    // Sum of applied discounts
    "tax": 255,              // Tax on discounted amount
    "total": 2805,
    ...
  }
}
```

### 12. Apply Discount to Existing Order
**POST** `/api/orders/[id]/apply-discount`

Apply a discount code to an order after creation (cashier/manager use case).

**Request:**
```json
{
  "code": "SUMMER2025"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Discount applied successfully",
    "order": { ... },
    "appliedDiscount": {
      "id": "od123",
      "rule": {
        "id": "clu...",
        "code": "SUMMER2025",
        "name": "Summer Special",
        ...
      },
      "discountAmount": 450
    }
  }
}
```

### 13. Get Order Discounts
**GET** `/api/orders/[id]/discounts`

Get all discounts applied to a specific order.

**Response:**
```json
{
  "success": true,
  "data": {
    "orderId": "ord123",
    "discounts": [
      {
        "id": "od123",
        "code": "SUMMER2025",
        "type": "percentage",
        "amount": 450,
        "description": "Summer Special",
        "appliedAt": "2025-01-14T10:30:00Z",
        "rule": {
          "id": "clu...",
          "code": "SUMMER2025",
          "name": "Summer Special"
        }
      }
    ],
    "totalDiscountAmount": 450
  }
}
```

## Discount Types

### Percentage Discount
Discount value is a percentage (0-100) applied to the order subtotal.
```json
{
  "type": "percentage",
  "value": 15,  // 15% off
  "code": "SUMMER2025"
}
```

### Fixed Discount
Discount value is a fixed amount in cents.
```json
{
  "type": "fixed",
  "value": 500,  // $5 off
  "code": "HAPPY20"
}
```

### Tiered Discount
Advanced discount based on order amount brackets (currently implemented as percentage).
```json
{
  "type": "tiered",
  "value": 10,  // Base percentage, can be enhanced with bracket logic
  "code": "BULK_TIER"
}
```

### Employee Discount
Special fixed percentage discount for employees.
```json
{
  "type": "employee",
  "value": 15,  // 15% employee discount
  "maxUsagePerCustomer": null,  // Usually unlimited for employees
  "code": "EMPLOYEE15"
}
```

### Bulk Discount
Discount for large orders.
```json
{
  "type": "bulk",
  "value": 1000,  // $10 off
  "minOrderAmount": 5000,  // Minimum $50 order
  "code": "BULK50"
}
```

## Validation & Constraints

All discount validations happen at two points:

### 1. Code Validation (at checkout)
**POST** `/api/discounts/validate` performs:
- ✅ Code existence check
- ✅ Active status verification
- ✅ Time window validation (startDate ≤ now ≤ endDate)
- ✅ Minimum order amount check
- ✅ Department applicability check
- ✅ Total usage limit verification
- ✅ Per-customer usage limit check
- ✅ Discount amount calculation

### 2. Application (at order creation)
OrderService applies the same validations and:
- Prevents discount stacking violations
- Ensures discount doesn't exceed subtotal
- Updates order totals (subtotal - discounts + tax = total)
- Creates audit trail in OrderDiscount table

## Common Workflows

### A. Create and Apply Discount at Order Creation

```javascript
const response = await fetch('/api/orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    customerId: 'cust123',
    items: [
      {
        productId: 'prod123',
        productType: 'food',
        productName: 'Burger',
        departmentCode: 'RESTAURANT',
        quantity: 1,
        unitPrice: 1500  // $15
      }
    ],
    discounts: ['SUMMER2025']  // Applied during creation
  })
});

const order = await response.json();
// order.data.discountTotal = 225  // 15% of $15
// order.data.total = 1275 - 225 + tax
```

### B. Validate Then Apply at Checkout

```javascript
// Step 1: Validate discount code
const validation = await fetch('/api/discounts/validate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    code: 'SUMMER2025',
    orderTotal: 1500,
    customerId: 'cust123',
    departmentCode: 'RESTAURANT'
  })
});

const { data } = await validation.json();
if (!data.valid) {
  console.error(data.error);
  return;
}

// Step 2: Create order with discount
const order = await fetch('/api/orders', { ... }).then(r => r.json());

// Discount is already included in order
```

### C. Apply Discount After Order Creation

```javascript
// Step 1: Create order without discounts
const order = await fetch('/api/orders', {
  method: 'POST',
  body: JSON.stringify({
    customerId: 'cust123',
    items: [ ... ]
    // no discounts field
  })
}).then(r => r.json());

// Step 2: Apply discount later (at payment/checkout)
const updated = await fetch(`/api/orders/${order.data.id}/apply-discount`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    code: 'SUMMER2025'
  })
}).then(r => r.json());

// Updated order includes discount
```

### D. Discover Available Discounts

```javascript
// Get all active discounts for a department
const discounts = await fetch(
  '/api/discounts/by-department/RESTAURANT'
).then(r => r.json());

// Or get upcoming discounts
const upcoming = await fetch(
  '/api/discounts/upcoming?daysAhead=14&departmentCode=RESTAURANT'
).then(r => r.json());
```

## Database Tables

### DiscountRule
Stores all discount rules with metadata and constraints.

### OrderDiscount
Join table between Order and DiscountRule. Records when a discount is applied to an order.

```
OrderDiscount {
  id: string
  orderHeaderId: string    // FK to OrderHeader
  discountRuleId: string?  // FK to DiscountRule (null if manual discount)
  discountType: string     // Copied from rule for audit
  discountCode: string?    // Code that was applied
  description: string?     // Display text
  discountAmount: int      // Actual discount in cents
  appliedAt: DateTime
}
```

## Price Handling

All discount calculations use **integer cents** (no floating-point arithmetic):

```typescript
// Example: 15% off $25.99 order
const subtotalCents = 2599;        // $25.99 in cents
const discountAmount = Math.round(
  subtotalCents * (15 / 100)
);                                  // 389 cents = $3.89
const finalTotal = subtotalCents - discountAmount;  // 2210 cents = $22.10
```

## Seeding Test Data

Run the discount seeding script to populate test discounts:

```bash
npx ts-node scripts/seed-discounts.ts
```

This creates 10 sample discounts including:
- Active percentage discounts
- Fixed amount discounts
- Employee discounts
- Department-specific rules
- Time-limited promotions
- Expired/inactive examples

## Role-Based Access Control

| Endpoint | Public | User | Manager | Admin |
|----------|--------|------|---------|-------|
| GET /api/discounts | ❌ | ❌ | ✅ | ✅ |
| POST /api/discounts | ❌ | ❌ | ✅ | ✅ |
| PUT /api/discounts/[id] | ❌ | ❌ | ✅ | ✅ |
| DELETE /api/discounts/[id] | ❌ | ❌ | ✅ | ✅ |
| POST /api/discounts/validate | ✅ | ✅ | ✅ | ✅ |
| GET /api/discounts/active | ✅ | ✅ | ✅ | ✅ |
| GET /api/discounts/by-department/* | ✅ | ✅ | ✅ | ✅ |
| GET /api/discounts/by-type/* | ✅ | ✅ | ✅ | ✅ |
| GET /api/discounts/upcoming | ✅ | ✅ | ✅ | ✅ |
| POST /api/orders/[id]/apply-discount | ❌ | ❌ | ✅ | ✅ |
| GET /api/orders/[id]/discounts | ❌ | ✅* | ✅ | ✅ |

*Users can only see discounts on their own orders

## Troubleshooting

### Discount Code Not Found
- Check code spelling and case sensitivity (codes are uppercase internally)
- Verify discount exists and isActive = true

### Discount Won't Apply
Common reasons:
1. Not within time window (check startDate/endDate)
2. Order amount below minimum (check minOrderAmount)
3. Customer has reached usage limit (check maxUsagePerCustomer)
4. Global usage limit exceeded (check maxTotalUsage)
5. Not applicable to selected department (check applicableDepts)

### Discount Amount Seems Wrong
- Verify calculation: percentage discounts use Math.round()
- Fixed discounts cap at order subtotal
- All amounts are in cents (not dollars)

## Future Enhancements

- [ ] Combo/bundle discounts
- [ ] Conditional discounts (buy X get Y off)
- [ ] Tiered brackets with custom logic
- [ ] Discount scheduling (recurring weekly/monthly)
- [ ] Customer segment targeting
- [ ] Discount analytics and reporting

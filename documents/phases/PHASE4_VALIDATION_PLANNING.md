# Phase 4: Validation & Error Handling (PLANNING)

**Status**: 🚀 READY TO START  
**Date**: November 14, 2025  
**Previous Phase**: Phase 3C ✅ COMPLETE (5 routes, 930+ lines, 0 errors)

---

## Overview

Phase 4 adds comprehensive input validation, business rule enforcement, and error handling across all 21 API endpoints using Zod schema validation.

---

## Current State

### What We Have:
- ✅ 5 route files from Phase 3C (tested, no compilation errors)
- ✅ 11 route files from Phase 3A (tested, in production)
- ✅ 4 service layer files (OrderService, DiscountService, DepartmentService, InventoryService)
- ✅ Consistent error handling patterns (ErrorCodes, getStatusCode)
- ✅ Authorization layer (extractUserContext, loadUserWithRoles, hasAnyRole)

### What We Need:
- ⏳ Zod schemas for every request body
- ⏳ Business rule validation
- ⏳ Input sanitization middleware
- ⏳ Enhanced error messages
- ⏳ Validation reusable functions

---

## Validation Scope

### Routes Needing Validation (21 Total)

**Phase 3A: 11 Routes**
1. POST /api/orders - Create order ✅
2. GET /api/orders - List orders ✅
3. GET /api/orders/{id} - Get order ✅
4. POST /api/orders/{id}/discounts - Apply discount ✅
5. POST /api/orders/{id}/payments - Record payment ✅
6. PUT /api/orders/{id}/fulfillment - Update fulfillment ✅
7. + 5 more variant endpoints

**Phase 3B: Integrated**
- Order cancellation
- Status tracking

**Phase 3C: 10 Routes**
1. POST /api/discounts - Create discount ✅
2. GET /api/discounts - List discounts ✅
3. GET /api/discounts/active - Active discounts ✅
4. POST /api/orders/{id}/items - Add line item ✅
5. PUT /api/orders/{id}/items/{lineId} - Update item ✅
6. DELETE /api/orders/{id}/items/{lineId} - Remove item ✅
7. GET /api/departments - List departments ✅
8. GET /api/departments/{code}/orders - Dept orders ✅
9. GET /api/departments/{code}/pending - Pending items ✅
10. + variant endpoints

---

## Zod Schemas to Create

### File: `src/lib/schemas/validation.ts` (NEW - ~500 lines)

#### 1. **Order Creation Schema**
```typescript
const CreateOrderSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  departmentCode: z.enum([...VALID_DEPARTMENTS]),
  notes: z.string().max(500).optional(),
  items: z.array(
    z.object({
      productId: z.string(),
      productName: z.string().min(1).max(100),
      quantity: z.number().int().min(1).max(1000),
      unitPrice: z.number().min(0),
      departmentCode: z.enum([...VALID_DEPARTMENTS])
    })
  ).min(1, 'At least one item required')
})
```

**Validation Rules**:
- ✅ Customer must exist and be active
- ✅ At least one line item
- ✅ Valid department codes
- ✅ Quantity > 0
- ✅ Price > 0

---

#### 2. **Discount Creation Schema**
```typescript
const CreateDiscountSchema = z.object({
  code: z.string()
    .min(2).max(20)
    .regex(/^[A-Z0-9_-]+$/, 'Invalid code format'),
  name: z.string().max(100).optional(),
  type: z.enum(['percentage', 'fixed', 'tiered', 'employee', 'bulk']),
  value: z.number().min(0),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  minOrderAmount: z.number().min(0).optional(),
  maxUsageTotal: z.number().int().min(0).optional(),
  maxUsagePerCustomer: z.number().int().min(0).optional()
})

// Additional validation:
// - code must be unique in database
// - endDate > startDate (if both provided)
// - value: percentage 0-100, fixed > 0
```

**Validation Rules**:
- ✅ Code format: uppercase, alphanumeric, hyphens/underscores
- ✅ Code uniqueness (database check)
- ✅ Type must match allowed types
- ✅ Value ranges by type
- ✅ Date validation
- ✅ Usage limits positive

---

#### 3. **Apply Discount Schema**
```typescript
const ApplyDiscountSchema = z.object({
  discountCode: z.string().min(2).max(20),
  quantity: z.number().int().min(1).optional()
})

// Validation:
// - Discount must exist and be active
// - Discount within time window
// - Discount applicable to order departments
// - Usage limits not exceeded
// - Minimum order amount met
```

**Validation Rules**:
- ✅ Discount code exists
- ✅ Discount currently active
- ✅ Within date range
- ✅ Applicable to order's departments
- ✅ Usage limits not exceeded
- ✅ Minimum order amount met

---

#### 4. **Record Payment Schema**
```typescript
const RecordPaymentSchema = z.object({
  amount: z.number().min(0.01),
  method: z.enum(['cash', 'card', 'cheque', 'digital_wallet']),
  reference: z.string().max(100).optional(),
  notes: z.string().max(500).optional()
})

// Validation:
// - Amount <= order total
// - Amount > 0
// - Method must be valid
// - Don't exceed order balance
```

**Validation Rules**:
- ✅ Amount positive and > 0.01
- ✅ Amount ≤ order remaining balance
- ✅ Valid payment method
- ✅ Reference optional but unique if provided

---

#### 5. **Update Fulfillment Schema**
```typescript
const UpdateFulfillmentSchema = z.object({
  lineIds: z.array(z.string()).min(1),
  status: z.enum(['pending', 'processing', 'fulfilled', 'cancelled']),
  notes: z.string().max(500).optional()
})

// Validation:
// - Lines exist in order
// - Status transition valid
// - Cannot go backward in status
// - Cannot fulfil unpaid items (configurable)
```

**Validation Rules**:
- ✅ Line IDs exist in order
- ✅ Status is valid enum value
- ✅ Status transitions forward only
- ✅ All lines in same order
- ✅ Cannot cancel fulfilled items

---

#### 6. **Add Line Item Schema**
```typescript
const AddLineItemSchema = z.object({
  productId: z.string().uuid(),
  productType: z.string().max(50),
  productName: z.string().min(1).max(100),
  departmentCode: z.enum([...VALID_DEPARTMENTS]),
  quantity: z.number().int().min(1).max(1000),
  unitPrice: z.number().min(0)
})

// Validation:
// - Product exists (optional - could be flexible)
// - Order not completed/fulfilled/cancelled
// - Department valid
// - Inventory available (for RESTAURANT/BAR)
```

**Validation Rules**:
- ✅ All fields required
- ✅ Quantity > 0
- ✅ Unit price ≥ 0
- ✅ Department valid
- ✅ Order status allows modifications

---

#### 7. **Update Line Item Schema**
```typescript
const UpdateLineItemSchema = z.object({
  quantity: z.number().int().min(1).optional(),
  unitPrice: z.number().min(0).optional()
}).refine(
  obj => obj.quantity || obj.unitPrice,
  'At least quantity or unitPrice must be provided'
)

// Validation:
// - At least one field provided
// - Line not fulfilled/completed/cancelled
// - New quantity available in inventory
```

**Validation Rules**:
- ✅ At least one field provided
- ✅ Quantity > 0 if provided
- ✅ Price ≥ 0 if provided
- ✅ Line status allows update

---

#### 8. **List Query Schema** (Reusable)
```typescript
const PaginationSchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().min(1)).optional().default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional().default('20')
})

const FilterSchema = z.object({
  status: z.string().optional(),
  search: z.string().optional(),
  isActive: z.string().transform(v => v === 'true').optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'name']).optional()
})
```

**Validation Rules**:
- ✅ Page >= 1
- ✅ Limit 1-100
- ✅ Valid sort fields
- ✅ String to boolean conversion for isActive

---

## Business Rule Validation Functions

### File: `src/lib/business-validation.ts` (NEW - ~400 lines)

#### 1. **validateDiscountApplicability()**
```typescript
async function validateDiscountApplicability(
  discount: DiscountRule,
  order: OrderHeader,
  userId: string
): Promise<{ valid: boolean; error?: string }>

Checks:
- Discount active (startDate <= now <= endDate)
- Applicable to order departments
- Usage limit not exceeded (global)
- Usage limit not exceeded (per customer)
- Minimum order amount met
- Discount not already applied
- Customer type matches discount type (if employee/bulk discount)
```

---

#### 2. **validateInventoryAvailability()**
```typescript
async function validateInventoryAvailability(
  productId: string,
  departmentCode: string,
  quantity: number
): Promise<{ available: boolean; reservedCount?: number }>

Checks:
- Only for RESTAURANT/BAR_CLUB departments
- Item exists in inventory
- Available quantity >= requested quantity
- Account for pending reservations
- Check storage location if applicable
```

---

#### 3. **validateOrderModification()**
```typescript
async function validateOrderModification(
  orderId: string
): Promise<{ canModify: boolean; reason?: string }>

Checks:
- Order status allows modification (not fulfilled/cancelled/completed)
- Order not locked (by payment or fulfillment)
- Within modification window (configurable hours)
- Customer still active
- No concurrent modifications
```

---

#### 4. **validatePaymentAmount()**
```typescript
async function validatePaymentAmount(
  orderId: string,
  amount: number
): Promise<{ valid: boolean; remainingBalance?: number }>

Checks:
- Amount > 0
- Amount <= remaining balance
- Don't exceed total order amount
- Calculate available credit
- Check payment method availability
```

---

#### 5. **validateFulfillmentStatus()**
```typescript
async function validateFulfillmentStatus(
  order: OrderHeader,
  lineIds: string[],
  newStatus: 'pending' | 'processing' | 'fulfilled' | 'cancelled'
): Promise<{ valid: boolean; error?: string }>

Checks:
- All line IDs exist in order
- All lines in same order
- Current status allows transition
- No status regression (fulfilled → pending invalid)
- Cannot cancel fulfilled items (configurable)
- Check payment status if fulfilling
```

---

#### 6. **validateDepartmentAccess()**
```typescript
async function validateDepartmentAccess(
  userId: string,
  departmentCode: string
): Promise<{ hasAccess: boolean; reason?: string }>

Checks:
- Department exists and is active
- User role can access department
- User department assignment (if staff)
- Department operations active
- Department not in maintenance
```

---

## Sanitization Functions

### File: `src/lib/sanitization.ts` (NEW - ~200 lines)

```typescript
// Input sanitization
export function sanitizeString(input: string): string
  - Trim whitespace
  - Escape special characters
  - Remove control characters
  - Max length enforcement

export function sanitizeCode(input: string): string
  - Uppercase conversion
  - Remove spaces
  - Remove special chars except hyphen/underscore
  - Validate format

export function sanitizePrice(input: number): number
  - Round to 2 decimals
  - Ensure non-negative
  - Check max value

export function sanitizeQuantity(input: number): number
  - Parse as integer
  - Ensure positive
  - Check max quantity (1000)
```

---

## Validation Middleware

### File: `src/lib/middleware/validate.ts` (NEW - ~150 lines)

```typescript
export function validateBody(schema: z.ZodSchema) {
  return async (req: NextRequest): Promise<{ valid: boolean; data?: any; error?: string }> => {
    const body = await req.json().catch(() => ({}))
    const result = schema.safeParse(body)
    
    if (!result.success) {
      return {
        valid: false,
        error: formatZodError(result.error)
      }
    }
    
    return {
      valid: true,
      data: result.data
    }
  }
}

export function validateQuery(schema: z.ZodSchema) {
  return (searchParams: URLSearchParams): { valid: boolean; data?: any; error?: string } => {
    const queryData = Object.fromEntries(searchParams)
    const result = schema.safeParse(queryData)
    
    if (!result.success) {
      return {
        valid: false,
        error: formatZodError(result.error)
      }
    }
    
    return {
      valid: true,
      data: result.data
    }
  }
}

function formatZodError(error: z.ZodError): string {
  return error.errors
    .map(e => `${e.path.join('.')}: ${e.message}`)
    .join('; ')
}
```

---

## Handling implicit `any` and runtime `unknown` errors

We encountered several `any` usages (transaction callbacks, reduce/map callbacks) and `catch (error)` blocks in the codebase that accept untyped values. During Phase 4 we'll proactively remove those blindspots and ensure both compile-time and runtime errors are handled consistently.

Planned actions:

- Enable or verify `noImplicitAny: true` in `tsconfig.json` and run `tsc --noEmit` to find implicit-any sites.
- Replace `tx: any` callback parameters with `tx: Prisma.TransactionClient` where Prisma is used. Example:

  ```ts
  import { Prisma } from '@prisma/client';

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // typed transaction client
  })
  ```

- Replace `Array.prototype` callback `any` parameters (map/reduce) with explicit types, e.g. `reduce((sum: number, p: IOrderPayment) => ...)`.
- Create a small utility `src/lib/errors.ts` with `normalizeError(err: unknown)` that safely extracts message and metadata and returns a consistent shape for logging and API responses.

  ```ts
  export function normalizeError(err: unknown) {
    if (err instanceof Error) return { message: err.message, name: err.name };
    try { return { message: JSON.stringify(err) }; } catch { return { message: String(err) } }
  }
  ```

- Update `catch` blocks across services and routes to declare `error: unknown` and call `normalizeError(error)` before logging or building an `errorResponse` so we never leak undefined or unstructured values.
- Add an ESLint rule to flag `no-explicit-any` in `src/services` and `app/api` (gradual cleanup allowed, but flagging enforced).

Expected outcomes:

- No implicit-any TypeScript errors remain in services/routes after the sweep.
- Transactions and callbacks are properly typed using Prisma types.
- All runtime errors are normalized; `errorResponse` always receives a safe message and optional meta.
- Easier debugging and safer error telemetry.

Estimated time: 1-2 hours of focused refactor + small handbook updates.


## Implementation Plan

### Step 1: Create Schema Files
**Files to Create**:
- `src/lib/schemas/validation.ts` - All Zod schemas (~500 lines)
- `src/lib/schemas/index.ts` - Exports (~50 lines)

**Time**: ~1 hour

---

### Step 2: Create Validation Functions
**Files to Create**:
- `src/lib/business-validation.ts` - Business rules (~400 lines)
- `src/lib/sanitization.ts` - Input sanitization (~200 lines)

**Time**: ~1 hour

---

### Step 3: Create Validation Middleware
**Files to Create**:
- `src/lib/middleware/validate.ts` - Middleware helpers (~150 lines)

**Time**: ~30 minutes

---

### Step 4: Update All 21 Route Files
**Routes to Update**:

**Phase 3A Routes (11 files)**:
- app/api/orders/route.ts
- app/api/orders/[id]/route.ts
- app/api/orders/[id]/discounts/route.ts
- app/api/orders/[id]/payments/route.ts
- app/api/orders/[id]/fulfillment/route.ts
- app/api/admin/roles/route.ts
- app/api/admin/roles/[id]/route.ts
- app/api/admin/users/[userId]/roles/route.ts
- app/api/admin/users/[userId]/roles/batch/route.ts
- app/api/bookings/route.ts
- app/api/bookings/[id]/route.ts

**Phase 3C Routes (10 files)**:
- app/api/discounts/route.ts
- app/api/orders/[id]/items/route.ts
- app/api/departments/route.ts
- app/api/departments/[code]/orders/route.ts
- app/api/departments/[code]/pending/route.ts
- + 5 more variant endpoints

**Changes per Route**:
1. Import Zod schema
2. Validate request body: `const validation = validateBody(schema)`
3. Validate query params: `const validation = validateQuery(schema)`
4. Add business rule checks
5. Enhanced error responses

**Time**: ~3-4 hours (depends on route complexity)

---

### Step 5: Update Error Response Format
**File**: `src/lib/api-response.ts`

Add detailed validation error responses:
```typescript
{
  success: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Validation failed',
    details: [
      { field: 'email', message: 'Invalid email format' },
      { field: 'quantity', message: 'Must be positive integer' }
    ]
  }
}
```

**Time**: ~30 minutes

---

## Expected Validation Outcomes

### Before Validation (Current):
- ❌ Missing field error → 500
- ❌ Wrong type → Crashes or undefined behavior
- ❌ Invalid discount code → 404 or creates error
- ❌ Inventory overselling possible
- ❌ Status transitions not validated
- ❌ No rate limiting

### After Validation (Phase 4):
- ✅ Missing field error → 400 with clear field message
- ✅ Wrong type → 400 with type expectation
- ✅ Invalid discount code → 400 "Discount not found or expired"
- ✅ Inventory overselling prevented
- ✅ Status transitions enforced
- ✅ All business rules validated
- ✅ Input sanitized

---

## Testing Examples

### Test 1: Create Order Without Items
```typescript
POST /api/orders
{
  customerId: "123",
  departmentCode: "RESTAURANT",
  items: []
}

Expected: 400
{
  error: {
    code: 'VALIDATION_ERROR',
    message: 'items: At least one item required'
  }
}
```

### Test 2: Apply Expired Discount
```typescript
POST /api/orders/{id}/discounts
{
  discountCode: "EXPIRED_20"
}

Expected: 400
{
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Discount EXPIRED_20 is no longer active (ended 2025-10-31)'
  }
}
```

### Test 3: Inventory Overselling
```typescript
POST /api/orders/{id}/items
{
  productId: "wine-001",
  productName: "Red Wine",
  departmentCode: "BAR_CLUB",
  quantity: 100,
  unitPrice: 500
}

Expected: 400
{
  error: {
    code: 'INVENTORY_ERROR',
    message: 'Only 5 units available, requested 100'
  }
}
```

### Test 4: Invalid Status Transition
```typescript
PUT /api/orders/{id}/fulfillment
{
  lineIds: ["line-1"],
  status: "pending"  // from "fulfilled" - regression
}

Expected: 409
{
  error: {
    code: 'STATUS_CONFLICT',
    message: 'Cannot transition from fulfilled to pending'
  }
}
```

---

## Performance Impact

- ✅ Schema validation: <5ms per request
- ✅ Database validation: ~20-50ms (business rules)
- ✅ Total overhead: ~50-100ms per validated request
- ✅ Caching for frequently validated rules: TBD Phase 5

---

## Files Summary

**Phase 4 Creates** (4 new utility files):
1. `src/lib/schemas/validation.ts` - 500+ lines of Zod schemas
2. `src/lib/business-validation.ts` - 400+ lines of business rule checks
3. `src/lib/sanitization.ts` - 200+ lines of input sanitization
4. `src/lib/middleware/validate.ts` - 150+ lines of validation middleware

**Phase 4 Updates** (21 route files):
- All API routes add request validation
- All routes use sanitization
- All routes enforce business rules
- Enhanced error responses

**Total Phase 4**: ~1,300 lines of new code + updates to 21 route files

---

## Next: Phase 5 Planning

After Phase 4 validation:
- ✅ Unit tests for all services
- ✅ Integration tests for all 21 API routes
- ✅ Performance benchmarking
- ✅ Query optimization
- ✅ Caching strategy
- ✅ Production deployment checklist

---

**Status**: 🚀 READY FOR PHASE 4 IMPLEMENTATION  
**Date**: November 14, 2025  
**Previous**: Phase 3C ✅ COMPLETE  
**Total Project Progress**: ~75% (after Phase 4 completion, will be ~85%)

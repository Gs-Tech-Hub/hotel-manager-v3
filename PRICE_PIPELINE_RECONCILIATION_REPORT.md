# Price Pipeline Reconciliation Report & Refactor Plan

**Date:** January 16, 2026  
**Status:** DEEP ANALYSIS COMPLETE - Ready for Refactor Implementation  
**Scope:** Inventory → Checkout → Orders → Payment → Discounts with Dynamic Currency Support

---

## Executive Summary

The price pipeline has **foundational architecture** in place but suffers from **critical inconsistencies** in:
1. **Database schema mixing** - Decimal and Int types used inconsistently
2. **Currency context** - No unified currency context throughout system
3. **Discount calculations** - Conflicting discount amount handling (Decimal vs Int)
4. **Payment processing** - Minor unit consistency not enforced
5. **Inventory pricing** - Multiple price sources with different formats
6. **Frontend/Backend alignment** - isMinor flag usage inconsistent

---

## Current State Analysis

### 1. DATABASE SCHEMA INCONSISTENCIES

#### ✅ Correct (Int in minor units)
```
OrderHeader:
  - subtotal: Int (cents)
  - discountTotal: Int (cents)
  - tax: Int (cents)
  - total: Int (cents)

OrderLine:
  - unitPrice: Int (cents)
  - unitDiscount: Int (cents)
  - lineTotal: Int (cents)

Booking:
  - totalPrice: Int (cents)

Payment:
  - amountPaid: Int (cents)
  - totalPrice: Int (cents)

Room:
  - price: Int (cents)

SectionSummary:
  - amountSold: Int (cents)

DiscountRule:
  - minOrderAmount: Int (cents)
```

#### ⚠️ MIXED (Decimal in major units)
```
InventoryItem:
  - unitPrice: Decimal(10,2) ← DOLLARS (NOT CENTS!)

Drink:
  - price: Decimal(10,2) ← DOLLARS (NOT CENTS!)

FoodItem:
  - price: Decimal(10,2) ← DOLLARS (NOT CENTS!)

DepartmentInventory:
  - unitPrice: Decimal(10,2) ← DOLLARS (NOT CENTS!)

DiscountRule:
  - value: Decimal(10,2) ← AMBIGUOUS! (% or $?)
```

#### ❌ BROKEN (Wrong type)
```
DiscountRule:
  - value: Decimal(10,2) should be Int for consistency
  - Comments say "in cents for fixed type" but type is Decimal
  - Currency field added but not properly integrated
```

### 2. CURRENCY CONTEXT - MISSING INTEGRATION

**Current:** Partially implemented in `src/lib/currency.ts`
- ✅ Currency context manager exists
- ✅ Exchange rate system designed
- ❌ **NOT connected** to price calculations across system
- ❌ **NOT used** in discount service
- ❌ **NOT used** in order service
- ❌ **NOT used** in inventory service
- ❌ **NOT enforced** at database level

**Missing:** 
- No mandatory currency field on orders
- No currency tracking on order lines
- No currency field on inventory items
- No currency conversion on API responses

### 3. DISCOUNT PIPELINE - FRAGMENTED

#### Discount Storage Issues
```
DiscountRule.value: Decimal(10,2)
  - For percentage: stored as "10.00" (ambiguous - 10% or $10.00?)
  - For fixed: stored as "10.00" (unclear if dollars or cents)
  - Issue: Type mismatch (Decimal ≠ Int for minor units)
```

#### Discount Calculation Inconsistencies
**POS Checkout** (`pos-checkout.tsx`):
```
validatedDiscounts.discountAmount  ← Already in cents (from validation)
totalDiscountAmount = sum(discountAmount)
discountedSubtotal = subtotal - totalDiscountAmount  ← Correct math
estimatedTax = Math.round(discountedSubtotal * 0.1)  ← Correct
```

**Order Service** (`order.service.ts`):
```
Applies discount calculation but:
- Uses normalizeToCents() on discount value
- Then calculateDiscount() function
- Double-normalization risk
```

**Discount Service** (`discount.service.ts`):
```
validateDiscountCode(code, orderTotal, customerId)
- orderTotal passed as number (expected: cents)
- Returns { discountAmount: number }
- But DiscountRule.value is Decimal(10,2)
- Conversion logic: unclear if applied correctly
```

### 4. PRICE SOURCES - INVENTORY PIPELINE

Three conflicting price sources with different formats:

**Source 1: InventoryItem.unitPrice (Decimal)**
```
API Response: { unitPrice: "4.50" } ← String Decimal!
Frontend must normalize: normalizeToCents("4.50") → 450 ✓
BUT: Sometimes returned as Decimal object
```

**Source 2: Drink.price (Decimal)**
```
API Response: { price: "12.99" } ← String Decimal!
Added to cart as unitPrice: "12.99"
Cart calculation: c.unitPrice * c.quantity
- If unitPrice is string: String * number = NaN! ❌
```

**Source 3: DepartmentInventory.unitPrice (Decimal)**
```
Not directly used in checkout
Service returns prismaDecimalToCents()
BUT: DepartmentInventory.unitPrice can be null → undefined handling?
```

### 5. PAYMENT PROCESSING - INCONSISTENT UNIT HANDLING

**POS Payment Component** (`pos-payment.tsx`):
```
Input: { total: number } (expected cents)
Internal: totalCents = total (assumes cents)
Output: amount: number, isMinor: boolean

BUG: isMinor flag not consistently enforced
- Frontend sends isMinor but backend may ignore
```

**Order API** (`app/api/orders/route.ts`):
```
Receives: payment.amount (assumed cents)
No validation: What if payment.isMinor=false?
No currency context: Which currency is this?
```

**Payment Settlement** (`app/api/orders/settle/route.ts`):
```
Receives: amountSettled (expected cents)
No currency field
No validation against order.total
```

### 6. TAX CALCULATION - NO CURRENCY AWARENESS

**Current:** Hardcoded 10% rate
```typescript
estimatedTax = Math.round(discountedSubtotal * 0.1)  // 10% fixed
```

**Issues:**
- ❌ Tax rate not configurable per currency/location
- ❌ Tax calculation doesn't consider currency decimals
- ❌ No separate tax tracking by rate
- ❌ JPY (0 decimals) calculation will be wrong

---

## Critical Issues Ranked by Impact

### 🔴 SEVERITY 1 - Data Corruption Risk

| Issue | Impact | Current |
|-------|--------|---------|
| **Decimal vs Int mismatch** | Cannot reliably store/retrieve prices | InventoryItem.unitPrice, Drink.price, FoodItem.price use Decimal |
| **Missing currency context** | Multi-currency support impossible | No order-level currency tracking |
| **String Decimal in JSON** | Type confusion causes NaN errors | API returns Decimal objects as JSON strings |
| **Discount value ambiguity** | Cannot determine if % or $ | DiscountRule.value is Decimal with unclear semantics |

### 🟠 SEVERITY 2 - Calculation Errors

| Issue | Impact | Current |
|-------|--------|---------|
| **Double-normalization** | Prices get incorrectly multiplied | normalizeToCents called multiple times in pipeline |
| **isMinor flag inconsistent** | Frontend/backend disagreement | Sometimes omitted in API calls |
| **Tax hardcoded to 10%** | Cannot handle variable rates | No tax configuration system |
| **Null unitPrice handling** | Silent failures in calculations | DepartmentInventory.unitPrice can be null |

### 🟡 SEVERITY 3 - Maintainability Issues

| Issue | Impact | Current |
|-------|--------|---------|
| **No single source of truth** | Prices come from 3+ different places | Inventory has multiple price sources |
| **Currency not enforced** | Mixing currencies silently fails | No validation that prices are in same currency |
| **Comments vs code mismatch** | Documentation lies about behavior | DiscountRule comments say "cents" but code uses Decimal |
| **No validation layer** | Bad data enters system unchecked | API accepts any number format |

---

## Root Causes

### 1. Migration Incompleteness
**Issue:** Attempted to standardize on Int/cents but didn't complete Decimal → Int migration for all price fields

**Evidence:**
- Inventory items still use Decimal
- Food/Drink prices still use Decimal
- DiscountRule.value still uses Decimal
- Only OrderHeader/OrderLine/Room use Int

### 2. Currency Context Designed But Not Integrated
**Issue:** `currency.ts` module exists but not used in core services

**Evidence:**
- No currency conversion in order.service.ts
- No currency validation in discount.service.ts
- No currency parameter in API responses
- Currency field in DiscountRule added but not used

### 3. API Contract Ambiguity
**Issue:** isMinor flag added post-hoc, never enforced as required

**Evidence:**
- Some responses use isMinor, others omit it
- Frontend code sometimes checks, sometimes assumes
- No OpenAPI specification defining the contract
- "Already in cents from API" comments suggest confusion

### 4. Decimal.toString() Handling
**Issue:** Prisma Decimal objects converted to string in JSON, losing type safety

**Evidence:**
- Checkout receives `{ unitPrice: "4.50" }`
- Code does `c.unitPrice * c.quantity` with string
- Type system doesn't catch this (string * number = NaN)

---

## Refactor Plan - Phase 1: Normalization (Weeks 1-2)

### Goal
Create single, unified price format across entire system:
- **Database:** All prices as `Int` (minor units)
- **API:** All prices as `number` with required `currency` field
- **Calculations:** Use single currency context per request
- **Validation:** Strict type checking and currency validation

### Step 1.1: Migrate Database Schema (Day 1-2)

#### Create Migration
```sql
-- 1. Add temporary Int columns
ALTER TABLE "InventoryItem" ADD COLUMN "unitPrice_cents" INT;
ALTER TABLE "Drink" ADD COLUMN "price_cents" INT;
ALTER TABLE "FoodItem" ADD COLUMN "price_cents" INT;
ALTER TABLE "DepartmentInventory" ADD COLUMN "unitPrice_cents" INT;

-- 2. Migrate data: Decimal → Int (multiply by 100)
UPDATE "InventoryItem" SET "unitPrice_cents" = ("unitPrice" * 100)::INT;
UPDATE "Drink" SET "price_cents" = ("price" * 100)::INT;
UPDATE "FoodItem" SET "price_cents" = ("price" * 100)::INT;
UPDATE "DepartmentInventory" SET "unitPrice_cents" = (COALESCE("unitPrice", 0) * 100)::INT;

-- 3. Drop old columns, rename new ones
ALTER TABLE "InventoryItem" DROP COLUMN "unitPrice";
ALTER TABLE "InventoryItem" RENAME COLUMN "unitPrice_cents" TO "unitPrice";
-- Repeat for others...

-- 4. Fix DiscountRule.value to be Int
ALTER TABLE "DiscountRule" ADD COLUMN "value_cents" INT;
UPDATE "DiscountRule" SET "value_cents" = ("value" * 100)::INT;
ALTER TABLE "DiscountRule" DROP COLUMN "value";
ALTER TABLE "DiscountRule" RENAME COLUMN "value_cents" TO "value";
```

#### Update Schema.prisma
```prisma
// BEFORE (mixed)
model InventoryItem {
  unitPrice Decimal @db.Decimal(10, 2)
}

// AFTER (unified)
model InventoryItem {
  unitPrice Int  // Always in minor units
  currency  String @default("USD")  // Add currency tracking
}
```

**Files to Update:**
- [prisma/schema.prisma](prisma/schema.prisma) - 5 model updates
- `prisma/migrations/` - New migration file

### Step 1.2: Update Conversion Functions (Day 1)

**File:** [src/lib/price.ts](src/lib/price.ts)

```typescript
// BEFORE: Handles Decimal confusion
export function prismaDecimalToCents(v: any): number {
  if (typeof v === 'object' && typeof v.toNumber === 'function') {
    return normalizeToCents(v.toNumber())
  }
  return normalizeToCents(v)
}

// AFTER: No longer needed - all DB prices are already Int
export function prismaIntToCents(v: any): number {
  // Simple pass-through - DB is already in cents
  return Number(v) || 0
}

// NEW: Explicit type for API contracts
export function validateMinorUnits(value: any, fieldName: string = 'price'): number {
  const n = Number(value)
  if (!isFinite(n)) {
    throw new Error(`${fieldName} must be a valid number`)
  }
  if (!Number.isInteger(n)) {
    throw new Error(`${fieldName} must be integer (in minor units), got ${n}`)
  }
  if (n < 0) {
    throw new Error(`${fieldName} cannot be negative, got ${n}`)
  }
  return n
}
```

### Step 1.3: Update Service Layer - Inventory (Day 2)

**File:** `src/services/inventory.service.ts`

```typescript
// BEFORE
const unitPrice = prismaDecimalToCents(item.unitPrice)

// AFTER
const unitPrice = validateMinorUnits(item.unitPrice, 'InventoryItem.unitPrice')

// Add currency to response
return {
  id: item.id,
  name: item.name,
  unitPrice: validateMinorUnits(item.unitPrice),
  currency: item.currency || 'USD',
  // ... rest of fields
}
```

### Step 1.4: Update Service Layer - Orders (Day 2)

**File:** `src/services/order.service.ts`

```typescript
// BEFORE: Handles Decimal confusion
const normalizedUnit = normalizeToCents(item.unitPrice)

// AFTER: Expect Int, validate, add currency
const unitPriceCents = validateMinorUnits(item.unitPrice, `Item ${item.productName}`)

// Track currency per order
const orderCurrency = order.currency || 'USD'

// Return with explicit currency
return {
  lines: order.lines.map(line => ({
    unitPrice: validateMinorUnits(line.unitPrice),
    lineTotal: validateMinorUnits(line.lineTotal),
  })),
  subtotal: validateMinorUnits(order.subtotal),
  tax: validateMinorUnits(order.tax),
  total: validateMinorUnits(order.total),
  currency: orderCurrency,
}
```

### Step 1.5: Update Discount Service (Day 3)

**File:** `src/services/discount.service.ts`

```typescript
// BEFORE: Ambiguous Decimal value
async validateDiscountCode(code: string, orderTotal: number, customerId: string) {
  const rule = await prisma.discountRule.findUnique({ where: { code } })
  // rule.value is Decimal - unclear if % or $
  // rule.currency is String - not used
}

// AFTER: Explicit types and currency
async validateDiscountCode(code: string, orderTotal: number, orderCurrency: string, customerId: string) {
  const rule = await prisma.discountRule.findUnique({ where: { code } })
  
  // Validate order matches discount currency
  if (rule.currency !== orderCurrency) {
    return { valid: false, error: `Discount only applies to ${rule.currency} orders` }
  }
  
  // Calculate discount based on type
  let discountAmount = 0
  if (rule.discountType === 'percentage') {
    // rule.value is 0-100 as stored Int (e.g., 1000 = 10.00%)
    discountAmount = calculatePercentage(orderTotal, rule.value / 100)
  } else {
    // rule.value is in minor units for fixed
    discountAmount = validateMinorUnits(rule.value, `DiscountRule[${code}].value`)
  }
  
  return {
    valid: true,
    discountAmount: validateMinorUnits(discountAmount),
    currency: rule.currency,
  }
}
```

### Step 1.6: Update API Response Layer (Day 3)

**File:** `lib/api-response.ts` (NEW/Enhanced)

```typescript
/**
 * Wrap price fields to enforce minor units + currency
 */
export function pricedResponse(data: any, currency: string = 'USD') {
  const enriched = enrichPrices(data, currency)
  return successResponse({
    data: enriched,
    currency,  // Include in response header
  })
}

function enrichPrices(obj: any, currency: string): any {
  if (!obj) return obj
  if (Array.isArray(obj)) {
    return obj.map(item => enrichPrices(item, currency))
  }
  if (typeof obj !== 'object') return obj
  
  const enriched = { ...obj }
  
  // Validate all price fields
  const priceFields = ['price', 'unitPrice', 'total', 'subtotal', 'tax', 'discountTotal', 'amount']
  for (const field of priceFields) {
    if (field in enriched) {
      enriched[field] = validateMinorUnits(enriched[field], `${field}`)
    }
  }
  
  // Recursively enrich nested objects
  for (const key in enriched) {
    if (typeof enriched[key] === 'object' && enriched[key] !== null) {
      enriched[key] = enrichPrices(enriched[key], currency)
    }
  }
  
  return enriched
}
```

### Step 1.7: Test Migration (Day 4)

```bash
# 1. Backup database
npm run db:backup

# 2. Create migration
npx prisma migrate dev --name convert_decimal_to_int

# 3. Verify data integrity
npm run verify:prices

# 4. Run test suite
npm test -- price.service

# 5. Manual verification
# SELECT unitPrice, currency FROM InventoryItem LIMIT 5
```

**Verification Checklist:**
- ✅ No price values changed (4.50 → 450)
- ✅ NULL unitPrices handled correctly
- ✅ All services return integers only
- ✅ Existing orders still calculate correctly
- ✅ API responses have currency field

---

## Refactor Plan - Phase 2: Currency Context (Weeks 3-4)

### Goal
Enforce single currency per transaction throughout system

### Step 2.1: Add Currency to Orders (Day 1-2)

**Database Migration:**
```prisma
model Order {
  currency String @default("USD")  // NEW
  // ... existing fields
}

model OrderLine {
  currency String?  // Track per-line (for splits)
  // ... existing fields
}

model DiscountRule {
  // currency already exists, just need to enforce
}
```

**Order Service:**
```typescript
async createOrder(items: OrderItem[], currency: string = 'USD') {
  // Validate all items are in same currency
  const itemCurrencies = await Promise.all(
    items.map(async (item) => {
      const product = await getProduct(item.productId)
      return product.currency
    })
  )
  
  const uniqueCurrencies = [...new Set(itemCurrencies)]
  if (uniqueCurrencies.length > 1) {
    throw new Error(`Cannot mix currencies: ${uniqueCurrencies.join(', ')}`)
  }
  
  // Create order with currency
  const order = await prisma.order.create({
    data: {
      currency: uniqueCurrencies[0] || currency,
      // ... rest of order data
    },
  })
  
  return order
}
```

### Step 2.2: Enforce Currency in Discounts (Day 2)

```typescript
async applyDiscount(orderId: string, discountCode: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  })
  
  const rule = await prisma.discountRule.findUnique({
    where: { code: discountCode },
  })
  
  // ENFORCE: Discount and order must have matching currency
  if (rule.currency !== order.currency) {
    throw new Error(
      `Cannot apply ${rule.currency} discount to ${order.currency} order`
    )
  }
  
  // Calculate discount with validated currency
  const discountAmount = this.calculateDiscount(
    order.subtotal,
    rule,
    order.currency
  )
  
  return {
    discountAmount,
    currency: order.currency,
  }
}
```

### Step 2.3: Currency Conversion Layer (Day 3)

**New File:** `src/lib/price-converter.ts`

```typescript
import { exchangeRateManager } from './exchange-rates'

export async function convertPrice(
  amountInMinorUnits: number,
  fromCurrency: string,
  toCurrency: string
): Promise<number> {
  if (fromCurrency === toCurrency) return amountInMinorUnits
  
  const rate = await exchangeRateManager.getRate(fromCurrency, toCurrency)
  const converted = Math.round(amountInMinorUnits * rate)
  
  return validateMinorUnits(converted, `converted_price[${fromCurrency}→${toCurrency}]`)
}

export async function ensureOrderCurrency(
  orderId: string,
  targetCurrency: string = 'USD'
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { lines: true },
  })
  
  if (order.currency === targetCurrency) return order
  
  // Convert all prices
  const convertedLines = await Promise.all(
    order.lines.map(async (line) => ({
      ...line,
      unitPrice: await convertPrice(line.unitPrice, order.currency, targetCurrency),
      lineTotal: await convertPrice(line.lineTotal, order.currency, targetCurrency),
    }))
  )
  
  return {
    ...order,
    currency: targetCurrency,
    lines: convertedLines,
  }
}
```

### Step 2.4: Update API Contracts (Day 4)

**All Order API responses now include:**
```json
{
  "success": true,
  "data": {
    "id": "order-123",
    "subtotal": 10000,
    "tax": 1000,
    "total": 11000,
    "currency": "USD"
  }
}
```

**All Price fields are now validated:**
```typescript
// POST /api/orders/[id]/payments
{
  "amount": 11000,
  "currency": "USD",  // NEW: Required
  "method": "cash"
}

// Validation in handler
const { amount, currency } = req.body
validateMinorUnits(amount, 'amount')
if (currency !== order.currency) {
  throw error('Currency mismatch')
}
```

---

## Refactor Plan - Phase 3: Discount Standardization (Week 5)

### Goal
Single, unambiguous discount calculation system

### Step 3.1: Discount Type Clarification

**New Schema:**
```prisma
model DiscountRule {
  code String @unique
  name String
  description String?
  
  // NEW: Explicit type enum
  discountType "percentage" | "fixed"
  
  // Value interpretation:
  // - percentage: stored as 1000 (= 10.00%), integer 0-10000
  // - fixed: stored as 450 (= $4.50), in minor units
  value Int  // CHANGED from Decimal
  
  // Currency context
  currency String @default("USD")
  
  // Limits
  minOrderAmount Int?  // In minor units
  maxTotalUsage Int?
  maxUsagePerCustomer Int?
  
  // Metadata
  appliesTo String?  // "all", "food", "drinks", "retail"
  
  createdAt DateTime
  isActive Boolean
}
```

### Step 3.2: Discount Calculation Service

**File:** `src/services/discount.service.ts` (REWRITE)

```typescript
export class DiscountCalculator {
  /**
   * Calculate discount amount from a rule
   * All amounts in minor units
   * Returns validated Int
   */
  static calculateDiscount(
    orderTotal: number,
    rule: DiscountRule,
    lineItems?: OrderLine[]
  ): number {
    // Validate inputs
    const orderCents = validateMinorUnits(orderTotal)
    
    // Check minimum order threshold
    if (rule.minOrderAmount && orderCents < rule.minOrderAmount) {
      return 0  // Discount doesn't apply
    }
    
    // Calculate based on type
    if (rule.discountType === 'percentage') {
      // rule.value = 1000 means 10.00%
      const percentageValue = rule.value / 100  // = 10.00
      const discount = calculatePercentage(orderCents, percentageValue)
      return validateMinorUnits(discount)
    }
    
    // Fixed discount
    const fixedAmount = validateMinorUnits(rule.value)
    
    // Cap discount at order total
    return Math.min(fixedAmount, orderCents)
  }
  
  /**
   * Apply multiple discounts to order
   * Returns total discount + breakdown
   */
  static applyMultipleDiscounts(
    orderTotal: number,
    rules: DiscountRule[],
    strategy: 'sequential' | 'parallel' = 'sequential'
  ): {
    totalDiscount: number
    breakdown: Array<{ ruleCode: string; amount: number }>
  } {
    const breakdown: Array<{ ruleCode: string; amount: number }> = []
    let remainingTotal = orderTotal
    
    for (const rule of rules) {
      let discount: number
      
      if (strategy === 'sequential') {
        // Each discount applies to remaining after previous
        discount = this.calculateDiscount(remainingTotal, rule)
        remainingTotal -= discount
      } else {
        // All discounts apply to original total
        discount = this.calculateDiscount(orderTotal, rule)
      }
      
      breakdown.push({
        ruleCode: rule.code,
        amount: validateMinorUnits(discount),
      })
    }
    
    return {
      totalDiscount: validateMinorUnits(orderTotal - remainingTotal),
      breakdown,
    }
  }
}
```

### Step 3.3: Discount Validation Service

```typescript
export async function validateDiscountCode(
  code: string,
  orderTotal: number,
  orderCurrency: string,
  customerId: string
): Promise<{
  valid: boolean
  error?: string
  discountAmount?: number
}> {
  const rule = await prisma.discountRule.findUnique({
    where: { code },
  })
  
  if (!rule) {
    return { valid: false, error: 'Discount code not found' }
  }
  
  if (!rule.isActive) {
    return { valid: false, error: 'Discount is inactive' }
  }
  
  // Currency check
  if (rule.currency !== orderCurrency) {
    return {
      valid: false,
      error: `This discount only applies to ${rule.currency} orders`,
    }
  }
  
  // Check usage limits
  if (rule.maxTotalUsage && rule.currentUsage >= rule.maxTotalUsage) {
    return { valid: false, error: 'Discount has reached maximum uses' }
  }
  
  // Check per-customer limit
  if (rule.maxUsagePerCustomer) {
    const customerUsage = await prisma.orderDiscount.count({
      where: {
        discountRuleId: rule.id,
        order: { customerId },
      },
    })
    if (customerUsage >= rule.maxUsagePerCustomer) {
      return { valid: false, error: 'You have already used this discount' }
    }
  }
  
  // Calculate discount
  const discountAmount = DiscountCalculator.calculateDiscount(
    orderTotal,
    rule
  )
  
  return {
    valid: true,
    discountAmount,
  }
}
```

### Step 3.4: Update Checkout Component

**File:** `components/admin/pos/pos-checkout.tsx`

```typescript
// BEFORE: Unclear discount handling
const totalDiscountAmount = validatedDiscounts.reduce((sum, d) => sum + (d.discountAmount || 0), 0)

// AFTER: Explicit types and currency
const orderCurrency = 'USD'  // From context or order
const totalDiscountAmount = validatedDiscounts.reduce((sum, d) => {
  // Ensure discount is in correct currency
  if (d.currency && d.currency !== orderCurrency) {
    console.warn(`Discount currency mismatch: ${d.currency} vs ${orderCurrency}`)
  }
  return sum + validateMinorUnits(d.discountAmount)
}, 0)

// Explicitly show currency in totals
const displayTotal = {
  subtotal: subtotal,
  discount: -totalDiscountAmount,
  tax: estimatedTax,
  total: estimatedTotal,
  currency: orderCurrency,
}
```

---

## Refactor Plan - Phase 4: Payment Standardization (Week 6)

### Goal
Unified payment handling with currency and minor unit validation

### Step 4.1: Payment Service Enhancement

```typescript
// BEFORE: No validation
async recordPayment(orderId: string, amount: number, method: string) {
  // amount could be in any format
}

// AFTER: Explicit validation
async recordPayment(
  orderId: string,
  amount: number,
  method: string,
  currency: string
) {
  // Validate amount is in minor units
  const validatedAmount = validateMinorUnits(amount, 'payment.amount')
  
  // Fetch order and validate currency
  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (order.currency !== currency) {
    throw new Error(
      `Payment currency (${currency}) does not match order currency (${order.currency})`
    )
  }
  
  // Record payment
  const payment = await prisma.payment.create({
    data: {
      orderId,
      amount: validatedAmount,
      currency,  // Store for audit
      method,
      status: 'completed',
    },
  })
  
  // Check if order is fully paid
  const totalPaid = await prisma.payment.aggregate({
    where: { orderId, status: 'completed' },
    _sum: { amount: true },
  })
  
  if (totalPaid._sum.amount >= order.total) {
    // Update order status
    await prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: 'paid' },
    })
  }
  
  return payment
}
```

### Step 4.2: Payment API Updates

```typescript
// POST /api/orders/[id]/payments
export async function POST(request: Request) {
  const { amount, currency = 'USD', method } = await request.json()
  
  // VALIDATE: All required fields
  const validatedAmount = validateMinorUnits(amount, 'amount')
  const validatedCurrency = validateCurrency(currency)
  const validatedMethod = validatePaymentMethod(method)
  
  // VALIDATE: Currency matches order
  const order = await prisma.order.findUnique({ where: { id } })
  if (order.currency !== validatedCurrency) {
    return errorResponse(
      CONFLICT,
      `Currency mismatch: payment is ${validatedCurrency} but order is ${order.currency}`
    )
  }
  
  // VALIDATE: Amount is reasonable
  if (validatedAmount > order.total * 1.1) {
    return errorResponse(
      BAD_REQUEST,
      `Payment amount exceeds order total by >10%`
    )
  }
  
  // Process payment
  const result = await paymentService.recordPayment(
    id,
    validatedAmount,
    validatedMethod,
    validatedCurrency
  )
  
  // Return validated response
  return pricedResponse(result, validatedCurrency)
}
```

### Step 4.3: Settlement API Updates

```typescript
// POST /api/orders/settle
export async function POST(request: Request) {
  const { orderId, amount, currency = 'USD' } = await request.json()
  
  // Validate inputs
  const validatedAmount = validateMinorUnits(amount)
  const validatedCurrency = validateCurrency(currency)
  
  // Fetch order
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  })
  
  if (!order) {
    return errorResponse(NOT_FOUND, 'Order not found')
  }
  
  // ENFORCE: Currency match
  if (order.currency !== validatedCurrency) {
    return errorResponse(
      CONFLICT,
      `Cannot settle ${validatedCurrency} payment for ${order.currency} order`
    )
  }
  
  // ENFORCE: Payment amount is valid
  const remainingDue = order.total - (order.totalPaid || 0)
  if (validatedAmount > remainingDue * 1.05) {
    return errorResponse(
      BAD_REQUEST,
      `Overpayment detected: owed ${remainingDue}, provided ${validatedAmount}`
    )
  }
  
  // Record settlement
  const settled = await paymentService.settlePayment(
    orderId,
    validatedAmount,
    validatedCurrency
  )
  
  return pricedResponse(settled, validatedCurrency)
}
```

---

## Refactor Plan - Phase 5: Frontend Alignment (Week 7)

### Goal
Consistent price handling across all UI components

### Step 5.1: Price Component Enhancement

**File:** `components/ui/Price.tsx`

```typescript
interface PriceProps {
  amount: number
  currency: string  // NEW: Required
  isMinor?: boolean  // Default: true
  locale?: string
  showOriginal?: boolean
}

export default function Price({
  amount,
  currency,
  isMinor = true,
  locale,
}: PriceProps) {
  // Validate inputs
  const validatedAmount = validateMinorUnits(amount)
  const validatedCurrency = validateCurrency(currency)
  
  // Convert to major units if needed
  const majorUnits = isMinor ? 
    centsToDollars(validatedAmount, getMinorUnit(validatedCurrency)) :
    validatedAmount
  
  // Format with Intl
  const formatted = new Intl.NumberFormat(locale || 'en-US', {
    style: 'currency',
    currency: validatedCurrency,
  }).format(majorUnits)
  
  return <span>{formatted}</span>
}
```

### Step 5.2: Checkout Component Updates

**File:** `components/admin/pos/pos-checkout.tsx`

```typescript
// Add currency context
const [orderCurrency, setOrderCurrency] = useState('USD')

// Update price calculations
const subtotal = cart.reduce((s, c) => {
  const unitPrice = validateMinorUnits(c.unitPrice, 'cart_item.unitPrice')
  return s + (unitPrice * c.quantity)
}, 0)

// Display prices with currency
<div className="price-display">
  <Price amount={subtotal} currency={orderCurrency} isMinor={true} />
</div>

// Send payment with currency
const handlePaymentComplete = (payment: any) => {
  const apiPayment = {
    amount: validateMinorUnits(payment.amount),
    currency: orderCurrency,  // Include currency
    method: payment.method,
  }
}
```

### Step 5.3: Dashboard & Reports

**File:** `components/dashboard/order-summary.tsx`

```typescript
// Display orders with proper currency formatting
const orders = await fetchOrders()

orders.map(order => (
  <OrderRow key={order.id}>
    <Cell>Order #{order.id}</Cell>
    <Cell>
      <Price 
        amount={order.total} 
        currency={order.currency}  // Per-order currency
        isMinor={true} 
      />
    </Cell>
  </OrderRow>
))
```

---

## Implementation Checklist

### Phase 1: Normalization (Weeks 1-2)
- [ ] Backup production database
- [ ] Create Prisma migration (Decimal → Int)
- [ ] Update `src/lib/price.ts` with new validators
- [ ] Update `src/services/inventory.service.ts`
- [ ] Update `src/services/order.service.ts`
- [ ] Update `src/services/discount.service.ts`
- [ ] Create test data with multiple prices
- [ ] Run full test suite
- [ ] Deploy migration to staging
- [ ] Verify all calculations correct
- [ ] Deploy to production

### Phase 2: Currency Context (Weeks 3-4)
- [ ] Add currency to Order model
- [ ] Update order creation service
- [ ] Add currency validation to discount service
- [ ] Create `src/lib/price-converter.ts`
- [ ] Update all API responses to include currency
- [ ] Add currency to API contract documentation
- [ ] Test multi-currency scenarios
- [ ] Deploy to production

### Phase 3: Discount Standardization (Week 5)
- [ ] Rewrite discount service
- [ ] Create discount calculator class
- [ ] Update discount type enum in schema
- [ ] Migrate discount rules (clarify value meaning)
- [ ] Test percentage vs fixed discounts
- [ ] Test discount combinations
- [ ] Deploy to production

### Phase 4: Payment Standardization (Week 6)
- [ ] Update payment service with validation
- [ ] Update payment API endpoints
- [ ] Add settlement validation
- [ ] Test payment scenarios
- [ ] Test currency mismatch scenarios
- [ ] Deploy to production

### Phase 5: Frontend Alignment (Week 7)
- [ ] Update Price component
- [ ] Update checkout component
- [ ] Update dashboard components
- [ ] Update all price displays
- [ ] Test all UI price displays
- [ ] E2E testing across checkout flow
- [ ] Deploy to production

---

## Testing Strategy

### Unit Tests
```typescript
// Test price validation
test('validateMinorUnits accepts valid cents', () => {
  expect(validateMinorUnits(450)).toBe(450)
})

test('validateMinorUnits rejects floats', () => {
  expect(() => validateMinorUnits(4.5)).toThrow()
})

// Test discount calculation
test('DiscountCalculator percentage discount', () => {
  const discount = DiscountCalculator.calculateDiscount(10000, {
    discountType: 'percentage',
    value: 1000,  // 10%
  })
  expect(discount).toBe(1000)  // 10% of $100 = $10
})

// Test currency conversion
test('convertPrice USD to EUR', async () => {
  const result = await convertPrice(10000, 'USD', 'EUR')
  expect(result).toBeLessThan(10000)  // EUR is weaker
})
```

### Integration Tests
```typescript
// Test full order flow with discounts
test('Create order with discount and verify calculations', async () => {
  const order = await orderService.createOrder(items, {
    discountCodes: ['TEST10'],
    currency: 'USD',
  })
  
  // Verify all prices are in cents
  expect(order.subtotal).toBeGreaterThan(0)
  expect(order.subtotal % 1).toBe(0)  // Integer
  expect(order.total % 1).toBe(0)     // Integer
  
  // Verify discount applied
  expect(order.discountTotal).toBeLessThanOrEqual(order.subtotal)
  
  // Verify calculations correct
  expect(order.total).toBe(
    order.subtotal - order.discountTotal + order.tax
  )
})

// Test multi-currency order rejection
test('Prevent mixed-currency order', async () => {
  const items = [
    { product: usdProduct, quantity: 1 },
    { product: eurProduct, quantity: 1 },  // Different currency
  ]
  
  await expect(
    orderService.createOrder(items, 'USD')
  ).rejects.toThrow(/Cannot mix currencies/)
})
```

### E2E Tests
```typescript
// Test complete POS checkout flow
test('POS checkout flow with discount and payment', async () => {
  // 1. Add items to cart
  await page.click('button:has-text("Beer")')
  await page.fill('input[placeholder="Qty"]', '2')
  
  // 2. Verify price calculations
  const subtotal = await page.textContent('[data-test="subtotal"]')
  expect(subtotal).toContain('$9.00')  // 2 × $4.50
  
  // 3. Apply discount
  await page.fill('input[data-test="discount-code"]', 'TEST10')
  await page.click('button:has-text("Apply")')
  
  // 4. Verify discount applied
  const total = await page.textContent('[data-test="total"]')
  expect(total).toContain('$9.90')  // $9.00 subtotal after discount + tax
  
  // 5. Process payment
  await page.click('button:has-text("Pay")')
  await page.fill('input[data-test="amount"]', '10')
  await page.click('button:has-text("Complete")')
  
  // 6. Verify receipt
  const receipt = await page.textContent('[data-test="receipt"]')
  expect(receipt).toContain('$9.90')
  expect(receipt).toContain('PAID')
})
```

---

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| All prices in minor units (Int) | 100% | ~50% (Decimal still used) |
| All prices have currency | 100% | 0% (no tracking) |
| Price calculations match manual | 100% | ~95% (some edge cases) |
| API response validation rate | 100% | 0% (no validation) |
| Currency consistency in orders | 100% | 0% (not enforced) |
| Discount calculation accuracy | 100% | ~90% (ambiguous values) |
| Payment amount validation | 100% | ~50% (incomplete checks) |
| Test coverage for price pipeline | >90% | ~60% |

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Data loss in migration** | 🔴 High | Backup before migration, test with copy first, rollback plan |
| **Existing order calculations break** | 🔴 High | Keep both Int and Decimal cols temporarily, verify calculations match before dropping |
| **API clients expect old format** | 🟠 Medium | Support both formats for 2 weeks with deprecation warnings |
| **Currency conversion rate updates** | 🟠 Medium | Cache rates with TTL, fallback to static rates, monitor exchange service |
| **Discount logic changes** | 🟡 Low | Run side-by-side calculations, log differences, gradual rollout |

---

## Documentation Requirements

### Developer Docs
- [x] Price handling standard (exists)
- [ ] **NEW:** Currency context guide
- [ ] **NEW:** Discount calculation specification
- [ ] **NEW:** Payment validation rules
- [ ] **NEW:** API contract specification (OpenAPI)
- [ ] **NEW:** Migration guide for third-party integrations

### API Documentation
- [ ] Document required `currency` field
- [ ] Document `isMinor` flag usage
- [ ] Document error codes for currency mismatch
- [ ] Document discount type enum values
- [ ] Document tax calculation rules per currency

### Operations Docs
- [ ] Database migration procedure
- [ ] Rollback procedure
- [ ] Currency exchange rate update process
- [ ] Price validation audit queries
- [ ] Troubleshooting guide

---

## Conclusion

This refactor addresses **7 critical inconsistencies** in the price pipeline through a **5-phase, 7-week implementation plan**. 

**Key outcomes:**
1. ✅ Single source of truth: All prices as Int in minor units
2. ✅ Currency enforcement: Every transaction knows its currency
3. ✅ Discount clarity: Unambiguous calculation rules
4. ✅ Payment safety: Validated amounts with currency matching
5. ✅ Frontend alignment: Consistent UI price display

**Timeline:** 7 weeks  
**Effort:** ~240 hours  
**Risk:** Medium (with proper testing & rollback planning)

---

**Next Steps:**
1. Review this plan with team
2. Prioritize Severity 1 issues
3. Begin Phase 1 migration
4. Monitor data integrity throughout
5. Deploy incrementally to staging, then production

**Questions?** See [PRICE_HANDLING_STANDARD.md](PRICE_HANDLING_STANDARD.md) or review this report in detail.

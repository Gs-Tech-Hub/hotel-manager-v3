# Price Pipeline Refactor - Quick Reference Guide

## TL;DR - What's Wrong Now (30 seconds)

| Layer | Current | Problem | Target |
|-------|---------|---------|--------|
| **DB** | Decimal(10,2) | String in JSON, type confusion | Int (cents) |
| **API** | Mixed formats | No currency field | Int + currency |
| **Orders** | No currency | Can't verify currency match | currency field enforced |
| **Discounts** | Decimal ambiguous | Unclear if % or $ | Int with type enum |
| **Payments** | Unvalidated | No currency check | Validated + currency |
| **Frontend** | Inconsistent isMinor | Type errors | Required currency prop |

## The 5-Phase Plan

```
Phase 1: Normalization     (Weeks 1-2)  ← Start here
├─ Decimal → Int migration
├─ All prices now cents
└─ No more type confusion

Phase 2: Currency Context  (Weeks 3-4)  
├─ Add currency field everywhere
├─ Validate currency matches
└─ Foundation for multi-currency

Phase 3: Discounts         (Week 5)     
├─ Clear discount types (% vs $)
├─ Currency validation
└─ Unambiguous calculations

Phase 4: Payments          (Week 6)     
├─ Amount validation
├─ Currency matching
└─ Safe settlement

Phase 5: Frontend          (Week 7)     
├─ Consistent components
├─ Required currency prop
└─ No more type mismatches
```

## What Gets Changed

### Files Modified (Priority Order)

**Phase 1 (2 weeks):**
```
┌─ Database (CRITICAL)
│  └─ prisma/schema.prisma (5 models)
│  └─ prisma/migrations/[new] (Decimal → Int)
├─ Utilities
│  └─ src/lib/price.ts (validators)
│  └─ lib/api-response.ts (response wrapper)
└─ Services
   ├─ src/services/inventory.service.ts
   ├─ src/services/order.service.ts
   ├─ src/services/discount.service.ts
   └─ src/services/payment.service.ts
```

**Phase 2 (2 weeks):**
```
┌─ Schema (Add currency)
│  └─ prisma/schema.prisma (Order, OrderLine, DepartmentInventory)
├─ Services (Currency validation)
│  ├─ src/services/order.service.ts
│  ├─ src/services/discount.service.ts
│  └─ src/services/payment.service.ts
├─ Utilities (New)
│  └─ src/lib/price-converter.ts (NEW)
└─ API Routes (Add currency field)
   ├─ app/api/orders/route.ts
   ├─ app/api/orders/[id]/payments/route.ts
   └─ app/api/orders/[id]/discounts/route.ts
```

**Phase 3 (1 week):**
```
└─ Discount Service
   ├─ Schema: DiscountRule.discountType enum (NEW)
   ├─ Schema: DiscountRule.value as Int
   └─ Service: DiscountCalculator class (rewrite)
```

**Phase 4 (1 week):**
```
└─ Payment Routes
   ├─ POST /api/orders/[id]/payments
   ├─ POST /api/orders/settle
   └─ src/services/payment.service.ts
```

**Phase 5 (1 week):**
```
└─ UI Components
   ├─ components/ui/Price.tsx (require currency)
   ├─ components/admin/pos/pos-checkout.tsx
   ├─ components/admin/pos/pos-payment.tsx
   └─ components/dashboard/* (all price displays)
```

## Key Validation Functions (After Refactor)

### New Functions in `src/lib/price.ts`

```typescript
// Required for ALL price inputs
validateMinorUnits(value: any, fieldName: string = 'price'): number
  Ensures: value is Int, non-negative, represents cents
  Throws: if format invalid
  Example: validateMinorUnits(450, 'unitPrice') → 450

// Check currency is valid
validateCurrency(code: string): string
  Ensures: code is ISO 4217 (USD, EUR, GBP, JPY, etc.)
  Throws: if unknown currency
  Example: validateCurrency('EUR') → 'EUR'

// Require currency + minor units in API responses
pricedResponse(data: any, currency: string = 'USD')
  Validates: all price fields are Int
  Adds: currency field to response
  Example: pricedResponse(order, 'USD')
```

## Usage Examples (After Refactor)

### Creating an Order

```typescript
// BEFORE (incorrect type mixing)
const order = await orderService.createOrder({
  items: [{ unitPrice: "4.50", quantity: 2 }]
  // unitPrice is string! Will cause NaN
})

// AFTER (type-safe)
const order = await orderService.createOrder({
  items: [{ unitPrice: 450, quantity: 2 }],  // 450 cents = $4.50
  currency: 'USD',  // REQUIRED
})
// Returns: { subtotal: 900, tax: 90, total: 990, currency: 'USD' }
```

### Applying a Discount

```typescript
// BEFORE (no currency check)
const discount = await discountService.validateDiscountCode(
  'SAVE10',
  order.total,
  customerId
)
// Might apply USD discount to EUR order silently!

// AFTER (type-safe + currency check)
const discount = await discountService.validateDiscountCode(
  'SAVE10',
  order.total,
  order.currency,  // REQUIRED
  customerId
)
// Returns: { valid: true, discountAmount: 100, currency: 'USD' }
// Or: { valid: false, error: 'Cannot apply USD discount to EUR order' }
```

### Recording Payment

```typescript
// BEFORE (no validation)
await paymentService.recordPayment(orderId, 450, 'cash')
// 450 what? Cents? Dollars? Unknown.

// AFTER (validated)
await paymentService.recordPayment(
  orderId,
  validateMinorUnits(450),  // Must be Int
  'cash',
  order.currency  // REQUIRED
)
// Returns: payment record with amount validated
```

### Displaying Prices

```typescript
// BEFORE (type confusion)
<Price amount={order.total} />
// Might be cents, might be dollars, unclear

// AFTER (explicit)
<Price 
  amount={order.total}  // Int, required
  currency={order.currency}  // 'USD', required
  isMinor={true}  // Optional, default true
/>
// Displays: $9.90 (formatted correctly with Intl API)
```

## Testing Checklist

### Before Each Phase Deployment

```javascript
// Phase 1: Data Migration
test('Prices are Int after migration', async () => {
  const item = await prisma.inventoryItem.findUnique(...)
  expect(typeof item.unitPrice).toBe('number')
  expect(item.unitPrice % 1).toBe(0)  // No decimals
})

// Phase 2: Currency Enforcement
test('Cannot mix currencies in order', async () => {
  await expect(
    orderService.createOrder([usdItem, eurItem])
  ).rejects.toThrow(/Cannot mix currencies/)
})

// Phase 3: Discount Clarity
test('Discount type must be clear', async () => {
  const rule = await prisma.discountRule.findUnique(...)
  expect(rule.discountType).toBe('percentage' | 'fixed')
  expect(rule.value % 1).toBe(0)  // Always Int
})

// Phase 4: Payment Validation
test('Payment currency must match order', async () => {
  await expect(
    paymentService.recordPayment(usdOrder.id, 1000, 'eur')
  ).rejects.toThrow(/Currency mismatch/)
})

// Phase 5: Frontend Type Safety
test('Price component requires currency', () => {
  expect(() => {
    render(<Price amount={450} />)
  }).toThrow(/currency prop required/)
})
```

## Common Mistakes to Avoid

### ❌ Don't
```typescript
// 1. Mix types
const price = Decimal("4.50")  // Database type
const subtotal = price * quantity  // NaN!

// 2. Forget currency validation
await applyDiscount(order, discountCode)  // Might use wrong currency

// 3. Skip validation
const payment = { amount: userInput }  // Could be $, %, string, etc.

// 4. Omit isMinor flag
<Price amount={450} />  // Displays $4.50 as $450

// 5. Store prices as strings
{ unitPrice: "4.50" }  // Type confusion in JSON
```

### ✅ Do
```typescript
// 1. Use Int throughout
const subtotal = 450  // cents (Int)
const total = subtotal * quantity  // Always Int math

// 2. Always validate currency
validateCurrency(order.currency)
if (discount.currency !== order.currency) throw error

// 3. Validate all inputs
const validated = validateMinorUnits(userInput, 'unitPrice')

// 4. Always include currency and isMinor
<Price amount={450} currency="USD" isMinor={true} />

// 5. API returns Int + currency
return { amount: 450, currency: 'USD' }
```

## Debugging Price Issues

### Symptom: Prices show wrong (e.g., $4.50 displays as $450)

**Cause:** `isMinor` flag wrong or omitted

**Fix:**
```typescript
// Wrong
<Price amount={450} />
// Assumes amount is dollars, displays as $450

// Correct
<Price amount={450} isMinor={true} />
// Correctly displays as $4.50
```

### Symptom: NaN in calculations

**Cause:** String price mixed with number

**Fix:**
```typescript
// Wrong
const price = "4.50"  // String
const total = price * 2  // NaN!

// Correct
const price = 450  // Int cents
const total = price * 2  // 900 ✓
```

### Symptom: Discount applied to wrong currency

**Cause:** No currency validation

**Fix:**
```typescript
// Wrong
await applyDiscount(order, code)

// Correct
if (discount.currency !== order.currency) {
  throw new Error('Currency mismatch')
}
await applyDiscount(order, code)
```

### Symptom: Overpayment recorded

**Cause:** No validation of payment amount

**Fix:**
```typescript
// Wrong
const payment = userInput  // Any value

// Correct
const payment = validateMinorUnits(userInput, 'payment')
if (payment > order.total * 1.1) {
  throw new Error('Overpayment detected')
}
```

## Timeline Reference

```
Week 1-2: Phase 1 (Normalization)
└─ Decimal → Int migration
└─ Risk: LOW (data-only, well-tested)

Week 3-4: Phase 2 (Currency Context)
└─ Add currency fields
└─ Enforce currency matching
└─ Risk: MEDIUM (new required fields)

Week 5: Phase 3 (Discount Standardization)
└─ Clear discount types
└─ Risk: LOW (isolated change)

Week 6: Phase 4 (Payment Validation)
└─ Add validation checks
└─ Risk: LOW (mostly additions)

Week 7: Phase 5 (Frontend Alignment)
└─ Update components
└─ Risk: LOW (UI-only)

Total: 7 weeks, ~240 hours, Medium risk
```

## Getting Help

**Full Details:** [PRICE_PIPELINE_RECONCILIATION_REPORT.md](PRICE_PIPELINE_RECONCILIATION_REPORT.md)

**Executive Summary:** [PRICE_PIPELINE_EXECUTIVE_SUMMARY.md](PRICE_PIPELINE_EXECUTIVE_SUMMARY.md)

**Existing Standards:** [PRICE_HANDLING_STANDARD.md](PRICE_HANDLING_STANDARD.md)

**Questions:**
1. Review the full reconciliation report for your phase
2. Check this quick reference for common patterns
3. Look at test examples for your use case
4. Ask in team standup for clarification

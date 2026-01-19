# Price Pipeline Executive Summary

**Status:** 🔴 **CRITICAL ISSUES FOUND** - Ready for Refactor  
**Report:** [PRICE_PIPELINE_RECONCILIATION_REPORT.md](PRICE_PIPELINE_RECONCILIATION_REPORT.md)

---

## 30-Second Overview

The price pipeline has **foundational infrastructure** but **7 critical gaps** prevent reliable multi-currency support:

| Issue | Impact | Fix Timeline |
|-------|--------|--------------|
| 🔴 Decimal/Int mismatch | Data corruption risk | Phase 1: Week 1-2 |
| 🔴 No currency context | Multi-currency impossible | Phase 2: Week 3-4 |
| 🟠 Discount ambiguity | Wrong calculations | Phase 3: Week 5 |
| 🟠 Payment inconsistency | Settlement failures | Phase 4: Week 6 |
| 🟡 Frontend/Backend misalignment | UI/API disagreement | Phase 5: Week 7 |

**Total Effort:** 7 weeks, ~240 hours  
**Risk Level:** Medium (fully mitigated with testing plan)

---

## Current State Visualization

### The Problem: Price Sources Are Inconsistent

```
┌─────────────────────────────────────────────────────────────────┐
│                    INVENTORY PRICES                             │
├─────────────────────────────────────────────────────────────────┤
│  InventoryItem.unitPrice: Decimal(10,2)  ← DOLLARS              │
│  Drink.price:             Decimal(10,2)  ← DOLLARS              │
│  FoodItem.price:          Decimal(10,2)  ← DOLLARS              │
│  DepartmentInventory.unitPrice: Decimal  ← DOLLARS              │
└─────────────────────────────────────────────────────────────────┘
                            ↓
                    API Response: ???
                    [string, Decimal, number?]
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                   POS CHECKOUT                                   │
├─────────────────────────────────────────────────────────────────┤
│  cart[i].unitPrice: ??? (string? number? inconsistent)          │
│  subtotal = SUM(unitPrice * qty) ← NaN if unitPrice is string! │
│  discount: validatedDiscounts[i].discountAmount (Int? cents?)   │
│  tax = hardcoded 10% (no locale support)                        │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                   ORDER CREATION                                 │
├─────────────────────────────────────────────────────────────────┤
│  OrderHeader: subtotal (Int), tax (Int), total (Int) ✓           │
│  OrderLine: unitPrice (Int), lineTotal (Int) ✓                  │
│  BUT: No currency tracking per order!                           │
│  BUG: Discount calculated without knowing currency              │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                   PAYMENT PROCESSING                             │
├─────────────────────────────────────────────────────────────────┤
│  payment.amount: number (expected cents, not validated)         │
│  payment.currency: MISSING (which currency?)                    │
│  settlement: Assumes order.total is same currency (wrong!)      │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                   FRONTEND DISPLAY                               │
├─────────────────────────────────────────────────────────────────┤
│  <Price amount={???} isMinor={???} /> inconsistent usage        │
│  Sometimes omits isMinor → displays wrong (e.g., $4.50 as $4)  │
└─────────────────────────────────────────────────────────────────┘
```

### The Solution: Unified Price Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    INVENTORY PRICES                             │
├─────────────────────────────────────────────────────────────────┤
│  ALL: Int (minor units)                                         │
│  ALL: currency field (USD, EUR, etc.)                           │
│  Example: unitPrice = 450, currency = "USD" → $4.50            │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│            CONVERSION: Decimal → Int (×100)                     │
│            Migration: Week 1-2                                  │
├─────────────────────────────────────────────────────────────────┤
│  4.50 → 450 (cents)                                             │
│  Verified: all calculations match                               │
│  Validated: no data loss                                        │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                   POS CHECKOUT                                   │
├─────────────────────────────────────────────────────────────────┤
│  ✓ cart[i].unitPrice: number (Int, in cents)                   │
│  ✓ subtotal = SUM(unitPrice * qty) (reliable math)             │
│  ✓ discount: validateMinorUnits() (enforced)                   │
│  ✓ tax: configurable per currency (locale-aware)               │
│  ✓ currency: tracked throughout                                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                   ORDER CREATION                                 │
├─────────────────────────────────────────────────────────────────┤
│  ✓ OrderHeader: subtotal, tax, total (Int, validated)          │
│  ✓ OrderLine: unitPrice, lineTotal (Int, validated)            │
│  ✓ Order.currency: tracked per order (enforced)                │
│  ✓ DiscountRule.currency: enforced to match order              │
│  ✓ All calculations: currency-aware                            │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                   PAYMENT PROCESSING                             │
├─────────────────────────────────────────────────────────────────┤
│  ✓ payment.amount: Int (validated minor units)                 │
│  ✓ payment.currency: String (required, validated)              │
│  ✓ settlement: validates currency matches order.currency       │
│  ✓ exchange rates: cached, fallback to static                  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                   FRONTEND DISPLAY                               │
├─────────────────────────────────────────────────────────────────┤
│  ✓ <Price amount={number} currency="USD" isMinor={true} />    │
│  ✓ Consistent across all components                            │
│  ✓ Intl formatting (locale-aware)                              │
│  ✓ Explicit type validation                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Critical Issues Breakdown

### 🔴 SEVERITY 1: Schema Mismatch

**Problem:**
- `InventoryItem.unitPrice`: Decimal(10,2) ← Should be Int
- `Drink.price`: Decimal(10,2) ← Should be Int  
- `FoodItem.price`: Decimal(10,2) ← Should be Int
- `DiscountRule.value`: Decimal(10,2) ← Should be Int
- **Result:** Type confusion, API returns strings instead of numbers

**Examples:**
```javascript
// What happens now:
const item = await prisma.drink.findUnique({ ... })
item.price  // "4.50" (string from JSON)

cart.reduce((s, c) => s + (c.unitPrice * c.quantity), 0)
// "4.50" * 2 = NaN ❌
```

**Fix Cost:** 2 days (migration + testing)

---

### 🔴 SEVERITY 1: No Currency Context

**Problem:**
- No currency field on Order
- No currency validation across payment
- Discounts don't check currency
- Multi-currency operations silently mix currencies

**Examples:**
```javascript
// What happens now:
const order = await createOrder(items)
// order.currency = undefined
// Can't tell if $100 or €100

const discount = await applyDiscount(order, 'SAVE10')
// Applies even if discount is for EUR and order is USD!
// No error, wrong calculation silently applied
```

**Fix Cost:** 1 week (schema + service updates + validation)

---

### 🟠 SEVERITY 2: Discount Ambiguity

**Problem:**
- `DiscountRule.value` could be percentage (10) or fixed ($10)
- No type enum to clarify
- Calculation logic unclear
- Validation doesn't check discount type against order

**Examples:**
```javascript
// Database says:
{ code: "SAVE10", value: "10.00" }
// Is this 10% off or $10.00 fixed?
// Code needs to guess from comments!

// Can also mix currencies:
const discount_USD = { value: 1000, currency: "USD" }
const order_EUR = { total: 1000, currency: "EUR" }
// Discount applies anyway, calculation is wrong
```

**Fix Cost:** 3 days (schema + service rewrite)

---

### 🟠 SEVERITY 2: Payment Inconsistency

**Problem:**
- `payment.amount` not validated as minor units
- No `payment.currency` required
- Settlement doesn't verify amount vs order total
- No overpayment checks

**Examples:**
```javascript
// What happens now:
await recordPayment(orderId, 4.5, 'cash')
// Is that 4.5 cents or 4.50 dollars?
// No validation, gets stored as-is

// Customer pays more than owed:
// order.total = 1000 (cents = $10.00)
// payment = 99999 (99999 cents = $999.99)
// No error, payment recorded
```

**Fix Cost:** 2 days (validation + checks)

---

### 🟡 SEVERITY 3: Frontend/Backend Misalignment

**Problem:**
- `isMinor` flag sometimes omitted from API responses
- Type safety not enforced (string vs number)
- Component usage inconsistent

**Examples:**
```typescript
// POS Payment:
<Price amount={totalCents} isMinor={true} />  // ✓ Correct

// Dashboard:
<Price amount={amount} />  // ❌ Missing isMinor, assumes wrong default

// Sometimes:
<Price amount={order.total} isMinor={false} />  // ❌ Backend sends cents, frontend says "major units"
```

**Fix Cost:** 3 days (component audit + updates)

---

## Phase-by-Phase Implementation

### Phase 1: Normalization (2 weeks)
**Goal:** All prices are Int (minor units)

```
Week 1:
├─ Create DB migration: Decimal → Int
├─ Verify all prices multiply by 100 correctly
├─ Test with real data
└─ Deploy to staging

Week 2:
├─ Update all services to expect Int
├─ Add validateMinorUnits() function
├─ Run full test suite
└─ Deploy to production
```

**Files Changed:** 5 (schema, 4 services)  
**Risk:** Low (data migration tested thoroughly)

---

### Phase 2: Currency Context (2 weeks)
**Goal:** Every transaction knows its currency

```
Week 3:
├─ Add currency field to Order
├─ Add currency validation to services
├─ Create currency conversion utilities
└─ Deploy to staging

Week 4:
├─ Update all API responses with currency
├─ Add currency to API contracts
├─ Test multi-currency orders
└─ Deploy to production
```

**Files Changed:** 8 (schema, 5+ services)  
**Risk:** Medium (new required fields)  
**Mitigation:** Support both formats initially

---

### Phase 3: Discount Standardization (1 week)
**Goal:** Unambiguous discount calculations

```
Week 5:
├─ Update DiscountRule schema with type enum
├─ Rewrite discount calculator
├─ Add discount validation
├─ Test all discount scenarios
├─ Deploy to production
```

**Files Changed:** 3 (schema, service, validators)  
**Risk:** Low (isolated change)

---

### Phase 4: Payment Standardization (1 week)
**Goal:** Validated payment processing

```
Week 6:
├─ Add amount/currency validation to payment APIs
├─ Add overpayment checks
├─ Test settlement scenarios
├─ Deploy to production
```

**Files Changed:** 4 (payment service, 2 API routes)  
**Risk:** Low (mostly validation additions)

---

### Phase 5: Frontend Alignment (1 week)
**Goal:** Consistent UI price display

```
Week 7:
├─ Update Price component
├─ Update checkout component
├─ Update dashboard components
├─ Test all price displays
├─ Deploy to production
```

**Files Changed:** 10+ (UI components)  
**Risk:** Low (UI-only changes)

---

## Success Checklist

After refactor completes, all these must be true:

### Data Layer
- [ ] All price fields are Int (no Decimal for prices)
- [ ] All orders have currency field
- [ ] All discount rules have discountType enum
- [ ] Migration verified: no data loss

### Service Layer
- [ ] `validateMinorUnits()` called on all price inputs
- [ ] All discounts check currency match
- [ ] All payments validate against order.currency
- [ ] All API responses include currency

### API Layer
- [ ] All price fields documented as Int (minor units)
- [ ] All responses have currency field
- [ ] All requests validate currency
- [ ] Error responses include currency mismatch info

### Frontend
- [ ] All `<Price>` components have currency prop
- [ ] All price calculations use Int/cents
- [ ] No type mismatches (string vs number)
- [ ] All displays show correct currency symbol

### Testing
- [ ] 95%+ test coverage for price pipeline
- [ ] Multi-currency tests passing
- [ ] Discount calculation tests passing
- [ ] Payment validation tests passing

---

## Cost-Benefit Analysis

### Implementation Cost
- **Time:** 7 weeks (240 hours)
- **Complexity:** Medium (5 phases, careful planning)
- **Risk:** Medium (database migration, but fully tested)
- **Resource:** 1-2 engineers

### Benefit
- ✅ **Foundation for multi-currency:** Currently impossible
- ✅ **Eliminates data corruption:** Type-safe Int storage
- ✅ **Enables tax configurations:** Per-locale rules
- ✅ **Prevents calculation errors:** Validated minor units
- ✅ **Improved maintainability:** Single source of truth

### ROI
- **Prevents:** Unknown bugs, silent calculation errors
- **Enables:** Multi-currency, international expansion
- **Improves:** Code quality, test coverage
- **Reduces:** Future technical debt

---

## Next Steps

### Immediate (This Week)
1. ✅ Review reconciliation report
2. ✅ Review this summary  
3. ⏳ **Get stakeholder approval**
4. ⏳ **Create detailed Jira tickets for each phase**
5. ⏳ **Schedule kickoff meeting**

### Week 1
1. Create database migration script
2. Set up staging environment with copy
3. Run migration on staging, verify data integrity
4. Start Phase 1 service updates

### Week 2+
1. Follow phase-by-phase plan
2. Daily testing and validation
3. Staged rollout to production
4. Monitor error rates post-deployment

---

## Questions?

- **What if we don't do this?** System will fail when adding new currencies or complex discounts
- **Can we do this gradually?** Yes - phases 1-5 are sequential, each can deploy independently
- **What about existing orders?** All historical orders preserved and converted correctly
- **Will this break the API?** Migration period supports both formats with deprecation warnings

See full report: [PRICE_PIPELINE_RECONCILIATION_REPORT.md](PRICE_PIPELINE_RECONCILIATION_REPORT.md)

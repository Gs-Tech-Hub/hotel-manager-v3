# Price Handling Standard - Complete Reference

## The Problem We're Solving

Previously, prices weren't standardized in how they were stored, converted, and displayed. This caused:
- Confusion about whether prices were in cents or dollars
- Inconsistent conversion logic across the codebase
- Display errors when prices didn't match expected formats
- Difficulty adding new features that rely on prices

## The Solution: Standardized Three-Layer System

### Layer 1: Database Storage (Truth Source)
**Standard**: Prices stored in DOLLARS with 2 decimal places
- Type: `Decimal(10, 2)`
- Format: `"4.50"`, `"85.00"`, `"100.99"`
- Examples:
  - A beer costs $4.50 → stored as `4.50`
  - A burger costs $12.99 → stored as `12.99`
  - A wine costs $85 → stored as `85.00`

**Tables affected:**
- `Drink.price` - drink prices
- `FoodItem.price` - food item prices
- `InventoryItem.unitPrice` - inventory prices

### Layer 2: API Response (Minor Units - Cents)
**Standard**: Prices sent to frontend are in CENTS
- Type: `number` (integer)
- Format: `450`, `8500`, `10099`
- Reason: Avoids floating-point precision issues in JavaScript

**Example API response:**
```json
{
  "items": [
    {
      "id": "drink-123",
      "name": "Beer",
      "unitPrice": 450,      // $4.50 in cents
      "unitsSold": 10,
      "amountSold": 4500     // $45.00 in cents
    }
  ]
}
```

### Layer 3: Frontend Display (Formatted Currency)
**Standard**: Frontend receives cents, displays formatted with currency symbol
- Display: `$4.50`, `$85.00`, `$100.99`
- Component: `<Price amount={450} isMinor={true} />`

## Conversion Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ DATABASE LAYER (Storage)                                        │
│ Drink.price = "4.50"  (Decimal type, stored as dollars)        │
└─────────────────────────────────────────────────────────────────┘
                            ↓
                    [Service Layer]
                    prismaDecimalToCents()
                    "4.50" → 450
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ API RESPONSE (Transfer)                                         │
│ { unitPrice: 450 }  (number type, in cents)                    │
└─────────────────────────────────────────────────────────────────┘
                            ↓
                    [Frontend Receives]
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND DISPLAY (User Sees)                                    │
│ <Price amount={450} isMinor={true} />  → "$4.50"              │
└─────────────────────────────────────────────────────────────────┘
```

## Code Examples

### ✅ Correct: Getting a product with price

**Service Layer (Backend):**
```typescript
import { prismaDecimalToCents } from '@/lib/price'

const drink = await prisma.drink.findUnique({ where: { id: 'drink-123' } })
// drink.price = Decimal("4.50")

const response = {
  id: drink.id,
  name: drink.name,
  unitPrice: prismaDecimalToCents(drink.price),  // Decimal → number (cents)
  // Returns: { unitPrice: 450 }
}
```

**Frontend:**
```typescript
// API returns: { unitPrice: 450 }

<Price amount={product.unitPrice} isMinor={true} />
// Displays: $4.50
```

### ✅ Correct: Calculating sale amount

**Service Layer:**
```typescript
const orderLine = await prisma.orderLine.findUnique({
  where: { id: 'line-123' }
  include: { orderHeader: true }
})

// lineTotal from DB is stored in cents (e.g., 4500 for $45.00)
const response = {
  amountSold: orderLine.lineTotal,  // Already in cents, no conversion needed
  // Returns: { amountSold: 4500 }
}
```

### ❌ Wrong: Forgetting to convert
```typescript
const response = {
  unitPrice: drink.price,  // ❌ Returns Decimal("4.50") instead of 450
}
// Frontend receives: 4.50 instead of 450
// <Price amount={4.50} isMinor={true} /> → displays "$0.04" (WRONG!)
```

### ❌ Wrong: Double-converting
```typescript
const cents = prismaDecimalToCents(drink.price)  // 450
const response = {
  unitPrice: prismaDecimalToCents(cents)  // ❌ Converting 450 again
  // Returns: 4 (WRONG!)
}
```

## Utility Functions

### `prismaDecimalToCents(value: any): number`
Converts a Prisma Decimal field (dollars) to cents.
```typescript
prismaDecimalToCents("4.50")   // → 450
prismaDecimalToCents(4.50)     // → 450
prismaDecimalToCents(Decimal("85.00"))  // → 8500
```

### `validatePrice(value: any): boolean`
Validates that a price is in the correct format.
```typescript
validatePrice(4.50)   // → true
validatePrice("4.50") // → true
validatePrice(450)    // → false (cents not allowed)
```

### `centsToDollars(cents: number): number`
Converts cents back to dollars (rare, mostly for logging).
```typescript
centsToDollars(450)   // → 4.5
centsToDollars(10099) // → 100.99
```

## When to Use Each Function

| Situation | Use | Example |
|-----------|-----|---------|
| Reading price from DB | `prismaDecimalToCents()` | `unitPrice: prismaDecimalToCents(drink.price)` |
| Sending price to API | Direct (already cents) | `response.amountSold = orderLine.lineTotal` |
| Receiving price from form | Validate with `validatePrice()` | `if (validatePrice(userInput)) { ... }` |
| Displaying price | Use `<Price>` component | `<Price amount={450} isMinor={true} />` |
| Logging/debugging | `centsToDollars()` | `console.log(centsToDollars(450))  // "4.50"` |

## Common Mistakes and How to Avoid Them

### Mistake 1: Storing prices in cents
❌ Wrong: `Drink.price = 450` (cents)
✅ Right: `Drink.price = 4.50` (dollars)
**Why:** Database is the source of truth. Humans read dollars, not cents.

### Mistake 2: Forgetting to convert in service layer
❌ API returns: `{ unitPrice: Decimal("4.50") }`
✅ API returns: `{ unitPrice: 450 }`
**Why:** JavaScript floats are imprecise. Integers are safer.

### Mistake 3: Not using `isMinor={true}` in Price component
❌ `<Price amount={4.50} />`  → displays "$4.50" (coincidence!)
✅ `<Price amount={450} isMinor={true} />`  → displays "$4.50" (correct)
**Why:** Component needs to know if you're passing cents or dollars.

### Mistake 4: Double-converting
❌ `prismaDecimalToCents(prismaDecimalToCents(price))`
✅ `prismaDecimalToCents(price)`
**Why:** Function is idempotent for numbers but will break if applied twice.

## Checklist for New Features

When adding price-related features:

- [ ] Database stores in dollars (e.g., `4.50`)
- [ ] Service layer converts to cents before API response
- [ ] API response uses `isMinor={true}` in documentation
- [ ] Frontend uses `<Price amount={cents} isMinor={true} />`
- [ ] Form validation uses `validatePrice()`
- [ ] No floating-point arithmetic (use integers for calculations)
- [ ] Tests verify conversion at each layer

## Testing Price Conversions

```typescript
// Test: Database → API
const dbPrice = Decimal("4.50")
const apiPrice = prismaDecimalToCents(dbPrice)
expect(apiPrice).toBe(450)

// Test: API → Display
const displayPrice = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(apiPrice / 100)
expect(displayPrice).toBe('$4.50')
```

## Files Using This Standard

| File | Purpose |
|------|---------|
| `src/lib/price.ts` | Conversion utilities |
| `components/ui/Price.tsx` | Display component |
| `src/services/section.service.ts` | Product price queries |
| `src/services/order.service.ts` | Order price calculations |
| `app/api/departments/*/products/route.ts` | Product API endpoints |

## Troubleshooting

**Problem**: Price displays as "$0.04" instead of "$4.50"
- **Cause**: Not using `isMinor={true}` or passing dollars instead of cents
- **Fix**: `<Price amount={450} isMinor={true} />`

**Problem**: Price shows too many decimal places like "$4.50000"
- **Cause**: Decimal not converted to number
- **Fix**: Use `prismaDecimalToCents()`

**Problem**: API returns wrong number like `4.5` instead of `450`
- **Cause**: Forgot to convert in service layer
- **Fix**: Wrap with `prismaDecimalToCents()`

**Problem**: Form won't accept price like "4.50"
- **Cause**: Validation expects different format
- **Fix**: Update validation or document expected format

---

**Last Updated**: December 26, 2025
**Status**: Active Standard - All code should follow this

# Price Consistency & Currency Handling Guide

## Overview

This guide documents the centralized price and currency handling system implemented across the Hotel Manager V3 application. All prices are stored and calculated as **integers in cents** to ensure precision, consistency, and prevent floating-point arithmetic errors.

## Core Principles

### 1. **Single Source of Truth: Cents**
- **All prices stored as integers (cents)** - no decimals allowed
- Example: $4.50 = 450 cents
- Example: $0.01 = 1 cent
- Example: $100.00 = 10000 cents

### 2. **Why Cents?**
- **Precision**: Avoids floating-point errors (e.g., 0.1 + 0.2 !== 0.3)
- **Financial accuracy**: No rounding errors during calculations
- **Database consistency**: All prices stored as INT, not FLOAT/DECIMAL
- **Easy arithmetic**: Multiply/divide/sum without precision issues

### 3. **Normalized Price Flow**
```
User Input ($4.50)
    ↓
normalizeToCents() → 450 (cents)
    ↓
Database (INT field)
    ↓
centsToDollars() → 4.5 (for display)
    ↓
formatCents() → "$4.50" (formatted display)
```

## Database Schema

### Price Fields (All INT - Cents)

#### InventoryItem
```prisma
model InventoryItem {
  unitPrice Int @db.Int  // Price in cents (e.g., 450 = $4.50)
  // Database handles as integer, no precision loss
}
```

#### OrderHeader
```prisma
model OrderHeader {
  subtotal      Int @default(0)  // Sum of all line totals (cents)
  discountTotal Int @default(0)  // Total discounts applied (cents)
  tax           Int @default(0)  // Tax amount (cents)
  total         Int @default(0)  // Final total (cents)
}
```

#### OrderLine
```prisma
model OrderLine {
  unitPrice    Int  // Item price (cents)
  unitDiscount Int @default(0)  // Discount per unit (cents)
  lineTotal    Int  // quantity × unitPrice - unitDiscount (cents)
}
```

#### DepartmentInventory
```prisma
model DepartmentInventory {
  unitPrice Decimal? @db.Decimal(10, 2)  // Stored as decimal
  // Service normalizes to cents for calculations
}
```

## Price Utilities API

### Location: `src/lib/price.ts`

#### Normalization Functions

```typescript
// Convert any input to cents (integer)
normalizeToCents(value: any): number
// Examples:
normalizeToCents(4.5)      // → 450
normalizeToCents("4.50")   // → 450
normalizeToCents(450)      // → 450 (< 1000, treated as dollars)
normalizeToCents(10000)    // → 10000 (≥ 1000, treated as cents already)

// Convert Prisma Decimal to cents
prismaDecimalToCents(value: any): number

// Convert cents back to dollars (float)
centsToDollars(cents: number): number
// Examples:
centsToDollars(450)     // → 4.5
centsToDollars(10000)   // → 100
```

#### Calculation Functions

```typescript
// Calculate percentage of amount
calculatePercentage(cents: number, percentage: number): number
// Example: calculatePercentage(1000, 10) → 100 (10% of $10)

// Calculate discount amount
calculateDiscount(subtotalCents, discountValue, discountType)
// Types: 'percentage' (0-100) or 'fixed' (cents)

// Calculate tax (percentage-based)
calculateTax(subtotalCents: number, taxRate: number = 10): number
// Example: calculateTax(1000, 10) → 100 (10% tax on $10)

// Calculate total
calculateTotal(subtotal, discount, tax): number
// Formula: total = subtotal - discount + tax

// Validate price is non-negative integer
validatePrice(cents: number, fieldName?: string): void
```

#### Formatting Functions

```typescript
// Format cents to currency string
formatCents(cents: any): string
// Example: formatCents(450) → "$4.50"

// Format for display (alias)
formatPrice(cents: number): string
// Example: formatPrice(450) → "$4.50"

// Format as decimal string (no currency)
formatPriceAsDecimal(cents: number): string
// Example: formatPriceAsDecimal(450) → "4.50"

// Convert cents to Decimal string (for DB storage)
centsToDecimal(cents: number): string
// Example: centsToDecimal(450) → "4.50"
```

#### Batch Operations

```typescript
// Sum array of prices
sumPrices(prices: number[]): number

// Calculate average
averagePrice(prices: number[]): number

// Compare prices (with tolerance)
pricesEqual(a: number, b: number, toleranceCents?: number): boolean
```

## Formatter Utilities

### Location: `src/lib/formatters.ts`

**Purpose**: Centralized, consistent formatting across all UI components

#### Price Display Functions

```typescript
// Format any price for display
formatPriceDisplay(value: any): string
// Example: formatPriceDisplay(450) → "$4.50"

// Format order totals
formatOrderTotal(cents: number): string

// Format line prices
formatLinePrice(unitPrice, quantity): string

// Format discounts, tax, inventory prices
formatDiscount(cents: number): string
formatTax(cents: number): string
formatInventoryPrice(cents: number): string

// Format for receipt
formatReceiptLine(quantity, unitPrice, lineTotal): string
// Example: formatReceiptLine(2, 500, 1000) → "2 × $5.00 = $10.00"

// Price ranges
formatPriceRange(minCents, maxCents): string
```

#### Usage in Components

```tsx
import { formatPriceDisplay, formatOrderTotal } from '@/lib/formatters'

export function PriceDisplay({ cents }: { cents: number }) {
  return <div>{formatPriceDisplay(cents)}</div>  // Displays: $4.50
}

export function OrderTotal({ order }: { order: any }) {
  return (
    <div className="font-bold">
      Total: {formatOrderTotal(order.total)}  // Displays: $45.50
    </div>
  )
}
```

## Currency Support

### Location: `src/lib/price.ts`

```typescript
// Supported currencies (USD default)
const SUPPORTED_CURRENCIES = {
  USD: { code: 'USD', symbol: '$', decimals: 2, name: 'US Dollar' },
  EUR: { code: 'EUR', symbol: '€', decimals: 2, name: 'Euro' },
  GBP: { code: 'GBP', symbol: '£', decimals: 2, name: 'British Pound' },
  JPY: { code: 'JPY', symbol: '¥', decimals: 0, name: 'Japanese Yen' },
  CHF: { code: 'CHF', symbol: 'CHF', decimals: 2, name: 'Swiss Franc' },
}

// Get currency info
getCurrencyInfo(code: string): CurrencyInfo

// Format with currency code
formatInCurrency(cents: number, currencyCode: string, locale: string): string
// Example: formatInCurrency(450, 'EUR', 'de-DE') → "4,50 €"
```

## Order Pricing Calculation

### Order Creation Flow

```typescript
// 1. Normalize item prices to cents
const normalizedUnit = normalizeToCents(item.unitPrice)  // 450 cents

// 2. Calculate line total
const lineTotal = quantity * normalizedUnit  // quantity × 450 cents

// 3. Calculate subtotal (sum of all lines)
const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0)

// 4. Apply discounts
const discountTotal = calculateDiscount(subtotal, discountValue, 'percentage')

// 5. Calculate tax
const taxAmount = calculateTax(subtotal - discountTotal, 10)  // 10% rate

// 6. Calculate final total
const total = calculateTotal(subtotal, discountTotal, taxAmount)

// 7. Store all values as INT (cents)
const order = await prisma.orderHeader.create({
  data: {
    subtotal,        // INT: cents
    discountTotal,   // INT: cents
    tax,             // INT: cents
    total,           // INT: cents
  }
})
```

### Database Query Example

```typescript
// All database values are already in cents
const order = await prisma.orderHeader.findUnique({
  where: { id: orderId }
})

// Display using formatter
console.log(formatOrderTotal(order.total))  // Outputs: $45.50
```

## Price Updates & Consistency

### Inventory Price Updates

```typescript
// When updating inventory price
const newPriceCents = normalizeToCents(userInput)  // Normalize to cents
validatePrice(newPriceCents, 'inventoryPrice')

// Store as Decimal in database (automatically converted back to cents by service)
await prisma.inventoryItem.update({
  where: { id: itemId },
  data: {
    unitPrice: centsToDollars(newPriceCents),  // Convert to decimal for storage
  }
})

// Service normalizes when reading
const item = await inventoryItemService.getById(itemId)
console.log(item.unitPrice)  // Already normalized to cents
```

### Discount Calculation Example

```typescript
// Percentage discount (0-100)
const discountAmount = calculateDiscount(subtotal, 15, 'percentage')
// Result: 15% of subtotal in cents

// Fixed discount (in cents)
const fixedDiscount = calculateDiscount(subtotal, 500, 'fixed')
// Result: 500 cents ($5.00) or less if discount exceeds subtotal
```

## Department Summary Pricing

### Department Stats

Department summaries aggregate order totals:

```typescript
// Service calculates totalAmount from all fulfilled orders
const totalAmount = await prisma.orderLine.aggregate({
  _sum: { lineTotal: true },
  where: { departmentCode, status: 'fulfilled' }
})

// Result is already in cents (lineTotal is INT)
const stats = {
  totalAmount: totalAmount._sum.lineTotal || 0,  // INT: cents
  updatedAt: new Date()
}

// Display
console.log(formatDepartmentPrice(stats.totalAmount))  // $500.50
```

## Receipt Generation

### Receipt with Consistent Pricing

```tsx
export function Receipt({ order }: { order: any }) {
  return (
    <div className="font-mono text-sm">
      <h1>Receipt</h1>
      <div>Order#: {order.orderNumber}</div>
      
      {/* Line items */}
      <div>
        {order.lines.map(line => (
          <div key={line.id} className="flex justify-between">
            <span>{line.productName} × {line.quantity}</span>
            {/* All prices formatted consistently */}
            <span>{formatLinePrice(line.unitPrice, line.quantity)}</span>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="border-t pt-2">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatPriceDisplay(order.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>Discount</span>
          <span>-{formatDiscount(order.discountTotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>Tax</span>
          <span>{formatTax(order.tax)}</span>
        </div>
        <div className="flex justify-between font-bold">
          <span>Total</span>
          <span>{formatOrderTotal(order.total)}</span>
        </div>
      </div>
    </div>
  )
}
```

## Migration & Validation

### Running Price Consistency Check

```bash
# Check all prices for consistency
npm run script -- scripts/price-consistency-migration.ts
```

### Migration Report

The migration script validates:
- ✓ InventoryItem prices (normalized to cents)
- ✓ DepartmentInventory prices (normalized to cents)
- ✓ OrderLine prices (verified in cents, lineTotal calculations correct)
- ✓ OrderHeader totals (verified calculations: total = subtotal - discount + tax)
- ✓ DiscountRule values (percentages 0-100, fixed amounts in cents)

Example report:
```json
{
  "timestamp": "2025-11-29T10:00:00Z",
  "status": "success",
  "messages": [
    "✓ InventoryItem: 150 items valid",
    "✓ DepartmentInventory: 450 items valid",
    "✓ OrderLine: 2500 lines valid",
    "✓ OrderHeader: 800 orders valid",
    "✓ DiscountRule: 25 rules valid",
    "✓ Price consistency validation completed"
  ],
  "fixes": {
    "inventoryItems": 150,
    "departmentInventories": 450,
    "orderLines": 2500,
    "orderHeaders": 800,
    "discountRules": 25
  },
  "errors": []
}
```

## Common Mistakes to Avoid

❌ **Don't**: Mix dollars and cents
```typescript
// WRONG
const total = dollars + centsToDollars(cents)  // 4.5 + 4.5 ≠ mixing units

// RIGHT
const total = dollarsToCents(dollars) + cents  // 450 + 450 = 900 cents
```

❌ **Don't**: Use floating-point math
```typescript
// WRONG
const discountAmount = subtotal * 0.15  // Could have precision issues

// RIGHT
const discountAmount = calculateDiscount(subtotal, 15, 'percentage')
```

❌ **Don't**: Directly format database values
```typescript
// WRONG
<span>${order.subtotal.toFixed(2)}</span>  // Might show wrong currency

// RIGHT
<span>{formatPriceDisplay(order.subtotal)}</span>
```

❌ **Don't**: Store prices as FLOAT/DECIMAL
```typescript
// WRONG - Data loss risk
unitPrice Float
total Decimal

// RIGHT - Precise integer storage
unitPrice Int  // in cents
total     Int  // in cents
```

## Testing Prices

### Unit Tests

```typescript
import { normalizeToCents, calculateTax, calculateTotal } from '@/lib/price'

describe('Price Utilities', () => {
  it('should normalize dollars to cents', () => {
    expect(normalizeToCents(4.5)).toBe(450)
    expect(normalizeToCents('4.50')).toBe(450)
    expect(normalizeToCents(450)).toBe(450)
  })

  it('should calculate tax correctly', () => {
    const subtotal = 10000  // $100
    const tax = calculateTax(subtotal, 10)  // 10% tax
    expect(tax).toBe(1000)  // $10
  })

  it('should calculate totals correctly', () => {
    const subtotal = 10000   // $100
    const discount = 1000    // $10
    const tax = 900          // $9
    const total = calculateTotal(subtotal, discount, tax)
    expect(total).toBe(9900) // $99
  })
})
```

## Performance Considerations

- ✓ Integer operations are faster than decimal math
- ✓ No precision loss means no rounding corrections needed
- ✓ Database indexes work better with INT fields
- ✓ Batch operations (sumPrices) use integer arithmetic throughout

## Future Enhancements

- [ ] Multi-currency exchange rates
- [ ] Price history tracking (audit trail)
- [ ] Currency conversion middleware
- [ ] Dynamic tax rate management
- [ ] Bulk price updates with validation

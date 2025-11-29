# Quick Reference: Price Handling in Hotel Manager V3

## 🎯 TL;DR

**All prices are stored and calculated as integers in CENTS.**

- `$4.50` = `450` cents
- `$0.99` = `99` cents  
- `$100.00` = `10000` cents

## 📍 Where to Find Things

| What | Where | Import |
|------|-------|--------|
| Price normalization | `src/lib/price.ts` | `normalizeToCents`, `centsToDollars` |
| Price calculations | `src/lib/price.ts` | `calculateTax`, `calculateDiscount`, `calculateTotal` |
| Price formatting | `src/lib/formatters.ts` | `formatPriceDisplay`, `formatOrderTotal` |
| Inventory service | `src/services/inventory.service.ts` | Uses `prismaDecimalToCents` |
| Order service | `src/services/order.service.ts` | Uses all price utilities |
| Audit script | `scripts/price-consistency-migration.ts` | `runPriceConsistencyMigration` |

## 💡 Common Tasks

### Display a Price in Component
```tsx
import { formatPriceDisplay } from '@/lib/formatters'

<span>{formatPriceDisplay(450)}</span>  // Displays: $4.50
```

### Normalize User Input
```tsx
import { normalizeToCents } from '@/lib/price'

const cents = normalizeToCents(userInput)  // Any format → 450
// Works with: "4.50", 4.5, 450
```

### Calculate Order Total
```tsx
import { calculateTax, calculateTotal } from '@/lib/price'

const tax = calculateTax(subtotal, 10)  // 10% tax rate
const total = calculateTotal(subtotal, discount, tax)
```

### Format Receipt Line
```tsx
import { formatReceiptLine } from '@/lib/formatters'

<span>{formatReceiptLine(2, 500, 1000)}</span>
// Displays: 2 × $5.00 = $10.00
```

### Validate Price
```tsx
import { validatePrice } from '@/lib/price'

validatePrice(450, 'itemPrice')  // Throws if invalid
```

## 🐛 Common Mistakes

| ❌ Wrong | ✅ Right |
|----------|----------|
| `price * 0.1` | `calculatePercentage(price, 10)` |
| `$`{price.toFixed(2)}`` | `{formatPriceDisplay(price)}` |
| `subtotal + discount` | `subtotal - discount + tax` |
| Mixing dollars and cents | Always use cents internally |

## 📊 Database Fields

All price fields are `Int` (not Float/Decimal):

```prisma
InventoryItem.unitPrice        // Int (cents)
OrderHeader.subtotal           // Int (cents)
OrderHeader.discountTotal      // Int (cents)
OrderHeader.tax                // Int (cents)
OrderHeader.total              // Int (cents)
OrderLine.unitPrice            // Int (cents)
OrderLine.lineTotal            // Int (cents)
DepartmentInventory.unitPrice  // Decimal (service normalizes to cents)
```

## 🔄 Price Calculation Chain

```
Order Creation:
  Item 1: 2 × $4.50 = $9.00      →  2 × 450 = 900 cents
  Item 2: 1 × $5.00 = $5.00      →  1 × 500 = 500 cents
  ─────────────────────────────
  Subtotal:              $14.00   →  1400 cents
  Discount (10%):        -$1.40   →  -140 cents
  Subtotal after disc:   $12.60   →  1260 cents
  Tax (10%):             +$1.26   →  +126 cents
  ─────────────────────────────
  TOTAL:                 $13.86   →  1386 cents

All stored as INT in database, formatted for display
```

## 🧪 Testing Prices

```typescript
import { normalizeToCents, calculateTotal, formatPriceDisplay } from '@/lib/price'

// Test normalization
expect(normalizeToCents(4.5)).toBe(450)
expect(normalizeToCents("4.50")).toBe(450)

// Test calculation
const total = calculateTotal(1000, 100, 90)  // $10 - $1 + $0.90
expect(total).toBe(990)  // $9.90

// Test display
expect(formatPriceDisplay(990)).toBe("$9.90")
```

## 🚀 API Endpoints

### Run Price Audit
```bash
GET /api/admin/price-check
# Returns: Audit report of all prices in system
# Requires: Admin role
```

### Create Order
```bash
POST /api/orders
{
  "items": [
    {
      "productId": "...",
      "unitPrice": 450,  // Can be 4.5 or 450 or "4.50"
      "quantity": 2
    }
  ]
}
# Service normalizes all prices to cents
```

## 📋 Checklist for New Features

When adding price-related features:

- [ ] Use `normalizeToCents()` for all user input
- [ ] Store prices as INT in database
- [ ] Use `formatPriceDisplay()` for display
- [ ] Use calculation utilities (not manual math)
- [ ] Call `validatePrice()` before storing
- [ ] Update formatters if new price type
- [ ] Add tests for price calculations
- [ ] Document in PRICE_CONSISTENCY_GUIDE.md

## 🔗 Full Documentation

See `docs/PRICE_CONSISTENCY_GUIDE.md` for:
- Complete API reference
- Currency support details
- Migration procedures
- Common mistakes to avoid
- Performance considerations

## 📞 Support

For price-related questions:
1. Check `docs/PRICE_CONSISTENCY_GUIDE.md`
2. Review `src/lib/price.ts` source
3. Check `src/lib/formatters.ts` for display examples
4. Run price audit: `GET /api/admin/price-check`

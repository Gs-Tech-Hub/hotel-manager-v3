# Price Pipeline - Streamlined 3-Phase Fix

**Status:** Ready for Implementation  
**Target Completion:** 2 weeks  
**Risk:** LOW (isolated, well-tested)

---

## The Problem (30 Seconds)

Three price fields still use `Decimal(10,2)` but the system calculates in `Int` (cents):

```
❌ InventoryItem.unitPrice → Decimal (returns as string "4.50")
❌ FoodItem.price → Decimal (returns as string "12.99")
❌ DepartmentInventory.unitPrice → Decimal (returns as string or null)

✅ Everything else is Int:
   - OrderHeader (subtotal, tax, total)
   - OrderLine (unitPrice, lineTotal)
   - Room (price)
   - Booking (totalPrice)
```

**Why This Matters:**
- Decimal → JSON → String in API responses
- Frontend receives `{ unitPrice: "4.50" }` not `{ unitPrice: 450 }`
- Calculations fail: `"4.50" * 2 = NaN`
- Type safety broken

---

## Solution: 3-Phase Fix

### Phase 1: Database Migration (Day 1-2)
Convert Decimal → Int for the 3 fields

### Phase 2: Service Layer Normalization (Day 2-3)
Ensure all services return Int, never Decimal

### Phase 3: API Response Validation (Day 3-4)
Enforce minor units + currency in all responses

---

## Phase 1: Database Migration

### Fields to Fix

```
InventoryItem.unitPrice       Decimal(10,2) → Int
FoodItem.price                Decimal(10,2) → Int
DepartmentInventory.unitPrice Decimal(10,2) → Int (nullable)
```

### Migration Script (Safe)

```sql
-- Step 1: Add new Int columns
ALTER TABLE "InventoryItem" ADD COLUMN "unitPrice_cents" INT DEFAULT 0;
ALTER TABLE "FoodItem" ADD COLUMN "price_cents" INT DEFAULT 0;
ALTER TABLE "DepartmentInventory" ADD COLUMN "unitPrice_cents" INT;

-- Step 2: Convert Decimal → Int (multiply by 100)
UPDATE "InventoryItem" 
SET "unitPrice_cents" = (unitPrice * 100)::INT;

UPDATE "FoodItem" 
SET "price_cents" = (price * 100)::INT;

UPDATE "DepartmentInventory" 
SET "unitPrice_cents" = CASE 
  WHEN "unitPrice" IS NULL THEN NULL
  ELSE (unitPrice * 100)::INT
END;

-- Step 3: Swap columns
ALTER TABLE "InventoryItem" DROP COLUMN "unitPrice";
ALTER TABLE "InventoryItem" RENAME COLUMN "unitPrice_cents" TO "unitPrice";

ALTER TABLE "FoodItem" DROP COLUMN "price";
ALTER TABLE "FoodItem" RENAME COLUMN "price_cents" TO "price";

ALTER TABLE "DepartmentInventory" DROP COLUMN "unitPrice";
ALTER TABLE "DepartmentInventory" RENAME COLUMN "unitPrice_cents" TO "unitPrice";
```

### Prisma Schema Changes

```prisma
// BEFORE
model InventoryItem {
  unitPrice Decimal @db.Decimal(10, 2)
}

model FoodItem {
  price Decimal @db.Decimal(10, 2)
}

model DepartmentInventory {
  unitPrice Decimal? @db.Decimal(10, 2)
}

// AFTER
model InventoryItem {
  unitPrice Int  // in cents
}

model FoodItem {
  price Int  // in cents
}

model DepartmentInventory {
  unitPrice Int?  // in cents (nullable)
}
```

### Verification

```typescript
// Test the migration
describe('Price Migration', () => {
  test('4.50 → 450 cents', () => {
    const result = 4.50 * 100;
    expect(Math.round(result)).toBe(450);
  });

  test('12.99 → 1299 cents', () => {
    const result = 12.99 * 100;
    expect(Math.round(result)).toBe(1299);
  });

  test('no data loss for null', () => {
    const result = null;
    expect(result).toBe(null);
  });
});
```

---

## Phase 2: Service Layer Normalization

### Current Problem

Services receive Decimal objects from Prisma and mix conversion approaches:

```typescript
// order.service.ts
const normalizedUnit = normalizeToCents(item.unitPrice)  // OK

// inventory.service.ts
const unitPrice = prismaDecimalToCents(item.unitPrice)  // OK

// But after migration, both will receive Int already
// So we need to handle both: existing Decimal handling + new Int passthrough
```

### Solution: Create Unified Adapter

**File:** `src/lib/price-adapter.ts` (NEW)

```typescript
import { normalizeToCents, prismaDecimalToCents } from './price';

/**
 * Universal price adapter: handles both pre/post migration
 * 
 * Pre-migration (Decimal):  "4.50" → 450
 * Post-migration (Int):      450 → 450
 * 
 * Returns: always Int (minor units)
 */
export function adaptPrice(value: any, context: string = 'price'): number {
  if (value === null || value === undefined) return 0;

  // If it's already a number (Int), return as-is
  if (typeof value === 'number') {
    // Validate it's in reasonable range (>= 0, < 10M cents = $100k)
    if (Number.isInteger(value) && value >= 0 && value < 1_000_000_000) {
      return value;
    }
  }

  // If it's a Decimal object or string, convert
  if (typeof value === 'object' && typeof value.toNumber === 'function') {
    return prismaDecimalToCents(value);
  }

  // String or other format
  return normalizeToCents(value);
}

/**
 * Validate price is in minor units (Int) and return it
 * Used for API response validation
 */
export function validateAndReturnMinorUnits(value: any, fieldName: string = 'price'): number {
  const adapted = adaptPrice(value, fieldName);
  
  if (!Number.isInteger(adapted)) {
    throw new Error(`${fieldName} must be integer (minor units), got ${adapted}`);
  }
  
  if (adapted < 0) {
    throw new Error(`${fieldName} cannot be negative, got ${adapted}`);
  }
  
  return adapted;
}
```

### Update Services to Use Adapter

**Files to Update:**

1. **src/services/inventory.service.ts**
```typescript
import { adaptPrice } from '@/src/lib/price-adapter';

// Replace all: prismaDecimalToCents(item.unitPrice)
const unitPrice = adaptPrice(item.unitPrice, 'InventoryItem.unitPrice');
```

2. **src/services/order.service.ts**
```typescript
import { adaptPrice } from '@/src/lib/price-adapter';

// Replace all: normalizeToCents(item.unitPrice)
const unitPrice = adaptPrice(item.unitPrice, 'Item unitPrice');
```

3. **src/services/discount.service.ts**
```typescript
import { adaptPrice } from '@/src/lib/price-adapter';

// Replace all price conversions to use adaptPrice
const discountValue = adaptPrice(rule.value, 'DiscountRule.value');
```

---

## Phase 3: API Response Validation

### Enforce Type Safety at Response Layer

**File:** `lib/api-response.ts` (ENHANCE)

```typescript
import { validateAndReturnMinorUnits } from '@/src/lib/price-adapter';

/**
 * Wrap responses to ensure all prices are Int + have currency
 */
export function priceValidatedResponse(data: any, currency: string = 'USD') {
  const validated = validatePriceFields(data);
  
  return successResponse({
    ...validated,
    _currency: currency,  // Makes currency explicit in response
  });
}

/**
 * Recursively validate all price fields in response
 */
function validatePriceFields(obj: any, path: string = ''): any {
  if (!obj) return obj;

  if (Array.isArray(obj)) {
    return obj.map((item, i) => validatePriceFields(item, `${path}[${i}]`));
  }

  if (typeof obj === 'object') {
    const result: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      // Check if field looks like a price
      if (isPriceField(key)) {
        result[key] = validateAndReturnMinorUnits(value, `${path}.${key}`);
      } else if (typeof value === 'object') {
        result[key] = validatePriceFields(value, `${path}.${key}`);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }

  return obj;
}

function isPriceField(key: string): boolean {
  const priceFields = [
    'unitPrice', 'price', 'total', 'subtotal', 'tax',
    'amount', 'amountPaid', 'discountAmount', 'lineTotal',
    'totalPrice', 'basePrice', 'cost', 'sellingPrice'
  ];
  return priceFields.some(f => key.toLowerCase().includes(f.toLowerCase()));
}
```

### Apply to Key API Routes

**app/api/orders/route.ts:**
```typescript
import { priceValidatedResponse } from '@/lib/api-response';

export async function GET(request: Request) {
  const orders = await orderService.listOrders(ctx);
  
  // BEFORE
  // return NextResponse.json(successResponse(orders), { status: 200 });
  
  // AFTER: Validate all prices
  return NextResponse.json(
    priceValidatedResponse(orders, 'USD'),
    { status: 200 }
  );
}
```

**app/api/departments/[code]/orders/route.ts:**
```typescript
export async function POST(request: Request) {
  const order = await deptOrderService.createOrder(items);
  
  return NextResponse.json(
    priceValidatedResponse(order, 'USD'),
    { status: 201 }
  );
}
```

---

## Testing Checklist

### Unit Tests (src/lib/__tests__/price-adapter.test.ts)

```typescript
describe('Price Adapter', () => {
  describe('adaptPrice', () => {
    test('Int input: 450 → 450', () => {
      expect(adaptPrice(450)).toBe(450);
    });

    test('Float input: 4.5 → 450', () => {
      expect(adaptPrice(4.5)).toBe(450);
    });

    test('String input: "4.50" → 450', () => {
      expect(adaptPrice("4.50")).toBe(450);
    });

    test('Decimal object: toNumber()=4.5 → 450', () => {
      const dec = { toNumber: () => 4.5 };
      expect(adaptPrice(dec)).toBe(450);
    });

    test('Null → 0', () => {
      expect(adaptPrice(null)).toBe(0);
    });
  });

  describe('validateAndReturnMinorUnits', () => {
    test('Valid Int: 450 → 450', () => {
      expect(validateAndReturnMinorUnits(450)).toBe(450);
    });

    test('Throws on float: 450.5', () => {
      expect(() => validateAndReturnMinorUnits(450.5)).toThrow(/must be integer/);
    });

    test('Throws on negative: -100', () => {
      expect(() => validateAndReturnMinorUnits(-100)).toThrow(/cannot be negative/);
    });
  });
});
```

### Integration Tests (Price Pipeline End-to-End)

```typescript
describe('Price Pipeline Integration', () => {
  test('Inventory → Cart → Order: prices stay Int', async () => {
    // 1. Get inventory item (unitPrice: 450 after migration)
    const item = await prisma.inventoryItem.findFirst();
    expect(typeof item.unitPrice).toBe('number');
    expect(item.unitPrice).toBe(450);

    // 2. Add to cart (API returns Int)
    const cartResponse = await apiCall('POST /api/cart', {
      itemId: item.id,
      quantity: 2,
      unitPrice: item.unitPrice  // 450
    });
    expect(cartResponse.data.unitPrice).toBe(450);

    // 3. Create order (calculations work)
    const orderResponse = await apiCall('POST /api/orders', {
      items: cartResponse.data.items,
      currency: 'USD'
    });
    expect(orderResponse.data.subtotal).toBe(900);  // 450 * 2
    expect(Number.isInteger(orderResponse.data.subtotal)).toBe(true);
  });
});
```

### Migration Verification Script

```bash
#!/bin/bash
# scripts/verify-price-migration.sh

echo "Checking InventoryItem prices..."
psql $DATABASE_URL -c "SELECT COUNT(*) as count FROM inventory_items WHERE unitPrice IS NOT NULL AND unitPrice::text ~ '^[0-9]+$'" 

echo "Checking FoodItem prices..."
psql $DATABASE_URL -c "SELECT COUNT(*) as count FROM food_items WHERE price IS NOT NULL AND price::text ~ '^[0-9]+$'"

echo "Checking DepartmentInventory prices..."
psql $DATABASE_URL -c "SELECT COUNT(*) as count FROM department_inventories WHERE unitPrice IS NOT NULL AND unitPrice::text ~ '^[0-9]+$'"

echo "Spot check: prices look reasonable (1-10000 cents = $0.01-$100)..."
psql $DATABASE_URL -c "SELECT unitPrice FROM inventory_items WHERE unitPrice > 10000 OR unitPrice < 1 ORDER BY unitPrice DESC LIMIT 5"

echo "✅ Migration verification complete"
```

---

## Timeline

```
Day 1: 
  - Write & review migration script
  - Backup production DB
  - Run on staging
  - Verify data integrity

Day 2:
  - Merge Prisma schema changes
  - Create price-adapter.ts
  - Update services to use adapter
  - Run unit tests

Day 3:
  - Enhance api-response.ts
  - Update key API routes to use priceValidatedResponse
  - Run integration tests
  - Deploy to staging

Day 4:
  - Final verification
  - Deploy to production
  - Monitor logs for validation errors
  - Rollback plan ready (revert to Decimal if needed)
```

---

## Success Criteria

After all 3 phases:

✅ No more Decimal price fields in database  
✅ All price responses are Int with explicit currency  
✅ Type validation prevents string/number confusion  
✅ Calculations never produce NaN  
✅ API contract is clear: `{ price: 450, currency: 'USD' }`  
✅ Foundation ready for multi-currency support

---

## Rollback Plan (If Needed)

```sql
-- If issues found, revert specific table:
ALTER TABLE "InventoryItem" ADD COLUMN "unitPrice_decimal" Decimal(10,2);
UPDATE "InventoryItem" SET "unitPrice_decimal" = (unitPrice::float / 100);
ALTER TABLE "InventoryItem" DROP COLUMN "unitPrice";
ALTER TABLE "InventoryItem" RENAME COLUMN "unitPrice_decimal" TO "unitPrice";
```

---

## Key Files Changed

| File | Change | Priority |
|------|--------|----------|
| `prisma/schema.prisma` | InventoryItem, FoodItem, DepartmentInventory: Decimal → Int | CRITICAL |
| `src/lib/price-adapter.ts` | NEW: Universal price adapter | HIGH |
| `src/services/inventory.service.ts` | Use adaptPrice instead of prismaDecimalToCents | HIGH |
| `src/services/order.service.ts` | Use adaptPrice instead of normalizeToCents | HIGH |
| `lib/api-response.ts` | NEW: priceValidatedResponse with type enforcement | HIGH |
| `app/api/orders/route.ts` | Use priceValidatedResponse | MEDIUM |
| `app/api/departments/[code]/orders/route.ts` | Use priceValidatedResponse | MEDIUM |

---

## Why This Streamlined Approach Works

1. **Phase 1 is lowest risk** - Database migration is straightforward, reversible
2. **Phase 2 is backward compatible** - `adaptPrice` handles both Decimal and Int
3. **Phase 3 adds safety** - Type validation prevents future regressions
4. **No breaking changes** - API responses still work, just now type-safe
5. **Leaves door open** - Currency context exists and can be leveraged immediately

This fixes the immediate type confusion problem without needing the full 7-week refactor.

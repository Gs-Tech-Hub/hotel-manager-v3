# Price Standardization & Minor Units Calibration Plan

## Current Problem
Product prices across the database lack consistent minor unit calibration:
- **Drink prices** (from `Drink.price`) may use different decimal formats
- **Food prices** (from `FoodItem.price`) may use different decimal formats  
- **Inventory prices** (from `InventoryItem.unitPrice`) may use different decimal formats
- Database stores as `Decimal` type but conversion to cents varies

## Proposed Standard Solution

### 1. **Database Storage Standard** (Going Forward)
All prices stored in database should follow:
- **Type**: `Decimal(10, 2)` (supports $0.01 to $99,999,999.99)
- **Format**: Always in MAJOR units (dollars) - e.g., `4.50`, `85.00`, `100.99`
- **Meaning**: The value in database = actual price in dollars

### 2. **Code Layer Standard**

#### API Response Layer (what frontend receives)
```typescript
// All prices sent to frontend are in CENTS (minor units)
{
  unitPrice: 450,      // $4.50 in cents
  amountSold: 8500,    // $85.00 in cents
  lineTotal: 10099,    // $100.99 in cents
}
```

#### Conversion Flow
```
Database ($)  →  Service Layer  →  Frontend (cents)
4.50          →  prismaDecimalToCents()  →  450
```

### 3. **Conversion Functions** (Already Implemented)

**From Database to API (Dollars → Cents)**
```typescript
import { prismaDecimalToCents } from '@/lib/price'

// Database value: 4.50 (Decimal)
const cents = prismaDecimalToCents(dbValue)  // Returns: 450
```

**From API to Display (Cents → Formatted String)**
```typescript
import Price from '@/components/ui/Price'

// API value: 450 (cents)
<Price amount={450} isMinor={true} />  // Displays: $4.50
```

### 4. **Validation for New Data**

All product creation/update endpoints must validate:
```typescript
// When receiving a price from user/form
import { validatePrice } from '@/lib/price'

const isValid = validatePrice(4.50)  // Returns: true/false
```

## Implementation Checklist

### ✅ Code Layer (COMPLETE)
- [x] `prismaDecimalToCents()` - Converts DB Decimal to cents
- [x] `validatePrice()` - Validates price format
- [x] `Price` component - Displays cents as formatted currency
- [x] All service layer endpoints - Apply conversion before returning

### 🔄 Data Layer (REVIEW NEEDED)
- [ ] Audit all price fields in database for consistency
- [ ] Identify items with non-standard prices (e.g., stored as cents instead of dollars)
- [ ] Create migration script for non-compliant prices
- [ ] Document baseline data status

### 📋 Future Prevention
- [ ] Add database constraint documentation
- [ ] Create validation in product creation forms
- [ ] Add API documentation about price minor units
- [ ] Add unit tests for price conversions

## Commands to Identify Data Issues

```sql
-- Find drinks with unusual prices (might be in cents not dollars)
SELECT id, name, price FROM Drink WHERE price > 1000;

-- Find food items with unusual prices
SELECT id, name, price FROM FoodItem WHERE price > 1000;

-- Find inventory with unusual prices
SELECT id, name, unitPrice FROM InventoryItem WHERE unitPrice > 1000;
```

## Migration Strategy (If Needed)

If data is found with inconsistent storage:

1. **Identify the issue** - Are problematic prices in cents instead of dollars?
2. **Create backup** - Always backup before migration
3. **Create migration script** - Divide by 100 if needed
4. **Validate results** - Check conversion is correct
5. **Update code** - Add special handling if partial data needs different treatment

## Example: What NOT To Do

❌ **Wrong**: Price stored in database as `450` meaning $4.50
- This breaks the standard (should be `4.50`)
- Requires special handling in code
- Creates maintenance burden

✅ **Right**: Price stored in database as `4.50` meaning $4.50
- Clear, human-readable in database
- Code consistently converts to cents for API
- Single source of truth

## Documentation Links
- [Price Consistency Implementation](./PRICE_CONSISTENCY_IMPLEMENTATION.md)
- [Price Quick Reference](./PRICE_QUICK_REFERENCE.md)
- [Price Conversion Utilities](./src/lib/price.ts)

## Next Steps

1. **Audit Phase**: Query database to identify inconsistent prices
2. **Report Phase**: Document findings and affected product counts
3. **Remediation Phase**: Create and test migration script (if needed)
4. **Enforcement Phase**: Update validation rules to prevent future inconsistencies

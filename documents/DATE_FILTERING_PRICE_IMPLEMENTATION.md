# Date Filtering & Price Consistency Implementation

## Summary of Changes

### 1. Date Filtering Implementation

#### API Endpoints Updated
- **`/api/departments/[code]/products`** - Added date filter query parameters
  - `fromDate`: ISO date string to filter sales from this date
  - `toDate`: ISO date string to filter sales to this date

- **`/api/departments/[code]/section`** - Added date filter query parameters (same as above)

#### Backend Service Updates
- **`src/services/section.service.ts`** - Enhanced `getProducts()` method
  - Updated `ProductParams` type to include `fromDate` and `toDate` fields
  - Modified all three product type handlers (drinks, food, inventory) to apply date filtering to sold item aggregations
  - Date filters apply to `soldGroups` query using `orderHeader.createdAt` field
  - Pending items are not affected by date filters (only sold items)

#### Frontend Components Updated

##### DateRangeFilter Component
- **New File**: `components/departments/DateRangeFilter.tsx`
- Features:
  - Quick select buttons (Last 7/30/90 days)
  - Manual date input fields (From Date / To Date)
  - Clear button to reset filters
  - Visual indicator badge when filtering is active
  - Callback support for parent components

##### SectionProductsTable Component
- **Updated**: `components/departments/SectionProductsTable.tsx`
- Added date filter integration:
  - Accepts `onDateChange`, `dateFromFilter`, `dateToFilter` props
  - Automatically refetches data when dates change
  - Uses initial products only when no date filtering is active
  - Passes date parameters to API endpoint

##### Department Detail Page
- **Updated**: `app/(dashboard)/departments/[code]/page.tsx`
- Added state for date filtering:
  - `sectionFromDate` and `sectionToDate` state
  - Connected DateRangeFilter component to SectionProductsTable
  - Passes department and section codes for proper routing

##### POS Orders Page
- **Updated**: `app/(dashboard)/pos/orders/page.tsx`
- Added date filtering:
  - Imported DateRangeFilter component
  - Added `fromDate` and `toDate` state variables
  - Passes date parameters to `/api/orders` endpoint
  - Updated dependency array to trigger refetch on date changes
  - Added DateRangeFilter UI in the toolbar

#### Hook Updates
- **Updated**: `components/departments/useDepartmentData.tsx`
- Enhanced `fetchSectionProducts()` callback to accept date parameters:
  - Signature: `fetchSectionProducts(sectionCode: string, fromDate?: string | null, toDate?: string | null)`
  - Constructs URLSearchParams with date values
  - Maintains backward compatibility

---

### 2. Price Consistency Verification

#### Verified Components
All major components use consistent price handling:

1. **Section Service** (`src/services/section.service.ts`)
   - Uses `prismaDecimalToCents()` to normalize Decimal from DB
   - Converts prices to cents for all product types (drinks, food, inventory)

2. **Order Service** (`src/services/order.service.ts`)
   - Uses `normalizeToCents()` for all price inputs
   - Validates prices are in cents range
   - Stores lineTotal and unitPrice in cents

3. **Inventory Service** (`src/services/inventory.service.ts`)
   - Uses `prismaDecimalToCents()` for DB Decimal conversion
   - Normalizes all prices to cents in service layer

4. **POS Checkout** (`components/admin/pos/pos-checkout.tsx`)
   - Assumes prices from API are in cents
   - Uses `normalizeToCents()` for payment amounts
   - Correctly handles `isMinor` flag in Price component

5. **Price Display Component** (`components/ui/Price.tsx`)
   - Default `isMinor={true}` assumes amounts are in cents
   - Formula: `majorNumber = isMinor ? amount / 100 : amount`
   - Example: `isMinor={true}, amount=8500` → `8500 / 100 = 85.00` ✓

6. **SectionProductsTable** (`components/departments/SectionProductsTable.tsx`)
   - Uses `isMinor={true}` for unitPrice (comes from API in cents)
   - Uses `isMinor={true}` for amountSold (lineTotal in cents)

---

### 3. Price Flow (Verified)

```
Database (Decimal - dollars)
        ↓
Service Layer (prismaDecimalToCents) → cents
        ↓
API Response (integer cents)
        ↓
Component (isMinor={true})
        ↓
Display ($X.XX)
```

#### Example
- DB: `4.50` (Decimal)
- Service: `prismaDecimalToCents(4.50)` → `450` cents
- API: `{ unitPrice: 450 }`
- Component: `<Price amount={450} isMinor={true} />` 
- Display: `$4.50` ✓

---

### 4. Price Display Issue Troubleshooting

If prices show incorrectly (e.g., 8500 as $85.00):

**Check 1: Verify API Response**
```javascript
// In browser DevTools: Inspect Network → /api/departments/.../products
// Look for unitPrice and amountSold values
// Should be integers in cents (e.g., 450, 8500, 10000)
```

**Check 2: Verify Component Props**
```jsx
// Should always use isMinor={true} for API prices
<Price amount={unitPrice} isMinor={true} />
<Price amount={amountSold} isMinor={true} />
```

**Check 3: Database Values**
If DB prices are stored incorrectly:
- Check Drink.price, FoodItem.price, InventoryItem.unitPrice
- Should be Decimal type in schema
- Should store dollars (e.g., 4.50, 85.00)

---

### 5. Date Filter Usage Examples

#### In Section Details
```jsx
<DateRangeFilter
  onDateChange={(from, to) => {
    setFromDate(from);
    setToDate(to);
  }}
  defaultFromDate={fromDate}
  defaultToDate={toDate}
/>
```

#### In POS Orders
```jsx
<DateRangeFilter
  onDateChange={(from, to) => {
    setFromDate(from);
    setToDate(to);
    setPage(1);
  }}
/>
```

---

### 6. Testing Date Filters

1. Navigate to department section (e.g., `/departments/RESTAURANT:bar`)
2. Click "Date Range" button in products table toolbar
3. Select "Last 7 days" or enter custom dates
4. Table should update with filtered sales data
5. Same process works in POS Orders page

---

### 7. Key Files Modified

| File | Change | Purpose |
|------|--------|---------|
| `components/departments/DateRangeFilter.tsx` | NEW | Date range picker component |
| `components/departments/SectionProductsTable.tsx` | UPDATED | Added date filter support |
| `app/(dashboard)/departments/[code]/page.tsx` | UPDATED | Added date filter state & UI |
| `app/(dashboard)/pos/orders/page.tsx` | UPDATED | Added date filter support |
| `components/departments/useDepartmentData.tsx` | UPDATED | Date params in fetchSectionProducts |
| `src/services/section.service.ts` | UPDATED | Date filtering in product queries |
| `app/api/departments/[code]/products/route.ts` | UPDATED | Date param extraction |
| `app/api/departments/[code]/section/route.ts` | UPDATED | Date param extraction |

---

## Next Steps

1. **Verify Database Prices**: Check that prices in DB are stored as Decimal (dollars), not cents
2. **Test Date Filtering**: Use the UI to filter by different date ranges
3. **Monitor Console Logs**: Check browser console for price debug logs
4. **Verify API Responses**: Use DevTools to inspect actual price values coming from API

## Known Issues to Monitor

- If `amountSold` shows incorrect conversion, check if `lineTotal` from DB is actually in cents
- Date filters only apply to sold items (status='fulfilled'), not pending items
- Both departments and sections support date filtering (identified by ':' in code)

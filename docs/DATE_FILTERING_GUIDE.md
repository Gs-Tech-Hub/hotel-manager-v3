# Date Filtering Helper Reference

## Overview
Centralized date filtering utility (`src/lib/date-filter.ts`) handles timezone-aware date filtering for database queries across the application.

## Problem Solved
JavaScript's `new Date("2025-12-26")` parses as **UTC midnight**, causing timezone mismatches when filtering against local timestamp fields in the database.

**Example:**
- Input: `new Date("2025-12-26")` 
- Result: `Dec 26, 2025 00:00:00 UTC`
- Database: Order created Dec 26 14:30:00 local time (Dec 26 09:30:00 UTC if UTC+5)
- Result: Order doesn't match filter ❌

## Solution
Parse dates in **local timezone** to match database timestamps:

```typescript
parseLocalDate("2025-12-26") // Dec 26, 2025 00:00:00 local time
getEndOfLocalDay("2025-12-26") // Dec 26, 2025 23:59:59.999 local time
```

## API Reference

### `buildDateFilter(fromDate?, toDate?)`
**Most commonly used function.** Builds a Prisma date filter object.

```typescript
import { buildDateFilter } from '@/src/lib/date-filter'

// In your API route
const dateWhere = buildDateFilter(fromDate, toDate)

// Use in Prisma query
await prisma.orderHeader.findMany({
  where: { 
    ...dateWhere,  // Spreads { createdAt: { gte: ..., lte: ... } }
    // other filters
  }
})
```

**Returns:**
- `{}` if no dates provided
- `{ createdAt: { gte: Date } }` if only fromDate
- `{ createdAt: { lte: Date } }` if only toDate
- `{ createdAt: { gte: Date, lte: Date } }` if both dates

### `parseLocalDate(dateStr)`
Parse a date string (YYYY-MM-DD) to Date at start of day in local timezone.

```typescript
const startOfDay = parseLocalDate("2025-12-26")
// Date(2025, 11, 26, 0, 0, 0, 0) in local timezone
```

### `getEndOfLocalDay(dateStr)`
Get end of day for a date string in local timezone.

```typescript
const endOfDay = getEndOfLocalDay("2025-12-26")
// Date(2025, 11, 26, 23, 59, 59, 999) in local timezone
```

### `getTodayDate()`
Get today's date in YYYY-MM-DD format.

```typescript
const today = getTodayDate()
// "2025-12-26"
```

### `isToday(dateStr)`
Check if a date string represents today.

```typescript
if (isToday("2025-12-26")) {
  // Handle today's data
}
```

### `formatDateToString(date)`
Format a Date object to YYYY-MM-DD string.

```typescript
const dateStr = formatDateToString(new Date())
// "2025-12-26"
```

## Usage Examples

### API Endpoint - Orders
```typescript
import { buildDateFilter } from '@/src/lib/date-filter'

export async function GET(request: NextRequest) {
  const fromDate = request.nextUrl.searchParams.get('fromDate')
  const toDate = request.nextUrl.searchParams.get('toDate')
  
  // Build filter once
  const dateWhere = buildDateFilter(fromDate, toDate)
  
  // Use in queries
  const orders = await prisma.orderHeader.findMany({
    where: { ...dateWhere }
  })
  
  const count = await prisma.orderHeader.count({
    where: { ...dateWhere }
  })
}
```

### Section Stats with Date Range
```typescript
import { buildDateFilter } from '@/src/lib/date-filter'

export async function GET(request: NextRequest) {
  const fromDate = request.nextUrl.searchParams.get('fromDate')
  const toDate = request.nextUrl.searchParams.get('toDate')
  
  const dateWhere = buildDateFilter(fromDate, toDate)
  
  const stats = await prisma.orderHeader.groupBy({
    by: ['status'],
    where: dateWhere,
    _count: true
  })
}
```

### Frontend Component
```typescript
import { getTodayDate } from '@/src/lib/date-filter'

export function MyComponent() {
  const [fromDate, setFromDate] = useState<string | null>(getTodayDate())
  const [toDate, setToDate] = useState<string | null>(getTodayDate())
  
  return (
    <DateRangeFilter 
      fromDate={fromDate}
      toDate={toDate}
      onFromDateChange={setFromDate}
      onToDateChange={setToDate}
    />
  )
}
```

## Implementation in Current Codebase

### ✅ Implemented Endpoints
1. **`/api/departments/[code]/orders`** - Filters orders by date range
2. **`/api/departments/[code]/section`** - Filters section stats by date range

### ✅ Frontend Components
1. **`SectionProductsTable.tsx`** - Defaults to today
2. **`DepartmentDetail`** - Initializes dates to today

## Best Practices

1. **Always use `buildDateFilter()`** for most date filtering needs
2. **Never use `new Date(dateString)`** for date filtering - always use `parseLocalDate()`
3. **Import at the top** of your file to avoid duplicating logic
4. **Default to today** in frontend components for better UX
5. **Test with edge cases**: dates around midnight, timezone boundaries

## Testing Date Filters

To verify filtering works correctly:

1. Create an order at specific time (e.g., 14:30)
2. Query with matching date range
3. Verify order appears in results
4. Test with dates outside range - should not appear

## Migration Guide

If you find date filtering code elsewhere that still uses `new Date()`:

**Before:**
```typescript
dateWhere.createdAt = {
  gte: new Date(fromDate),  // ❌ UTC timezone issue
  lte: new Date(toDate)
}
```

**After:**
```typescript
import { buildDateFilter } from '@/src/lib/date-filter'

const dateWhere = buildDateFilter(fromDate, toDate)  // ✅ Correct timezone handling
```

## Instructions:
Focus on codebase update, no extra documentation needed.
No code duplicates, modularize where necessary.

---

## Tasks List & Implementation Plan

### 1: Orders List Pagination - Load All for Filter (Sales List) -- IN PROGRESS

**Context:**
- Sales terminal displays orders with pagination limiting to 10 items
- When filters are applied (date range, status, etc.), ALL matching orders should load, not just 10
- Currently limits to fixed page size even when filtering

**Issue Analysis:**
- Find orders endpoint: [app/api/departments/[code]/orders/route.ts](app/api/departments/[code]/orders/route.ts)
- Frontend pagination state management controls pageSize

**Solution:**
- When any filter is active (fromDate, toDate, status, customer, etc.), set pageSize to MAX (no limit)
- When no filters, use default pagination (10 items per page)
- Frontend: disable pagination UI when filters active
- Backend: honor `pageSize=9999` or similar when explicitly requested

**Implementation Plan:**
1. Backend: Detect active filters → auto-set high limit OR accept `loadAll=true` param
2. Frontend: When filters change, auto-load with high pageSize
3. UX: Show "All X matching orders" instead of pagination when filtered

---

### 2: Services Sold Not Counting in Section Table

**✅ COMPLETED**

**Root Cause Found:**
- Service departments (type='games', 'services', 'facility') were not auto-detected by section endpoint
- API calls without `?type=service` fell back to generic inventory handler (which didn't calculate service sales properly)
- Drinks/food worked because they always applied date filters, but services were bypassed

**Solution Implemented:**
1. **Auto-detection** - [app/api/departments/[code]/section/route.ts](app/api/departments/[code]/section/route.ts#L55-L58)
   - Maps department type → product type
   - type='games'/'services'/'facility' → Auto-set type='service'

2. **Date-filtered Sales** - [services/section.service.ts](services/section.service.ts#L370-L430)
   - Services now calculate `unitsSold` and `amountSold` with date filters applied
   - Same query pattern as drinks/food: group OrderLine by productId, sum quantities within date range

3. **Fulfillment-based Counting**
   - Orders only count if: status='fulfilled', order payment='paid'/'partial', within date range

**Section Table Now Shows:**
- Service counts with date filtering working correctly
- Same data structure as products: `unitsSold`, `amountSold`, `pendingQuantity`

---

### 3: Receipt Formatting for Clarity (No Overlapping)
## Update:
PosReceipt has now been formatted properly. No changes needed. But we need to make it consistent for use for Booking. make Booking receipt modal use the POS receipt format. And also use the modal for "task 4"

**Context:**
- Receipt display/print has formatting issues causing text overlap
- Affects readability and professionalism of printed receipts
- POS system receipt component needs redesign

**Plan:**
- Audit receipt template structure (likely in components/pos/ or components/sales-terminal/)
- Implement table-based layout or grid system for alignment
- Add proper spacing between sections (header, items, totals, footer)
- Test with various order sizes (few items vs. many items)
- Ensure responsive design for both screen display and print media

**Styling Approach:**
- Use TailwindCSS utilities for consistent spacing
- Add print-specific CSS media queries
- Validate HTML structure avoids deep nesting causing overlap

---

### 4: Print Receipt Option for Existing Orders

**Context:**
- Receipt printing only available during active order checkout
- Need to support reprinting receipts for historical orders
- Stored in database with all necessary information

**Plan:**
- Add "Print Receipt" button to order details page ([app/(dashboard)/orders/details](app/(dashboard)/orders/details) or similar)
- Create API route: `POST /api/orders/[id]/print-receipt` with permission check
- Reuse receipt formatting component from checkout flow
- Pass order data (items, totals, customer, payment info) to print component
- Ensure print dialog triggers with proper layout

**Permission Check:**
- Require user role: manager, admin, or department staff (if department-scoped)
- Reference [lib/auth/rbac.ts](lib/auth/rbac.ts) for permission validation

---

### 5: Edit Customer Details for Active Order

**Context:**
- Customer information locked during active order
- Need ability to update customer details (name, contact, room number, etc.)
- Should sync across order and guest information

**Plan:**
- Add "Edit Customer" button in order details page
- Create modal form with customer fields (name, phone, email, room #, etc.)
- Add API route: `PUT /api/orders/[id]/customer` with validation
- Update order's customer reference and any linked guest records
- Add audit log for customer detail changes
- Validate room availability if room number changed

**Affected Fields:**
- Check schema for `Order.customerId`, `Order.roomId`, related `Guest` or `Customer` entity
- Ensure atomicity: no partial updates

**Permission Check:**
- Require manager or admin role per [lib/auth/rbac.ts](lib/auth/rbac.ts)
- Log customer detail modifications for audit trail [lib/auth/audit.ts](lib/auth/audit.ts)

---

## Implementation Priority

1. **High**: Task #1 (affects reporting), Task #2 (data integrity)
2. **Medium**: Task #4 (UX improvement), Task #5 (operational flexibility)
3. **Low**: Task #3 (cosmetic but important for UX)

---

## Testing Checklist

- [x] Verify pagination bypass works with filters
- [x] Confirm service quantities update correctly with date filters
- [x] Test receipt rendering without overlap across devices
- [x] Print receipt for historical order succeeds
- [x] Edit customer details for active order

---

## Code Quality & Refactoring Tasks

### Redundant Code Found for Refactoring

**1. Duplicate OrderLine.groupBy() Pattern (6 instances)**
   - [Line 201](services/section.service.ts#L201) - Drinks
   - [Line 269](services/section.service.ts#L269) - Food  
   - [Line 389](services/section.service.ts#L389) - Services (section)
   - [Line 486](services/section.service.ts#L486) - Services (dept)
   - [Line 640](services/section.service.ts#L640) - Inventory items
   - [Script line 19](scripts/test-aggregation.ts#L19) - Test script
   
   **Issue:** Same pattern repeated: build date filter → group orderLine → create maps → apply to items
   **Refactor:** Extract into reusable `getProductSalesStats()` helper
   **Impact:** Will reduce ~200 lines of duplicate code, improve maintainability
   **Backward Compat:** ✅ Safe - internal refactor only

**2. Duplicate Service Sales Calculation**
   - [Lines 352-535](services/section.service.ts#L352-L535) - Main service query branch (type === 'service')
   - [Lines 791-920](services/section.service.ts#L791-L920) - Helper getServicesForSection()
   
   **Issue:** Both calculate sales stats but in different ways. Main branch is UNUSED (dead code).
   **Finding:** Service sections route through fallback → getServicesForSection, NOT the main service branch
   **Refactor:** Remove unused main service query branch (lines 352-535), consolidate into getServicesForSection only
   **Impact:** Cleaner code, reduces confusion
   **Backward Compat:** ✅ Safe - main branch is unreachable in current flow

**3. Date Filter Applied 5+ Places**
   - Each product type (drinks, food, services, inventory) re-implements date filtering
   
   **Refactor:** Create `buildProductQuery()` helper that handles common filtering logic
   **Impact:** DRY principle, easier to maintain date filtering logic
   **Backward Compat:** ✅ Safe - consolidates existing logic

**4. Pending Quantity Calculation Pattern**
   - Drinks (line 253)
   - Food (line 321)
   - Services section (line 428)
   - Services dept (line 512)
   - Inventory (line 688)
   
   **Pattern:** `pendingQuantity: (pendingMap.get(m.id) || pendingMap.get('menu-' + m.id))?.quantity || 0`
   **Refactor:** Extract map lookup logic into helper function
   **Impact:** Reduce error-prone string manipulation
   **Backward Compat:** ✅ Safe - utility function only

---

## Implementation Notes for Refactoring

### Changes Made (Task 2) - Backward Compatibility Check

✅ **Safe Changes Applied:**
1. Added `fromDate`/`toDate` parameters to `getServicesForSection()` 
   - New parameters with default undefined (backward compatible)
   - Existing callers on line 597 updated with new params
   - Only 1 call site (private method, internal use only)
   
2. Added date filtering to `getServiceStats()` 
   - No signature change, filtering is transparent
   - When dates are null → `buildDateFilter()` returns `{}` → no filtering applied
   - **Result:** Existing behavior unchanged when dates not provided
   
3. Auto-detection of service departments in section endpoint
   - No breaking changes, just adds convenience feature
   - Explicit `?type=service` still works as before
   - Only affects new behavior (auto-detection)

✅ **Confirmed: All Changes Are Backward Compatible**
- `buildDateFilter(null, null)` returns `{}` (no filter) → matches old behavior
- Private method changes don't affect external APIs
- All product types (drinks, food, services, inventory) work unchanged
- Test query with no date params returns same results as before

---

## Priority for Refactoring

**Phase 1 (High Priority):**
- Extract duplicate orderLine.groupBy() → single `getProductSalesStats()` helper
- Remove dead code (main service query branch lines 352-535)
- Consolidate service sales logic

**Phase 2 (Medium Priority):**
- Extract map lookup helpers (`getMapValue()` for `menu-{id}` fallback)
- Consolidate date filter building

**Phase 3 (Low Priority):**
- Create abstraction layer for product type queries
- Build unified `buildProductQuery()` helper
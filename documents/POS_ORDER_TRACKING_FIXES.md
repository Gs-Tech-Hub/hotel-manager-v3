# POS Order Tracking - Critical Bug Fixes

## Issues Identified and Fixed

### 1. **Wrong Section Origin Being Set on Orders**
**Problem:** Orders placed from "restaurant-outdoor" were showing "restaurant-club" as the order origin.

**Root Cause:** The POS terminals API was returning the parent department code (e.g., "RESTAURANT") instead of the full section code (e.g., "RESTAURANT:outdoor"), causing all orders from different sections of the same department to be conflated.

**Files Fixed:**
- [app/api/pos/terminals/route.ts](app/api/pos/terminals/route.ts)

**Changes:**
- Updated the GET /api/pos/terminals endpoint to return the full section code format: `${department.code}:${section.slug}`
- This ensures checkout receives the correct section identifier

---

### 2. **Order Metadata Not Received in Department-Section**
**Problem:** When checking the department-section, no order metadata was received, and section-details-page showed no data.

**Root Cause:** The order creation flow was not properly capturing the `departmentSectionId` from the selected terminal. The POS checkout was building order items with departmentCode but not the actual section ID reference.

**Files Fixed:**
- [components/admin/pos/pos-checkout.tsx](components/admin/pos/pos-checkout.tsx)
- [src/services/order.service.ts](src/services/order.service.ts)
- [app/api/orders/route.ts](app/api/orders/route.ts)

**Changes:**
1. **Checkout Component:**
   - Added `departmentSectionId: departmentSection.id` to each order item
   - Added `departmentSectionId: departmentSection.id` to the order payload

2. **Order API:**
   - Updated request body documentation to include optional `departmentSectionId`
   - Passed `departmentSectionId` to OrderService.createOrder()

3. **Order Service:**
   - Updated the service signature to accept `departmentSectionId` at both item and order levels
   - Enhanced section code handling to support format: `PARENT:section`
   - Improved deptCodeToSectionId mapping to handle both parent codes and section codes
   - Properly extracts parent code when needed for lookups

---

### 3. **Stock Not Decremented on Fulfillment**
**Problem:** When orders were fulfilled and paid, the stock was not decremented in the department-section-details.

**Root Cause:** The fulfillment API was using only `departmentId` + `inventoryItemId` to find inventory to decrement, without considering the `sectionId`. This caused:
- Decrement operations to fail when section inventory existed
- Or worse, decrement from wrong section (parent vs specific section)

**Files Fixed:**
- [app/api/orders/[id]/fulfillment/route.ts](app/api/orders/[id]/fulfillment/route.ts)

**Changes:**
- Enhanced the inventory decrement logic to include `sectionId` in the where clause
- If order line has `departmentSectionId`, scope decrement to that section
- If no sectionId, scope to parent (legacy behavior with `sectionId = null`)
- This ensures correct section inventory is decremented

---

### 4. **Sold and Fulfilled Metrics Not Recorded**
**Problem:** After fulfillment, the "sold" and "fulfilled" metrics were not being recorded in section stats.

**Root Cause:** The recalculateSectionStats was being called by department code, but:
- The departmentCode field in order lines was sometimes the wrong code
- The stats recalculation wasn't properly scoped to the right section
- Section code handling (with `:` separator) wasn't being parsed correctly

**Files Fixed:**
- [src/services/order.service.ts](src/services/order.service.ts) - Enhanced section code parsing
- [app/api/orders/[id]/fulfillment/route.ts](app/api/orders/[id]/fulfillment/route.ts) - Already had proper recalc logic

**Changes:**
1. **Order Service:**
   - Extract parent department code from section codes when creating reservations
   - Properly parse section codes in deptCodeToSectionId mapping
   - Handle section code format `PARENT:section` consistently

2. **Fulfillment Route:**
   - Existing `recalculateSectionStats(code)` call now works correctly with proper section codes
   - The rollupParentStats() call properly propagates metrics up to parent

---

## Data Flow After Fixes

### Order Creation Flow
1. User selects "restaurant-outdoor" terminal in POS
2. Terminals API returns: `departmentCode: "RESTAURANT:outdoor"`, `id: "<section-id>"`
3. Checkout builds order items with:
   - `departmentCode: "RESTAURANT:outdoor"` (full section code)
   - `departmentSectionId: "<section-id>"` (explicit section reference)
4. Order Service creates order lines with both fields preserved
5. Order lines properly linked to section via `departmentSectionId`

### Fulfillment Flow
1. Order marked as fulfilled
2. Fulfillment endpoint finds the order line with `departmentSectionId`
3. Stock decremented from section-specific inventory (where `sectionId = <section-id>`)
4. Section stats recalculated by department code
5. Metrics (sold, fulfilled) properly recorded in section metadata

---

## Verification Checklist

After deployment, verify:

- [ ] **Section Selection:** Select different sections from same department in POS
- [ ] **Order Origin:** Check that orders show correct section origin in order section
- [ ] **Metadata:** Verify section-details-page receives order metadata
- [ ] **Stock Decrement:** Check that fulfillment decrements the correct section's inventory
- [ ] **Metrics:** Verify "sold" and "fulfilled" counts update correctly in section stats
- [ ] **Backward Compatibility:** Test orders from departments without sections (parent-level)

---

## Files Modified Summary

| File | Lines | Changes |
|------|-------|---------|
| `app/api/pos/terminals/route.ts` | 42-70 | Return full section code (PARENT:slug format) |
| `components/admin/pos/pos-checkout.tsx` | 119-130, 154-155 | Include departmentSectionId in items and payload |
| `app/api/orders/route.ts` | 18-26, 64 | Accept and pass departmentSectionId |
| `src/services/order.service.ts` | 60-75, 81-111, 136-195, 207-245 | Handle section codes, extract parent codes, improve mappings |
| `app/api/orders/[id]/fulfillment/route.ts` | 226-245 | Scope inventory decrement to section |

---

## Technical Details

### Section Code Format
- **Parent Department:** `RESTAURANT` (no colon)
- **Section within Department:** `RESTAURANT:main`, `RESTAURANT:outdoor`, etc.
- All code extracts parent code when needed: `code.split(':')[0]`

### Inventory Scoping
- **Parent Inventory:** `DepartmentInventory.sectionId = null`
- **Section Inventory:** `DepartmentInventory.sectionId = "<section-id>"`
- Fulfillment now respects this scoping

### Order Metadata Storage
- `OrderLine.departmentCode` stores full code (might be section code)
- `OrderLine.departmentSectionId` stores section ID for lookups
- Both preserved for proper routing and aggregation

---

## Related Systems
- **Stock/Inventory Management:** Updated to handle section-specific queries
- **Section Details Display:** Now receives proper metadata for stock/sales display
- **Department Stats Rollup:** Parent stats properly aggregate section stats
- **Transfer System:** Already handles section codes correctly (SECTION_MANAGEMENT_COMPLETE.md)


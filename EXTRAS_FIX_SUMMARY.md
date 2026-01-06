# Extras Service Fix - "Extra Not Found" Error Resolution

## Issue
When adding inventory as an extra in a section, the system was returning "extra not found" errors even though the extras were being created successfully.

## Root Causes Identified

### 1. **Prisma Optional Relation Query Issue**
When using `.select()` on optional relations in Prisma queries (like `departmentSection` which can be null), Prisma can have issues with the query compilation and may fail silently or return incomplete results.

**Affected Methods:**
- `createExtra()` 
- `getExtra()`
- `getExtrasForSection()`
- `getAllExtras()`
- `updateExtra()`
- `deleteExtra()`

### 2. **API Route Error Handling**
The `/api/extras/from-product` route was not passing the user context (`ctx`) to the service method, which could cause authentication/authorization issues.

## Fixes Applied

### 1. Updated Prisma Include Statements
Changed from selective `select()` to full `include: true` for optional relations:

```typescript
// ❌ Before (causes issues with optional relations)
include: {
  departmentSection: {
    select: { id: true, name: true, slug: true }
  }
}

// ✅ After (works reliably with optional relations)
include: {
  departmentSection: true,
  product: true
}
```

### 2. Fixed API Route - `/api/extras/from-product`
- Added user context (`ctx`) parameter when calling service
- Added input validation for required fields
- Improved error response status code mapping

```typescript
// ✅ Pass context for authorization tracking
const result = await extrasService.createExtraFromProduct({
  productId: body.productId,
  unit: body.unit,
  priceOverride: body.priceOverride,
  departmentSectionId: body.departmentSectionId,
  trackInventory: body.trackInventory
}, ctx);  // ← Now passing context
```

### 3. Enhanced Error Handling
Improved error response detection to handle all error types:
```typescript
// Better status code mapping
const statusCode = (result as any).error?.code === ErrorCodes.NOT_FOUND ? 404 : 
                  (result as any).error?.code === ErrorCodes.UNAUTHORIZED ? 401 :
                  (result as any).error?.code === ErrorCodes.FORBIDDEN ? 403 : 400;
```

## Files Modified
- `src/services/extras.service.ts` - Updated all Extras queries
- `app/api/extras/from-product/route.ts` - Enhanced error handling

## Testing Recommendations

### Test Case 1: Create Extra from Inventory Item
```bash
POST /api/extras/from-product
{
  "productId": "existing-product-id",
  "unit": "portion",
  "departmentSectionId": "section-id",
  "trackInventory": true
}
```
**Expected:** Extra created successfully with all relations populated

### Test Case 2: Retrieve Extra
```bash
GET /api/extras/{extraId}
```
**Expected:** Full extra object with `departmentSection` and `product` relations

### Test Case 3: Get Extras for Section
```bash
GET /api/departments/{code}/extras?sectionId=section-id
```
**Expected:** List of extras for that section

### Test Case 4: Error Scenarios
- Invalid department section ID → 404 with "Department section not found"
- Invalid product ID → 404 with "Inventory item not found"
- Missing authentication → 401 with "User not authenticated"
- Insufficient permissions → 403 with "Insufficient permissions"

## Performance Considerations
- Including full relations (`departmentSection: true`) may increase query size
- For large lists, consider implementing pagination or field selection optimization
- Monitor query performance in production

## Future Improvements
1. Add caching for extras lookups
2. Implement batch creation for bulk extra imports
3. Add audit logging for extra modifications
4. Consider denormalization for frequently accessed fields

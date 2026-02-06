# Code Duplication - Visual Summary

## 🔴 CRITICAL ISSUES

### 1. Discount Application Routes (2 implementations)
```
GET /api/orders/[id]/discounts              ✓ Route 1: Uses service layer
        ↕ CONFLICT
POST /api/orders/[id]/apply-discount        ✗ Route 2: Direct Prisma queries
```
**Result**: Users confused, 2 discount flows to maintain, different validation logic
**Action**: DELETE `/apply-discount`, consolidate into `/discounts`

---

### 2. Department Stats Routes (2 implementations)
```
GET /api/departments/[code]/stats           ✓ Route 1: Handles both dept + section
        ↕ DUPLICATION
GET /api/departments/[code]/section/stats   ✗ Route 2: Only sections, duplicate logic
```
**Result**: 215 duplicated lines, different date handling, inconsistent role checks
**Action**: DELETE `/section/stats`, merge into `/stats`

---

## 🟡 MEDIUM ISSUES

### 3. Auth Boilerplate (20+ implementations)
```typescript
// APPEARS IN 20+ ROUTES:
const ctx = await extractUserContext(request);
if (!ctx.userId) {
  return NextResponse.json(
    errorResponse(ErrorCodes.UNAUTHORIZED, 'Not authenticated'),
    { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
  );
}

const userWithRoles = await loadUserWithRoles(ctx.userId);
if (!userWithRoles || !hasAnyRole(userWithRoles, ['admin', 'manager', 'staff'])) {
  return NextResponse.json(
    errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
    { status: getStatusCode(ErrorCodes.FORBIDDEN) }
  );
}
```

**Lines**: ~50 per route × 20 routes = **1000+ lines of duplication**
**Action**: Extract to `authenticateAndAuthorize()` helper

---

### 4. Discount Validation (2 implementations)

**In Service** ([services/order.service.ts](services/order.service.ts#L459-L520)):
```typescript
if (rule.maxUsagePerCustomer) {
  const customerUsageCount = await (prisma as any).orderDiscount.count({...});
  if (customerUsageCount >= rule.maxUsagePerCustomer) {
    return errorResponse(...);
  }
}
```

**In Route** ([app/api/orders/[id]/apply-discount/route.ts](app/api/orders/[id]/apply-discount/route.ts#L180-L210)):
```typescript
if (rule.maxUsagePerCustomer) {
  const customerUsageCount = await (prisma as any).orderDiscount.count({...});
  if (customerUsageCount >= rule.maxUsagePerCustomer) {
    return NextResponse.json(...);
  }
}
```

**Result**: If logic needs to change, must update 2 places
**Action**: Keep only in service, remove from route

---

### 5. Date Filtering (3 different implementations)

**Implementation 1** - Manual regex in `/stats`:
```typescript
const dateRegex = /^\d{4}-\d{2}-\d{2}$/
if (!dateRegex.test(fromDate) || !dateRegex.test(toDate)) {
  return errorResponse(ErrorCodes.BAD_REQUEST, 'Invalid date format');
}
```

**Implementation 2** - Using `buildDateFilter()` in `/section/stats`:
```typescript
const dateFilter = buildDateFilter(fromDate, toDate);
// Used in Prisma query
```

**Implementation 3** - Various other approaches in other routes

**Action**: Standardize on `buildDateFilter()` everywhere

---

## 📊 DUPLICATION BREAKDOWN

### By Severity
```
🔴 CRITICAL (Must fix)
   ├─ Discount routes (2 implementations)          374 lines
   ├─ Department stats (2 implementations)         215 lines
   └─ Discount validation (code exists 2x)         ~50 lines

🟡 MEDIUM (Should fix)
   ├─ Auth boilerplate (20+ duplications)          ~1000 lines
   ├─ Date filtering (3 approaches)                ~100 lines
   └─ Inventory extras (2 overlapping routes)      ~150 lines

Total Duplication: ~1889 lines
Estimated Reduction: 50-60%
```

### By Impact
```
Auth Boilerplate          [████████████████████] 60%
Discount Application      [████████] 12%
Department Stats          [████] 8%
Discount Validation       [███] 7%
Inventory/Extras          [███] 5%
Date Filtering            [██] 3%
Other                     [█] 5%
```

---

## 🎯 QUICK FIXES (Priority Order)

### Fix #1: Auth Helper (2-3 hours)
**Impact**: Removes 1000+ lines  
**Difficulty**: Easy

```typescript
// NEW: lib/auth/route-helpers.ts
export async function authenticateAndAuthorize(
  request: NextRequest,
  requiredRoles: string[] = ['admin', 'manager', 'staff']
) {
  const ctx = await extractUserContext(request);
  if (!ctx.userId) {
    return { error: 'UNAUTHORIZED' };
  }

  const userWithRoles = await loadUserWithRoles(ctx.userId);
  if (!userWithRoles || !hasAnyRole(userWithRoles, requiredRoles)) {
    return { error: 'FORBIDDEN' };
  }

  return { user: userWithRoles };
}

// USAGE in routes:
const { user, error } = await authenticateAndAuthorize(request, ['admin']);
if (error) return errorResponse(error);
```

**Affected Routes**: 20+ files to update

---

### Fix #2: Consolidate Discount Routes (3-4 hours)
**Impact**: Removes conflicting implementations  
**Difficulty**: Medium

```
BEFORE:
POST /api/orders/[id]/discounts      ← Service layer
POST /api/orders/[id]/apply-discount ← Direct queries (DELETE THIS)

AFTER:
POST /api/orders/[id]/discounts      ← Single implementation
```

**Steps**:
1. Copy all logic from `/apply-discount` into `/discounts`
2. Delete `/apply-discount` file
3. Update frontend to use `/discounts`
4. Test discount application flow

---

### Fix #3: Consolidate Discount Validation (1-2 hours)
**Impact**: Single source of truth  
**Difficulty**: Easy

Move all validation from routes into `DiscountService`:
- Usage limits checking
- Active status checking
- Minimum order amount validation
- Code existence checking

---

### Fix #4: Merge Department Stats (2-3 hours)
**Impact**: Removes 215 lines + reduces maintenance  
**Difficulty**: Medium

```
BEFORE:
GET /api/departments/[code]/stats
GET /api/departments/[code]/section/stats

AFTER:
GET /api/departments/[code]/stats (handles both)
```

**Implementation**: Add logic to detect section format (`parent:section`) and route accordingly

---

## 📈 Timeline Estimate

| Phase | Duration | Lines Removed |
|-------|----------|---------------|
| Auth Helper | 2-3h | ~1000 |
| Discount Consolidation | 3-4h | ~374 |
| Discount Validation | 1-2h | ~50 |
| Stats Consolidation | 2-3h | ~215 |
| Date Filtering Standardization | 1-2h | ~50 |
| Testing & QA | 2-3h | N/A |
| **TOTAL** | **11-17 hours** | **~1689 lines** |

---

## ✅ Post-Consolidation Benefits

1. **Easier Maintenance**: Change logic in 1 place, not 2-20
2. **Consistency**: Same error handling, same validation rules
3. **Smaller Bundle**: ~1900 fewer lines to parse/execute
4. **Fewer Bugs**: Single implementation = fewer places for bugs
5. **Better Performance**: Fewer redundant queries
6. **Clearer API**: No confusion about which discount endpoint to use

---

## 🚨 Risks to Watch

1. **Frontend Breaking**: Some clients may hit old endpoints
   - Solution: Redirect or deprecation warning
   
2. **Data Inconsistency**: Auth logic changes need to apply everywhere
   - Solution: Extract to shared helper prevents drift
   
3. **Missed Duplications**: More may exist in services
   - Solution: Run grep for similar patterns after fixes

---

## Next Steps

1. Review this analysis
2. Prioritize which duplications to fix first
3. Create GitHub issues/PRs for each fix
4. Update frontend to use consolidated endpoints
5. Run full integration tests
6. Deploy in stages (one consolidation at a time)


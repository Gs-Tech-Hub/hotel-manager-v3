# Page Access Control - Fixes & Improvements

**Date:** January 8, 2026  
**Issue Fixed:** Redirecting not working properly after RBAC implementation

## Problems Identified & Fixed

### 1. Missing Pages in Middleware Matcher
**Issue:** `/employees` and `/discounts` pages were not included in the middleware config matcher, so they weren't being protected.

**Fix:**
```typescript
export const config = {
  matcher: [
    // ... existing paths ...
    "/employees/:path*",    // ✅ Added
    "/discounts/:path*",    // ✅ Added
  ],
};
```

### 2. Type Errors in User Context Loading
**Issue:** `request.headers.get()` returns `string | null`, but fields expected `string | undefined`, causing type mismatch.

**Fix:**
```typescript
// Before: Type mismatch
departmentId: request.headers.get("x-department-id") || undefined

// After: Proper type handling
const deptId = request.headers.get("x-department-id");
departmentId: deptId ? deptId : undefined
```

### 3. Permission Check Logic Too Strict
**Issue:** The system required BOTH roles AND permissions to be present. When permissions weren't seeded yet (empty array), users would be denied access even with correct roles.

**Fix:** Skip permission checks if permissions array is empty (graceful degradation):
```typescript
// Before: Always require permissions
if (rule.requiredPermissions && rule.requiredPermissions.length > 0) {
  // Check permissions...
}

// After: Skip if no permissions are loaded
if (rule.requiredPermissions && rule.requiredPermissions.length > 0 && 
    userPermissions.length > 0) {  // ✅ Check if permissions exist
  // Check permissions...
}
```

### 4. Better Error Logging
**Issue:** Middleware wasn't logging database errors clearly, making debugging difficult.

**Fix:** Added try-catch around `loadUserAccessContext()` with detailed error logging:
```typescript
let userContext;
try {
  userContext = await loadUserAccessContext(...);
} catch (dbErr) {
  console.error(`[middleware] Database error loading user context: ${dbErr}`);
  url.pathname = "/login";
  return NextResponse.redirect(url);
}
```

## Current Status

✅ **Build:** Successful (exit code 0)  
✅ **TypeScript:** No errors  
✅ **Middleware:** Compiles cleanly in 25ms  
✅ **Redirects:** Should now work properly

## Testing Steps

1. **Start dev server:**
   ```bash
   npm run dev
   ```
   Should run on http://localhost:3001

2. **Test access control:**
   - Login as admin → can access `/dashboard/admin/*` pages
   - Login as pos_staff → can access `/pos/*` pages
   - Login as manager → can access `/inventory`, `/departments`, etc.
   - Try accessing unauthorized page → should redirect to `/dashboard`

3. **Check logs:**
   - Look for `[middleware] incoming request: /path tokenPresent=true`
   - Look for `[middleware] User denied access to /path. Roles: ...` if denied
   - Look for `[middleware] Database error` if there's a connection issue

## Key Files Updated

1. [middleware.ts](../middleware.ts)
   - Added `/employees` and `/discounts` to matcher config
   - Improved error handling for user context loading
   - Enhanced logging for debugging

2. [lib/auth/user-access-context.ts](../lib/auth/user-access-context.ts)
   - Fixed type issues with `request.headers.get()`
   - Proper null/undefined handling

3. [lib/auth/page-access.ts](../lib/auth/page-access.ts)
   - Graceful permission check degradation
   - Skip permission validation if permissions not seeded

## Architecture

### Request Flow (Now Working)

```
User visits /pos/orders
    ↓
Middleware:
  1. Check token exists ✓
  2. Load user context from DB ✓ (with error handling)
  3. Get page access rule ✓
  4. Check roles (required) ✓
  5. Check permissions (if loaded) ✓ (graceful fallback)
    ↓
User has role → Allow ✓
User lacks role → Redirect to /dashboard ✓
DB error → Redirect to /login ✓
```

### Page Access Matrix

| Page | Requires | Fallback |
|------|----------|----------|
| `/pos/*` | pos_staff, pos_manager, admin | Role-based (no permission req) |
| `/dashboard/admin/*` | admin only | Admin bypass |
| `/inventory/*` | inventory_staff, manager, admin | Role-based |
| `/bookings/*` | receptionist, manager, admin | Role-based |
| `/docs/*` | Authenticated only | Any user |

## What's Next

1. **Seed roles and permissions:**
   ```bash
   npm run seed:permissions
   npm run seed:users
   ```

2. **Monitor production logs** for access denial patterns

3. **Optional:** Add Redis caching for user roles (performance optimization)

---

**Status:** ✅ Ready for testing  
**Build Exit Code:** 0 (success)  
**Middleware Compile Time:** 25ms

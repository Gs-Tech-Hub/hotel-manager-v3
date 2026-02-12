# RBAC Implementation Audit Report
**Date:** February 11, 2026  
**Status:** Review Complete with Recommendations

---

## Executive Summary

Hotel Manager v3 has a **complex multi-layered RBAC system** with both **legacy (admin)** and **unified (user roles)** implementations. While there are **NO critical duplicate permission checks**, there are **inconsistencies in patterns and missing null-safety that could cause vulnerabilities**.

### Key Findings:
- ✅ **No major duplicates** - Each permission check is defined once
- ⚠️ **Pattern inconsistency** - Two different auth patterns used across routes
- ⚠️ **Incomplete user loading** - `loadUserWithRoles()` only checks AdminUser, not unified User model
- ⚠️ **Missing null checks** - `extractUserContext()` can return empty context
- ⚠️ **Role mapping functions underutilized** - Position/Department mappings not consistently applied

---

## Architecture Overview

### RBAC Layers (Bottom → Top)

```
┌─────────────────────────────────────────────────────┐
│ API Routes & Components                            │
│ (Consume: withPermission() or manual context)      │
└────────────┬────────────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────────────┐
│ Authorization Layer                                │
│ ├─ checkPermission(ctx, action, subject)           │
│ ├─ withPermission(handler, action, subject)        │
│ ├─ hasAnyRole(ctx, roles)                          │
│ ├─ requireRole(ctx, roles)                         │
│ └─ requireRoleOrOwner(ctx, roles, ownerId)        │
└────────────┬────────────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────────────┐
│ User Context Extraction                            │
│ ├─ extractUserContext(request)                     │
│ ├─ loadUserWithRoles(userId)     ⚠️ INCOMPLETE    │
│ └─ getSession() / verifyToken()                    │
└────────────┬────────────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────────────┐
│ Session & Authentication                           │
│ ├─ createToken(session) / verifyToken(token)       │
│ ├─ validateSession(session)                        │
│ └─ Department/Position Role Mapping                │
└────────────┬────────────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────────────┐
│ Database Layer                                     │
│ ├─ AdminUser → AdminRole → AdminPermission (Legacy)│
│ ├─ User → UserRole → Role → RolePermission        │
│ ├─ User → UserPermission (Direct grants)          │
│ └─ Department, Position metadata                   │
└─────────────────────────────────────────────────────┘
```

---

## Request Flow (With Issues Marked)

### Flow 1: Page Access (Next.js Middleware)
```
Request → middleware.ts
  ├─ verifyToken(cookie) → AuthSession
  ├─ extractUserFromHeaders() → headers set
  ├─ getPageAccessRule(pathname) → PageRule
  ├─ checkPageAccess(rule, roles, permissions) ✅ Correct
  └─ Set headers: x-user-id, x-user-type, x-user-roles, x-department-id
```

### Flow 2: API Route - Pattern A (withPermission decorator)
```
Request → /api/users, /api/roles
  ├─ withPermission(handler, action, subject)
  ├─ extractAndValidateContext(request)
  │  ├─ verifyAuthHeader() OR getSession()
  │  ├─ validateSession() ✅ Correct
  │  └─ Return PermissionContext
  ├─ checkPermission(ctx, action, subject)
  │  ├─ Check legacy AdminUser (if admin) ⚠️ OPTIONAL
  │  ├─ Check UserPermission (direct)
  │  ├─ Check UserRole → Role → RolePermission
  │  └─ Return boolean
  └─ handler() OR FORBIDDEN(403)
```

### Flow 3: API Route - Pattern B (Manual context)
```
Request → /api/employees, /api/orders, /api/departments
  ├─ extractUserContext(request) ⚠️ CAN RETURN {}
  ├─ if (!ctx.userId) → UNAUTHORIZED ✅ Correct
  ├─ loadUserWithRoles(userId) ⚠️ ONLY AdminUser
  │  ├─ Fetch AdminUser + AdminRole (Legacy only)
  │  ├─ Does NOT fetch User + UserRole
  │  └─ May return null for non-admin users!
  ├─ hasAnyRole(userWithRoles, allowedRoles)
  │  └─ Check userRoles array
  └─ handler() OR proceed without role data
```

---

## Identified Issues & Inconsistencies

### 🔴 Critical Issues

#### 1. **loadUserWithRoles() Incomplete**
**File:** [lib/user-context.ts](lib/user-context.ts#L63-L89)

```typescript
// CURRENT - Only loads AdminUser
const user = await prisma.adminUser.findUnique({...});
if (!user) return null; // Returns null for employee users!
```

**Problem:** 
- Only queries `AdminUser` table
- Returns `null` for employees (who use `User` table)
- Used in 40+ API routes expecting valid role data
- Causes silent permission failures

**Impact:** Employee-only API routes can't properly validate roles

**Recommendation:** Update to check both tables:
```typescript
async function loadUserWithRoles(userId: string) {
  // Try unified User table first
  let user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: true }
  });
  
  if (user) {
    return {
      userId: user.id,
      userRoles: user.roles.map(r => r.code),
      userType: 'employee'
    };
  }
  
  // Fall back to legacy AdminUser
  const admin = await prisma.adminUser.findUnique({...});
  // ...
}
```

---

#### 2. **extractUserContext() Can Return Empty Context**
**File:** [lib/user-context.ts](lib/user-context.ts#L20-L56)

```typescript
export async function extractUserContext(req: NextRequest): Promise<UserContext> {
  // ... multiple fallback attempts ...
  return {}; // ⚠️ VALID but EMPTY return!
}
```

**Problem:**
- Multiple fallbacks silently fail without logging
- Returns `{}` if no auth found
- Consuming code must check `!ctx.userId` explicitly
- Some routes forget this check

**Current Patterns:**
```typescript
// SAFE Pattern (found in most routes)
const ctx = await extractUserContext(req);
if (!ctx.userId) return UNAUTHORIZED; ✅

// UNSAFE Pattern (some routes)
const ctx = await extractUserContext(req);
const user = await prisma.user.get(ctx.userId); ❌ CRASH if ctx.userId is undefined
```

**Recommendation:** Make extraction stricter:
```typescript
// Option 1: Throw on failure
export async function extractUserContext(req): Promise<UserContext> {
  const ctx = { ...extractions };
  if (!ctx.userId) throw new UnauthorizedError('No auth context');
  return ctx;
}

// Option 2: Return null for easier .ok checks
export async function extractUserContext(req): Promise<UserContext | null> {
  // ... 
  return userId ? {...} : null;
}
```

---

### ⚠️ Pattern Inconsistencies

#### 3. **Two Different Auth Patterns Across Routes**

**Pattern A: Decorator (Centralized)**
- Files: `/api/users`, `/api/roles`
- Uses: `withPermission(handler, action, subject)`
- Pros: Centralized auth logic, less code duplication
- Cons: Limited to async handler patterns

```typescript
export const GET = withPermission(
  (req, ctx) => { /* handler */ },
  'users.read',
  'users'
);
```

**Pattern B: Manual (Distributed)**
- Files: `/api/employees`, `/api/orders`, `/api/departments`, etc. (40+ routes)
- Uses: Inline `extractUserContext()` + `loadUserWithRoles()` + `hasAnyRole()`
- Pros: More flexible, can handle complex logic
- Cons: Repetitive, inconsistent null checks, easy to miss permission validation

```typescript
export async function GET(req) {
  const ctx = await extractUserContext(req);
  if (!ctx.userId) return UNAUTHORIZED;
  const user = await loadUserWithRoles(ctx.userId);
  if (!hasAnyRole(user, ['admin'])) return FORBIDDEN;
  // handler logic
}
```

**Why inconsistent?**
- Decorator pattern can't easily access request body or complex params
- Manual pattern offers more control but sacrifices consistency
- No enforced standard pattern across team

**Recommendation:** Create unified handler pattern:
```typescript
// Create a wrapper that satisfies both needs
export async function withAuth<T extends NextRequest>(
  req: T,
  roles?: string[],
  onAuth?: (ctx: PermissionContext, user: any) => Promise<any>
): Promise<UserContext & { user?: any } | NextResponse> {
  const ctx = await extractUserContext(req);
  if (!ctx.userId) return NextResponse.json(UNAUTHORIZED, { status: 401 });
  
  if (roles) {
    const user = await loadUserWithRoles(ctx.userId);
    if (!hasAnyRole(user, roles)) {
      return NextResponse.json(FORBIDDEN, { status: 403 });
    }
    if (onAuth) return onAuth(ctx, user);
  }
  return { ...ctx };
}

// Usage
export async function GET(req) {
  const auth = await withAuth(req, ['admin', 'manager']);
  if (auth instanceof NextResponse) return auth; // Error response
  
  // auth.userId is guaranteed to exist here
  // auth.user is loaded with roles
}
```

---

#### 4. **checkPermission() Complex with Schema Detection**
**File:** [lib/auth/rbac.ts](lib/auth/rbac.ts#L40-L200)

**Current behavior:**
- Runs expensive schema detection every call (cached with global flags)
- Supports BOTH legacy admin + unified roles
- Falls through multiple checks (direct perms → role perms → global perms)
- Requires action + subject parameters, but some code passes only action

**Issue:**
- Caching is global, not per-request (could cause issues if schema changes mid-deployment)
- Multiple fallback checks (4-5 DB queries worst case) without explain logging

**Recommendation:**
```typescript
// Add debug mode to understand permission flow
export async function checkPermissionDebug(...) {
  const log = [];
  log.push(`Checking: ${action}.${subject}`);
  
  // Each check logs result
  const hasLegacy = await checkLegacyAdmin(...);
  log.push(`Legacy admin: ${hasLegacy}`);
  
  const hasDirect = await checkDirect(...);
  log.push(`Direct perm: ${hasDirect}`);
  
  console.debug('[RBAC]', log.join(' → '));
}
```

---

### ⚠️ Unused/Underutilized Mappings

#### 5. **Position & Department Role Mappings Not Applied**
**Files:**
- [lib/auth/position-role-mapping.ts](lib/auth/position-role-mapping.ts) - NEW, with dropdown
- [lib/auth/department-role-mapping.ts](lib/auth/department-role-mapping.ts)

**Current:**
- Position dropdown now enforces standardized positions ✅
- But NO automatic role assignment on employee creation
- Department default roles configured but not used in create employee flow

**Missing Flow:**
```
User fills form → Selects "Chef" → Should auto-assign "kitchen_staff" role
Currently: Position stored but role must be assigned manually
```

**Recommendation:** Integrate into employee creation:
```typescript
export async function POST(req: NextRequest) {
  const data = await req.json();
  
  // Get role from position (automatic)
  const roleCode = getRoleForPosition(data.position);
  if (roleCode) {
    data.roles = [{ roleCode }]; // Auto-assign
  }
  
  // Get role from department (fallback)
  if (!roleCode && data.departmentId) {
    const deptRole = await getDefaultRoleForDepartment(data.departmentId);
    if (deptRole) data.roles = [{ roleCode: deptRole }];
  }
  
  // Create employee with auto-assigned roles
}
```

---

## Summary Table: Permission Check Methods

| Method | Location | Usage | Pattern | Null-Safe | Async |
|--------|----------|-------|---------|-----------|-------|
| `checkPermission()` | rbac.ts | Internal use in middleware | Legacy + Unified | ✅ | ✅ |
| `withPermission()` | middleware.ts | API decorators | Decorator | ✅ | ✅ |
| `withAuth()` | middleware.ts | API decorators (auth only) | Decorator | ✅ | ✅ |
| `extractUserContext()` | user-context.ts | Manual API routes | Direct call | ⚠️ Can be {} | ✅ |
| `loadUserWithRoles()` | user-context.ts | Manual API routes | Direct call | ⚠️ AdminUser only | ✅ |
| `hasAnyRole()` | user-context.ts | Manual API routes | Direct call | ✅ | ❌ |
| `requireRole()` | authorization.ts | Services/handlers | Throws Error | ✅ | ❌ |
| `isOwnerOrHasRole()` | user-context.ts | Ownership checks | Direct call | ✅ | ❌ |

---

## Recommendations Priority

### 🔥 P1: Critical (Fix ASAP)
1. **Fix `loadUserWithRoles()` to check both User and AdminUser tables**
   - Affects 40+ API routes
   - Current: Only works for admins
   - Time: 30 mins

2. **Audit all Pattern B routes for null-safety**
   - Search: `const ctx = await extractUserContext`
   - Ensure each has `if (!ctx.userId) return UNAUTHORIZED`
   - Time: 1 hour

### 🟡 P2: Important (Next Sprint)
3. **Standardize to unified handler pattern**
   - Consolidate Pattern A + B into single `withAuth()` function
   - Reduces code duplication from 40+ manual checks
   - Time: 2-3 hours

4. **Integrate position/department role auto-assignment**
   - Apply `getRoleForPosition()` in employee creation
   - Prevents manual role assignment errors
   - Time: 1 hour

### 🟢 P3: Nice-to-Have (Refactor)
5. **Add debug/audit logging to checkPermission()**
   - Helps troubleshoot permission denials
   - Can export audit trail to analytics
   - Time: 2 hours

6. **Extract schema detection to boot-time**
   - Move from cached global state to startup init
   - More robust for container deployments
   - Time: 1 hour

---

## Files to Audit

**Core RBAC Files:**
- ✅ [lib/auth/rbac.ts](lib/auth/rbac.ts) - Central permission logic
- ⚠️ [lib/user-context.ts](lib/user-context.ts) - User loading (incomplete)
- ✅ [lib/auth/middleware.ts](lib/auth/middleware.ts) - Decorators
- ✅ [lib/auth/authorization.ts](lib/auth/authorization.ts) - Helper validators
- ✅ [lib/auth/session.ts](lib/auth/session.ts) - JWT/cookies

**Support Files:**
- ✅ [lib/auth/position-role-mapping.ts](lib/auth/position-role-mapping.ts) - Now with dropdown
- ⚠️ [lib/auth/department-role-mapping.ts](lib/auth/department-role-mapping.ts) - Underutilized
- ✅ [middleware.ts](middleware.ts) - Page access rules
- ✅ [lib/auth/page-access.ts](lib/auth/page-access.ts) - Page rule configuration

**API Routes to Review:**
- [app/api/employees/route.ts](app/api/employees/route.ts) - Pattern B
- [app/api/orders/route.ts](app/api/orders/route.ts) - Pattern B
- [app/api/departments/route.ts](app/api/departments/route.ts) - Pattern B
- [app/api/users/route.ts](app/api/users/route.ts) - Pattern A ✅
- [app/api/roles/route.ts](app/api/roles/route.ts) - Pattern A ✅

---

## Next Steps

1. **Create issue tickets for P1 items**
2. **Update `loadUserWithRoles()` immediately**
3. **Add null-safety audit to code review checklist**
4. **Begin migration to unified handler pattern**
5. **Document as ADR (Architecture Decision Record)**


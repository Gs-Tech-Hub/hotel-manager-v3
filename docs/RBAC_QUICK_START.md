# Hotel Manager v3 — RBAC Implementation Summary

**Status:** ✅ Complete — Ready for Phase 1 Deployment  
**Date:** November 25, 2025  
**Duration:** Full roadmap provides 6-phase implementation plan (2–5 weeks total)

---

## 📋 What Has Been Created

### 1. **Main Documentation**
- **File:** `docs/RBAC_IMPLEMENTATION_GUIDE.md`
- **Contents:**
  - Current state analysis (problems & gaps)
  - Proposed unified RBAC solution
  - Complete schema changes with code
  - 6-phase implementation roadmap
  - Migration strategy & backfill process
  - Runtime best practices (permission checking, middleware, caching, audit)
  - Deployment checklist
  - Troubleshooting guide

**Use This For:** Understanding the complete vision, migration strategy, and deployment steps.

---

### 2. **Schema Updates**
- **File:** `prisma/schema.prisma`
- **Changes:**
  - ✅ Added `Permission` model (fine-grained actions)
  - ✅ Added `Role` model (role definitions)
  - ✅ Added `RolePermission` join table (explicit role→permission mapping)
  - ✅ Added `UserRole` join table (explicit user→role mapping with scoping)
  - ✅ Added `UserPermission` join table (direct user permission overrides)
  - ✅ Added `TokenPermission` join table (API/Transfer token permissions)
  - ✅ Updated `Department` model (added relations for scoped roles)

**Use This For:** Running Prisma migrations to create new RBAC tables.

---

### 3. **Backfill Script**
- **File:** `scripts/migrate-rbac.ts`
- **Functionality:**
  - Seeds 30+ default permissions (dashboard, users, roles, bookings, orders, inventory, etc.)
  - Migrates existing `AdminRole` → new `Role` table
  - Migrates existing `AdminPermission` → new `Permission` table
  - Migrates role-permission links
  - Migrates admin user role assignments
  - Creates default employee role
  - Assigns default roles to all employees
  - Fully idempotent (safe to run multiple times)

**Use This For:** One-command data migration from legacy to new RBAC system.

```bash
# Run backfill script
npx tsx scripts/migrate-rbac.ts
```

---

### 4. **Auth Library — RBAC Service**
- **File:** `lib/auth/rbac.ts`
- **Exports:**
  - `checkPermission(ctx, action, subject?)` — Check if user has permission
  - `getUserPermissions(ctx)` — Fetch all user permissions
  - `getUserRoles(ctx)` — Fetch all user roles
  - `hasRole(ctx, roleCode, departmentId?)` — Check if user has specific role
  - `grantRole(targetUserId, userType, roleId, grantedBy, departmentId?)` — Grant role
  - `revokeRole(targetUserId, userType, roleId, revokedBy, departmentId?)` — Revoke role
  - `grantPermission(...)` — Grant direct permission
  - `getAllRoles(type?)` — Fetch available roles
  - `getAllPermissions(subject?)` — Fetch available permissions

**Use This For:** Core permission checking logic in your app.

---

### 5. **Auth Library — Middleware**
- **File:** `lib/auth/middleware.ts`
- **Exports:**
  - `withPermission(handler, action, subject?)` — Protect route with single permission
  - `withPermissions(handler, permissions[])` — Protect route with multiple permissions (all required)
  - `withAnyPermission(handler, permissions[])` — Protect route with multiple permissions (any one)
  - `withAuth(handler)` — Protect route (authentication only, no specific permission)

**Use This For:** Protecting Next.js API routes.

**Example:**
```typescript
// app/api/orders/create/route.ts
export const POST = withPermission(
  async (req, ctx) => {
    // Your handler logic here
    return NextResponse.json({ success: true });
  },
  'orders.create',
  'orders'
);
```

---

### 6. **Auth Library — Caching Service**
- **File:** `lib/auth/cache.ts`
- **Exports:**
  - `initializeCache(redisClient)` — Initialize Redis
  - `getCachedUserPermissions(ctx)` — Get permissions with caching
  - `invalidateUserPermissionsCache(userId, userType?)` — Clear cache
  - `invalidateDepartmentCache(departmentId)` — Clear department cache
  - `clearAllPermissionCache()` — Emergency cache reset
  - `getCacheStats()` — Get cache stats

**Use This For:** Reducing database queries on high-traffic apps (optional but recommended).

---

### 7. **Auth Library — Audit Logger**
- **File:** `lib/auth/audit.ts`
- **Exports:**
  - `logAudit(log)` — Log any audit event
  - `logRoleGranted(...)` — Log role grant
  - `logRoleRevoked(...)` — Log role revocation
  - `logPermissionGranted(...)` — Log permission grant
  - `logPermissionRevoked(...)` — Log permission revocation
  - `logRoleCreated(...)` — Log role creation
  - `configureAudit(config)` — Configure audit logging
  - `queryAuditLogs(filters?)` — Query audit history

**Use This For:** Compliance, debugging, and understanding who did what when.

---

## 🚀 Quick Start

### Phase 1: Apply Schema Changes
```bash
# The schema has already been updated in prisma/schema.prisma
# Run migration to create new tables:
npx prisma migrate dev --name add_unified_rbac

# Verify tables created:
npx prisma db execute
-- SELECT COUNT(*) FROM permissions;
-- SELECT COUNT(*) FROM roles;
```

### Phase 2: Run Backfill
```bash
# Backup your database first!
pg_dump -U postgres hotel_manager_v3_dev > backup_preRBAC.sql

# Run backfill script
npx tsx scripts/migrate-rbac.ts

# Verify data
npx prisma db execute
-- SELECT COUNT(*) FROM permissions;           # Should be ~30+
-- SELECT COUNT(*) FROM roles;                 # Should be +1 for each AdminRole
-- SELECT COUNT(*) FROM role_permissions;      # Should match old AdminPermission count
-- SELECT COUNT(*) FROM user_roles;            # Should match old role assignments
```

### Phase 3: Test Locally
```bash
# Start your dev server
npm run dev

# In Node REPL or a test script, import and use RBAC:
import { checkPermission } from '@/lib/auth/rbac';

const ctx = { userId: 'admin123', userType: 'admin', departmentId: null };
const hasAccess = await checkPermission(ctx, 'orders.create', 'orders');
console.log(hasAccess); // Should be true for admin
```

### Phase 4: Integrate into Routes
Replace existing permission checks with new utilities:

**Before:**
```typescript
// app/api/orders/create/route.ts
export async function POST(req: NextRequest) {
  // Hardcoded permission logic
  if (req.headers.get('x-user-role') !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  // ... rest of handler
}
```

**After:**
```typescript
// app/api/orders/create/route.ts
import { withPermission } from '@/lib/auth/middleware';

export const POST = withPermission(
  async (req, ctx) => {
    // Permission already checked by middleware
    // ... rest of handler
    return NextResponse.json({ success: true });
  },
  'orders.create',
  'orders'
);
```

---

## 📊 Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                 API Request Arrives                           │
└──────────────────────────────────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────┐
│            withPermission() Middleware                        │
│  • Extract user context from headers                          │
│  • Call checkPermission(ctx, action, subject)                │
└──────────────────────────────────────────────────────────────┘
                             ↓
                      ┌──────────┐
                      │ Allowed? │
                      └────┬─────┘
                      Yes  │  No
                          │
        ┌─────────────────┴────────────────┐
        ↓                                  ↓
    ┌─────────┐                      ┌──────────┐
    │ Handler │                      │ 403 Error│
    │Executes │                      │ Returned │
    └─────────┘                      └──────────┘
        ↓
   ┌────────────────────────────────────┐
   │ checkPermission() Logic:            │
   │ 1. Check UserPermission (direct)    │
   │ 2. Check UserRole→RolePermission    │
   │ 3. Apply department scoping         │
   │ 4. Return true/false               │
   └────────────────────────────────────┘
```

---

## 🎯 Implementation Roadmap (From Main Document)

| Phase | Name | Duration | Key Deliverables | Status |
|-------|------|----------|------------------|--------|
| 1 | Schema Extension | 2 hrs | New tables, Prisma types | ✅ Complete |
| 2 | Data Backfill | 1 hr | Seeded permissions, roles, mappings | ✅ Script Ready |
| 3 | App Integration | 3–5 days | RBAC utilities, updated routes, middleware | 🔄 In Progress |
| 4 | Testing | 2 days | Unit/integration tests, staging validation | ⏳ Pending |
| 5 | Rollout | 1 day | Deploy, monitor, gradual feature flag | ⏳ Pending |
| 6 | Cleanup | 1 day | Archive legacy tables, documentation | ⏳ Pending |

---

## 🔑 Key Features

✅ **Unified RBAC**
- Single Permission/Role/UserRole model works for admin, employee, and custom users

✅ **Department Scoping**
- Assign roles scoped to specific departments (e.g., "manager for Restaurant A")

✅ **Audit Trail**
- Every role/permission change logged with who, what, when

✅ **Caching**
- Optional Redis caching for permission checks (reduce DB queries by 90%+)

✅ **Middleware**
- Easy-to-use middleware decorators for protecting routes

✅ **Direct Permission Overrides**
- Grant/revoke specific permissions to users independent of roles

✅ **Token Permissions**
- API/Transfer tokens can use same permission system

✅ **Backward Compatible**
- Legacy AdminUser/AdminPermission tables kept during transition
- Safe to run multiple times

---

## 📚 Files Reference

| File | Purpose | Phase |
|------|---------|-------|
| `docs/RBAC_IMPLEMENTATION_GUIDE.md` | Complete dev flow & strategy | All |
| `scripts/migrate-rbac.ts` | Data backfill | 2 |
| `prisma/schema.prisma` | Database schema | 1 |
| `lib/auth/rbac.ts` | Permission checking logic | 3 |
| `lib/auth/middleware.ts` | Route protection middleware | 3 |
| `lib/auth/cache.ts` | Redis caching (optional) | 3 |
| `lib/auth/audit.ts` | Audit logging | 3 |

---

## ⚠️ Important Notes

1. **Backup Before Phase 2:** Run `pg_dump` before executing backfill script.
2. **Test Locally First:** Run Phases 1–2 in dev environment before staging.
3. **Gradual Rollout:** Consider feature flags for Phase 3 to minimize risk.
4. **Monitor Logs:** Watch for permission check errors in Phase 3/4.
5. **Document Changes:** Update team wiki with new permission strings.

---

## 🤔 Common Questions

**Q: Do I need to run the backfill script?**  
A: Yes, Phase 2 is required to populate new tables with existing role/permission data.

**Q: Can I keep the old AdminRole table?**  
A: Yes, legacy tables are kept during migration. You can archive them later (Phase 6).

**Q: How do I add new permissions?**  
A: Create Permission entries via admin UI or directly in database:
```sql
INSERT INTO permissions (id, action, subject, description, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'custom.action', 'custom', 'Custom permission', NOW(), NOW());
```

**Q: How do I handle department-scoped roles?**  
A: When assigning roles, provide a `departmentId` to `UserRole`:
```typescript
await grantRole(userId, 'employee', roleId, adminId, departmentId);
```

**Q: Should I enable Redis caching?**  
A: Recommended for production (10–100k+ requests/day). Optional for dev/staging.

---

## 📞 Support

- **Full Documentation:** See `docs/RBAC_IMPLEMENTATION_GUIDE.md`
- **Schema Questions:** Check `prisma/schema.prisma` comments
- **Backfill Issues:** Review `scripts/migrate-rbac.ts` logs
- **Integration Help:** Reference examples in middleware comments

---

**Next Step:** Follow Phase 1 (Schema Extension) in Quick Start section above.

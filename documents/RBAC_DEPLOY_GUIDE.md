# 🔐 RBAC System — Deploy Guide

**Status:** ✅ Schema validated and ready for migration  
**Created:** November 25, 2025

---

## 📦 What's Included

This package includes a complete unified RBAC (Role-Based Access Control) system for Hotel Manager v3. It consolidates separate admin and employee role management into a single, database-enforced permission system.

### Files Created/Modified

```
✅ prisma/schema.prisma              [MODIFIED] Added 6 new RBAC models
✅ scripts/migrate-rbac.ts           [NEW] Backfill script to migrate old data
✅ lib/auth/rbac.ts                  [NEW] Core permission checking service
✅ lib/auth/middleware.ts            [NEW] Route protection middleware
✅ lib/auth/cache.ts                 [NEW] Redis caching utility
✅ lib/auth/audit.ts                 [NEW] Audit logging service
✅ docs/RBAC_IMPLEMENTATION_GUIDE.md [NEW] Complete implementation guide
✅ docs/RBAC_QUICK_START.md          [NEW] Quick reference guide
```

---

## 🚀 Deployment Steps

### Step 1: Verify Schema Validation ✅
Already done! Schema has been validated.

```bash
npx prisma validate
# Output: The schema at prisma\schema.prisma is valid 🚀
```

### Step 2: Create Database Migration

```bash
# Generate migration files
npx prisma migrate dev --name add_unified_rbac
```

**Expected Output:**
```
Enter a name for the new migration: add_unified_rbac
Prisma Migrate created the following migration(s):

✔ Created migrations/20250125_add_unified_rbac.sql
✔ Applied migration _current development
```

**New Tables Created:**
- `permissions` — Fine-grained permission definitions
- `roles` — Role definitions with type and status
- `role_permissions` — Explicit role→permission mappings
- `user_roles` — Explicit user→role mappings with department scoping
- `user_permissions` — Direct user permission overrides
- `token_permissions` — Token-based permission mappings

### Step 3: Backup Production Database

**Before running backfill in production:**

```bash
# PostgreSQL backup
pg_dump -U postgres hotel_manager_v3_prod > backup_rbac_$(Get-Date -Format yyyyMMdd_HHmmss).sql

# Alternative using Docker
docker exec -it postgres_container pg_dump -U postgres hotel_manager_v3_prod > backup.sql
```

### Step 4: Run Backfill Script (DEV/TEST FIRST)

**Development Environment:**
```bash
npx tsx scripts/migrate-rbac.ts
```

**Expected Output:**
```
🔄 Starting RBAC migration...

📝 Step 1: Seeding default permissions...
✅ Seeded 30 permissions.

📝 Step 2: Migrating admin roles...
✅ Migrated 5 roles.

📝 Step 3: Migrating admin user roles...
✅ Created 8 admin user-role assignments.

📝 Step 4: Creating default employee role...
✅ Created default employee role with basic permissions.

📝 Step 5: Assigning default roles to employees...
✅ Assigned default roles to 12 employees.

✨ RBAC migration complete!

📊 Migration Summary:
   • Permissions seeded: 30
   • Roles created/updated: 5
   • Admin user-role assignments: 8
   • Employees with default roles: 12

✅ Next Steps:
   1. Verify database: SELECT COUNT(*) FROM permissions, roles, role_permissions, user_roles;
   2. Refactor app code to use new RBAC tables (see lib/auth/rbac.ts)
   3. Update admin UI to manage roles via new tables
   4. Deploy and monitor logs for auth errors
```

### Step 5: Verify Data Migration

```bash
# Connect to your database
psql -U postgres -d hotel_manager_v3_dev

# Verify new tables are populated
SELECT COUNT(*) as permission_count FROM permissions;
SELECT COUNT(*) as role_count FROM roles;
SELECT COUNT(*) as role_permission_count FROM role_permissions;
SELECT COUNT(*) as user_role_count FROM user_roles;

# Check specific data
SELECT code, name, COUNT(rp.id) as permission_count 
FROM roles r 
LEFT JOIN role_permissions rp ON r.id = rp."roleId" 
GROUP BY r.code, r.name;
```

### Step 6: Update Application Code

Replace hardcoded permission checks with new utilities.

**Example 1: Protecting an API Route**

Before:
```typescript
// app/api/orders/create/route.ts
export async function POST(req: NextRequest) {
  const userRole = req.headers.get('x-user-role');
  if (userRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  // ... handler logic
}
```

After:
```typescript
// app/api/orders/create/route.ts
import { withPermission } from '@/lib/auth/middleware';

export const POST = withPermission(
  async (req, ctx) => {
    // Permission already validated by middleware
    // ctx contains { userId, userType, departmentId }
    // ... handler logic
    return NextResponse.json({ success: true });
  },
  'orders.create',
  'orders'
);
```

**Example 2: Checking Permission in Service Layer**

Before:
```typescript
// services/order.service.ts
export async function createOrder(userId: string, orderData: any) {
  // Permission check hardcoded in app logic (fragile!)
  // ...
}
```

After:
```typescript
// services/order.service.ts
import { checkPermission, type PermissionContext } from '@/lib/auth/rbac';

export async function createOrder(
  ctx: PermissionContext,
  orderData: any
) {
  // Check permission first
  const allowed = await checkPermission(ctx, 'orders.create', 'orders');
  if (!allowed) throw new ForbiddenError('No permission');

  // Proceed with business logic
  // ...
}
```

### Step 7: Enable Caching (Optional, Recommended for Production)

In your app initialization code:

```typescript
// lib/init/cache.ts
import Redis from 'ioredis';
import { initializeCache } from '@/lib/auth/cache';

const redis = new Redis(process.env.REDIS_URL);
initializeCache(redis);

// Now permission checks will use Redis caching (1-hour TTL)
```

Use `getCachedUserPermissions()` instead of `getUserPermissions()`:

```typescript
import { getCachedUserPermissions } from '@/lib/auth/cache';

export async function checkAndExecuteAction(ctx: PermissionContext) {
  const perms = await getCachedUserPermissions(ctx);  // With caching
  const hasAccess = perms.includes('orders.create:orders');
  // ...
}
```

### Step 8: Setup Audit Logging

In your app initialization:

```typescript
// lib/init/audit.ts
import { configureAudit } from '@/lib/auth/audit';

configureAudit({
  enableConsole: true,
  enableFile: true,
  filePath: '/var/log/rbac-audit.log',
  enableExternal: process.env.NODE_ENV === 'production',
  externalService: async (log) => {
    // Send to Datadog, Splunk, CloudWatch, etc.
    await fetch('https://your-audit-service.com/logs', {
      method: 'POST',
      body: JSON.stringify(log),
    });
  },
});
```

### Step 9: Deploy to Staging

```bash
# Commit changes
git add -A
git commit -m "feat: unified RBAC system with permission checks"

# Push to staging branch
git push origin staging

# Deploy
# (your CI/CD pipeline runs here)
```

**Staging Testing Checklist:**
- [ ] Admin users can access admin routes
- [ ] Employees can access employee routes
- [ ] Department-scoped roles work correctly
- [ ] Permission caching reduces DB queries
- [ ] Audit logs are being generated
- [ ] No 500 errors in auth middleware
- [ ] Role/permission assignment works in admin UI

### Step 10: Deploy to Production

```bash
# Merge staging to main after 24-48 hours of testing
git checkout main
git merge staging
git push origin main

# Production deployment runs via CI/CD
```

**Production Deployment Checklist:**
- [ ] Production database backup complete
- [ ] Monitoring/alerts configured for auth errors
- [ ] Runbook created for common RBAC issues
- [ ] Team trained on new permission strings
- [ ] Gradual rollout enabled (if feature flag available)
- [ ] Rollback plan documented and tested

---

## 🔧 Adding New Permissions

### 1. Add Permission to Database

```sql
INSERT INTO permissions (id, action, subject, description, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'custom.action',           -- Permission action
  'custom_subject',          -- Optional subject
  'Description of action',   -- Human-readable description
  NOW(),
  NOW()
);
```

### 2. Create or Update Role

```sql
-- Get permission ID
SELECT id FROM permissions WHERE action = 'custom.action';

-- Get role ID
SELECT id FROM roles WHERE code = 'my.role';

-- Link permission to role
INSERT INTO role_permissions (id, "roleId", "permissionId", "createdAt")
VALUES (gen_random_uuid(), '<role_id>', '<permission_id>', NOW());
```

### 3. Reference in Code

```typescript
const allowed = await checkPermission(ctx, 'custom.action', 'custom_subject');
```

---

## 🔑 Permission String Format

Permissions follow the pattern: `resource.action`

**Examples:**
- `dashboard.read` — Read dashboard data
- `orders.create` — Create orders
- `orders.fulfill` — Fulfill orders
- `bookings.checkin` — Check in guests
- `inventory.transfer` — Transfer inventory between departments
- `departments.manage` — Manage department configuration
- `roles.update` — Update role definitions
- `users.delete` — Delete users

---

## 📊 Default Permissions Seeded

The backfill script seeds 30+ permissions:

| Category | Permissions |
|----------|------------|
| Dashboard | `dashboard.read` |
| User Mgmt | `users.read`, `.create`, `.update`, `.delete` |
| Roles | `roles.read`, `.create`, `.update`, `.delete` |
| Permissions | `permissions.read`, `.manage` |
| Bookings | `bookings.read`, `.create`, `.update`, `.delete`, `.checkin`, `.checkout` |
| Orders | `orders.read`, `.create`, `.update`, `.delete`, `.fulfill`, `.approve` |
| Inventory | `inventory.read`, `.update`, `.transfer`, `.restock` |
| Departments | `departments.read`, `.create`, `.update`, `.manage` |
| Customers | `customers.read`, `.create`, `.update`, `.delete` |
| Payments | `payments.read`, `.process`, `.refund` |
| Reports | `reports.read`, `.export` |
| Settings | `settings.read`, `.manage` |

---

## 🚨 Troubleshooting

| Issue | Solution |
|-------|----------|
| **Migration fails with "table already exists"** | Drop old tables manually or run `prisma migrate resolve --rolled-back` |
| **Permission check always returns false** | Verify `UserRole` entries exist in database for user |
| **Backfill script hangs** | Check if database connection is working: `psql -U postgres -d hotel_manager_v3_dev -c "SELECT 1"` |
| **503 permission check errors** | Verify all middleware passes `x-user-id` and `x-user-type` headers |
| **Redis cache stale after role change** | Call `invalidateUserPermissionsCache(userId)` after role updates |
| **Admin UI still showing old permission checks** | Search for old permission logic in codebase: `grep -r "AdminPermission" app/` |

---

## 📚 Key Documentation Files

1. **RBAC_IMPLEMENTATION_GUIDE.md** — Complete technical guide (6 phases, migration strategy, best practices)
2. **RBAC_QUICK_START.md** — Quick reference with code examples
3. **rbac.ts** — Core service with full JSDoc comments
4. **middleware.ts** — Middleware usage guide with examples
5. **cache.ts** — Caching strategy and Redis setup

---

## 🔗 Related Changes

- Updated `Department` model: now has `userRoles` and `userPermissions` relations
- Updated `ApiToken` model: now has `tokenPermissions` relation
- Updated `TransferToken` model: now has `tokenPermissions` relation
- All existing admin/employee code paths can now use centralized RBAC

---

## ✅ Post-Deployment Validation

After going live:

```bash
# Monitor auth errors
tail -f /var/log/app.log | grep "\[AUTH\]"

# Check permission cache hit rate
redis-cli KEYS "perms:*" | wc -l

# Audit recent role changes
# Query your audit log service for the last 24 hours

# Verify no users locked out
# Check for unusual 403 error spikes in monitoring
```

---

## 📞 Support & Questions

- **Schema Issues:** Check `prisma/schema.prisma` comments
- **Permission Checking:** See `lib/auth/rbac.ts` JSDoc
- **Route Protection:** See `lib/auth/middleware.ts` examples
- **Caching:** See `lib/auth/cache.ts` usage guide
- **Full Roadmap:** See `docs/RBAC_IMPLEMENTATION_GUIDE.md`

---

**Deployment Status:** Ready for Phase 1 execution.  
**Estimated Total Duration:** 2–5 weeks (6 phases, can overlap)  
**Recommended Rollout:** Gradual (feature flag) or timed maintenance window

---

Created: November 25, 2025  
Version: 1.0

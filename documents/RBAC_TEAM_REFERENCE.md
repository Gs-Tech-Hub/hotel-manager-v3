# 🎯 RBAC Team Reference Card

Quick reference for common tasks with the new unified RBAC system.

---

## ✅ Check Permission in Code

### In API Route (Easiest)

```typescript
import { withPermission } from '@/lib/auth/middleware';

export const POST = withPermission(
  async (req, ctx) => {
    // ctx = { userId, userType, departmentId }
    return NextResponse.json({ success: true });
  },
  'orders.create'    // permission action
  // 'orders'         // optional subject
);
```

### In Service/Library

```typescript
import { checkPermission, type PermissionContext } from '@/lib/auth/rbac';

const ctx = { userId: 'user123', userType: 'employee', departmentId: 'dept456' };
const allowed = await checkPermission(ctx, 'orders.create', 'orders');

if (!allowed) throw new Error('No permission');
// ... rest of logic
```

### Check Multiple Permissions (All Required)

```typescript
import { withPermissions } from '@/lib/auth/middleware';

export const DELETE = withPermissions(
  async (req, ctx) => {
    // User must have BOTH permissions
    return NextResponse.json({ success: true });
  },
  [
    ['orders.delete', 'orders'],
    ['orders.read', 'orders'],
  ]
);
```

### Check Any Permission

```typescript
import { withAnyPermission } from '@/lib/auth/middleware';

export const GET = withAnyPermission(
  async (req, ctx) => {
    // User needs AT LEAST ONE permission
    return NextResponse.json({ data: [] });
  },
  [
    ['reports.read', 'reports'],
    ['reports.export', 'reports'],
  ]
);
```

---

## 🔑 Manage Roles & Permissions

### Grant a Role to User

```typescript
import { grantRole } from '@/lib/auth/rbac';
import { invalidateUserPermissionsCache } from '@/lib/auth/cache';

// Grant global role
await grantRole(
  'user123',                    // target user ID
  'employee',                   // user type
  'role-id-456',               // role to grant
  'admin-id-789',              // who's granting
  // optional: 'dept-id-999'   // department scope
);

// Invalidate cache so changes take effect immediately
await invalidateUserPermissionsCache('user123');
```

### Grant Direct Permission (Bypass Role)

```typescript
import { grantPermission } from '@/lib/auth/rbac';
import { invalidateUserPermissionsCache } from '@/lib/auth/cache';

await grantPermission(
  'user123',                    // target user
  'employee',                   // user type
  'perm-id-456',               // permission ID
  'admin-id-789',              // who's granting
  // optional: 'dept-id-999'   // department scope
);

await invalidateUserPermissionsCache('user123');
```

### Revoke Role

```typescript
import { revokeRole } from '@/lib/auth/rbac';
import { invalidateUserPermissionsCache } from '@/lib/auth/cache';

await revokeRole(
  'user123',                    // target user
  'employee',                   // user type
  'role-id-456',               // role to revoke
  'admin-id-789',              // who's revoking
  // optional: 'dept-id-999'   // department scope
);

await invalidateUserPermissionsCache('user123');
```

---

## 📊 Query User Info

### Get All User Roles

```typescript
import { getUserRoles } from '@/lib/auth/rbac';

const ctx = { userId: 'user123', userType: 'employee' };
const roles = await getUserRoles(ctx);

roles.forEach(ur => {
  console.log(`Role: ${ur.role.name}, Scoped to: ${ur.departmentId}`);
});
```

### Get All User Permissions

```typescript
import { getCachedUserPermissions } from '@/lib/auth/cache';

const ctx = { userId: 'user123', userType: 'employee' };
const perms = await getCachedUserPermissions(ctx);

console.log('User has:', perms); // ['orders.create:orders', 'orders.read:orders', ...]
```

### Check if User Has Specific Role

```typescript
import { hasRole } from '@/lib/auth/rbac';

const ctx = { userId: 'user123', userType: 'employee' };
const isFulfiller = await hasRole(ctx, 'kitchen.fulfiller', 'dept-999');

if (isFulfiller) {
  // Show fulfillment UI
}
```

---

## 🛠️ Admin Tasks

### Add New Permission to System

**Option 1: SQL Direct**
```sql
INSERT INTO permissions (id, action, subject, description, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'bookings.modify',
  'bookings',
  'Modify existing booking',
  NOW(),
  NOW()
);
```

**Option 2: In Admin UI (not yet built)**
- Create form to insert permission
- Call: `prisma.permission.create({ data: {...} })`

### Create New Role

```sql
INSERT INTO roles (id, code, name, description, type, "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'restaurant.manager',
  'Restaurant Manager',
  'Manages restaurant orders and staff',
  'standard',
  true,
  NOW(),
  NOW()
);
```

### Add Permission to Role

```sql
-- Get role ID
SELECT id FROM roles WHERE code = 'restaurant.manager';

-- Get permission ID
SELECT id FROM permissions WHERE action = 'orders.fulfill';

-- Link them
INSERT INTO role_permissions (id, "roleId", "permissionId", "createdAt")
VALUES (gen_random_uuid(), '<role_id>', '<perm_id>', NOW());
```

### Bulk Assign Role to Multiple Users

```typescript
import { grantRole } from '@/lib/auth/rbac';
import { invalidateUserPermissionsCache } from '@/lib/auth/cache';

const userIds = ['user1', 'user2', 'user3'];
const roleId = 'role-456';

for (const userId of userIds) {
  await grantRole(userId, 'employee', roleId, 'admin-id', 'dept-999');
  await invalidateUserPermissionsCache(userId);
}
```

---

## 🔍 Debugging

### View All Available Roles

```typescript
import { getAllRoles } from '@/lib/auth/rbac';

const roles = await getAllRoles('employee');  // filter by type
roles.forEach(r => {
  console.log(`${r.code}: ${r.name} (${r.rolePermissions.length} perms)`);
});
```

### View All Available Permissions

```typescript
import { getAllPermissions } from '@/lib/auth/rbac';

const perms = await getAllPermissions('orders');  // filter by subject
perms.forEach(p => {
  console.log(`${p.action}:${p.subject} - ${p.description}`);
});
```

### Check Cache Stats

```typescript
import { getCacheStats } from '@/lib/auth/cache';

const stats = await getCacheStats();
console.log('Cache stats:', stats);
// Output: { enabled: true, totalEntries: 42, ttl: 3600, prefix: 'perms' }
```

### Force Clear All Caches

```typescript
import { clearAllPermissionCache } from '@/lib/auth/cache';

await clearAllPermissionCache();
// Use only in emergency or testing!
```

---

## 📝 Common Permission Strings

Keep these in mind when building features:

```
// Dashboard & Admin
dashboard.read

// Order Management
orders.read
orders.create
orders.update
orders.delete
orders.fulfill
orders.approve

// Booking Management
bookings.read
bookings.create
bookings.update
bookings.delete
bookings.checkin
bookings.checkout

// Inventory
inventory.read
inventory.update
inventory.transfer
inventory.restock

// Department Management
departments.read
departments.manage

// User Management
users.read
users.create
users.update
users.delete

// Roles & Permissions
roles.read
roles.create
roles.update
roles.delete
permissions.read
permissions.manage

// Customer Management
customers.read
customers.create
customers.update
customers.delete

// Payment Processing
payments.read
payments.process
payments.refund

// Reports
reports.read
reports.export

// System Settings
settings.read
settings.manage
```

---

## 🚨 Error Handling

### Permission Denied (403)

```typescript
// The middleware returns 403 automatically
// In your handler, you can assume permission was granted

export const POST = withPermission(async (req, ctx) => {
  // If we get here, permission was already verified
  // No need for additional checks
  return NextResponse.json({ success: true });
});
```

### Handle Permission Check Failure

```typescript
try {
  const allowed = await checkPermission(ctx, 'orders.create');
  if (!allowed) {
    throw new ForbiddenError(`User ${ctx.userId} lacks orders.create permission`);
  }
} catch (error) {
  console.error('Permission check error:', error);
  return NextResponse.json({ error: 'Internal error' }, { status: 500 });
}
```

---

## 🎓 Learning Path

1. **Start Here:** Read `RBAC_QUICK_START.md` (5 min read)
2. **Understand:** Read `RBAC_IMPLEMENTATION_GUIDE.md` § Runtime Best Practices (10 min)
3. **Implement:** Use examples above in your first route (15 min)
4. **Debug:** Use debugging section above if issues arise (5 min)
5. **Reference:** Bookmark this card for quick lookups

---

## 📞 When Things Go Wrong

| Symptom | Cause | Fix |
|---------|-------|-----|
| 403 error on every request | User has no role or permissions | `grantRole()` or `grantPermission()` |
| Permission check hanging | Redis down or DB connection issue | Check logs, restart Redis |
| Stale permissions after role change | Cache not invalidated | Call `invalidateUserPermissionsCache()` |
| Admin UI still uses old auth | Old code not migrated | Search for `AdminPermission` in codebase |
| Performance degradation | Too many DB queries | Enable Redis caching with `initializeCache()` |

---

## 🔗 Key Files

- `lib/auth/rbac.ts` — Main service (permission checking)
- `lib/auth/middleware.ts` — Route protection
- `lib/auth/cache.ts` — Performance optimization
- `lib/auth/audit.ts` — Compliance & debugging
- `scripts/migrate-rbac.ts` — Data migration

---

## 💡 Pro Tips

✅ **Always invalidate cache after role changes**
```typescript
await grantRole(...);
await invalidateUserPermissionsCache(userId);  // Don't forget!
```

✅ **Use middleware decorators for routes**
```typescript
export const POST = withPermission(handler, 'action', 'subject');
// Cleaner than checking inside handler
```

✅ **Batch permission checks when possible**
```typescript
const perms = await getCachedUserPermissions(ctx);
const canCreate = perms.includes('orders.create:orders');
const canDelete = perms.includes('orders.delete:orders');
// Only 1 DB query (cached) instead of 2
```

✅ **Document custom permissions**
```typescript
// When adding new permission strings, add to this card
// so team knows what they mean
```

---

**Last Updated:** November 25, 2025  
**Questions?** See full docs in `docs/RBAC_IMPLEMENTATION_GUIDE.md`

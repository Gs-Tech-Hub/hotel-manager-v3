# Page Access Control - Quick Reference

## TL;DR - Make Pages Only Accessible to Specific Roles

### Step 1: Define Page Access Rule

Edit [lib/auth/page-access.ts](../lib/auth/page-access.ts):

```typescript
"/my-page": {
  requiredRoles: ["role_name"],
  adminBypass: true,  // Admins always get access
}

"/my-page/*": {
  requiredRoles: ["role_name"],
  adminBypass: true,
}
```

### Step 2: Restart Dev Server

Middleware is compiled on startup. Changes take effect immediately after restart.

```bash
npm run dev
```

### Step 3: Test

Visit the page with a user who has/doesn't have the role. Unauthorized users are redirected to `/dashboard`.

## Page Access Rules Quick Lookup

### Admin Only
```typescript
"/dashboard/admin/*": {
  requiredRoles: ["admin"],
  adminBypass: true,
}
```

### Managers Only
```typescript
"/inventory": {
  requiredRoles: ["manager"],
  adminBypass: true,
}
```

### POS Staff (with fallback for managers/admins)
```typescript
"/pos/orders": {
  requiredRoles: ["pos_staff", "pos_manager", "admin"],
  requiredPermissions: ["orders.read"],
  adminBypass: true,
}
```

### Multiple Permissions Required
```typescript
"/inventory/transfers": {
  requiredRoles: ["manager", "admin"],
  requiredPermissions: ["inventory.read", "inventory.transfer"],
  adminBypass: true,
}
```

### Any Authenticated User
```typescript
"/docs": {
  authenticatedOnly: true,
}
```

## Adding a New User Role

1. **Create role in database**:
   ```sql
   INSERT INTO roles (code, name, type, is_active)
   VALUES ('cashier', 'Cashier', 'standard', true);
   ```

2. **Add to page access rules** (this file):
   ```typescript
   "/pos/checkout": {
     requiredRoles: ["cashier", "pos_manager", "admin"],
     adminBypass: true,
   }
   ```

3. **Assign role to users**:
   ```sql
   INSERT INTO user_roles (user_id, user_type, role_id)
   VALUES ('user123', 'employee', (SELECT id FROM roles WHERE code = 'cashier'));
   ```

## Debugging: User Can't Access Page

### Check 1: User Has Role
```sql
SELECT ur.id, r.code FROM user_roles ur
JOIN roles r ON ur.role_id = r.id
WHERE ur.user_id = 'the_user_id';
```

### Check 2: Page Rule Matches Role
Open [lib/auth/page-access.ts](../lib/auth/page-access.ts) and find the page:
- Is the user's role in `requiredRoles`?
- Does `adminBypass: true` exist (if user is admin)?

### Check 3: Check Server Logs
```
[middleware] User denied access to /dashboard/admin/roles. Roles: pos_staff
```

This tells you exactly why access was denied.

## Role Hierarchy

| Role | Can Access |
|------|-----------|
| `admin` | Everything |
| `manager` | Inventory, Departments, Employees, Bookings, Rooms |
| `pos_manager` | POS pages, POS Terminals, Discounts |
| `pos_staff` | POS ordering pages only |
| `terminal_operator` | POS checkout terminals only |
| `receptionist` | Bookings, Rooms, Customers |
| `inventory_staff` | Inventory pages only |

## Key Files

- **Rules**: [lib/auth/page-access.ts](../lib/auth/page-access.ts)
- **Middleware**: [middleware.ts](../middleware.ts)
- **Client Component**: [components/protected-route.tsx](../components/protected-route.tsx)
- **Hook**: [hooks/usePageAccess.ts](../hooks/usePageAccess.ts)
- **Full Docs**: [docs/PAGE_ACCESS_CONTROL.md](PAGE_ACCESS_CONTROL.md)

## Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| User always redirected to `/dashboard` | Check middleware logs; verify user has a role assigned |
| Page loads but shows "Access Denied" | Check `ProtectedRoute` props match user's actual roles |
| New rule not taking effect | Restart dev server (`npm run dev`) |
| Admin user can't access admin page | Ensure they have `admin` role in database |

## Testing

```bash
# Run with a specific user to test role-based access
npm run dev

# Open DevTools > Network tab
# Look for 307 redirect responses = access denied
# Look for 200 OK = access granted
```

---

**See [docs/PAGE_ACCESS_CONTROL.md](PAGE_ACCESS_CONTROL.md) for full documentation.**

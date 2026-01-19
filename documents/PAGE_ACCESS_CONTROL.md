# Page Access Control (RBAC) Implementation

## Overview

The Hotel Manager v3 system implements comprehensive **role-based access control (RBAC)** for all pages. This document explains how page access is scoped per user based on their roles and permissions.

## Architecture

### Three-Layer Security Model

1. **Middleware Layer** (`middleware.ts`) - Server-side enforcement
   - Verifies authentication
   - Loads user roles and permissions
   - Checks page access rules
   - Redirects unauthorized users to `/dashboard`

2. **Component Layer** (`ProtectedRoute`) - Client-side guards
   - Wraps page content with role/permission checks
   - Shows "Access Denied" message if user lacks permissions
   - Prevents unauthorized UI rendering (defense in depth)

3. **Hook Layer** (`usePageAccess`) - UX feedback
   - Allows components to dynamically hide/show content
   - **Note:** This is for UX only, not for security

## Page Access Rules

All page access requirements are defined in [lib/auth/page-access.ts](lib/auth/page-access.ts).

### Rule Types

Each page can require:
- **`requiredRoles`** - User must have at least one of these roles
- **`requiredPermissions`** - User must have ALL of these permissions
- **`requiredAnyPermissions`** - User must have ANY of these permissions
- **`adminBypass`** - Admins automatically gain access
- **`authenticatedOnly`** - Any authenticated user can access

### Example Rules

```typescript
// Admin only
"/dashboard/admin/*": {
  requiredRoles: ["admin"],
  adminBypass: true,  // Redundant but explicit
}

// POS staff and managers (with permission check)
"/pos": {
  requiredRoles: ["pos_staff", "pos_manager", "admin"],
  requiredPermissions: ["orders.read"],
  adminBypass: true,  // Admins bypass role check
}

// Authenticated users only
"/docs": {
  authenticatedOnly: true,
}
```

## Role Hierarchy

### Standard Roles

| Role | Pages | Permissions |
|------|-------|-------------|
| `admin` | All | All |
| `manager` | Bookings, Rooms, Customers, Employees, Inventory, Departments, Discounts | departments.read, bookings.read, rooms.read, employees.read, inventory.read |
| `pos_manager` | POS, POS Terminals, Discounts | orders.read, pos_terminal.access, discounts.read |
| `pos_staff` | POS | orders.read |
| `terminal_operator` | POS Terminals | pos_terminal.access |
| `receptionist` | Bookings, Rooms, Customers | bookings.read, rooms.read, customers.read |
| `inventory_staff` | Inventory | inventory.read |

## How It Works

### 1. User Login
User provides credentials → JWT token issued → Token stored in `auth_token` cookie

### 2. Request to Protected Page
```
Request → Middleware
  ├─ Check auth_token exists
  ├─ Verify JWT token
  ├─ Load user roles/permissions from database
  ├─ Get page access rule for pathname
  ├─ Check if user has required roles/permissions
  └─ Allow ✓ or Redirect to /dashboard ✗
```

### 3. Middleware Flow

```typescript
// In middleware.ts
async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // 1. Verify authentication
  const session = await verifyToken(token);

  // 2. Load full user context
  const userContext = await loadUserAccessContext(
    session.userId,
    session.userType
  );

  // 3. Get page rule
  const pageRule = getPageAccessRule(pathname);

  // 4. Check access
  const hasAccess = checkPageAccess(
    pageRule,
    userContext.roles,
    userContext.permissions,
    userContext.userType
  );

  if (!hasAccess) {
    // Redirect to dashboard
    return NextResponse.redirect('/dashboard');
  }

  // Allow request to proceed
  return NextResponse.next();
}
```

### 4. User Context Headers

After middleware validation, user context is set in headers for API routes:
```
x-user-id: "user123"
x-user-type: "employee"
x-user-roles: "pos_staff,pos_manager"
x-user-permissions: "orders.read,orders.create"
x-department-id: "dept456"
```

API routes can use these headers to make additional permission decisions.

## Usage

### For Developers: Adding Page Access Rules

1. **Edit [lib/auth/page-access.ts](lib/auth/page-access.ts)**

   ```typescript
   "/my-new-page": {
     requiredRoles: ["manager", "admin"],
     requiredPermissions: ["some.permission"],
     adminBypass: true,
   },

   "/my-new-page/*": {
     requiredRoles: ["manager", "admin"],
     adminBypass: true,
   }
   ```

2. **Restart the dev server** (middleware is recompiled)

3. **Test by accessing the page**
   - If unauthorized: should redirect to `/dashboard`
   - If authorized: page should load

### For Components: Checking Page Access Client-Side

**For UX purposes only - actual authorization happens server-side:**

```typescript
'use client';

import { usePageAccess } from '@/hooks/usePageAccess';

export function MyComponent() {
  const { hasAccess, requiredRoles } = usePageAccess();

  if (!hasAccess) {
    return <AccessDeniedMessage roles={requiredRoles} />;
  }

  return <div>Page content...</div>;
}
```

### For API Routes: Using User Headers

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Get user context from headers (set by middleware)
  const userId = request.headers.get('x-user-id');
  const userRoles = request.headers.get('x-user-roles')?.split(',') || [];
  const userPermissions = request.headers.get('x-user-permissions')?.split(',') || [];

  // Additional permission checks
  if (!userPermissions.includes('orders.create')) {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    );
  }

  // Process request
  return NextResponse.json({ data: [...] });
}
```

## Key Files

| File | Purpose |
|------|---------|
| [middleware.ts](../../middleware.ts) | Server-side page access enforcement |
| [lib/auth/page-access.ts](lib/auth/page-access.ts) | Page access rules and check logic |
| [lib/auth/user-access-context.ts](lib/auth/user-access-context.ts) | User context loading from database |
| [components/protected-route.tsx](../../components/protected-route.tsx) | Client-side component guard |
| [hooks/usePageAccess.ts](../../hooks/usePageAccess.ts) | Client-side UX hook |

## Security Model

### Defense in Depth

1. **Middleware** (Server) - Primary enforcement
   - User cannot bypass (runs on server)
   - Checks every request before page loads
   - Redirects unauthorized users

2. **Component** (Client) - Secondary guard
   - Prevents unauthorized UI rendering
   - Guards with `<ProtectedRoute>`
   - Shows "Access Denied" message

3. **API Routes** (Server) - Tertiary check
   - Additional permission verification
   - Uses headers from middleware
   - Can enforce department scoping

### Important: Client-Side Checks Are NOT Secure

```typescript
// ❌ BAD: Relying only on client-side check
if (user.roles.includes('admin')) {
  // This can be bypassed via browser DevTools!
  return <AdminPage />;
}

// ✓ GOOD: Server-side middleware + component layer
// Middleware checks first, then component renders
```

## Debugging Access Issues

### User Cannot Access Page

1. **Check if user is authenticated**
   ```bash
   # Look at Application > Cookies > auth_token
   # Token should exist and be valid
   ```

2. **Check user roles**
   ```sql
   SELECT ur.id, r.code, r.name
   FROM user_roles ur
   JOIN roles r ON ur.role_id = r.id
   WHERE ur.user_id = 'user123';
   ```

3. **Check page rule**
   - Edit [lib/auth/page-access.ts](lib/auth/page-access.ts)
   - Find the page pathname
   - Verify `requiredRoles` matches user's roles

4. **Check server logs**
   ```
   [middleware] User denied access to /dashboard/admin/roles. Roles: pos_staff
   ```

### Adding User Role

```typescript
// Programmatically grant role
const userRole = await prisma.userRole.create({
  data: {
    userId: 'user123',
    userType: 'employee',
    roleId: 'role_manager_id',
    // Optional: scope to department
    departmentId: 'dept456',
  },
});
```

## Testing Page Access

### Manual Testing

1. **Login as different roles** and try accessing pages
2. **Verify redirects** occur for unauthorized access
3. **Check browser DevTools** Network tab for redirect responses

### Automated Testing (Future)

```typescript
describe('Page Access Control', () => {
  it('should deny non-admin access to /dashboard/admin', async () => {
    const response = await middleware(
      createRequest('/dashboard/admin/roles', { userType: 'employee' })
    );
    expect(response.status).toBe(307); // Redirect
    expect(response.headers.get('location')).toBe('/dashboard');
  });
});
```

## Performance Considerations

### Database Queries

**Per-request cost:**
- 1 × `UserRole.findMany()` to load user's roles and permissions
- Includes role → permissions relationship (avoid N+1)

**Optimization:**
- Roles/permissions cached in memory on middleware startup
- Redis cache layer can be added for high-traffic deployments

### Caching Strategy

Currently: No caching (queries on every request)

**Future improvements:**
- Cache user roles/permissions in Redis with TTL
- Invalidate cache on role/permission changes
- Use `verifyToken` to minimize database calls

## Common Patterns

### Add New Page with Role Requirement

```typescript
// 1. Add rule in page-access.ts
"/my-feature": {
  requiredRoles: ["my_role"],
  adminBypass: true,
}

// 2. Create the page component (middleware will protect it)
// app/(dashboard)/my-feature/page.tsx

// 3. Optional: Wrap with ProtectedRoute for extra safety
export default function MyFeaturePage() {
  return (
    <ProtectedRoute requiredRole="my_role">
      <div>Feature content</div>
    </ProtectedRoute>
  );
}
```

### Dynamically Show/Hide Based on Role

```typescript
'use client';

import { useAuth } from '@/components/auth-context';

export function FeatureToggle() {
  const { user } = useAuth();

  if (!user?.roles?.includes('manager')) {
    return null; // Hide for non-managers
  }

  return <div>Manager-only feature</div>;
}
```

### Check Permission Before Making API Call

```typescript
'use client';

import { useAuth } from '@/components/auth-context';

export function OrderActions() {
  const { user } = useAuth();

  async function handleCreateOrder() {
    // Check before API call (good UX)
    if (!user?.permissions?.includes('orders.create')) {
      alert('You do not have permission to create orders');
      return;
    }

    // Make API call (server will also check)
    const response = await fetch('/api/orders', { method: 'POST' });
  }

  return <button onClick={handleCreateOrder}>Create Order</button>;
}
```

## Troubleshooting

### Issue: User always redirected to `/dashboard`

**Solution:**
1. Check `middleware.ts` isn't throwing errors (check server logs)
2. Verify `loadUserAccessContext()` returns successfully
3. Ensure user has at least one role assigned in database

### Issue: Page loads but content says "Access Denied"

**Solution:**
1. `ProtectedRoute` component wrapper has stricter checks
2. Remove or adjust `requiredRole`/`requiredPermission` props
3. Verify user actually has the required role/permission

### Issue: Performance degradation after adding middleware

**Solution:**
1. Add Redis caching for user roles (see Caching Strategy section)
2. Use `include()` in Prisma queries to avoid N+1 queries
3. Monitor database query times in production

## Next Steps

1. **Seed demo users** with various roles
   ```bash
   npm run seed:users
   ```

2. **Test all pages** with different role combinations

3. **Monitor access logs** in production (add to audit trail)

4. **Implement caching** if performance issues arise

5. **Document custom roles** specific to your organization

---

**Last Updated:** January 8, 2026

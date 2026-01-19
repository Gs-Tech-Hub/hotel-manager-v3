# Roles & Access Control System

## Overview

This system implements role-based access control (RBAC) for the Hotel Manager application. Users can be assigned one or more roles, and each role determines what operations they can perform.

## Database Schema

### Models

- **AdminUser** - Application users
- **AdminRole** - Role definitions (admin, manager, staff, customer, etc.)
- **AdminPermission** - Granular permissions attached to roles
- **AdminUser ↔ AdminRole** - Many-to-many relationship

### Key Tables

```
admin_users (id, email, username, password, ...)
admin_roles (id, code, name, description, ...)
admin_permissions (id, action, subject, roleId, ...)
```

Example roles:
- `admin` - Full system access
- `manager` - Can manage hotel operations (bookings, inventory, staff)
- `staff` - Can perform daily tasks (check-ins, orders, etc.)
- `customer` - Limited access to own data

## API Endpoints

### Role Management (Admin Only)

#### List all roles
```
GET /api/admin/roles
Headers: x-user-id, x-user-role: admin

Response:
{
  "success": true,
  "data": [
    {
      "id": "role-1",
      "code": "admin",
      "name": "Administrator",
      "description": "Full system access",
      "users": [...],
      "permissions": [...]
    }
  ]
}
```

#### Create a new role
```
POST /api/admin/roles
Headers: x-user-id, x-user-role: admin

Body:
{
  "code": "staff",
  "name": "Staff Member",
  "description": "Can perform daily operations"
}

Response:
{
  "success": true,
  "data": { "id": "role-2", "code": "staff", ... }
}
```

#### Get role by ID
```
GET /api/admin/roles/[id]
Headers: x-user-id, x-user-role: admin
```

#### Update role
```
PUT /api/admin/roles/[id]
Headers: x-user-id, x-user-role: admin

Body:
{
  "name": "Updated Name",
  "description": "Updated description"
}
```

#### Delete role
```
DELETE /api/admin/roles/[id]
Headers: x-user-id, x-user-role: admin
```

### User Role Assignment (Admin Only)

#### Get user roles
```
GET /api/admin/users/[userId]/roles
Headers: x-user-id, x-user-role: admin

Response:
{
  "success": true,
  "data": [
    { "id": "role-1", "code": "admin", "name": "Administrator", ... }
  ]
}
```

#### Assign role to user
```
POST /api/admin/users/[userId]/roles
Headers: x-user-id, x-user-role: admin

Body:
{
  "roleId": "role-2"
}

Response:
{
  "success": true,
  "data": { "id": "user-1", "roles": [...] }
}
```

#### Revoke role from user
```
DELETE /api/admin/users/[userId]/roles/[roleId]
Headers: x-user-id, x-user-role: admin
```

#### Set all user roles (batch)
```
PUT /api/admin/users/[userId]/roles/batch
Headers: x-user-id, x-user-role: admin

Body:
{
  "roleIds": ["role-1", "role-2"]
}

Response:
{
  "success": true,
  "data": { "id": "user-1", "roles": [...] }
}
```

## Authentication & Context Extraction

### User Context Extraction

User context (userId + role) is extracted from request headers:

```typescript
import { extractUserContext } from '@/lib/user-context';

const ctx = extractUserContext(req);
// ctx = { userId: "user-123", userRole: "admin", userRoles: [...], isAdmin: true }
```

**Expected Headers:**
- `x-user-id` - The user's ID
- `x-user-role` - The user's primary role (e.g., "admin", "manager")

### Loading Full User Context

To load complete user information including all assigned roles from the database:

```typescript
import { loadUserWithRoles } from '@/lib/user-context';

const fullCtx = await loadUserWithRoles(userId);
```

## Authorization Helpers

### Check if user has any allowed role

```typescript
import { hasAnyRole } from '@/lib/user-context';

if (!hasAnyRole(ctx, ['admin', 'manager'])) {
  return sendError(ErrorCodes.FORBIDDEN, 'Access denied');
}
```

### Check if user is owner or has allowed role

```typescript
import { isOwnerOrHasRole } from '@/lib/user-context';

if (!isOwnerOrHasRole(ctx, customerId, ['admin', 'manager'])) {
  return sendError(ErrorCodes.FORBIDDEN, 'Access denied');
}
```

### Check if user is admin

```typescript
import { isAdmin } from '@/lib/user-context';

if (!isAdmin(ctx)) {
  return sendError(ErrorCodes.FORBIDDEN, 'Admin access required');
}
```

## Usage Examples

### Protecting an API Route

```typescript
// app/api/inventory/route.ts
import { extractUserContext, hasAnyRole } from '@/lib/user-context';
import { sendError, ErrorCodes } from '@/lib/api-handler';

export async function GET(req: NextRequest) {
  const ctx = extractUserContext(req);

  // Only admin, manager, and staff can view inventory
  if (!hasAnyRole(ctx, ['admin', 'manager', 'staff'])) {
    return sendError(ErrorCodes.FORBIDDEN, 'Access denied');
  }

  // ... fetch and return inventory
}
```

### Service-Level Authorization

```typescript
// src/services/order.service.ts
import { UserContext, requireRoleOrOwner } from '@/lib/authorization';

async getCustomerOrders(customerId: string, ctx?: UserContext) {
  // Customer can view own orders, admins/managers can view any customer's orders
  const forbidden = requireRoleOrOwner(ctx, customerId, ['admin', 'manager']);
  if (forbidden) return forbidden;

  return await prisma.order.findMany({ where: { customerId } });
}
```

## Role Hierarchy (Recommended)

1. **admin** - Root access, can manage all roles and users
2. **manager** - Can manage hotel operations, staff, and reports
3. **staff** - Can perform daily operations (bookings, payments, etc.)
4. **customer** - Limited to own data access

## Setting Up Headers

### Option 1: Reverse Proxy (Recommended for Production)

Configure your reverse proxy (Nginx, HAProxy, etc.) to extract user info from JWT and set headers:

```nginx
# Nginx example
location /api {
  # Assuming JWT is in Authorization header
  set $user_id "";
  set $user_role "";
  
  # Parse JWT and set headers (use a module like auth_request)
  proxy_pass http://backend;
  proxy_set_header x-user-id $user_id;
  proxy_set_header x-user-role $user_role;
}
```

### Option 2: Middleware (For Development/Testing)

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  // For development: mock user context from headers or env
  const headers = new Headers(req.headers);
  
  if (!headers.get('x-user-id')) {
    headers.set('x-user-id', 'user-dev-123');
    headers.set('x-user-role', 'admin');
  }

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/api/:path*']
};
```

### Option 3: JWT Decode (If Using JWT Auth)

Install JWT library:
```bash
npm install jsonwebtoken
```

Decode token in your route:
```typescript
import jwt from 'jsonwebtoken';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (token) {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    const ctx = {
      userId: decoded.sub,
      userRole: decoded.role,
    };
    // Use ctx for authorization
  }
}
```

## Best Practices

1. **Always extract context** at the beginning of route handlers
2. **Fail-safe defaults** - Deny access unless explicitly allowed
3. **Load full roles** when needed - Use `loadUserWithRoles()` for permission checks
4. **Use middleware** - Consider centralizing auth logic in Next middleware
5. **Audit logs** - Log all role changes for security
6. **Role codes** - Use lowercase, hyphen-separated codes (e.g., `super-admin`, `front-desk`)

## Migration Guide (First Time Setup)

### 1. Create default roles

```bash
# You can seed the database via a script or API call
POST /api/admin/roles
{
  "code": "admin",
  "name": "Administrator",
  "description": "Full system access"
}
```

### 2. Assign roles to existing users

```bash
POST /api/admin/users/{userId}/roles
{
  "roleId": "role-id"
}
```

### 3. Update API routes to use authorization

See "Usage Examples" section above.

## Troubleshooting

### User roles not loading

- Ensure user exists in database
- Check that roles are properly assigned in DB
- Verify headers are being passed correctly

### Always denied even as admin

- Check `x-user-role` header is set to "admin"
- Verify user exists with admin role in DB
- Check database connection

### Headers not appearing in requests

- If using a client library, ensure headers are included
- Check middleware or proxy isn't filtering headers
- For development, use browser DevTools Network tab to verify

## Next Steps

1. **Implement middleware** in `middleware.ts` for centralized auth
2. **Add permission matrix** - More granular control (action-subject based)
3. **Add audit logging** - Track role changes
4. **Add role templates** - Pre-defined role sets for common positions
5. **Implement session management** - JWT refresh tokens, expiration

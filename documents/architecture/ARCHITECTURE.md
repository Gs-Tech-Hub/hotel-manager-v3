# Role Management System - Architecture Overview

## System Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client / Browser                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                    HTTP Request with:
              Authorization: Bearer JWT or Session
                         │
         ┌───────────────┴───────────────┐
         │                               │
    ┌────▼─────────────────┐       ┌────▼──────────────┐
    │  middleware.ts or    │       │  Reverse Proxy    │
    │  API Layer Auth      │       │  (Nginx, HAProxy) │
    └────┬─────────────────┘       └────┬──────────────┘
         │                              │
    ┌────▼──────────────────────────────▼──────┐
    │   Extract user info from token/session    │
    │   Set headers:                            │
    │   - x-user-id: "user-123"                 │
    │   - x-user-role: "admin"                  │
    └────┬─────────────────────────────────────┘
         │
    ┌────▼────────────────────────────────────────────────┐
    │       Next.js API Route Handler                     │
    │  ┌─────────────────────────────────────────────┐   │
    │  │  const ctx = extractUserContext(req);       │   │
    │  │  if (!hasAnyRole(ctx, ['admin']))           │   │
    │  │    return sendError(FORBIDDEN, ...)         │   │
    │  └─────────────────────────────────────────────┘   │
    └────┬────────────────────────────────────────────────┘
         │
    ┌────▼──────────────────────────────┐
    │   Business Logic / Service Layer   │
    │  ┌───────────────────────────────┐ │
    │  │ async getOrderStats(ctx) {    │ │
    │  │   const forbidden =           │ │
    │  │    requireRole(ctx, ['admin'])│ │
    │  │   if (forbidden) return it    │ │
    │  │   // proceed ...              │ │
    │  │ }                             │ │
    │  └───────────────────────────────┘ │
    └────┬──────────────────────────────┘
         │
    ┌────▼──────────────────────────────┐
    │   Database Query                   │
    │  ┌───────────────────────────────┐ │
    │  │ FROM orders WHERE status=...  │ │
    │  └───────────────────────────────┘ │
    └────┬──────────────────────────────┘
         │
    ┌────▼──────────────────────────────┐
    │   Response                         │
    │  ┌───────────────────────────────┐ │
    │  │ {                             │ │
    │  │   success: true,              │ │
    │  │   data: [...orders...]        │ │
    │  │ }                             │ │
    │  └───────────────────────────────┘ │
    └──────────────────────────────────┘
```

## Directory Structure

```
hotel-manager-v3/
├── app/
│   └── api/
│       ├── admin/
│       │   ├── roles/
│       │   │   ├── route.ts           ← List/create roles
│       │   │   └── [id]/
│       │   │       └── route.ts       ← Get/update/delete role
│       │   └── users/
│       │       └── [userId]/
│       │           └── roles/
│       │               ├── route.ts   ← Manage user roles
│       │               └── batch/
│       │                   └── route.ts ← Batch role assignment
│       ├── orders/
│       │   └── route.ts               ← Uses UserContext
│       ├── bookings/
│       ├── customers/
│       └── ...
│
├── src/
│   ├── lib/
│   │   ├── user-context.ts            ← Extract & load context
│   │   ├── authorization.ts           ← Service-level checks
│   │   ├── api-handler.ts             ← (Existing)
│   │   ├── api-response.ts            ← (Existing)
│   │   └── prisma.ts                  ← (Existing)
│   │
│   ├── services/
│   │   ├── role-management.service.ts ← Role CRUD & assignment
│   │   ├── order.service.ts           ← Example with role checks
│   │   ├── customer.service.ts
│   │   └── ...
│   │
│   └── scripts/
│       └── seed-roles.ts              ← Initialize default roles
│
├── middleware.example.ts              ← Auth context setup
│
├── prisma/
│   └── schema.prisma                  ← AdminUser, AdminRole, AdminPermission
│
├── ROLES_AND_ACCESS.md                ← Full documentation
├── ROLES_QUICK_REFERENCE.md           ← Quick reference
├── IMPLEMENTATION_SUMMARY.md          ← This implementation
└── README.md                          ← (Existing)
```

## Database Schema

```sql
-- Users
CREATE TABLE admin_users (
  id SERIAL PRIMARY KEY,
  email VARCHAR UNIQUE,
  username VARCHAR,
  password VARCHAR,
  blocked BOOLEAN DEFAULT FALSE,
  isActive BOOLEAN DEFAULT FALSE,
  -- ... other fields
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);

-- Roles
CREATE TABLE admin_roles (
  id SERIAL PRIMARY KEY,
  code VARCHAR UNIQUE,        -- "admin", "manager", "staff", "customer"
  name VARCHAR,               -- "Administrator", "Manager", etc.
  description VARCHAR,
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);

-- User-Role Junction Table
CREATE TABLE _AdminUserToAdminRole (
  A VARCHAR REFERENCES admin_users(id),
  B VARCHAR REFERENCES admin_roles(id),
  PRIMARY KEY (A, B)
);

-- Permissions (for future granular control)
CREATE TABLE admin_permissions (
  id SERIAL PRIMARY KEY,
  action VARCHAR,             -- "read", "create", "update", "delete"
  subject VARCHAR,            -- "orders", "bookings", "customers"
  roleId VARCHAR REFERENCES admin_roles(id),
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);
```

## Role Examples

```
┌─────────────────────────────────────────────────────┐
│ ROLE: admin                                         │
│ ├─ Can create/delete roles                         │
│ ├─ Can assign roles to users                       │
│ ├─ Full access to all data                         │
│ └─ Access to admin dashboard                       │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ ROLE: manager                                      │
│ ├─ Can view analytics & reports                    │
│ ├─ Can manage staff schedules                      │
│ ├─ Can view/manage orders                          │
│ └─ Cannot create roles                             │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ ROLE: staff                                         │
│ ├─ Can check-in guests                             │
│ ├─ Can create orders                               │
│ ├─ Can view own shift data                         │
│ └─ Limited to assigned areas                       │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ ROLE: customer                                      │
│ ├─ Can view own bookings                           │
│ ├─ Can view own orders                             │
│ └─ Cannot modify others' data                      │
└─────────────────────────────────────────────────────┘
```

## API Endpoint Map

```
Admin Only Endpoints:
┌──────────────────────────────────────────────┐
│ Role Management                              │
├──────────────────────────────────────────────┤
│ GET    /api/admin/roles                      │ List all roles
│ POST   /api/admin/roles                      │ Create role
│ GET    /api/admin/roles/[id]                 │ Get role
│ PUT    /api/admin/roles/[id]                 │ Update role
│ DELETE /api/admin/roles/[id]                 │ Delete role
│                                              │
│ User Role Management                         │
│ GET    /api/admin/users/[userId]/roles       │ Get user roles
│ POST   /api/admin/users/[userId]/roles       │ Assign role
│ DELETE /api/admin/users/[userId]/roles/[rid] │ Revoke role
│ PUT    /api/admin/users/[userId]/roles/batch │ Set all roles
└──────────────────────────────────────────────┘

Protected by Role Check:
┌──────────────────────────────────────────────┐
│ All routes use extractUserContext()          │
│ and enforce role restrictions in handlers    │
│ or service methods                           │
└──────────────────────────────────────────────┘

Example: GET /api/orders/stats
Requires: x-user-role = "admin" or "manager"
```

## Authorization Checks

```typescript
// ROUTE HANDLER LEVEL
export async function GET(req: NextRequest) {
  const ctx = extractUserContext(req);
  
  // Check 1: Is admin?
  if (!isAdmin(ctx)) return sendError(FORBIDDEN, '...');
  
  // Check 2: Has any role?
  if (!hasAnyRole(ctx, ['admin', 'manager'])) return ...;
  
  // Check 3: Is owner or has role?
  if (!isOwnerOrHasRole(ctx, customerId, ['admin'])) return ...;
}

// SERVICE LAYER
export class OrderService {
  async getStats(ctx?: UserContext) {
    // Returns error object if unauthorized
    const forbidden = requireRole(ctx, ['admin', 'manager']);
    if (forbidden) return forbidden;
    
    // Proceed with query
  }
}
```

## Authentication Header Options

```
Option 1: Bearer Token (JWT)
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
→ Middleware decodes → Sets x-user-id, x-user-role

Option 2: Custom Headers (Dev/Testing)
x-user-id: user-123
x-user-role: admin
→ Route handler reads directly

Option 3: Session Cookie
Cookie: session=abc123...
→ Middleware loads session → Sets x-user-id, x-user-role

Option 4: Reverse Proxy (Production)
Authorization: Bearer ...
→ Proxy validates → Proxy sets x-user-id, x-user-role
→ App trusts headers from proxy
```

## Request Lifecycle Example

```
1. User clicks "View Analytics"
   ↓
2. Browser: GET /api/orders/stats
   Header: Authorization: Bearer jwt-token
   ↓
3. middleware.ts:
   - Extract JWT
   - Decode: { sub: "user-123", role: "manager" }
   - Set headers: x-user-id: "user-123", x-user-role: "manager"
   ↓
4. app/api/orders/route.ts:
   - Extract context: { userId: "user-123", userRole: "manager" }
   - Check role: hasAnyRole(ctx, ['admin', 'manager']) ✓
   - Call service
   ↓
5. src/services/order.service.ts:
   - getOrderStats(ctx)
   - Check role: requireRole(ctx, ['admin', 'manager'])
   - Query DB
   ↓
6. Response sent:
   { success: true, data: {...stats...} }
```

## Next Steps

1. ✅ System implemented
2. ⏳ Choose auth integration method (JWT/Session/Proxy)
3. ⏳ Create middleware.ts from middleware.example.ts
4. ⏳ Seed default roles: `npm run seed:roles`
5. ⏳ Assign roles to existing users
6. ⏳ Update API routes to use extractUserContext()
7. ⏳ Test with different user roles
8. ⏳ Add permission matrix (optional, for granular control)

---

See `ROLES_AND_ACCESS.md` and `ROLES_QUICK_REFERENCE.md` for detailed docs.

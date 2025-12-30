# Copilot Instructions for Hotel Manager v3

This document guides AI coding agents in understanding the architecture, patterns, and workflows of Hotel Manager v3—a Next.js-based hotel management system with POS, booking, inventory, and role-based access control (RBAC).

## Architecture Overview

**Tech Stack:** Next.js 15 (App Router), TypeScript, Prisma ORM, PostgreSQL, shadcn/ui, TailwindCSS

**Key Domains:**
- **Auth & RBAC**: Unified role-based access control with granular permissions
- **Orders**: POS system with department-specific ordering and fulfillment workflows
- **Inventory**: Department-level stock management with transfers and reconciliation
- **Bookings**: Room reservations and guest management
- **Departments**: Multi-section management (kitchen, bar, service areas)
- **Admin Dashboard**: Centralized management for permissions, users, and system configuration

## Critical Architecture Patterns

### 1. Unified RBAC (Role-Based Access Control)

**The System:**
- **Single source of truth:** `Permission` → `Role` → `UserRole` hierarchy
- **Schema models:** `Permission`, `Role`, `RolePermission`, `UserRole` in [prisma/schema.prisma](prisma/schema.prisma#L65-L110)
- **Supports:** Admin users, employee users, department-scoped roles, direct permission grants, and token-based access

**Where RBAC is checked:**
1. **API Routes** ([lib/auth/middleware.ts](lib/auth/middleware.ts)): Use `withPermission()`, `withAuth()`, `withAnyPermission()` decorators
2. **Route Handlers** ([src/lib/user-context.ts](src/lib/user-context.ts)): Call `extractUserContext()`, `hasAnyRole()`, `loadUserWithRoles()`
3. **Services**: Pass `PermissionContext` to business logic for fine-grained checks

**Key Functions:**
- `checkPermission(ctx, action, subject?)` - Core permission check (legacy admin + unified)
- `getUserRoles(ctx)` - Fetch all user roles with metadata
- `hasRole(ctx, roleCode, departmentId?)` - Check specific role
- `grantRole()` / `revokeRole()` - Audit-logged role management

**Common Pattern:**
```typescript
// Extract user context
const ctx = await extractUserContext(request);

// Require authentication
if (!ctx.userId) return errorResponse(UNAUTHORIZED);

// Load full user with roles
const userWithRoles = await loadUserWithRoles(ctx.userId);
if (!hasAnyRole(userWithRoles, ['admin', 'manager', 'staff'])) {
  return errorResponse(FORBIDDEN);
}

// Proceed with business logic
```

### 2. User Context & Authentication

**Session/JWT Flow:**
1. Middleware ([middleware.ts](middleware.ts)) decodes JWT from `auth_token` cookie or Authorization header
2. Sets user context in request headers: `x-user-id`, `x-user-role`, `x-user-type`, `x-department-id`
3. Route handlers extract via `extractUserContext(request)` → `UserContext` object

**Two User Types:**
- **admin** - AdminUser table, legacy admin RBAC (AdminRole, AdminPermission)
- **employee** - Unified user management via User/UserRole tables

**Session Management** ([lib/auth/session.ts](lib/auth/session.ts)):
- `verifyToken(token)` - Verify JWT and return session
- `getSession()` - Get current session from cookies
- `validateSession(session)` - Check if user is active and not blocked

### 3. API Response Standard

**Location:** [lib/api-response.ts](lib/api-response.ts)

**Pattern:**
```typescript
// Success
return NextResponse.json(
  successResponse({ data: result }),
  { status: 200 }
);

// Error
return NextResponse.json(
  errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
  { status: getStatusCode(ErrorCodes.FORBIDDEN) }
);
```

**Standard Error Codes:** `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `BAD_REQUEST`, `CONFLICT`, `INTERNAL_ERROR`

### 4. Order Management (POS System)

**Key Entities:**
- **Order** - Parent order with status (pending, processing, fulfilled, completed)
- **OrderItem** - Individual items with pricing, department routing
- **OrderFulfillment** - Fulfillment state per department/section
- **Department** - Organizational unit (kitchen, bar, service, etc.)

**Department-Specific Ordering:**
- Routes: `GET/POST /api/departments/[code]/orders`
- Each item routes to a department + optional section
- Kitchen display system (KDS) tracks pending items per section
- Price consistency: All prices stored in base currency, converted at display time

**Status Workflow:**
```
pending → processing (payment received) → fulfilled (all items done) → completed (served)
```

**Reference:** [app/api/departments/[code]/orders/route.ts](app/api/departments/[code]/orders/route.ts), [OrderService](src/services/order.service.ts)

### 5. Inventory & Department Management

**Multi-Level Inventory:**
1. **Global Inventory** - Organization-wide stock
2. **Department Inventory** - Department-specific allocations
3. **Reconciliation** - Scripts auto-sync discrepancies

**Key Routes:**
- `GET /api/inventory/products` - List products by type (food, drinks)
- `POST /api/inventory/transfer` - Inter-department transfers (audit-logged)
- `POST /api/departments/[code]/inventory` - Department stock

**Reconciliation Workflow:**
- Script: `npm run reconcile:dept-inv` - Auto-sync db vs. calculated state
- Detects missing/orphaned inventory records
- Logs discrepancies for audit

### 6. Data Filtering & Date Handling

**Date Filtering Utility:** [src/lib/date-filter.ts](src/lib/date-filter.ts)

**Common Patterns:**
```typescript
import { buildDateFilter } from '@/src/lib/date-filter';

const dateFilter = buildDateFilter({
  startDate: query.startDate,
  endDate: query.endDate,
  timezone: 'UTC'
});

// Use in Prisma query
const orders = await prisma.order.findMany({
  where: {
    createdAt: dateFilter
  }
});
```

**Price Consistency:**
- All prices stored with decimals in database
- Display: Format via `formatPrice()` utility
- Calculations: Use integer cent values to avoid floating-point errors

## Project Structure

```
app/                          # Next.js App Router
├── (auth)/                   # Login, register, auth pages
├── (dashboard)/              # Protected dashboard routes
├── (error)/                  # Error page layouts
├── api/                       # API routes (organized by domain)
│   ├── auth/                 # Auth endpoints
│   ├── departments/          # Dept-specific orders, inventory
│   ├── orders/               # Global order management
│   ├── inventory/            # Inventory operations
│   ├── admin/                # Admin endpoints (roles, permissions, users)
│   └── ...
├── globals.css               # Tailwind directives
└── layout.tsx                # Root layout with providers

components/                   # React components
├── admin/                    # Admin UI components
├── departments/              # Department-specific UI
├── shared/                   # Reusable components
├── ui/                       # shadcn/ui components
├── auth-context.tsx          # Auth state + hooks
├── auth-provider.tsx         # AuthProvider wrapper
└── protected-route.tsx       # Client-side route guard

lib/                          # Core utilities
├── auth/                     # Auth library
│   ├── rbac.ts              # Permission checking, role management
│   ├── middleware.ts        # Route protection decorators
│   ├── session.ts           # JWT/session handling
│   ├── cache.ts             # Permission caching
│   ├── audit.ts             # Audit logging
│   └── credentials.ts       # Password hashing
├── api-response.ts          # Standard response format
├── prisma.ts                # Prisma client with extensions
└── ...

src/                          # Additional source code
├── services/                # Business logic services
├── types/                   # TypeScript type definitions
├── lib/                     # Helper utilities
│   ├── date-filter.ts       # Date range filtering
│   └── user-context.ts      # User context extraction
└── scripts/                 # Database seeding and maintenance
    ├── seed.ts
    ├── seed-permissions.ts
    └── reconcile-department-inventories.ts

prisma/                       # Database schema
└── schema.prisma            # Complete data model

docs/                         # Documentation
├── RBAC_IMPLEMENTATION_GUIDE.md
├── ROLES_AND_ACCESS.md
└── ...
```

## Common Development Workflows

### Adding a Protected API Endpoint

1. **Extract context and check permissions:**
   ```typescript
   const ctx = await extractUserContext(request);
   if (!ctx.userId) return errorResponse(UNAUTHORIZED);
   
   const userWithRoles = await loadUserWithRoles(ctx.userId);
   if (!hasAnyRole(userWithRoles, ['admin', 'manager'])) {
     return errorResponse(FORBIDDEN);
   }
   ```

2. **Use permission context for RBAC:**
   ```typescript
   const permCtx: PermissionContext = {
     userId: ctx.userId,
     userType: userWithRoles.userType,
     departmentId: userWithRoles.departmentId
   };
   
   const hasAccess = await checkPermission(permCtx, 'orders.create', 'orders');
   if (!hasAccess) return errorResponse(FORBIDDEN);
   ```

3. **Return standard response:**
   ```typescript
   return NextResponse.json(
     successResponse({ orders: result }),
     { status: 200 }
   );
   ```

### Querying with Date Filters

```typescript
import { buildDateFilter } from '@/src/lib/date-filter';

const startDate = request.nextUrl.searchParams.get('startDate');
const endDate = request.nextUrl.searchParams.get('endDate');

const dateFilter = buildDateFilter({ startDate, endDate, timezone: 'UTC' });

const results = await prisma.order.findMany({
  where: {
    createdAt: dateFilter,
    // ... other filters
  }
});
```

### Department-Specific Operations

```typescript
// Extract department from route params
const { code: departmentCode } = await params;

// Load department
const dept = await prisma.department.findFirst({
  where: { departmentCode }
});

// Get department inventory
const inventory = await prisma.departmentInventory.findMany({
  where: { departmentId: dept.id }
});
```

### Seeding and Maintenance Scripts

**Available Commands:**
```bash
npm run seed               # Full data seed
npm run seed:permissions  # Permission matrix
npm run seed:users        # Demo users with roles
npm run reconcile:dept-inv # Sync inventory discrepancies
npm run cleanup:depts     # Remove orphaned records
```

**Script Pattern** ([scripts/seed.ts](scripts/seed.ts)):
```typescript
import { prisma } from '@/lib/prisma';

async function main() {
  // Create/update records
  await prisma.role.createMany({...});
  console.log('Seeded roles');
}

main().catch(console.error).finally(() => process.exit(0));
```

## Conventions & Best Practices

### Code Organization
- **One file, one responsibility**: Keep utilities focused
- **Export typed functions**: Always include parameter and return types
- **Document RBAC implications**: Add comments explaining permission checks
- **Use constants for error codes**: Reference `ErrorCodes.UNAUTHORIZED`, etc.

### Database Queries
- **Always await Prisma calls**: No unhandled promises
- **Use `.include()` for relationships**: Not separate queries (N+1)
- **Filter at DB level**: Avoid large result sets then filtering in code
- **Log significant operations**: Failed role checks, permission denied events

### API Routes
- **Check auth first**: Return `UNAUTHORIZED` before any business logic
- **Check roles/permissions second**: Return `FORBIDDEN` if insufficient access
- **Validate input early**: Use Zod or similar for request bodies
- **Return consistent response format**: Always use `successResponse()` / `errorResponse()`

### UI Components
- **Use `useAuth()` hook** for current user state
- **Check `user?.hasRole()` for UX-only visibility** (not security)
- **Never trust client-side role checks** for API calls
- **Use `ProtectedRoute` wrapper** for page-level auth

## Critical Files to Know

| File | Purpose | When to Modify |
|------|---------|---|
| [prisma/schema.prisma](prisma/schema.prisma) | Database model | Adding new entities or RBAC changes |
| [lib/auth/rbac.ts](lib/auth/rbac.ts) | Permission checking core | Changing RBAC logic |
| [lib/auth/middleware.ts](lib/auth/middleware.ts) | Route protection | Adding auth decorators |
| [middleware.ts](middleware.ts) | Request-level auth | JWT decode, session validation |
| [lib/api-response.ts](lib/api-response.ts) | Response format | API response structure |
| [src/lib/user-context.ts](src/lib/user-context.ts) | User context extraction | User header parsing |
| [components/auth-context.tsx](components/auth-context.tsx) | Frontend auth state | Client-side auth UI hooks |
| [app/api/orders/route.ts](app/api/orders/route.ts) | Order API pattern | Reference for similar endpoints |

## Debugging & Troubleshooting

### Auth Not Working
1. Check `middleware.ts`: Is it decoding JWT and setting headers?
2. Verify `auth_token` cookie exists: DevTools → Application → Cookies
3. Check `extractUserContext()`: Can it read `x-user-id` header?
4. Verify user exists in database with roles assigned

### Permission Denied but Should Be Allowed
1. Check user has role assigned: `SELECT * FROM user_roles WHERE user_id = '...';`
2. Check role has permission: `SELECT * FROM role_permissions WHERE role_id = '...';`
3. Check permission action/subject: `SELECT * FROM permissions WHERE action = '...';`
4. Enable debug logging in `lib/auth/rbac.ts` to trace permission check

### Department Inventory Not Syncing
1. Run reconciliation: `npm run reconcile:dept-inv`
2. Check logs for discrepancies
3. Manually verify: `SELECT COUNT(*) FROM department_inventory GROUP BY department_id;`

## Key Dependencies & Versions

- **next**: 15.3.4
- **@prisma/client**: 6.19.0
- **react**: 19.0.0
- **tailwindcss**: 4.0+
- **shadcn/ui**: Latest components from radix-ui

## Resources

- **Detailed Docs:** [docs/](docs/) directory
- **RBAC Guide:** [docs/RBAC_IMPLEMENTATION_GUIDE.md](docs/RBAC_IMPLEMENTATION_GUIDE.md)
- **Roles Reference:** [docs/roles/ROLES_QUICK_REFERENCE.md](docs/roles/ROLES_QUICK_REFERENCE.md)
- **Architecture Index:** [docs/architecture/INDEX.md](docs/architecture/INDEX.md)
- **Implementation Summary:** [docs/implementation/IMPLEMENTATION_SUMMARY.md](docs/implementation/IMPLEMENTATION_SUMMARY.md)

---

**Last Updated:** December 30, 2025

# Server-Side Role Management System - Implementation Summary

## What Was Built

A complete **role-based access control (RBAC) system** for managing user permissions server-side. This includes:

### 1. **User Context Extraction** (`src/lib/user-context.ts`)
- Extracts `userId` and `userRole` from request headers
- Loads complete user + roles from database when needed
- Helper functions: `hasAnyRole()`, `isAdmin()`, `isOwnerOrHasRole()`

### 2. **Authorization Helpers** (`src/lib/authorization.ts`)
- Service-level role checks that return error or null
- Used in business logic to enforce access policies
- Example: used in `order.service.ts`

### 3. **Role Management Service** (`src/services/role-management.service.ts`)
- CRUD operations for roles (create, read, update, delete)
- Assign/revoke roles to/from users
- Batch role assignment
- Built-in validation (prevents deleting roles with assigned users)

### 4. **Admin API Endpoints**
```
/api/admin/roles                          - List, create roles (GET, POST)
/api/admin/roles/[id]                     - Get, update, delete role (GET, PUT, DELETE)
/api/admin/users/[userId]/roles           - Manage user roles (GET, POST, DELETE)
/api/admin/users/[userId]/roles/batch     - Batch set user roles (PUT)
```

All endpoints are **admin-only protected**.

### 5. **Database**
Uses existing Prisma schema:
- `AdminUser` - Users
- `AdminRole` - Role definitions  
- `AdminPermission` - Granular permissions (structure ready for expansion)
- Many-to-many relationship between users and roles

### 6. **Documentation**
- `ROLES_AND_ACCESS.md` - Comprehensive guide with examples
- `ROLES_QUICK_REFERENCE.md` - Quick lookup for developers
- `src/scripts/seed-roles.ts` - Database seeding script

## How It Works

### Basic Flow
```
1. Request arrives → Extract headers (x-user-id, x-user-role)
2. Route handler checks permission via extractUserContext()
3. Service method enforces role requirement
4. Success/Forbidden response
```

### Example: Protect an Order API
```typescript
// Before
async getOrderStats() {
  return await prisma.order.aggregate(...);
}

// After
async getOrderStats(ctx?: UserContext) {
  const forbidden = requireRole(ctx, ['admin', 'manager']);
  if (forbidden) return forbidden;
  
  return await prisma.order.aggregate(...);
}

// In route handler
const ctx = extractUserContext(req);
const stats = await orderService.getOrderStats(ctx);
if ('error' in stats) return sendError(...);
```

## Key Features

✅ **Multi-role support** - Users can have multiple roles  
✅ **Header-based** - Works with any auth system (JWT, sessions, etc.)  
✅ **Fail-safe** - Default deny unless explicitly allowed  
✅ **Service-level** - Business logic knows about roles  
✅ **Admin-only endpoints** - Self-protecting management API  
✅ **Extensible** - Permission matrix ready in schema  
✅ **Type-safe** - Full TypeScript support  

## What You Need to Do Next

### Phase 1: Setup (Immediate)
1. **Create roles** (via API or seed script):
   ```bash
   npm run seed:roles  # or manually POST to /api/admin/roles
   ```

2. **Assign roles to users** (admin UI or API):
   ```bash
   POST /api/admin/users/{userId}/roles
   Body: { "roleId": "role-id" }
   ```

3. **Add header middleware**:
   ```typescript
   // middleware.ts or in your auth layer
   // Extract user info and set:
   // - x-user-id (from JWT sub, session ID, etc.)
   // - x-user-role (primary role code)
   ```

### Phase 2: Protect Endpoints (Within 1 week)
1. Update all API routes to extract context
2. Add role checks to sensitive operations
3. Test with different user roles

### Phase 3: Fine-Grained Permissions (Optional)
1. Populate `AdminPermission` table with action-subject pairs
2. Implement permission matrix checks
3. Add permission validation to endpoints

## File Locations

| File | Purpose |
|------|---------|
| `src/lib/user-context.ts` | Context extraction & helpers |
| `src/lib/authorization.ts` | Service-level auth checks |
| `src/services/role-management.service.ts` | Role CRUD & user assignment |
| `app/api/admin/roles/route.ts` | Role management endpoints |
| `app/api/admin/users/[userId]/roles/route.ts` | User role assignment |
| `src/scripts/seed-roles.ts` | Database seeding |
| `ROLES_AND_ACCESS.md` | Full documentation |
| `ROLES_QUICK_REFERENCE.md` | Quick reference |

## Integration Points

### With Your Auth System
Choose one approach:

**Option A: Reverse Proxy (Production)**
```nginx
# Nginx
location /api {
  # Your auth logic here
  proxy_set_header x-user-id $user_id;
  proxy_set_header x-user-role $user_role;
  proxy_pass http://app;
}
```

**Option B: Middleware (Dev/Simple)**
```typescript
// middleware.ts
export function middleware(req: NextRequest) {
  // Decode JWT or load session
  const userId = getUser(req)?.id;
  const role = getUser(req)?.role;
  
  const headers = new Headers(req.headers);
  headers.set('x-user-id', userId);
  headers.set('x-user-role', role);
  
  return NextResponse.next({ request: { headers } });
}
```

**Option C: JWT Decode in Route (Simple)**
```typescript
import jwt from 'jsonwebtoken';

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  
  const ctx = { userId: decoded.sub, userRole: decoded.role };
  // Use ctx for checks
}
```

## Testing

### Manual Testing
```bash
# Create a role
curl -X POST http://localhost:3000/api/admin/roles \
  -H "x-user-id: admin-1" \
  -H "x-user-role: admin" \
  -H "Content-Type: application/json" \
  -d '{"code":"manager","name":"Manager"}'

# Assign to user
curl -X POST http://localhost:3000/api/admin/users/user-1/roles \
  -H "x-user-id: admin-1" \
  -H "x-user-role: admin" \
  -H "Content-Type: application/json" \
  -d '{"roleId":"role-id"}'

# Get user roles
curl http://localhost:3000/api/admin/users/user-1/roles \
  -H "x-user-id: admin-1" \
  -H "x-user-role: admin"
```

### Test Failure Cases
```bash
# Should fail: non-admin trying to create role
curl -X POST http://localhost:3000/api/admin/roles \
  -H "x-user-id: user-1" \
  -H "x-user-role: customer" \
  -H "Content-Type: application/json" \
  -d '{"code":"test","name":"Test"}'
# Expected: 403 Forbidden
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Roles not appearing | Check DB connection; run `npm run seed:roles` |
| Always forbidden | Check `x-user-role` header is set to "admin" |
| Role assignment fails | Verify user & role IDs exist in DB |
| Service methods not enforcing | Check `ctx` is passed from route handler |

## Next Features to Consider

- [ ] Permission matrix (action + subject)
- [ ] Audit logging for role changes
- [ ] Role templates (pre-built role sets)
- [ ] Session/JWT expiration handling
- [ ] Dynamic permission loading
- [ ] Role inheritance/hierarchy
- [ ] UI for role management

## Support

Refer to:
- `ROLES_AND_ACCESS.md` for complete API reference
- `ROLES_QUICK_REFERENCE.md` for quick syntax
- `src/services/order.service.ts` for example implementation

---

**Status**: ✅ Ready to use  
**TypeScript**: ✅ Fully typed  
**Tests**: ⏳ Add as needed  
**Docs**: ✅ Complete

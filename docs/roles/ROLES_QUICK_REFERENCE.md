# Role Management - Quick Reference

## File Structure
```
src/
  lib/
    authorization.ts          # Simple role check helpers (used in services)
    user-context.ts           # Context extraction & loading from DB
    api-response.ts           # Error codes (already existed)
  services/
    role-management.service.ts # CRUD operations for roles & assignments
    order.service.ts          # Example: service with role checks

app/api/admin/
  roles/
    route.ts                  # GET /api/admin/roles, POST /api/admin/roles
    [id]/
      route.ts                # GET/PUT/DELETE /api/admin/roles/[id]
  users/
    [userId]/roles/
      route.ts                # GET /api/admin/users/[userId]/roles
                              # POST (assign role)
                              # DELETE (revoke role) 
      batch/
        route.ts              # PUT /api/admin/users/[userId]/roles/batch
```

## Database
- **AdminUser** ↔ **AdminRole** (Many-to-many)
- No migration needed (already in schema.prisma)

## Step 1: Create Default Roles
```bash
curl -X POST http://localhost:3000/api/admin/roles \
  -H "x-user-id: admin-user-id" \
  -H "x-user-role: admin" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "admin",
    "name": "Administrator",
    "description": "Full system access"
  }'
```

Repeat for: `manager`, `staff`, `customer`

## Step 2: Assign Roles to Users
```bash
curl -X POST http://localhost:3000/api/admin/users/{userId}/roles \
  -H "x-user-id: admin-user-id" \
  -H "x-user-role: admin" \
  -H "Content-Type: application/json" \
  -d '{
    "roleId": "role-id-here"
  }'
```

## Step 3: Use in API Routes

### Extract Context
```typescript
import { extractUserContext } from '@/lib/user-context';

const ctx = extractUserContext(req);
```

### Check Permission
```typescript
import { isAdmin, hasAnyRole } from '@/lib/user-context';

if (!isAdmin(ctx)) {
  return sendError(ErrorCodes.FORBIDDEN, 'Admin required');
}
```

### Use in Services
```typescript
import { UserContext, requireRole } from '@/lib/authorization';

async myMethod(ctx?: UserContext) {
  const forbidden = requireRole(ctx, ['admin', 'manager']);
  if (forbidden) return forbidden;
  // ... do stuff
}
```

## Step 4: Set Headers from Auth Layer

**For Development/Testing:**
```typescript
// middleware.ts
export function middleware(req: NextRequest) {
  if (!req.headers.get('x-user-id')) {
    const headers = new Headers(req.headers);
    headers.set('x-user-id', 'dev-user-123');
    headers.set('x-user-role', 'admin');
    return NextResponse.next({ request: { headers } });
  }
  return NextResponse.next();
}
```

**For Production:**
- Use JWT decode + set headers in reverse proxy (Nginx/HAProxy)
- Or decode JWT in Next middleware
- Ensure `x-user-id` and `x-user-role` reach route handlers

## Key Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `extractUserContext(req)` | `lib/user-context.ts` | Get userId + role from headers |
| `loadUserWithRoles(userId)` | `lib/user-context.ts` | Load full user + all roles from DB |
| `hasAnyRole(ctx, roles)` | `lib/user-context.ts` | Check if user has any allowed role |
| `isAdmin(ctx)` | `lib/user-context.ts` | Check if user is admin |
| `isOwnerOrHasRole(ctx, ownerId, roles)` | `lib/user-context.ts` | Check ownership or role |
| `requireRole(ctx, roles)` | `lib/authorization.ts` | Service-level role check (returns error or null) |
| `requireRoleOrOwner(ctx, ownerId, roles)` | `lib/authorization.ts` | Service-level ownership/role check |

## Common Patterns

### Route Handler with Role Check
```typescript
export async function GET(req: NextRequest) {
  const ctx = extractUserContext(req);
  
  if (!hasAnyRole(ctx, ['admin', 'manager'])) {
    return sendError(ErrorCodes.FORBIDDEN, 'Access denied');
  }
  
  // Proceed with logic
}
```

### Service Method with Role Check
```typescript
async getOrderStats(ctx?: UserContext) {
  const forbidden = requireRole(ctx, ['admin', 'manager']);
  if (forbidden) return forbidden;
  
  // Proceed with query
}
```

### Allow Owner or Admin
```typescript
async getCustomerOrders(customerId: string, ctx?: UserContext) {
  const forbidden = requireRoleOrOwner(ctx, customerId, ['admin']);
  if (forbidden) return forbidden;
  
  // Proceed
}
```

## API Response Examples

### Success
```json
{
  "success": true,
  "data": {
    "id": "role-1",
    "code": "admin",
    "name": "Administrator"
  }
}
```

### Forbidden
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Admin access required"
  }
}
```

## Testing
```bash
# List roles (admin only)
curl http://localhost:3000/api/admin/roles \
  -H "x-user-id: user1" \
  -H "x-user-role: admin"

# Try as non-admin (should fail)
curl http://localhost:3000/api/admin/roles \
  -H "x-user-id: user2" \
  -H "x-user-role: customer"
```

## Next: Integrate with Your Auth System
1. Identify where JWT is decoded or session is loaded
2. Extract `userId` and `role` (or all roles)
3. Set `x-user-id` and `x-user-role` headers OR inject via middleware
4. Update existing route handlers to use `extractUserContext()`
5. Add role checks where needed

See `ROLES_AND_ACCESS.md` for full documentation.

# Roles: Server vs Frontend - Where They're Used

## 📊 Quick Answer

**Roles are enforced on the SERVER in two places:**

1. ✅ **Service Layer** (business logic) - Currently implemented
2. ✅ **Route Handler** (API endpoints) - Ready to implement
3. ⏳ **Frontend** (optional, for UX) - You can add later if needed

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│ FRONTEND (Browser)                                  │
│ ├─ Send auth headers (x-user-id, x-user-role)     │
│ ├─ Optional: Show/hide UI based on role (UX only)  │
│ └─ But cannot be trusted for security!             │
└────────────┬────────────────────────────────────────┘
             │ HTTP Request + Headers
             ▼
┌─────────────────────────────────────────────────────┐
│ NEXT.JS API ROUTE HANDLER                           │
│ ├─ Extract context: extractUserContext(req)        │
│ ├─ Check role: hasAnyRole(ctx, ['admin'])          │
│ ├─ Return 403 FORBIDDEN if unauthorized            │
│ └─ Call service or return error immediately        │
└────────────┬────────────────────────────────────────┘
             │ Pass context to service
             ▼
┌─────────────────────────────────────────────────────┐
│ SERVICE LAYER (Business Logic) ✅ IMPLEMENTED      │
│ ├─ Receives UserContext                            │
│ ├─ Check role: requireRole(ctx, ['admin'])         │
│ ├─ Return error object if unauthorized             │
│ └─ Proceed only if authorized                      │
└────────────┬────────────────────────────────────────┘
             │ Query database
             ▼
┌─────────────────────────────────────────────────────┐
│ DATABASE                                            │
│ └─ Return data (if authorized to reach here)       │
└─────────────────────────────────────────────────────┘
```

---

## 🔒 Security Principle: Defense in Depth

**You need BOTH server checks:**

```
Why?
┌──────────────────────────────────────────────┐
│ Frontend check: UX ONLY (not secure)         │
│ └─ User can bypass JavaScript                │
│ └─ Attacker can send raw API request         │
│ └─ Don't rely on this for security!          │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ API Route check: FIRST LAYER OF SECURITY    │
│ └─ Catches unauthorized requests early       │
│ └─ Returns 403 immediately                   │
│ └─ Prevents service from being called        │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ Service check: SECOND LAYER OF SECURITY     │
│ └─ Belt + suspenders                         │
│ └─ Catches direct service calls              │
│ └─ Makes services safe to reuse anywhere     │
└──────────────────────────────────────────────┘
```

---

## ✅ What We Already Implemented

### **Service Layer** (DONE)

```typescript
// src/services/order.service.ts - ALREADY UPDATED

async getOrderStats(ctx?: UserContext) {
  // ✅ Service checks role
  const forbidden = requireRole(ctx, ['admin', 'manager']);
  if (forbidden) return forbidden;
  
  // ✅ Proceeds only if authorized
  return await db.order.aggregate(...);
}
```

This means:
- ✅ Service layer is **protected**
- ✅ If called directly, it checks authorization
- ✅ Multiple services already updated (see order.service.ts)

---

## ⏳ What Still Needs Implementation

### **Route Handler Layer** (NOT YET)

```typescript
// app/api/orders/stats/route.ts - NEEDS TO BE ADDED

import { extractUserContext, hasAnyRole } from '@/lib/user-context';

export async function GET(req: NextRequest) {
  // ⏳ NEEDS: Extract context
  const ctx = extractUserContext(req);
  
  // ⏳ NEEDS: Check role in route
  if (!hasAnyRole(ctx, ['admin', 'manager'])) {
    return sendError(ErrorCodes.FORBIDDEN, 'Admin/Manager access required');
  }
  
  // ✓ THEN: Call service
  const stats = await orderService.getOrderStats(ctx);
  if ('error' in stats) return sendError(...);
  
  return sendSuccess(stats);
}
```

### **Frontend Layer** (OPTIONAL for UX)

```typescript
// components/OrderStats.tsx - OPTIONAL

import { useUserContext } from '@/hooks/useUserContext'; // You'd create this

export function OrderStats() {
  const { userRole } = useUserContext(); // Get role from state/context
  
  // ⏳ OPTIONAL: Show/hide UI based on role
  if (!['admin', 'manager'].includes(userRole)) {
    return <div>You don't have access to statistics</div>;
  }
  
  return <StatsChart />;
}
```

---

## 📋 Summary: What's Where

| Layer | Status | Purpose | Trust Level |
|-------|--------|---------|-------------|
| **Frontend UI** | ⏳ Optional | User experience only | 🔴 NOT SECURE |
| **API Route** | ⏳ Needs implementation | First security check | 🟡 GOOD |
| **Service Layer** | ✅ DONE | Second security check | 🟢 BEST |
| **Database** | Already secured | Data persistence | 🟢 BEST |

---

## 🎯 Current Implementation Status

### ✅ WORKING RIGHT NOW

```typescript
// This is PROTECTED:
const stats = await orderService.getOrderStats(ctx);
// ✓ If ctx doesn't have 'admin' or 'manager' role
// ✓ It will return an error object
// ✓ User cannot access stats
```

### ⏳ NEEDS TO BE ADDED

```typescript
// API Routes should ALSO check before calling service
// This prevents unnecessary service calls
export async function GET(req: NextRequest) {
  const ctx = extractUserContext(req);
  
  // ⏳ ADD THIS CHECK
  if (!hasAnyRole(ctx, ['admin', 'manager'])) {
    return sendError(FORBIDDEN, '...');
  }
  
  // Then call service (which will check again as backup)
  const stats = await orderService.getOrderStats(ctx);
}
```

### 🎨 OPTIONAL (Frontend)

```typescript
// This is OPTIONAL for better UX
// Don't show buttons user can't click anyway
// But this is NOT for security - it's just nicer UI
```

---

## 💡 Real-World Example

### Without Our System

```
User (customer role) →
  Makes GET /api/orders/stats request →
  API handler has NO check →
  Service has NO check →
  Database query returns ALL stats →
  ❌ SECURITY BREACH: Customer sees everyone's data!
```

### With Our System (Current)

```
User (customer role) →
  Makes GET /api/orders/stats request →
  API handler → No check yet (⏳ needs to be added)
  Service layer → Checks role ✅
  ├─ Role is 'customer'
  ├─ Required: ['admin', 'manager']
  ├─ NOT matched
  └─ Returns error object
  ✅ BLOCKED: Service returns error, no data leaked
```

### With Our System (Complete)

```
User (customer role) →
  Makes GET /api/orders/stats request →
  API handler → Checks role ✅
  ├─ Role is 'customer'
  ├─ Required: ['admin', 'manager']
  ├─ NOT matched
  └─ Returns 403 immediately
  ✅ BLOCKED: Request rejected at route level
  Service layer → Never even called
```

---

## 🚀 Implementation Roadmap

### Phase 1: ✅ COMPLETE
- [x] Service layer role checks implemented
- [x] Example: order.service.ts updated
- [x] Authorization helpers created
- [x] Admin endpoints self-protected

### Phase 2: ⏳ DO THIS NEXT
- [ ] Add role checks to API routes that call services
- [ ] Example: app/api/orders/stats/route.ts
- [ ] Add to: bookings, customers, inventory, etc.
- [ ] Estimate: 2-3 hours

### Phase 3: 🎨 OPTIONAL
- [ ] Create useUserContext() hook for frontend
- [ ] Show/hide UI based on roles
- [ ] Disable buttons for unauthorized users
- [ ] Better UX, not required for security
- [ ] Estimate: 4-6 hours (if you want it)

---

## 🔐 Security Levels

```
Level 1: Frontend checks only
├─ Status: INSECURE ❌
├─ User can bypass with DevTools
└─ Attack: curl to API bypasses UI

Level 2: Route handler checks only
├─ Status: SECURE ✅
├─ Prevents unauthorized API access
└─ But service is vulnerable if called directly

Level 3: Route + Service checks (RECOMMENDED)
├─ Status: BEST ✅✅
├─ Multiple layers of protection
└─ Services safe even if reused elsewhere

Level 4: Route + Service + Database checks
├─ Status: PARANOID ✅✅✅
├─ Overkill but bulletproof
└─ Database-level row-level security
```

**We're at Level 2-3 right now. Should move to Level 3 (add route checks).**

---

## ✅ To-Do: Complete the Implementation

### Step 1: Add Route Handler Checks
```bash
# For each sensitive API route, add:
const ctx = extractUserContext(req);
if (!hasAnyRole(ctx, ['admin'])) return sendError(FORBIDDEN, '...');
```

### Step 2: Test
```bash
# Test as admin (works)
curl /api/orders/stats -H "x-user-role: admin" → ✓ Success

# Test as customer (blocked at route)
curl /api/orders/stats -H "x-user-role: customer" → ✗ 403 Forbidden
```

### Step 3: Frontend (Optional)
```typescript
// Show better error messages
// Hide buttons user can't click
// Not required for security, just UX
```

---

## 🎓 Summary

**Right Now:**
- ✅ Services check roles (you can't bypass them)
- ✅ Admin endpoints are protected
- ⏳ API routes don't check yet (but service will catch it)

**After Phase 2 (Recommended):**
- ✅ Services check roles
- ✅ API routes check roles (fail fast)
- ✅ Two-layer defense (best practice)

**Optional Phase 3:**
- 🎨 Frontend shows/hides UI based on roles (UX improvement)

---

## 📚 References

See these files:
- `src/services/order.service.ts` - How service checks work ✅
- `app/api/admin/roles/route.ts` - How admin routes are protected ✅
- `middleware.example.ts` - How to provide user context
- `ROLES_QUICK_REFERENCE.md` - Quick syntax reference

---

**TL;DR**: 
- ✅ **Services are protected** (done)
- ⏳ **Routes need to be protected** (next)
- 🎨 **Frontend is optional** (for UX, not security)

Want me to add route-level checks to your existing API routes?

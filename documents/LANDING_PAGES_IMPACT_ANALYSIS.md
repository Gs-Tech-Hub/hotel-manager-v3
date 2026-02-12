# Role-Based Landing Pages & Position Impact Analysis
**Date:** February 11, 2026

## Overview

The RBAC audit identified critical issues with `loadUserWithRoles()` that **directly impact user landing page routing**. This document explains the flow and the vulnerabilities.

---

## Current Landing Page Flow

### 1. Login Flow (Birth of User Context)

```
User submits login form
  ↓
POST /api/auth/login → loginUser(email, password)
  ├─ Validates credentials
  ├─ Returns { userId, userType: "admin" | "employee", departmentId? }
  ↓
buildSession(userId, userType, departmentId?)
  ├─ Fetch user details (AdminUser or pluginUsersPermissionsUser)
  ├─ Check if user_roles table exists (schema detection)
  │
  ├─ IF unified table exists (userType = "employee"):
  │   ├─ Query UserRole → Role → RolePermission
  │   ├─ Get rolesList from explicit assignments
  │   │
  │   └─ IF no explicit roles found:
  │       ├─ Try getRoleForPosition(user.position) ← NEW: from dropdown
  │       ├─ If still empty, try getDefaultRoleForDepartment(departmentId)
  │       └─ Auto-assign found role to JWT
  │
  └─ IF legacy table only (userType = "admin"):
      ├─ Query AdminUser → AdminRole → AdminPermission
      ├─ Add 'admin' role guarantee
      └─ Return rolesList with 'admin'
  
  ↓
Create JWT token with { userId, roles: [...], permissions: [...], departmentId? }
  ↓
Set auth_token cookie + return to frontend
  
  ↓
Frontend: auth.login() stores user in context
  ↓
getDefaultLandingPage(roles, departmentId) ← ROUTING DECISION POINT
  ↓
router.push(landingPage) → User sees their dashboard
```

---

## The Critical Issue: Role Loading Gap

### Problem 1: `buildSession()` Works, But `loadUserWithRoles()` Doesn't

**In Login Flow (buildSession):**
```typescript
// ✅ WORKS - Handles both tables
const hasUserRoles = await checkTableExists('user_roles');
if (hasUserRoles && userType === 'employee') {
  const userRoles = await prisma.userRole.findMany({...});
}
```

**In API Routes (loadUserWithRoles in user-context.ts):**
```typescript
// ❌ BROKEN - Only checks AdminUser
const user = await prisma.adminUser.findUnique({where: {id: userId}});
if (!user) return null; // Returns null for employees!
```

**Impact on Landing Pages:**
- Employees login → `buildSession()` loads their roles correctly → Landing page shows correctly ✅
- Later API calls in their session → `loadUserWithRoles()` returns null → Routes can't validate role access ❌

---

## Landing Page Routing Logic

### File: [lib/auth/role-landing.ts](lib/auth/role-landing.ts)

#### Function: `getDefaultLandingPage(roles, departmentId)`

```typescript
export function getDefaultLandingPage(
  roles: string[], 
  departmentId?: string
): string {
  // Priority 1: Check if admin (always → /dashboard)
  if (roles.includes('admin')) {
    return '/dashboard';
  }

  // Priority 2: Check department + non-specialized role
  //   e.g., "Chef" with department=kitchen → /departments
  if (departmentId && !roles.includes('admin')) {
    const specializedRoles = [
      'pos_manager', 'pos_staff', 'customer_service', 
      'front_desk', 'cashier'
    ];
    const hasSpecializedRole = roles.some(r => specializedRoles.includes(r));
    
    if (!hasSpecializedRole) {
      const departmentRoles = [
        'manager', 'staff', 'employee', 
        'kitchen_staff', 'bar_staff', 'housekeeping_staff'
      ];
      const hasDepartmentRole = roles.some(r => departmentRoles.includes(r));
      
      if (hasDepartmentRole) {
        return '/departments'; // ← Department-scoped employees
      }
    }
  }

  // Priority 3: By role (highest priority in list)
  const priority: RoleType[] = [
    'admin', 'manager', 'pos_manager', 'customer_service',
    'front_desk', 'cashier', 'kitchen_staff', 'bar_staff',
    'housekeeping_staff', 'pos_staff', 'staff', 'employee',
  ];
  
  for (const role of priority) {
    if (roles.includes(role)) {
      return roleLandingPages[role]?.landingPage || '/dashboard';
    }
  }

  return '/dashboard'; // Default fallback
}
```

### Role-Specific Landing Pages

| Role | Landing Page | Purpose |
|------|--------------|---------|
| `admin` | `/dashboard` | System admin center |
| `manager` | `/dashboard` | Hotel/department manager |
| `pos_manager` | `/pos` | POS terminal manager |
| `pos_staff` | `/pos` | POS cashier/operator |
| `kitchen_staff` | `/departments` | Kitchen display system |
| `bar_staff` | `/departments` | Bar ordering system |
| `cashier` | `/pos` | Checkout terminal |
| `customer_service` | `/admin/customer-service` | Customer support |
| `front_desk` | `/bookings` | Room reservations |
| `housekeeping_staff` | `/departments` | Housekeeping tasks |
| `staff` | `/departments` | Generic staff view |
| `employee` | `/dashboard` | Default employee |

---

## How Position & Department Mappings Affect Landing Pages

### New Position Dropdown Integration

**User selects position: "Chef"**

Flow:
```
1. Form selection → position = "Chef"
   
2. On save employee → API creates user
   
3. buildSession() runs:
   - No explicit roles assigned yet
   - Calls getRoleForPosition("Chef")
   - Returns "kitchen_staff"
   - Auto-assigns to JWT: roles = ["kitchen_staff"]
   
4. Frontend receives roles = ["kitchen_staff"]
   
5. getDefaultLandingPage(["kitchen_staff"], departmentId?)
   
6. Routing decision:
   - If departmentId provided → returns "/departments"
     (Kitchen staff see kitchen display system)
   - If no departmentId → returns "/dashboard" (fallback)
```

### Department Default Role Integration

**Employee assigned to department: "Restaurant"**

Flow:
```
1. Department creation sets metadata:
   { departmentCode: "restaurant", defaultRole: "kitchen_staff" }
   
2. buildSession() runs:
   - No explicit roles in UserRole table
   - Calls getDefaultRoleForDepartment(departmentId)
   - Returns "kitchen_staff"
   - Auto-assigns: roles = ["kitchen_staff"]
   
3. getDefaultLandingPage(["kitchen_staff"], departmentId)
   - departmentId exists + not specialized role
   - Has department role (kitchen_staff)
   - Returns "/departments"
   
4. Kitchen staff sees /departments (KDS)
```

---

## Current Issues & Their Landing Page Impact

### 🔴 Issue 1: Role Loading Gap (Critical)

**Scenario:**
```
1. Employee "Alice" logs in (position: "Chef")
   - buildSession() → roles = ["kitchen_staff"] ✅
   - Login page → router.push("/departments") ✅
   
2. Alice makes API call → GET /api/employees (get employee list)
   - Middleware extracts roles from JWT
   - Route calls loadUserWithRoles(alice.id)
   - Returns NULL ❌ (only checks AdminUser)
   - Cannot validate alice's role permission
   - May return 403 Forbidden incorrectly
   
3. Alice's dashboard breaks (API 403 errors)
```

**Impact on Landing Pages:**
- ✅ Login landing page works (uses JWT roles)
- ❌ Subsequent page data fails (API calls can't validate)
- Result: User sees correct dashboard but features don't load

---

### 🟡 Issue 2: Position Dropdown Not Integrated

**Current:**
```
Employee form now has position dropdown ✅
But position is NOT used to auto-assign role ❌

Flow:
1. Admin creates employee "Bob" (position: "Bartender")
2. No explicit role assigned
3. buildSession() runs, but position field might be NULL
4. No role auto-assignment happens
5. Bob logs in → roles = [] (empty!)
6. getDefaultLandingPage([]) → returns "/dashboard"
7. Bob can't see POS or bar features

Correct flow should:
1. Admin selects position "Bartender"
2. buildSession() calls getRoleForPosition("Bartender")
3. Returns "bar_staff"
4. Bob logs in → roles = ["bar_staff"]
5. getDefaultLandingPage(["bar_staff"]) → "/departments"
6. Bob sees bar interface
```

---

### 🟡 Issue 3: Department-Default Role Not Applied

**Current:**
```
Department has metadata.defaultRole = "kitchen_staff" ✅
But not used in employee creation flow ❌

Flow:
1. Admin creates employee in "Kitchen" department
2. No explicit role assigned
3. buildSession() only assigns role if position is set
4. If position is empty → roles = [] (empty!)
5. Landing page → "/dashboard" (fallback)

Correct flow should:
1. Employee created in kitchen department
2. buildSession() checks position first
3. If no position, checks department.defaultRole
4. Assigns "kitchen_staff" role
5. Landing page → "/departments"
```

---

## Role-Based Page Access Matrix

### Page Access Rules: [lib/auth/page-access.ts](lib/auth/page-access.ts)

**Dashboard Pages:**
```
/dashboard                     → authenticatedOnly
/analytics                     → admin, manager, pos_manager
/pos, /pos-terminals          → pos_manager, pos_staff, cashier
/departments, /departments/*   → manager, kitchen_staff, bar_staff, etc.
/bookings                      → front_desk, manager
/inventory                     → manager, admin
/admin, /admin/*               → admin only
```

**Issue: If role loading fails, these checks fail**

```
User accesses /analytics
  ↓
Middleware checks: hasAccess?
  ├─ Extracts roles from JWT header (works)
  └─ Allows access
  
User makes API call: GET /api/analytics/orders
  ↓
Route calls loadUserWithRoles() → NULL ❌
  ↓
Cannot verify permission
  ├─ May proceed unsafely
  └─ Or returns 403 (breaks page)
```

---

## Recommendations for Position-Based Landing Pages

### P1: Fix `loadUserWithRoles()` (Critical)

**Current:**
```typescript
const user = await prisma.adminUser.findUnique({...});
if (!user) return null;
```

**Fixed:**
```typescript
// Try unified User table first (employees)
let user = await prisma.user.findUnique({
  where: { id: userId },
  include: { roles: true }
});

if (user && user.roles.length > 0) {
  return {
    userId: user.id,
    userRoles: user.roles.map(r => r.code),
    userType: 'employee'
  };
}

// Fall back to legacy AdminUser (admins)
user = await prisma.adminUser.findUnique({...});
// ...
```

**Impact:** Landing pages will work consistently throughout session, not just at login.

---

### P2: Ensure Position Auto-Assignment in Employee Form

**In employee creation flow:**
```typescript
// When admin doesn't explicitly assign role
if (!data.roles || data.roles.length === 0) {
  // Try to auto-assign from position
  if (data.position) {
    const roleCode = getRoleForPosition(data.position);
    if (roleCode) {
      data.roles = [{ code: roleCode }];
    }
  }
  
  // If still no role, try department default
  if (!data.roles && data.departmentId) {
    const deptRole = await getDefaultRoleForDepartment(data.departmentId);
    if (deptRole) {
      data.roles = [{ code: deptRole }];
    }
  }
}
```

**Impact:** Users with position "Chef" or "Bartender" automatically see their correct landing page.

---

### P3: Update Employee Form to Show Preview

**Show role based on position selection:**
```tsx
// In employee form
const selectedPosition = employmentData.position;
const assignedRole = getRoleForPosition(selectedPosition);

<p className="text-sm text-gray-600">
  Will be assigned role: <strong>{assignedRole || 'No auto-assign'}</strong>
</p>
```

**Impact:** Admin can verify correct role before saving.

---

## Summary: How RBAC Issues Affect Landing Pages

| Issue | Affects Login | Affects Session | Severity |
|-------|--------------|-----------------|----------|
| `loadUserWithRoles()` incomplete | No ✅ | Yes ❌ | Critical |
| Position auto-assign missing | Maybe (if position set) | N/A | High |
| Department default not used | Maybe (if no position) | N/A | High |
| Page access rules not checked | No (JWT works) | Yes ❌ | Critical |

---

## Testing Checklist

- [ ] **Admin logs in** → Sees `/dashboard`
- [ ] **Manager logs in** → Sees `/dashboard`
- [ ] **Chef (position-based)** → Sees `/departments` (KDS)
- [ ] **Bartender (position-based)** → Sees `/departments` (bar)
- [ ] **POS Cashier** → Sees `/pos` (terminals)
- [ ] **Housekeeping** → Sees `/departments` (tasks)
- [ ] **Make API call while logged in** → No 403 permission errors
- [ ] **Change user position** → Landing page updates
- [ ] **Assign role + position** → Role takes priority

---

## Files to Review

**Landing Page Logic:**
- [lib/auth/role-landing.ts](lib/auth/role-landing.ts) - `getDefaultLandingPage()` ✅
- [lib/auth/page-access.ts](lib/auth/page-access.ts) - Page access rules ✅

**Session Building:**
- [lib/auth/session.ts](lib/auth/session.ts) - `buildSession()` ✅ (works correctly)

**User Loading (BROKEN):**
- [lib/user-context.ts](lib/user-context.ts) - `loadUserWithRoles()` ❌ (needs fix)

**Role Mappings:**
- [lib/auth/position-role-mapping.ts](lib/auth/position-role-mapping.ts) - NEW dropdown ✅
- [lib/auth/department-role-mapping.ts](lib/auth/department-role-mapping.ts) - Default roles ✅

**Employee Form:**
- [components/admin/employee-form.tsx](components/admin/employee-form.tsx) - Position dropdown ✅


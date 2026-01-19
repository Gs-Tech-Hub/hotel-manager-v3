# Hotel Manager v3 — Unified RBAC Implementation Guide

**Date:** November 25, 2025  
**Version:** 1.0  
**Status:** Ready for Implementation

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Problems & Gaps](#problems--gaps)
3. [Proposed Solution](#proposed-solution)
4. [Schema Changes](#schema-changes)
5. [Implementation Roadmap](#implementation-roadmap)
6. [Migration Strategy](#migration-strategy)
7. [Backfill Script](#backfill-script)
8. [Runtime Best Practices](#runtime-best-practices)
9. [Deployment Checklist](#deployment-checklist)

---

## Current State Analysis

### Existing Architecture

**Admin RBAC (Current):**
- `AdminUser`: email, username, password, metadata (firstname, lastname, blocked, isActive, etc.)
- `AdminRole`: code, name, description
- `AdminPermission`: action, subject, actionParameters (JSON), conditions (JSON), properties (JSON)
- **Join Logic:** Implicit many-to-many via `AdminPermission.roleId` → `AdminRole` (one-to-many), and `AdminRole` has array relation `users` (implicit join)

**Employee / App Users (Current):**
- `PluginUsersPermissionsUser`: username, email, password, firstname, lastname, blocked
- **Linked to:** EmployeeOrder, EmployeeRecord, EmployeeSummary, Expense, Game, GymAndSportSession
- **Roles/Permissions:** None — handled entirely in application code (not in database)

**Token-Based Auth:**
- `ApiToken` → `ApiTokenPermission` (permission-based access for external API calls)
- `TransferToken` → `TransferTokenPermission` (permission-based for inter-department transfers)
- Both are token-scoped, separate from user roles

**Departments:**
- `Department` is a standalone entity with no role-scoping
- Employees can be assigned to multiple departments, but no role-per-department concept in schema

### Data Flow

```
Request from AdminUser
  ↓
Check AdminUser.roles via implicit join
  ↓
Fetch AdminPermission entries for that role
  ↓
Validate action + subject against request
  ↓
Allow/Deny
```

```
Request from PluginUsersPermissionsUser (employee)
  ↓
Application-level role check (hardcoded or session-based)
  ↓
No database validation
  ↓
Allow/Deny (prone to errors)
```

---

## Problems & Gaps

| Problem | Impact | Severity |
|---------|--------|----------|
| **Two separate user types** | Admin and employee RBAC are disconnected; managing privileges across both is error-prone | High |
| **No roles for employees** | Employees lack database-enforced role assignments; all role logic lives in app code | High |
| **Implicit many-to-many for AdminUser↔AdminRole** | Hard to add metadata (e.g., when assigned, by whom, scope); harder to query | Medium |
| **AdminPermission tied only to roles** | No permission reuse; duplicate logic for token-based and user-based checks | Medium |
| **No department-scoped roles** | Can't say "user X is a 'kitchen manager' for the restaurant in department A only" | High |
| **No audit trail for role assignments** | Can't track who granted a role or when, critical for compliance | Medium |
| **Role-level permissions only** | Individual permission exceptions or user-specific grants not possible | Low |
| **Mixed permission formats** | AdminPermission uses JSON for complex rules; tokens use flat action strings; inconsistent | Medium |
| **Difficult to migrate later** | Adding RBAC to employees or merging systems will require complex data backfills | High |

---

## Proposed Solution

### Design Principles

1. **Unified RBAC Model**: Single Permission → Role → UserRole hierarchy works for all user types (admin, employee, customer-support staff).
2. **Explicit Join Tables**: Prefer `UserRole` and `RolePermission` over implicit joins to allow metadata attachment.
3. **Reusable Permissions**: One Permission table; reuse for roles, tokens, and individual user grants.
4. **Department Scoping**: `UserRole.departmentId` (nullable) enables role assignments scoped to departments.
5. **Audit-Friendly**: Include timestamps, grantedBy metadata in joins.
6. **Backward Compatible**: Keep legacy AdminUser/PluginUsersPermissionsUser during transition; migrate data, then optionally merge.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Unified RBAC Model                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Permission (fine-grained)                                      │
│  ├─ id, action, subject, conditions (JSON), properties (JSON)  │
│  └─ @@unique([action, subject])                                │
│                                                                 │
│  Role (group of permissions)                                    │
│  ├─ id, code, name, description, type (admin|employee|custom)  │
│  └─ @@index([code, type])                                      │
│                                                                 │
│  RolePermission (explicit join)                                │
│  ├─ roleId, permissionId                                       │
│  └─ @@unique([roleId, permissionId])                           │
│                                                                 │
│  UserRole (explicit join with scope)                           │
│  ├─ userId, roleId, departmentId (nullable)                    │
│  ├─ grantedAt, grantedBy (audit trail)                         │
│  └─ @@unique([userId, roleId, departmentId])                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

AdminUser / PluginUsersPermissionsUser ──(via UserRole)──> Role
                  │
                  └──(via RolePermission)──> Permission
```

---

## Schema Changes

### New Models to Add

```prisma
// ==================== UNIFIED RBAC ====================

/// Fine-grained permission definition. Reusable across roles, tokens, and individual user grants.
model Permission {
  id               String   @id @default(cuid())
  action           String   // e.g., "orders.create", "bookings.read", "inventory.transfer"
  subject          String?  // optional object context e.g., "orders", "bookings"
  description      String?
  actionParameters Json     @default("{}")  // complex rule parameters
  conditions       Json     @default("[]")  // additional constraints
  properties       Json     @default("{}")  // extra metadata
  
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  rolePermissions  RolePermission[]
  userPermissions  UserPermission[]  // direct user overrides
  
  @@unique([action, subject])
  @@index([action])
  @@index([subject])
  @@map("permissions")
}

/// Role definition: a named group of permissions. Can be admin-scoped or department-scoped.
model Role {
  id          String   @id @default(cuid())
  code        String   @unique
  name        String
  description String?
  type        String   @default("standard")  // admin, employee, manager, custom
  isActive    Boolean  @default(true)
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  rolePermissions  RolePermission[]
  userRoles        UserRole[]
  
  @@index([code, type])
  @@index([isActive])
  @@map("roles")
}

/// Explicit join: which permissions are granted by a role.
model RolePermission {
  id           String     @id @default(cuid())
  
  roleId       String
  role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  
  permissionId String
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  createdAt    DateTime   @default(now())
  
  @@unique([roleId, permissionId])
  @@index([roleId])
  @@index([permissionId])
  @@map("role_permissions")
}

/// Explicit join: which roles are assigned to a user. Supports department scoping and audit trail.
model UserRole {
  id           String    @id @default(cuid())
  
  userId       String    // works with AdminUser.id or PluginUsersPermissionsUser.id
  userType     String    // "admin" | "employee" | "other"
  
  roleId       String
  role         Role      @relation(fields: [roleId], references: [id], onDelete: Cascade)

  /// Optional: scope this role assignment to a specific department
  departmentId String?
  department   Department? @relation(fields: [departmentId], references: [id], onDelete: SetNull)

  /// Audit trail
  grantedAt    DateTime  @default(now())
  grantedBy    String?   // admin user who granted the role (optional)
  revokedAt    DateTime?
  revokedBy    String?

  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  
  @@unique([userId, userType, roleId, departmentId])
  @@index([userId, userType])
  @@index([roleId])
  @@index([departmentId])
  @@map("user_roles")
}

/// Direct permission overrides for individual users (bypasses role).
model UserPermission {
  id           String     @id @default(cuid())
  
  userId       String     // admin or employee user ID
  userType     String     // "admin" | "employee"
  
  permissionId String
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  /// Optional: scope this permission to a department
  departmentId String?
  department   Department? @relation(fields: [departmentId], references: [id], onDelete: SetNull)

  grantedAt    DateTime   @default(now())
  grantedBy    String?
  
  @@unique([userId, userType, permissionId, departmentId])
  @@index([userId, userType])
  @@index([permissionId])
  @@map("user_permissions")
}

/// Token-based permissions: map API/Transfer tokens to fine-grained permissions.
model TokenPermission {
  id           String     @id @default(cuid())
  
  tokenId      String     // ApiToken.id or TransferToken.id
  tokenType    String     // "api" | "transfer"
  
  permissionId String
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  createdAt    DateTime   @default(now())
  
  @@unique([tokenId, tokenType, permissionId])
  @@index([tokenId, tokenType])
  @@map("token_permissions")
}
```

### Update Department Model

Add relation to UserRole for scoped assignments:

```prisma
model Department {
  // ... existing fields ...
  
  userRoles      UserRole[]
  userPermissions UserPermission[]

  // ... rest of model ...
}
```

### Update ApiToken & TransferToken

Optionally, link tokens to new permission system (non-breaking):

```prisma
model ApiToken {
  // ... existing fields ...
  
  tokenPermissions TokenPermission[]  // new relation
  
  // ... rest of model ...
}

model TransferToken {
  // ... existing fields ...
  
  tokenPermissions TokenPermission[]  // new relation
  
  // ... rest of model ...
}
```

---

## Implementation Roadmap

### Phase 1: Schema Extension (Non-Breaking)
**Duration:** ~2 hours  
**Steps:**
1. Add new models: `Permission`, `Role`, `RolePermission`, `UserRole`, `UserPermission`, `TokenPermission` to `prisma/schema.prisma`.
2. Update `Department` to include relations to `UserRole` and `UserPermission`.
3. Run `prisma migrate dev --name add_unified_rbac`.
4. Run `npm run build` to ensure TypeScript compiles.

**Deliverables:**
- New tables in PostgreSQL.
- Updated Prisma Client types.
- No data loss; legacy tables remain intact.

### Phase 2: Data Backfill (Automated)
**Duration:** ~1 hour (includes testing)  
**Steps:**
1. Create backfill script: `scripts/migrate-rbac.ts` (see [Backfill Script](#backfill-script) section).
2. Run script in dev environment: `npx tsx scripts/migrate-rbac.ts`.
3. Verify: Query new tables; confirm permissions and roles are populated.
4. Repeat in staging/prod environments.

**Deliverables:**
- Seeded `Permission`, `Role`, `RolePermission`, `UserRole` tables.
- AdminUser/AdminRole/AdminPermission data copied and normalized.
- Employees assigned default roles if none exist.

### Phase 3: Application Integration
**Duration:** ~3–5 days (depends on app scope)  
**Steps:**
1. Create auth/authorization utilities:
   - `lib/auth/rbac.ts`: Functions to check user permissions against new tables.
   - `lib/auth/middleware.ts`: Next.js middleware to enforce permissions.
2. Refactor admin UI/API to use new permission checks.
3. Refactor employee routes to use new role/permission system.
4. Update token validation logic to use `TokenPermission` table.
5. Add caching (Redis) for frequently checked permissions.

**Deliverables:**
- Centralized permission validation logic.
- App routes enforcing RBAC via database.
- Audit logs for role/permission changes.

### Phase 4: Testing & Rollout
**Duration:** ~2 days  
**Steps:**
1. Unit tests: Permission checking logic.
2. Integration tests: API endpoints with various roles.
3. Staging environment validation.
4. Gradual rollout (feature flag) or full cutover.

### Phase 5: Cleanup (Optional)
**Duration:** ~1 day (after 1 week stability)  
**Steps:**
1. Archive legacy `AdminPermission` table (backup first).
2. Keep `AdminUser` and `PluginUsersPermissionsUser` for historical data; mark as read-only if desired.
3. Document deprecation.

**Note:** This phase is optional and can be deferred.

---

## Migration Strategy

### High-Level Flow

```
┌─────────────────────────────────────────────────────────┐
│ Current State: Legacy AdminRBAC + App-Level Employee   │
│ Permissions                                             │
└─────────────────────────────────────────────────────────┘
                         ↓
            (Phase 1: Schema Extension)
                         ↓
┌─────────────────────────────────────────────────────────┐
│ New Tables Exist, Empty                                 │
│ + Legacy Tables Untouched                               │
└─────────────────────────────────────────────────────────┘
                         ↓
         (Phase 2: Backfill Script Runs)
                         ↓
┌─────────────────────────────────────────────────────────┐
│ New Tables Populated:                                   │
│ ├─ Permission (from AdminPermission + predefined set)   │
│ ├─ Role (from AdminRole + employee defaults)           │
│ ├─ RolePermission (from AdminPermission→AdminRole)     │
│ └─ UserRole (from AdminUser→AdminRole)                 │
└─────────────────────────────────────────────────────────┘
                         ↓
       (Phase 3: App Reads from New Tables)
                         ↓
┌─────────────────────────────────────────────────────────┐
│ Dual-Write Period (Optional):                           │
│ ├─ Read from new RBAC tables                            │
│ ├─ Legacy tables as fallback                            │
│ └─ Admin UI updates role assignments in new tables     │
└─────────────────────────────────────────────────────────┘
                         ↓
           (Phase 4: Full Cutover)
                         ↓
┌─────────────────────────────────────────────────────────┐
│ All Auth Checks Read from New RBAC                      │
│ Legacy Tables Archived/Read-Only                        │
└─────────────────────────────────────────────────────────┘
```

### Database Backup & Rollback

**Before Phase 1:**
```bash
# Backup production DB
pg_dump -U postgres hotel_manager_v3_prod > backup_preRBAC_$(date +%Y%m%d_%H%M%S).sql

# Keep backup for 2 weeks
```

**Rollback Plan (if needed):**
1. Restore from backup.
2. Revert schema to prior version.
3. Redeploy app from prior commit.

---

## Backfill Script

### Script: `scripts/migrate-rbac.ts`

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_PERMISSIONS = [
  { action: "dashboard.read", subject: "dashboard" },
  { action: "users.read", subject: "users" },
  { action: "users.create", subject: "users" },
  { action: "users.update", subject: "users" },
  { action: "users.delete", subject: "users" },
  { action: "roles.read", subject: "roles" },
  { action: "roles.create", subject: "roles" },
  { action: "roles.update", subject: "roles" },
  { action: "roles.delete", subject: "roles" },
  { action: "permissions.read", subject: "permissions" },
  { action: "permissions.manage", subject: "permissions" },
  { action: "bookings.read", subject: "bookings" },
  { action: "bookings.create", subject: "bookings" },
  { action: "bookings.update", subject: "bookings" },
  { action: "bookings.delete", subject: "bookings" },
  { action: "orders.read", subject: "orders" },
  { action: "orders.create", subject: "orders" },
  { action: "orders.update", subject: "orders" },
  { action: "orders.fulfill", subject: "orders" },
  { action: "inventory.read", subject: "inventory" },
  { action: "inventory.transfer", subject: "inventory" },
  { action: "departments.read", subject: "departments" },
  { action: "departments.manage", subject: "departments" },
];

async function migrateRBAC() {
  try {
    console.log("🔄 Starting RBAC migration...\n");

    // Step 1: Seed default permissions
    console.log("📝 Seeding default permissions...");
    const permissionMap: Record<string, string> = {};

    for (const perm of DEFAULT_PERMISSIONS) {
      const permission = await prisma.permission.upsert({
        where: { 
          // Unique constraint: [action, subject]
          // Workaround: use action as unique key; subject is optional context
          action_subject: { action: perm.action, subject: perm.subject || null },
        },
        create: {
          action: perm.action,
          subject: perm.subject || null,
          description: `Permission to ${perm.action}`,
        },
        update: {},
      });
      permissionMap[`${perm.action}:${perm.subject}`] = permission.id;
    }
    console.log(`✅ Seeded ${Object.keys(permissionMap).length} permissions.\n`);

    // Step 2: Migrate AdminRoles → Roles
    console.log("🔄 Migrating admin roles...");
    const adminRoles = await prisma.adminRole.findMany({
      include: { permissions: true, users: true },
    });

    const roleMap: Record<string, string> = {};

    for (const adminRole of adminRoles) {
      const role = await prisma.role.upsert({
        where: { code: adminRole.code },
        create: {
          code: adminRole.code,
          name: adminRole.name,
          description: adminRole.description || undefined,
          type: "admin",
        },
        update: {},
      });
      roleMap[adminRole.id] = role.id;

      // Link permissions to role
      for (const permission of adminRole.permissions) {
        const perm = await prisma.permission.findUnique({
          where: { action_subject: { action: permission.action, subject: permission.subject || null } },
        });

        if (perm) {
          await prisma.rolePermission.upsert({
            where: {
              roleId_permissionId: { roleId: role.id, permissionId: perm.id },
            },
            create: { roleId: role.id, permissionId: perm.id },
            update: {},
          });
        }
      }
    }
    console.log(`✅ Migrated ${Object.keys(roleMap).length} roles.\n`);

    // Step 3: Migrate AdminUsers → UserRoles
    console.log("🔄 Migrating admin user roles...");
    const adminUsers = await prisma.adminUser.findMany({
      include: { roles: true },
    });

    let userRoleCount = 0;
    for (const adminUser of adminUsers) {
      for (const adminRole of adminUser.roles) {
        const roleId = roleMap[adminRole.id];
        if (roleId) {
          await prisma.userRole.upsert({
            where: {
              userId_userType_roleId_departmentId: {
                userId: adminUser.id,
                userType: "admin",
                roleId,
                departmentId: null,
              },
            },
            create: {
              userId: adminUser.id,
              userType: "admin",
              roleId,
              departmentId: null,
              grantedAt: adminUser.createdAt,
              grantedBy: undefined,
            },
            update: {},
          });
          userRoleCount++;
        }
      }
    }
    console.log(`✅ Created ${userRoleCount} user-role assignments.\n`);

    // Step 4: Assign default role to employees (if any)
    console.log("🔄 Assigning default roles to employees...");
    const employees = await prisma.pluginUsersPermissionsUser.findMany();

    let employeeCount = 0;
    const defaultEmployeeRole = await prisma.role.findUnique({
      where: { code: "employee.default" },
    });

    if (!defaultEmployeeRole) {
      // Create default employee role if it doesn't exist
      const newDefaultRole = await prisma.role.create({
        data: {
          code: "employee.default",
          name: "Employee (Default)",
          description: "Default role for employees with basic permissions.",
          type: "employee",
        },
      });

      // Link basic permissions
      const basicPerms = ["dashboard.read", "bookings.read", "orders.read", "orders.create"];
      for (const perm of basicPerms) {
        const permission = await prisma.permission.findFirst({
          where: { action: perm },
        });
        if (permission) {
          await prisma.rolePermission.create({
            data: {
              roleId: newDefaultRole.id,
              permissionId: permission.id,
            },
          });
        }
      }
    }

    for (const employee of employees) {
      const existingRole = await prisma.userRole.findFirst({
        where: {
          userId: employee.id,
          userType: "employee",
        },
      });

      if (!existingRole && defaultEmployeeRole) {
        await prisma.userRole.create({
          data: {
            userId: employee.id,
            userType: "employee",
            roleId: defaultEmployeeRole.id,
            departmentId: null,
            grantedAt: new Date(),
          },
        });
        employeeCount++;
      }
    }
    console.log(`✅ Assigned default roles to ${employeeCount} employees.\n`);

    console.log("✨ RBAC migration complete!");
    console.log("\nSummary:");
    console.log(`  • Permissions seeded: ${Object.keys(permissionMap).length}`);
    console.log(`  • Roles migrated: ${Object.keys(roleMap).length}`);
    console.log(`  • User-role assignments: ${userRoleCount}`);
    console.log(`  • Employees with default roles: ${employeeCount}`);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrateRBAC();
```

### Running the Script

```bash
# Dev environment
npx tsx scripts/migrate-rbac.ts

# Staging/Production (with confirmation)
npx tsx scripts/migrate-rbac.ts --confirm
```

### Verification Queries

After running the backfill script:

```sql
-- Check permissions seeded
SELECT COUNT(*) FROM permissions;

-- Check roles created
SELECT code, name, type, COUNT(id) FROM roles GROUP BY code, name, type;

-- Check user-role mappings
SELECT COUNT(*) FROM user_roles;

-- Check role-permission links
SELECT r.code, COUNT(rp.id) as permission_count 
FROM roles r 
LEFT JOIN role_permissions rp ON r.id = rp."roleId" 
GROUP BY r.code;

-- Find admin users with assigned roles
SELECT au.email, r.code, r.name, ur.id 
FROM "admin_users" au 
JOIN user_roles ur ON au.id = ur."userId" AND ur."userType" = 'admin'
JOIN roles r ON ur."roleId" = r.id;
```

---

## Runtime Best Practices

### 1. Permission Checking (Service Layer)

Create a utility to centralize permission checks:

```typescript
// lib/auth/rbac.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface PermissionContext {
  userId: string;
  userType: "admin" | "employee";
  departmentId?: string;
}

export async function checkPermission(
  ctx: PermissionContext,
  action: string,
  subject?: string
): Promise<boolean> {
  // Check direct user permissions
  const userPermission = await prisma.userPermission.findFirst({
    where: {
      userId: ctx.userId,
      userType: ctx.userType,
      permission: { action, subject },
      departmentId: ctx.departmentId || null,
    },
  });

  if (userPermission) return true;

  // Check role-based permissions
  const rolePermission = await prisma.userRole.findFirst({
    where: {
      userId: ctx.userId,
      userType: ctx.userType,
      departmentId: ctx.departmentId || null,
      role: {
        rolePermissions: {
          some: {
            permission: { action, subject },
          },
        },
      },
    },
  });

  return !!rolePermission;
}

export async function getUserPermissions(
  ctx: PermissionContext
): Promise<string[]> {
  // Fetch all permissions for user (caching recommended)
  const userPerms = await prisma.userPermission.findMany({
    where: {
      userId: ctx.userId,
      userType: ctx.userType,
      departmentId: ctx.departmentId || null,
    },
    select: { permission: { select: { action: true, subject: true } } },
  });

  const rolePerms = await prisma.userRole.findMany({
    where: {
      userId: ctx.userId,
      userType: ctx.userType,
      departmentId: ctx.departmentId || null,
    },
    select: {
      role: {
        select: {
          rolePermissions: {
            select: { permission: { select: { action: true, subject: true } } },
          },
        },
      },
    },
  });

  const perms = new Set<string>();

  userPerms.forEach((up) => {
    perms.add(`${up.permission.action}:${up.permission.subject}`);
  });

  rolePerms.forEach((rp) => {
    rp.role.rolePermissions.forEach((rpm) => {
      perms.add(`${rpm.permission.action}:${rpm.permission.subject}`);
    });
  });

  return Array.from(perms);
}
```

### 2. Middleware (Next.js API Routes)

```typescript
// lib/auth/middleware.ts

import { NextRequest, NextResponse } from "next/server";
import { checkPermission, type PermissionContext } from "./rbac";

export async function withPermission(
  handler: (req: NextRequest, context: PermissionContext) => Promise<Response>,
  action: string,
  subject?: string
) {
  return async (req: NextRequest) => {
    // Extract user context from session/JWT
    const userId = req.headers.get("x-user-id");
    const userType = req.headers.get("x-user-type") as "admin" | "employee";
    const departmentId = req.headers.get("x-department-id");

    if (!userId || !userType) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const ctx: PermissionContext = { userId, userType, departmentId: departmentId || undefined };

    const allowed = await checkPermission(ctx, action, subject);
    if (!allowed) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    return handler(req, ctx);
  };
}
```

### 3. Caching (Redis)

For high-traffic apps, cache user permissions:

```typescript
// lib/auth/cache.ts

import Redis from "ioredis";
import { PermissionContext, getUserPermissions } from "./rbac";

const redis = new Redis(process.env.REDIS_URL);
const CACHE_TTL = 3600; // 1 hour

export async function getCachedUserPermissions(ctx: PermissionContext): Promise<string[]> {
  const cacheKey = `perms:${ctx.userId}:${ctx.userType}:${ctx.departmentId || "global"}`;

  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Fetch from DB
  const perms = await getUserPermissions(ctx);

  // Store in cache
  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(perms));

  return perms;
}

export async function invalidateUserPermissionsCache(userId: string): Promise<void> {
  // Invalidate all cache keys for this user
  const keys = await redis.keys(`perms:${userId}:*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
```

### 4. Audit Logging

Track role/permission changes:

```typescript
// lib/audit/log.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface AuditLog {
  action: "role_granted" | "role_revoked" | "permission_granted" | "permission_revoked";
  userId: string;
  targetUserId: string;
  roleId?: string;
  permissionId?: string;
  departmentId?: string;
  timestamp: Date;
  grantedBy: string;
}

export async function logAudit(log: AuditLog): Promise<void> {
  // Store in a dedicated AuditLog table (not defined in main schema; add if needed)
  console.log(
    `[AUDIT] ${log.action}: ${log.grantedBy} → ${log.targetUserId} at ${log.timestamp}`
  );
  // In production, persist to DB or external audit service
}
```

### 5. Admin API for Managing Roles

```typescript
// app/api/admin/roles/route.ts

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { invalidateUserPermissionsCache } from "@/lib/auth/cache";

const prisma = new PrismaClient();

// POST /api/admin/roles/:roleId/assign
export async function POST(
  req: NextRequest,
  { params }: { params: { roleId: string } }
) {
  const { userId, userType, departmentId } = await req.json();

  const userRole = await prisma.userRole.create({
    data: {
      userId,
      userType,
      roleId: params.roleId,
      departmentId: departmentId || null,
      grantedAt: new Date(),
      grantedBy: "admin-id-placeholder", // Extract from auth context
    },
  });

  // Invalidate cache
  await invalidateUserPermissionsCache(userId);

  return NextResponse.json(userRole, { status: 201 });
}
```

---

## Deployment Checklist

- [ ] **Phase 1: Schema Extension**
  - [ ] Add new models to `prisma/schema.prisma`
  - [ ] Run `prisma migrate dev --name add_unified_rbac`
  - [ ] Run `npm run build` — verify no TypeScript errors
  - [ ] Commit changes to Git

- [ ] **Phase 2: Data Backfill**
  - [ ] Create `scripts/migrate-rbac.ts`
  - [ ] Run backfill in dev environment
  - [ ] Verify permissions/roles/user-roles are seeded (SQL queries)
  - [ ] Backup production database
  - [ ] Run backfill in staging environment
  - [ ] Run backfill in production database (during maintenance window)

- [ ] **Phase 3: Application Integration**
  - [ ] Create `lib/auth/rbac.ts` — permission checking utilities
  - [ ] Create `lib/auth/middleware.ts` — Next.js middleware
  - [ ] Setup Redis caching (optional but recommended)
  - [ ] Refactor admin routes to use new permission checks
  - [ ] Refactor employee routes to use new role/permission system
  - [ ] Add audit logging for role/permission changes
  - [ ] Create admin API endpoints for managing roles/permissions

- [ ] **Phase 4: Testing**
  - [ ] Unit tests: `checkPermission()`, `getUserPermissions()` logic
  - [ ] Integration tests: API endpoints with various roles
  - [ ] Staging environment full validation
  - [ ] Load testing (if caching is in place)

- [ ] **Phase 5: Rollout**
  - [ ] Deploy to staging → verify for 24 hours
  - [ ] Deploy to production (during low-traffic window)
  - [ ] Monitor logs for auth errors
  - [ ] Gradual rollout with feature flags (optional)

- [ ] **Phase 6: Cleanup (After 1 Week Stability)**
  - [ ] Archive legacy `AdminPermission` table (optional)
  - [ ] Document deprecation notices for removed tables
  - [ ] Update team wiki/runbooks

- [ ] **Monitoring & Support**
  - [ ] Setup alerts for failed permission checks
  - [ ] Create runbook for common RBAC issues
  - [ ] Plan for quick rollback if needed

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Backfill script fails with "Unique constraint violation" | Run script idempotently; use `upsert` instead of `create` (already done in provided script). |
| Old admin UI still uses legacy AdminPermission table | Search codebase for `AdminPermission` queries; refactor to use `Permission` and `Role` queries. |
| Users can't access routes after migration | Check `UserRole` entries exist; verify permissions are linked to roles via `RolePermission`. |
| Permission caching stale after role change | Call `invalidateUserPermissionsCache(userId)` after any role grant/revocation. |
| Performance degradation with large permission sets | Enable Redis caching; consider denormalizing frequently-checked permissions into user JWT. |

---

## References & Tools

- **Prisma Docs:** https://www.prisma.io/docs
- **Prisma Migrate:** https://www.prisma.io/docs/orm/prisma-migrate
- **Next.js Auth:** https://nextjs.org/docs/authentication
- **CASL (Authorization Library):** https://casl.js.org/v6/en (optional, for complex rule evaluation)
- **Redis Caching:** https://redis.io/docs

---

## Contact & Questions

For questions or clarifications:
- **Team Slack:** #rbac-migration
- **Jira Ticket:** [Link to epic]
- **Technical Lead:** [Name/Email]

---

**Document Version:** 1.0  
**Last Updated:** November 25, 2025  
**Next Review:** After Phase 4 (Testing)

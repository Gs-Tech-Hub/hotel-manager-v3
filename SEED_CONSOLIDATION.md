# Seed Consolidation - UNIFIED SEED CORE

## Status: ✅ COMPLETE

As of February 11, 2026, the seed system has been consolidated into a **single source of truth**: `seed-core.ts`

## What Changed

### Before
- **Multiple seed files with redundant logic:**
  - `seed-core.ts` - Basic roles (admin, manager, staff, cashier, accountant)
  - `seed-permissions.ts` - Extended permissions for specialized roles
  - `seed-employee-roles.ts` - Duplicate role definitions with hyphenated codes (kitchen-staff, bar-staff, etc.)
  - Result: Inconsistent role codes, missing permissions, conflicting role definitions

### After
- **Single unified seed file:**
  - `seed-core.ts` - Now includes ALL roles and comprehensive permissions
  - Consistent underscore notation (kitchen_staff, bar_staff, pos_staff, etc.)
  - Complete permission sets for every role
  - No redundancy or conflicts
  - Result: Clean, reliable, maintainable role system

## Current Roles (All in seed-core.ts)

### Core Roles
- `admin` - Full system access
- `manager` - General manager with broad cross-department access
- `staff` - General staff member
- `employee` - Basic employee
- `accountant` - Finance and accounting

### Specialized Roles
- `pos_manager` - POS system management
- `inventory_staff` - Inventory management
- `cashier` - POS cashier

### Department-Scoped Roles
- `kitchen_staff` - Kitchen operations (mapped to 'restaurant' dept)
- `bar_staff` - Bar operations (mapped to 'bar' dept)
- `pos_staff` - POS operations (mapped to 'service' dept)
- `housekeeping_staff` - Room management (mapped to 'housekeeping' dept)
- `front_desk` - Booking/check-in (mapped to 'reception' dept)
- `customer_service` - Customer inquiries
- `receptionist` - Legacy alias for front_desk
- `terminal_operator` - POS terminal access

## How to Seed

**Recommended workflow:**

```bash
# 1. Seed core application (roles, permissions, admin user, departments)
npm run seed:core

# 2. (Optional) Seed demo users with various roles
npm run seed:users

# 3. (Optional) Seed demo inventory, products, etc.
npm run seed:dept-inv
npm run seed:inventory
```

## Deprecated Seeds

The following seed files are **deprecated** and should NOT be used:

- ❌ `scripts/seed-permissions.ts` - **Replaced by seed-core.ts**
  - All permissions now included in seed-core.ts
  - Do NOT run this separately

- ❌ `scripts/seed-employee-roles.ts` - **Replaced by seed-core.ts**
  - Contained duplicate role definitions with inconsistent hyphenated codes
  - All roles and permissions now in seed-core.ts
  - Do NOT run this separately

If you have run these deprecated scripts before, the unified seed-core will:
1. Detect existing roles
2. Update their permissions to match the unified standard
3. Ensure role codes are consistent (underscore notation)

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| [scripts/seed-core.ts](scripts/seed-core.ts) | **PRIMARY** - All roles, permissions, org, admin user, departments | ✅ Active |
| [scripts/seed-demo-users.ts](scripts/seed-demo-users.ts) | Demo employee users | ✅ Active |
| [scripts/seed-department-inventories.ts](scripts/seed-department-inventories.ts) | Sample inventory | ✅ Active |
| [lib/auth/position-role-mapping.ts](lib/auth/position-role-mapping.ts) | Maps positions to role codes | ✅ Active |
| [lib/auth/department-role-mapping.ts](lib/auth/department-role-mapping.ts) | Maps departments to default roles | ✅ Active |
| [lib/auth/page-access.ts](lib/auth/page-access.ts) | Page-level RBAC rules | ✅ Active |
| [lib/auth/role-landing.ts](lib/auth/role-landing.ts) | Role-based sidebar & landing pages | ✅ Active |
| [scripts/seed-permissions.ts](scripts/seed-permissions.ts) | ❌ DEPRECATED - Use seed-core.ts |
| [scripts/seed-employee-roles.ts](scripts/seed-employee-roles.ts) | ❌ DEPRECATED - Use seed-core.ts |

## Why Consolidation?

### Benefits
1. **Single Source of Truth** - One authoritative seed for roles and permissions
2. **No Conflicts** - No overlapping or contradictory role definitions
3. **Complete Permission Sets** - Every role has all necessary permissions for their operations
4. **Consistency** - Unified underscore notation (orders.read, bookings.read, etc.)
5. **Maintainability** - One file to update instead of three
6. **Reliability** - Less chance of missing or broken permissions

### Problems Solved
- ✅ Permission format mismatches (orders.read vs orders:read)
- ✅ Missing permissions causing middleware to deny valid page access
- ✅ Inconsistent role codes (hyphenated vs underscore)
- ✅ Incomplete permission sets for department-scoped roles
- ✅ Redundant role definitions across multiple seed files

## Permission Format

All permissions use **dot notation** with variants:
```
orders.read      (primary format, used everywhere)
orders:read      (alternate, auto-converted)
orders.*         (wildcard for all order actions)
```

The system automatically converts between formats so middleware, page-access, and session handling all work consistently.

## Testing Your Setup

After running `npm run seed:core`, verify:

```bash
# 1. Check roles were created
psql -c "SELECT code, name FROM roles ORDER BY code;"

# 2. Check permissions exist
psql -c "SELECT COUNT(*) FROM permissions;"

# 3. Check role-permission mappings
psql -c "SELECT r.code, COUNT(rp.permission_id) as perm_count FROM roles r LEFT JOIN role_permissions rp ON r.id = rp.role_id GROUP BY r.code;"

# 4. Admin user was created
psql -c "SELECT email FROM admin_users WHERE email = 'admin@hotel.test';"
```

## Next Steps

1. **Run seed-core**: `npm run seed:core`
2. **Verify in database** (see Testing section above)
3. **Login as admin** (admin@hotel.test / admin123)
4. **Test roles**: Create employees with different positions/departments
5. **Verify access**: Each role should see correct sidebar items and access allowed pages

## Questions?

See [docs/RBAC_IMPLEMENTATION_GUIDE.md](docs/RBAC_IMPLEMENTATION_GUIDE.md) for detailed RBAC architecture.

---
Last updated: February 11, 2026

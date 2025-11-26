/**
 * RBAC Migration Script
 * 
 * Migrates legacy AdminRole/AdminPermission/AdminUser into unified RBAC model.
 * Creates Permission, Role, RolePermission, and UserRole tables with existing data.
 * 
 * Usage:
 *   npx tsx scripts/migrate-rbac.ts
 * 
 * Idempotent: Safe to run multiple times.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_PERMISSIONS = [
  // Dashboard & Analytics
  { action: "dashboard.read", subject: "dashboard", description: "View dashboard" },

  // User Management
  { action: "users.read", subject: "users", description: "View users" },
  { action: "users.create", subject: "users", description: "Create users" },
  { action: "users.update", subject: "users", description: "Update users" },
  { action: "users.delete", subject: "users", description: "Delete users" },

  // Role Management
  { action: "roles.read", subject: "roles", description: "View roles" },
  { action: "roles.create", subject: "roles", description: "Create roles" },
  { action: "roles.update", subject: "roles", description: "Update roles" },
  { action: "roles.delete", subject: "roles", description: "Delete roles" },

  // Permission Management
  { action: "permissions.read", subject: "permissions", description: "View permissions" },
  { action: "permissions.manage", subject: "permissions", description: "Manage permissions" },

  // Bookings
  { action: "bookings.read", subject: "bookings", description: "View bookings" },
  { action: "bookings.create", subject: "bookings", description: "Create bookings" },
  { action: "bookings.update", subject: "bookings", description: "Update bookings" },
  { action: "bookings.delete", subject: "bookings", description: "Delete bookings" },
  { action: "bookings.checkin", subject: "bookings", description: "Check in guest" },
  { action: "bookings.checkout", subject: "bookings", description: "Check out guest" },

  // Orders
  { action: "orders.read", subject: "orders", description: "View orders" },
  { action: "orders.create", subject: "orders", description: "Create orders" },
  { action: "orders.update", subject: "orders", description: "Update orders" },
  { action: "orders.delete", subject: "orders", description: "Delete orders" },
  { action: "orders.fulfill", subject: "orders", description: "Fulfill orders" },
  { action: "orders.approve", subject: "orders", description: "Approve orders" },

  // Inventory
  { action: "inventory.read", subject: "inventory", description: "View inventory" },
  { action: "inventory.update", subject: "inventory", description: "Update inventory" },
  { action: "inventory.transfer", subject: "inventory", description: "Transfer inventory" },
  { action: "inventory.restock", subject: "inventory", description: "Restock inventory" },

  // Departments
  { action: "departments.read", subject: "departments", description: "View departments" },
  { action: "departments.create", subject: "departments", description: "Create departments" },
  { action: "departments.update", subject: "departments", description: "Update departments" },
  { action: "departments.manage", subject: "departments", description: "Manage departments" },

  // Customers
  { action: "customers.read", subject: "customers", description: "View customers" },
  { action: "customers.create", subject: "customers", description: "Create customers" },
  { action: "customers.update", subject: "customers", description: "Update customers" },
  { action: "customers.delete", subject: "customers", description: "Delete customers" },

  // Payments
  { action: "payments.read", subject: "payments", description: "View payments" },
  { action: "payments.process", subject: "payments", description: "Process payments" },
  { action: "payments.refund", subject: "payments", description: "Refund payments" },

  // Reports
  { action: "reports.read", subject: "reports", description: "View reports" },
  { action: "reports.export", subject: "reports", description: "Export reports" },

  // System
  { action: "settings.read", subject: "settings", description: "View settings" },
  { action: "settings.manage", subject: "settings", description: "Manage settings" },
];

async function migrateRBAC() {
  try {
    console.log("🔄 Starting RBAC migration...\n");

    // ========== Step 1: Seed default permissions ==========
    console.log("📝 Step 1: Seeding default permissions...");
    const permissionMap: Map<string, string> = new Map();

    for (const perm of DEFAULT_PERMISSIONS) {
      const key = `${perm.action}:${perm.subject || ""}`;
      
      const permission = await prisma.permission.upsert({
        where: {
          action_subject: {
            action: perm.action,
            subject: perm.subject ?? undefined,
          },
        },
        create: {
          action: perm.action,
          subject: perm.subject ?? undefined,
          description: perm.description,
          actionParameters: {},
          conditions: [],
          properties: {},
        },
        update: {
          description: perm.description,
        },
      });

      permissionMap.set(key, permission.id);
    }

    console.log(`✅ Seeded ${permissionMap.size} permissions.\n`);

    // ========== Step 2: Migrate AdminRoles → Roles ==========
    console.log("📝 Step 2: Migrating admin roles...");
    const adminRoles = await prisma.adminRole.findMany({
      include: { permissions: true, users: true },
    });

    const roleMap: Map<string, string> = new Map();

    for (const adminRole of adminRoles) {
      const role = await prisma.role.upsert({
        where: { code: adminRole.code },
        create: {
          code: adminRole.code,
          name: adminRole.name,
          description: adminRole.description || undefined,
          type: "admin",
          isActive: true,
        },
        update: {
          name: adminRole.name,
          description: adminRole.description || undefined,
        },
      });

      roleMap.set(adminRole.id, role.id);

      // ========== Step 2a: Link AdminPermissions to Roles ==========
      for (const adminPermission of adminRole.permissions) {
        const permKey = `${adminPermission.action}:${adminPermission.subject || ""}`;
        const permissionId = permissionMap.get(permKey);

        if (permissionId) {
          await prisma.rolePermission.upsert({
            where: {
              roleId_permissionId: {
                roleId: role.id,
                permissionId,
              },
            },
            create: {
              roleId: role.id,
              permissionId,
            },
            update: {},
          });
        } else {
          console.warn(
            `⚠️  Permission not found for ${adminPermission.action}:${adminPermission.subject}`
          );
        }
      }
    }

    console.log(`✅ Migrated ${roleMap.size} roles.\n`);

    // ========== Step 3: Migrate AdminUsers → UserRoles ==========
    console.log("📝 Step 3: Migrating admin user roles...");
    const adminUsers = await prisma.adminUser.findMany({
      include: { roles: true },
    });

    let userRoleCount = 0;

    for (const adminUser of adminUsers) {
      for (const adminRole of adminUser.roles) {
        const newRoleId = roleMap.get(adminRole.id);

        if (newRoleId) {
          // avoid using upsert with composite unique where containing optional fields
          // instead, check existence and create if missing
          const existing = await prisma.userRole.findFirst({
            where: {
              userId: adminUser.id,
              userType: "admin",
              roleId: newRoleId,
              departmentId: null,
            },
          });

          if (!existing) {
            await prisma.userRole.create({
              data: {
                userId: adminUser.id,
                userType: "admin",
                roleId: newRoleId,
                departmentId: null,
                grantedAt: adminUser.createdAt,
                grantedBy: undefined,
              },
            });

            userRoleCount++;
          }
        }
      }
    }

    console.log(`✅ Created ${userRoleCount} admin user-role assignments.\n`);

    // ========== Step 4: Create default employee role ==========
    console.log("📝 Step 4: Creating default employee role...");

    let defaultEmployeeRole = await prisma.role.findUnique({
      where: { code: "employee.default" },
    });

    if (!defaultEmployeeRole) {
      defaultEmployeeRole = await prisma.role.create({
        data: {
          code: "employee.default",
          name: "Employee (Default)",
          description: "Default role for employees with basic read and create permissions.",
          type: "employee",
          isActive: true,
        },
      });

      // Link basic permissions to default employee role
      const basicPermissions = [
        "dashboard.read:dashboard",
        "bookings.read:bookings",
        "orders.read:orders",
        "orders.create:orders",
        "inventory.read:inventory",
        "customers.read:customers",
      ];

      for (const permKey of basicPermissions) {
        const permissionId = permissionMap.get(permKey);
        if (permissionId) {
          await prisma.rolePermission.upsert({
            where: {
              roleId_permissionId: {
                roleId: defaultEmployeeRole.id,
                permissionId,
              },
            },
            create: {
              roleId: defaultEmployeeRole.id,
              permissionId,
            },
            update: {},
          });
        }
      }

      console.log(`✅ Created default employee role with basic permissions.\n`);
    } else {
      console.log(`✅ Default employee role already exists.\n`);
    }

    // ========== Step 5: Assign default role to employees ==========
    console.log("📝 Step 5: Assigning default roles to employees...");

    const employees = await prisma.pluginUsersPermissionsUser.findMany();

    let employeeCount = 0;

    for (const employee of employees) {
      const existingRole = await prisma.userRole.findFirst({
        where: {
          userId: employee.id,
          userType: "employee",
        },
      });

      if (!existingRole) {
        await prisma.userRole.create({
          data: {
            userId: employee.id,
            userType: "employee",
            roleId: defaultEmployeeRole.id,
            departmentId: undefined,
            grantedAt: new Date(),
            grantedBy: undefined,
          },
        });

        employeeCount++;
      }
    }

    console.log(`✅ Assigned default roles to ${employeeCount} employees.\n`);

    // ========== Final Summary ==========
    console.log("✨ RBAC migration complete!\n");
    console.log("📊 Migration Summary:");
    console.log(`   • Permissions seeded: ${permissionMap.size}`);
    console.log(`   • Roles created/updated: ${roleMap.size}`);
    console.log(`   • Admin user-role assignments: ${userRoleCount}`);
    console.log(`   • Employees with default roles: ${employeeCount}`);
    console.log("\n✅ Next Steps:");
    console.log(
      "   1. Verify database: SELECT COUNT(*) FROM permissions, roles, role_permissions, user_roles;"
    );
    console.log(
      "   2. Refactor app code to use new RBAC tables (see lib/auth/rbac.ts)"
    );
    console.log("   3. Update admin UI to manage roles via new tables");
    console.log("   4. Deploy and monitor logs for auth errors\n");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateRBAC();

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Comprehensive permissions seeding script.
 * Seeds permissions for all roles and departments.
 * Supports both unified RBAC (roles/user_roles) and legacy admin_roles schemas.
 */
async function seedPermissions() {
  console.log("🌱 Starting permissions seeding...\n");

  try {
    // Detect schema
    const hasRolesTableRow: any[] = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'roles'
      ) as exists`;
    const hasRolesTable = Array.isArray(hasRolesTableRow) && (hasRolesTableRow[0]?.exists || false);

    const hasAdminRolesRow: any[] = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'admin_roles'
      ) as exists`;
    const hasAdminRoles = Array.isArray(hasAdminRolesRow) && (hasAdminRolesRow[0]?.exists || false);

    // Define comprehensive permission sets for each role
    const permissionSets: Record<string, Array<{ action: string; subject: string; description: string }>> = {
      admin: [
        // System management
        { action: "*", subject: "*", description: "Full system access" },
        { action: "admin.view", subject: "users", description: "View admin users" },
        { action: "admin.create", subject: "users", description: "Create admin users" },
        { action: "admin.edit", subject: "users", description: "Edit admin users" },
        { action: "admin.delete", subject: "users", description: "Delete admin users" },
        { action: "admin.manage", subject: "roles", description: "Manage roles and permissions" },
        
        // Orders
        { action: "orders.create", subject: "orders", description: "Create orders" },
        { action: "orders.read", subject: "orders", description: "View orders" },
        { action: "orders.update", subject: "orders", description: "Update orders" },
        { action: "orders.delete", subject: "orders", description: "Delete orders" },
        { action: "orders.cancel", subject: "orders", description: "Cancel orders" },
        
        // Payments
        { action: "payments.read", subject: "payments", description: "View payments" },
        { action: "payments.process", subject: "payments", description: "Process payments" },
        { action: "payments.refund", subject: "payments", description: "Process refunds" },
        
        // Inventory
        { action: "inventory.read", subject: "inventory", description: "View inventory" },
        { action: "inventory.create", subject: "inventory", description: "Create inventory items" },
        { action: "inventory.update", subject: "inventory", description: "Update inventory" },
        { action: "inventory.delete", subject: "inventory", description: "Delete inventory" },
        { action: "inventory.transfer", subject: "inventory", description: "Transfer inventory between departments" },
        
        // Extras
        { action: "extras.read", subject: "extras", description: "View extras" },
        { action: "extras.create", subject: "extras", description: "Create extras" },
        { action: "extras.update", subject: "extras", description: "Update extras" },
        { action: "extras.delete", subject: "extras", description: "Delete extras" },
        { action: "extras.allocate", subject: "extras", description: "Allocate extras to departments" },
        { action: "extras.transfer", subject: "extras", description: "Transfer extras between departments" },
        
        // Bookings
        { action: "bookings.create", subject: "bookings", description: "Create bookings" },
        { action: "bookings.read", subject: "bookings", description: "View bookings" },
        { action: "bookings.update", subject: "bookings", description: "Update bookings" },
        { action: "bookings.delete", subject: "bookings", description: "Delete bookings" },
        { action: "bookings.checkout", subject: "bookings", description: "Process checkout" },
        
        // Departments
        { action: "departments.read", subject: "departments", description: "View departments" },
        { action: "departments.create", subject: "departments", description: "Create departments" },
        { action: "departments.update", subject: "departments", description: "Update departments" },
        { action: "departments.delete", subject: "departments", description: "Delete departments" },
        
        // Reports
        { action: "reports.read", subject: "reports", description: "View reports" },
        { action: "reports.generate", subject: "reports", description: "Generate reports" },
        { action: "reports.export", subject: "reports", description: "Export reports" },
      ],
      
      manager: [
        // Orders (read + manage)
        { action: "orders.read", subject: "orders", description: "View orders" },
        { action: "orders.create", subject: "orders", description: "Create orders" },
        { action: "orders.update", subject: "orders", description: "Update orders" },
        
        // Payments (process and refund)
        { action: "payments.read", subject: "payments", description: "View payments" },
        { action: "payments.process", subject: "payments", description: "Process payments" },
        { action: "payments.refund", subject: "payments", description: "Process refunds" },
        
        // Inventory (read + manage within department)
        { action: "inventory.read", subject: "inventory", description: "View inventory" },
        { action: "inventory.update", subject: "inventory", description: "Update inventory" },
        { action: "inventory.transfer", subject: "inventory", description: "Transfer inventory" },
        
        // Extras
        { action: "extras.read", subject: "extras", description: "View extras" },
        { action: "extras.create", subject: "extras", description: "Create extras" },
        { action: "extras.update", subject: "extras", description: "Update extras" },
        { action: "extras.delete", subject: "extras", description: "Delete extras" },
        { action: "extras.allocate", subject: "extras", description: "Allocate extras to departments" },
        { action: "extras.transfer", subject: "extras", description: "Transfer extras between departments" },
        
        // Bookings
        { action: "bookings.read", subject: "bookings", description: "View bookings" },
        { action: "bookings.create", subject: "bookings", description: "Create bookings" },
        { action: "bookings.update", subject: "bookings", description: "Update bookings" },
        
        // Departments (read only)
        { action: "departments.read", subject: "departments", description: "View departments" },
        
        // Reports
        { action: "reports.read", subject: "reports", description: "View reports" },
        { action: "reports.generate", subject: "reports", description: "Generate reports" },
      ],
      
      employee: [
        // Orders (read only)
        { action: "orders.read", subject: "orders", description: "View orders" },
        
        // Inventory (read only)
        { action: "inventory.read", subject: "inventory", description: "View inventory" },
        
        // Bookings (read only)
        { action: "bookings.read", subject: "bookings", description: "View bookings" },
        
        // Departments (read only)
        { action: "departments.read", subject: "departments", description: "View departments" },
        
        // Reports (read only)
        { action: "reports.read", subject: "reports", description: "View reports" },
      ],
      
      cashier: [
        // Orders (full CRUD for checkout operations)
        { action: "orders.read", subject: "orders", description: "View orders" },
        { action: "orders.create", subject: "orders", description: "Create orders" },
        { action: "orders.update", subject: "orders", description: "Update orders" },
        
        // Inventory (read only for menu display)
        { action: "inventory.read", subject: "inventory", description: "View inventory" },
        
        // Payments (process payments and refunds)
        { action: "payments.read", subject: "payments", description: "View payments" },
        { action: "payments.process", subject: "payments", description: "Process payments" },
        { action: "payments.refund", subject: "payments", description: "Process refunds" },
        
        // Departments (read only)
        { action: "departments.read", subject: "departments", description: "View departments" },
      ],
      
      staff: [
        // Orders (read + create for restaurant/bar operations)
        { action: "orders.read", subject: "orders", description: "View orders" },
        { action: "orders.create", subject: "orders", description: "Create orders" },
        { action: "orders.update", subject: "orders", description: "Update orders" },
        
        // Inventory (read only for menu display)
        { action: "inventory.read", subject: "inventory", description: "View inventory" },
        
        // Departments (read only)
        { action: "departments.read", subject: "departments", description: "View departments" },
        
        // Reports (read only)
        { action: "reports.read", subject: "reports", description: "View reports" },
      ],
      
      receptionist: [
        // Bookings (full CRUD for room reservations)
        { action: "bookings.create", subject: "bookings", description: "Create bookings" },
        { action: "bookings.read", subject: "bookings", description: "View bookings" },
        { action: "bookings.update", subject: "bookings", description: "Update bookings" },
        { action: "bookings.delete", subject: "bookings", description: "Delete bookings" },
        
        // Customers (read + create for guest information)
        { action: "customers.read", subject: "customers", description: "View customers" },
        { action: "customers.create", subject: "customers", description: "Create customers" },
        { action: "customers.update", subject: "customers", description: "Update customers" },
        
        // Rooms (read + view room status)
        { action: "rooms.read", subject: "rooms", description: "View rooms" },
        
        // Departments (read only)
        { action: "departments.read", subject: "departments", description: "View departments" },
      ],
      
      inventory_staff: [
        // Inventory (full management)
        { action: "inventory.read", subject: "inventory", description: "View inventory" },
        { action: "inventory.create", subject: "inventory", description: "Create inventory items" },
        { action: "inventory.update", subject: "inventory", description: "Update inventory" },
        { action: "inventory.transfer", subject: "inventory", description: "Transfer inventory between departments" },
        
        // Extras
        { action: "extras.read", subject: "extras", description: "View extras" },
        { action: "extras.create", subject: "extras", description: "Create extras" },
        { action: "extras.update", subject: "extras", description: "Update extras" },
        { action: "extras.delete", subject: "extras", description: "Delete extras" },
        { action: "extras.allocate", subject: "extras", description: "Allocate extras to departments" },
        { action: "extras.transfer", subject: "extras", description: "Transfer extras between departments" },
        
        // Departments (read only)
        { action: "departments.read", subject: "departments", description: "View departments" },
      ],
      
      pos_staff: [
        // Orders (read + create)
        { action: "orders.read", subject: "orders", description: "View orders" },
        { action: "orders.create", subject: "orders", description: "Create orders" },
        { action: "orders.update", subject: "orders", description: "Update orders" },
        
        // Inventory (read only for menu display)
        { action: "inventory.read", subject: "inventory", description: "View inventory" },
        
        // Departments (read only)
        { action: "departments.read", subject: "departments", description: "View departments" },
      ],
      
      pos_manager: [
        // Orders (full CRUD + management)
        { action: "orders.read", subject: "orders", description: "View orders" },
        { action: "orders.create", subject: "orders", description: "Create orders" },
        { action: "orders.update", subject: "orders", description: "Update orders" },
        { action: "orders.delete", subject: "orders", description: "Delete orders" },
        { action: "orders.cancel", subject: "orders", description: "Cancel orders" },
        
        // Payments (process and refund)
        { action: "payments.read", subject: "payments", description: "View payments" },
        { action: "payments.process", subject: "payments", description: "Process payments" },
        { action: "payments.refund", subject: "payments", description: "Process refunds" },
        
        // Inventory (read + update)
        { action: "inventory.read", subject: "inventory", description: "View inventory" },
        { action: "inventory.update", subject: "inventory", description: "Update inventory" },
        { action: "inventory.transfer", subject: "inventory", description: "Transfer inventory" },
        
        // Extras (read only)
        { action: "extras.read", subject: "extras", description: "View extras" },
        
        // Departments
        { action: "departments.read", subject: "departments", description: "View departments" },
        { action: "departments.update", subject: "departments", description: "Update departments" },
        
        // Reports
        { action: "reports.read", subject: "reports", description: "View reports" },
        { action: "reports.generate", subject: "reports", description: "Generate reports" },
      ],
      
      terminal_operator: [
        // POS Terminal access
        { action: "pos_terminal.access", subject: "pos_terminal", description: "Access POS terminals" },
        
        // Orders (read + create)
        { action: "orders.read", subject: "orders", description: "View orders" },
        { action: "orders.create", subject: "orders", description: "Create orders" },
        { action: "orders.update", subject: "orders", description: "Update orders" },
        
        // Inventory (read only)
        { action: "inventory.read", subject: "inventory", description: "View inventory" },
      ],
    };

    // Seed legacy admin roles schema
    if (hasAdminRoles) {
      console.log("📝 Seeding legacy admin_roles permissions...");
      
      const adminRole = await prisma.adminRole.findFirst({ where: { code: "admin" } });
      if (adminRole) {
        const adminPerms = permissionSets["admin"] || [];
        for (const perm of adminPerms) {
          const existing = await prisma.adminPermission.findFirst({
            where: { action: perm.action, roleId: adminRole.id },
          });

          if (!existing) {
            await prisma.adminPermission.create({
              data: {
                action: perm.action,
                subject: perm.subject || null,
                roleId: adminRole.id,
              },
            });
          }
        }
        console.log(`  ✅ Admin role: ${adminPerms.length} permissions`);
      }
    }

    // Seed unified RBAC schema
    if (hasRolesTable) {
      console.log("📝 Seeding unified RBAC permissions...");

      for (const [roleCode, perms] of Object.entries(permissionSets)) {
        // Find or create role
        let role = await prisma.role.findUnique({ where: { code: roleCode } });
        if (!role) {
          role = await prisma.role.create({
            data: {
              code: roleCode,
              name: roleCode.charAt(0).toUpperCase() + roleCode.slice(1),
              type: roleCode,
              isActive: true,
            },
          });
          console.log(`  📌 Created role: ${roleCode}`);
        }

        // Create permissions and attach to role
        let createdCount = 0;
        for (const perm of perms) {
          // Find or create permission
          let permission = await prisma.permission.findFirst({
            where: {
              action: perm.action,
              subject: perm.subject || null,
            },
          });

          if (!permission) {
            permission = await prisma.permission.create({
              data: {
                action: perm.action,
                subject: perm.subject || null,
                description: perm.description,
              },
            });
          }

          // Attach to role if not already attached
          const existing = await prisma.rolePermission.findFirst({
            where: {
              roleId: role.id,
              permissionId: permission.id,
            },
          });

          if (!existing) {
            await prisma.rolePermission.create({
              data: {
                roleId: role.id,
                permissionId: permission.id,
              },
            });
            createdCount++;
          }
        }

        console.log(`  ✅ Role '${roleCode}': ${perms.length} permissions (${createdCount} new)`);
      }
    }

    if (!hasRolesTable && !hasAdminRoles) {
      console.warn("❌ Neither 'roles' nor 'admin_roles' table found. Cannot seed permissions.");
      return;
    }

    console.log("\n✨ Permissions seeding completed successfully!");
    console.log("📊 Summary:");
    console.log(`  - Admin role: ${permissionSets.admin.length} permissions`);
    console.log(`  - Manager role: ${permissionSets.manager.length} permissions`);
    console.log(`  - Employee role: ${permissionSets.employee.length} permissions`);
    console.log(`  - Cashier role: ${permissionSets.cashier.length} permissions`);
    console.log(`  - Staff role: ${permissionSets.staff.length} permissions`);
    console.log(`  - Receptionist role: ${permissionSets.receptionist.length} permissions`);
    console.log(`  - Inventory Staff role: ${permissionSets.inventory_staff.length} permissions`);
    console.log(`  - POS Staff role: ${permissionSets.pos_staff.length} permissions`);
    console.log(`  - POS Manager role: ${permissionSets.pos_manager.length} permissions`);
    console.log(`  - Terminal Operator role: ${permissionSets.terminal_operator.length} permissions`);
  } catch (error) {
    console.error("❌ Error seeding permissions:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run seeding
seedPermissions().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

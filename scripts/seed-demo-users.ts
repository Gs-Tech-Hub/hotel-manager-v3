import { PrismaClient } from "@prisma/client";
import bcryptjs from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Hash password using bcryptjs
 */
async function hashPassword(password: string): Promise<string> {
  return bcryptjs.hash(password, 10);
}

/**
 * Seed demo admin and employee users
 */
async function seedUsers() {
  console.log("🌱 Starting user seeding...\n");

  try {
    // Detect whether unified RBAC `roles` table exists or legacy `admin_roles` exists
    const hasRolesTableRow: any[] = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'roles'
      ) as exists`;
    const hasRolesTable = Array.isArray(hasRolesTableRow) && (hasRolesTableRow[0]?.exists || false);

    const hasUserRolesRow: any[] = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'user_roles'
      ) as exists`;
    const hasUserRolesTable = Array.isArray(hasUserRolesRow) && (hasUserRolesRow[0]?.exists || false);

    let adminRole: any = null;
    let employeeRole: any = null;

    if (hasRolesTable) {
      // Create or get admin role (unified RBAC)
      adminRole = await prisma.role.findUnique({ where: { code: "admin" } });
      if (!adminRole) {
        console.log("📋 Creating admin role (unified roles)...");
        adminRole = await prisma.role.create({
          data: {
            code: "admin",
            name: "Administrator",
            description: "Full system access",
            type: "admin",
            isActive: true,
          },
        });
        console.log("✅ Admin role created\n");
      }

      // Create or get employee role (unified RBAC)
      employeeRole = await prisma.role.findUnique({ where: { code: "employee" } });
      if (!employeeRole) {
        console.log("📋 Creating employee role (unified roles)...");
        employeeRole = await prisma.role.create({
          data: {
            code: "employee",
            name: "Employee",
            description: "Basic employee access",
            type: "employee",
            isActive: true,
          },
        });
        console.log("✅ Employee role created\n");
      }
    } else {
      // Fallback to legacy admin roles table
      console.log("⚠️ Unified `roles` table not found; using legacy `admin_roles` table if available.");
      const hasAdminRolesRow: any[] = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'admin_roles'
        ) as exists`;
      const hasAdminRoles = Array.isArray(hasAdminRolesRow) && (hasAdminRolesRow[0]?.exists || false);

      if (hasAdminRoles) {
        adminRole = await prisma.adminRole.findFirst({ where: { code: "admin" } });
        if (!adminRole) {
          console.log("📋 Creating admin role (legacy admin_roles)...");
          adminRole = await prisma.adminRole.create({
            data: {
              code: "admin",
              name: "Administrator",
              description: "Full system access",
            },
          });
          console.log("✅ Admin role created (legacy)\n");
        }

        // Create core admin permissions if not exist
        console.log("📋 Ensuring admin permissions exist...");
        const corePermissions = [
          { action: "*", subject: "*", description: "Full admin access" },
          { action: "admin.view", subject: "users", description: "View admin users" },
          { action: "admin.create", subject: "users", description: "Create admin users" },
          { action: "admin.edit", subject: "users", description: "Edit admin users" },
          { action: "admin.delete", subject: "users", description: "Delete admin users" },
          { action: "admin.manage", subject: "roles", description: "Manage roles" },
        ];

        for (const perm of corePermissions) {
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
        console.log("✅ Admin permissions ensured\n");
      } else {
        console.warn("No roles table found (neither 'roles' nor 'admin_roles'). Role assignments will be skipped.");
      }
    }

    // Define demo admin users
    const adminUsers = [
      {
        email: "admin@hotelmanager.com",
        username: "admin",
        firstname: "Admin",
        lastname: "User",
        password: "Admin@123456",
      },
      {
        email: "superadmin@hotelmanager.com",
        username: "superadmin",
        firstname: "Super",
        lastname: "Admin",
        password: "SuperAdmin@123456",
      },
    ];

    // Create demo admin users
    console.log("👤 Creating demo admin users...");
    for (const adminData of adminUsers) {
      const existing = await prisma.adminUser.findUnique({
        where: { email: adminData.email },
      });

      let adminUser = existing;
      if (existing) {
        console.log(`   ⏭️  Admin user already exists: ${adminData.email}`);
      } else {
        const hashedPassword = await hashPassword(adminData.password);
        adminUser = await prisma.adminUser.create({
          data: {
            email: adminData.email,
            username: adminData.username,
            firstname: adminData.firstname,
            lastname: adminData.lastname,
            password: hashedPassword,
            isActive: true,
            blocked: false,
          },
        });
        console.log(`   ✅ Admin created: ${adminData.email}`);
      }

      // Assign admin role (for both new and existing admins)
      if (adminUser && adminRole) {
        try {
          if (hasUserRolesTable) {
            // Try unified RBAC first
            await prisma.userRole.create({
              data: {
                userId: adminUser.id,
                userType: "admin",
                roleId: adminRole.id,
                grantedAt: new Date(),
                grantedBy: "system",
              },
            }).catch(() => {
              // Role already assigned, ignore
            });
          } else {
            // Use legacy admin role connection
            await prisma.adminUser.update({
              where: { id: adminUser.id },
              data: {
                roles: { connect: { id: adminRole.id } },
              },
            }).catch(() => {
              // Role already assigned, ignore
            });
          }
          console.log(`   ✅ Admin role assigned: ${adminData.email}`);
        } catch (err) {
          console.warn(`   ⚠️  Could not assign admin role: ${adminData.email}`, err);
        }
      }
    }
    console.log();

    // Define demo employee users
    const employeeUsers = [
      {
        email: "john.doe@hotelmanager.com",
        username: "john.doe",
        firstname: "John",
        lastname: "Doe",
        password: "Employee@123456",
      },
      {
        email: "jane.smith@hotelmanager.com",
        username: "jane.smith",
        firstname: "Jane",
        lastname: "Smith",
        password: "Employee@123456",
      },
      {
        email: "mike.johnson@hotelmanager.com",
        username: "mike.johnson",
        firstname: "Mike",
        lastname: "Johnson",
        password: "Employee@123456",
      },
      {
        email: "sarah.williams@hotelmanager.com",
        username: "sarah.williams",
        firstname: "Sarah",
        lastname: "Williams",
        password: "Employee@123456",
      },
      {
        email: "david.brown@hotelmanager.com",
        username: "david.brown",
        firstname: "David",
        lastname: "Brown",
        password: "Employee@123456",
      },
      {
        email: "emma.davis@hotelmanager.com",
        username: "emma.davis",
        firstname: "Emma",
        lastname: "Davis",
        password: "Employee@123456",
      },
    ];

    // Create demo employee users
    console.log("👥 Creating demo employee users...");
    for (const empData of employeeUsers) {
      const existing = await prisma.pluginUsersPermissionsUser.findUnique({
        where: { email: empData.email },
      });

      if (existing) {
        console.log(`   ⏭️  Employee already exists: ${empData.email}`);
      } else {
        const hashedPassword = await hashPassword(empData.password);
        const employee = await prisma.pluginUsersPermissionsUser.create({
          data: {
            email: empData.email,
            username: empData.username,
            firstname: empData.firstname,
            lastname: empData.lastname,
            password: hashedPassword,
            blocked: false,
          },
        });

        // Assign employee role (only if unified user_roles table exists)
        if (hasUserRolesTable && employeeRole) {
          await prisma.userRole.create({
            data: {
              userId: employee.id,
              userType: "employee",
              roleId: employeeRole.id,
              grantedAt: new Date(),
              grantedBy: "system",
            },
          });
        } else {
          console.warn("Skipping employee role assignment: 'user_roles' table not present or employee role missing.");
        }

        console.log(`   ✅ Employee created: ${empData.email}`);
      }
    }
    console.log();

    // Display summary
    console.log("📊 Seeding Summary:");
    console.log("==================");
    const totalAdmins = await prisma.adminUser.count();
    const totalEmployees = await prisma.pluginUsersPermissionsUser.count();
    console.log(`   Total Admin Users: ${totalAdmins}`);
    console.log(`   Total Employees: ${totalEmployees}`);
    console.log("\n🔐 Demo Credentials:");
    console.log("====================");
    console.log(`   Admin: admin@hotelmanager.com / Admin@123456`);
    console.log(`   Super Admin: superadmin@hotelmanager.com / SuperAdmin@123456`);
    console.log(`   Employee (any): john.doe@hotelmanager.com / Employee@123456`);
    console.log("\n✨ User seeding completed successfully!");
  } catch (error) {
    console.error("❌ Error seeding users:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run seeding
seedUsers().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

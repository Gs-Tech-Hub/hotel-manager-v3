import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Grant admin role to a demo employee for testing admin features
 * Usage: npx tsx scripts/grant-admin-to-employee.ts
 */
async function grantAdminToEmployee() {
  console.log("🔐 Granting admin role to demo employee...\n");

  try {
    // Get or create admin role
    let adminRole = await prisma.role.findUnique({ where: { code: "admin" } });
    if (!adminRole) {
      console.log("📋 Creating admin role...");
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
    } else {
      console.log("✅ Admin role found\n");
    }

    // Find a demo employee (john.doe)
    const employee = await prisma.pluginUsersPermissionsUser.findUnique({
      where: { email: "john.doe@hotelmanager.com" },
    });

    if (!employee) {
      console.error("❌ Demo employee not found. Please run seed-demo-users.ts first.");
      return;
    }

    console.log(`📧 Found employee: ${employee.email}\n`);

    // Check if already has admin role
    const existingRole = await prisma.userRole.findFirst({
      where: {
        userId: employee.id,
        userType: "employee",
        roleId: adminRole.id,
      },
    });

    if (existingRole) {
      console.log("⏭️  Employee already has admin role\n");
    } else {
      // Assign admin role to employee
      await prisma.userRole.create({
        data: {
          userId: employee.id,
          userType: "employee",
          roleId: adminRole.id,
          grantedAt: new Date(),
          grantedBy: "system",
        },
      });
      console.log("✅ Admin role assigned to employee\n");
    }

    console.log("🎯 You can now login with:");
    console.log(`   Email: ${employee.email}`);
    console.log(`   Password: Employee@123456`);
    console.log("\nAnd access admin features with full permissions!\n");

  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

grantAdminToEmployee().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function verifyPermissions() {
  console.log("🔍 Verifying orders.create permission for cashier and staff roles...\n");

  try {
    // Check for each role
    const roles = ["cashier", "staff"];

    for (const roleCode of roles) {
      const role = await prisma.role.findUnique({
        where: { code: roleCode },
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
        },
      });

      if (!role) {
        console.log(`❌ Role '${roleCode}' not found`);
        continue;
      }

      const hasOrdersCreate = role.rolePermissions.some(
        (rp) => rp.permission.action === "orders.create" && rp.permission.subject === "orders"
      );

      if (hasOrdersCreate) {
        console.log(`✅ Role '${roleCode}' has orders.create permission`);
      } else {
        console.log(`❌ Role '${roleCode}' MISSING orders.create permission`);
      }

      // Show all permissions for this role
      console.log(`   Permissions: ${role.rolePermissions.map((rp) => `${rp.permission.action}:${rp.permission.subject}`).join(", ")}`);
      console.log();
    }

    console.log("✨ Verification complete!");
  } catch (error) {
    console.error("❌ Error verifying permissions:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

verifyPermissions().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

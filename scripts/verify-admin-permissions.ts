import { prisma } from '@/lib/auth/prisma';
import { getUserPermissions } from '@/lib/auth/rbac';

async function verifyAdminPermissions() {
  try {
    console.log("✅ Verifying admin permissions for logged-in user...\n");

    // Get the admin user
    const adminUser = await prisma.adminUser.findUnique({
      where: { email: "admin@hotelmanager.com" },
    });

    if (!adminUser) {
      console.error("❌ Admin user not found");
      return;
    }

    console.log(`👤 Testing as: ${adminUser.email}\n`);

    // Simulate getting permissions
    const permissions = await getUserPermissions({
      userId: adminUser.id,
      userType: "admin",
      departmentId: undefined,
    });

    console.log("📋 Permissions returned by getUserPermissions():\n");

    const permsByResource: { [key: string]: string[] } = {};
    permissions.forEach((perm) => {
      const [resource, action] = perm.includes(".")
        ? perm.split(".")
        : [perm.split(":")[0], perm.split(":")[1] || ""];

      if (!permsByResource[resource]) {
        permsByResource[resource] = [];
      }
      if (action) {
        permsByResource[resource].push(action);
      }
    });

    Object.entries(permsByResource)
      .sort()
      .forEach(([resource, actions]) => {
        console.log(`\n${resource}:`);
        [...new Set(actions)].sort().forEach((action) => {
          console.log(`  ✓ ${resource}.${action}`);
        });
      });

    console.log(`\n${"=".repeat(50)}`);
    console.log(`Total unique permissions: ${[...new Set(permissions)].length}\n`);

    // Check specific permissions that UI needs
    const requiredPerms = [
      "departments.create",
      "departments.delete",
      "department_sections.create",
      "department_sections.delete",
      "inventory_items.create",
      "inventory_items.delete",
      "discounts.create",
      "discounts.delete",
      "employees.create",
      "employees.delete",
    ];

    console.log("🎯 Checking required UI permissions:\n");
    let allPresent = true;
    requiredPerms.forEach((perm) => {
      const present = permissions.includes(perm);
      console.log(`  ${present ? "✅" : "❌"} ${perm}`);
      if (!present) allPresent = false;
    });

    console.log(`\n${allPresent ? "✨" : "⚠️"} ${allPresent ? "All permissions present!" : "Some permissions missing!"}\n`);

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyAdminPermissions();

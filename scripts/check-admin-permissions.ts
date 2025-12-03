import { prisma } from '@/lib/auth/prisma';

async function checkAdminPermissions() {
  try {
    console.log("🔍 Checking admin role and permissions...\n");

    // Find admin role
    const adminRole = await prisma.role.findUnique({
      where: { code: "admin" },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!adminRole) {
      console.error("❌ Admin role not found");
      return;
    }

    console.log(`✅ Admin role found: ${adminRole.name}\n`);
    console.log("📋 Current permissions assigned to admin role:");
    console.log("=".repeat(50));

    const permsBySubject: { [key: string]: string[] } = {};
    adminRole.rolePermissions.forEach((rp) => {
      const subject = rp.permission.subject || "GLOBAL";
      if (!permsBySubject[subject]) {
        permsBySubject[subject] = [];
      }
      permsBySubject[subject].push(rp.permission.action);
    });

    Object.entries(permsBySubject).sort().forEach(([subject, actions]) => {
      console.log(`\n${subject}:`);
      actions.sort().forEach((action) => {
        console.log(`  • ${action}.${subject}`);
      });
    });

    console.log("\n" + "=".repeat(50));
    console.log(`\nTotal permissions: ${adminRole.rolePermissions.length}\n`);

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAdminPermissions();

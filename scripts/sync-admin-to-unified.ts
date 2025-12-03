import { prisma } from '@/lib/auth/prisma';

async function syncAdminRolesToUnified() {
  try {
    console.log("🔄 Syncing admin role assignments from legacy to unified RBAC...\n");

    // Get the unified admin role
    const unifiedAdminRole = await prisma.role.findUnique({
      where: { code: "admin" },
    });

    if (!unifiedAdminRole) {
      console.error("❌ Unified admin role not found. This shouldn't happen.");
      return;
    }

    // Find all admin users
    const adminUsers = await prisma.adminUser.findMany({
      include: { roles: true },
    });

    console.log(`Found ${adminUsers.length} admin users\n`);

    let synced = 0;
    let skipped = 0;

    for (const adminUser of adminUsers) {
      // Check if user has an admin role (legacy)
      const hasAdminRole = adminUser.roles.some((r: any) => r.code === "admin");

      if (hasAdminRole) {
        // Check if already in unified RBAC
        const existingUserRole = await prisma.userRole.findFirst({
          where: {
            userId: adminUser.id,
            userType: "admin",
            roleId: unifiedAdminRole.id,
          },
        });

        if (existingUserRole) {
          console.log(`⏭️  ${adminUser.email} - already synced`);
          skipped++;
        } else {
          // Create UserRole entry to sync to unified RBAC
          try {
            await prisma.userRole.create({
              data: {
                userId: adminUser.id,
                userType: "admin",
                roleId: unifiedAdminRole.id,
                grantedAt: new Date(),
                grantedBy: "system-sync",
              },
            });
            console.log(`✅ ${adminUser.email} - synced to unified RBAC`);
            synced++;
          } catch (err: any) {
            if (err.code === 'P2002') {
              console.log(`⏭️  ${adminUser.email} - already exists (duplicate key)`);
              skipped++;
            } else {
              console.error(`❌ ${adminUser.email} - error:`, err.message);
            }
          }
        }
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Synced: ${synced}`);
    console.log(`   Already synced/skipped: ${skipped}`);
    console.log(`   Total: ${adminUsers.length}`);

    console.log(`\n✨ Admin users are now synced to unified RBAC!`);
    console.log(`   They will have access to all admin permissions.`);

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

syncAdminRolesToUnified();

import { prisma } from '@/lib/auth/prisma';

async function checkAdminUser() {
  try {
    console.log("👤 Checking admin user and role assignment...\n");

    // Find admin user
    const adminUser = await prisma.adminUser.findUnique({
      where: { email: "admin@hotelmanager.com" },
      include: {
        // Legacy fallback if user_roles doesn't work
        roles: true,
      },
    });

    if (!adminUser) {
      console.error("❌ Admin user (admin@hotelmanager.com) not found");
      return;
    }

    console.log(`✅ Admin user found: ${adminUser.email}\n`);

    // Check unified RBAC role assignment
    const userRole = await prisma.userRole.findFirst({
      where: {
        userId: adminUser.id,
        userType: "admin",
      },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (userRole) {
      console.log(`✅ User role assignment found (unified RBAC)`);
      console.log(`   Role: ${userRole.role.name} (${userRole.role.code})`);
      console.log(`   Permissions: ${userRole.role.rolePermissions.length}`);
      console.log(`   Granted at: ${userRole.grantedAt}`);
    } else if (adminUser.roles && adminUser.roles.length > 0) {
      console.log(`✅ User has legacy admin roles assigned:`);
      adminUser.roles.forEach((role: any) => {
        console.log(`   • ${role.name} (${role.code})`);
      });
    } else {
      console.warn(`⚠️  Admin user has NO roles assigned!`);
      console.warn(`   This user won't have any permissions.\n`);
      
      // Try to assign admin role
      const adminRole = await prisma.role.findUnique({ where: { code: "admin" } });
      if (adminRole) {
        console.log("🔧 Attempting to assign admin role...");
        try {
          await prisma.userRole.create({
            data: {
              userId: adminUser.id,
              userType: "admin",
              roleId: adminRole.id,
              grantedAt: new Date(),
              grantedBy: "system",
            },
          });
          console.log("✅ Admin role assigned successfully!\n");
          console.log("🎯 The admin user now has full permissions.");
        } catch (err: any) {
          if (err.code === 'P2002') {
            console.log("⏭️  Role assignment already exists (duplicate)\n");
          } else {
            throw err;
          }
        }
      }
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAdminUser();

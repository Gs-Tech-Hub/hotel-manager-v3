/**
 * Fix Admin Permissions
 * Assigns admin role to admin users for unified RBAC
 */

import { prisma } from '@/lib/auth/prisma';

async function fixAdminPermissions() {
  console.log('🔧 Fixing admin user permissions...\n');

  try {
    // Get or create admin role
    let adminRole = await prisma.role.findUnique({
      where: { code: 'admin' },
    });

    if (!adminRole) {
      console.log('Creating admin role...');
      adminRole = await prisma.role.create({
        data: {
          code: 'admin',
          name: 'Administrator',
          description: 'Full system access',
          type: 'admin',
          isActive: true,
        },
      });
    }

    // Get all permissions and assign to admin role
    const permissions = await prisma.permission.findMany();
    const existingRolePermissions = await prisma.rolePermission.findMany({
      where: { roleId: adminRole.id },
    });

    const existingPermIds = new Set(
      existingRolePermissions.map((rp) => rp.permissionId)
    );

    // Add missing permissions
    const toAdd = permissions.filter((p) => !existingPermIds.has(p.id));
    for (const perm of toAdd) {
      await prisma.rolePermission.create({
        data: {
          roleId: adminRole.id,
          permissionId: perm.id,
        },
      });
    }

    console.log(`✅ Admin role has ${permissions.length} permissions`);

    // Get all admin users
    const adminUsers = await prisma.adminUser.findMany({
      select: { id: true, email: true },
    });

    console.log(`\n👤 Assigning admin role to ${adminUsers.length} admin users...\n`);

    // Assign admin role to all admin users
    for (const adminUser of adminUsers) {
      const existing = await prisma.userRole.findFirst({
        where: {
          userId: adminUser.id,
          userType: 'admin',
          roleId: adminRole.id,
        },
      });

      if (existing) {
        console.log(`  ⏭️  ${adminUser.email} already has admin role`);
      } else {
        await prisma.userRole.create({
          data: {
            userId: adminUser.id,
            userType: 'admin',
            roleId: adminRole.id,
          },
        });
        console.log(`  ✅ Assigned admin role to ${adminUser.email}`);
      }
    }

    console.log('\n✨ Admin permissions fixed!');
  } catch (error) {
    console.error('❌ Error fixing admin permissions:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixAdminPermissions();

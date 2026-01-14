/**
 * Verify and fix admin user roles
 */

import { prisma } from '@/lib/prisma';

async function verifyAdminRole() {
  console.log('🔍 Verifying admin user roles...\n');

  try {
    // Find admin user
    const adminUser = await prisma.adminUser.findFirst({
      where: { email: 'admin@hotelmanager.com' },
      include: {
        roles: {
          select: { id: true, code: true, name: true }
        }
      }
    });

    if (!adminUser) {
      console.log('❌ Admin user not found');
      return;
    }

    console.log('✅ Found admin user:', adminUser.email);
    console.log('📋 Current roles:', adminUser.roles.map(r => r.code).join(', ') || 'NONE');

    // Check if admin has admin role
    const hasAdminRole = adminUser.roles.some(r => r.code === 'admin');

    if (!hasAdminRole) {
      console.log('\n⚠️  Admin user is missing the admin role!');
      console.log('🔧 Fixing...');

      // Find admin role
      const adminRole = await prisma.adminRole.findFirst({
        where: { code: 'admin' }
      });

      if (!adminRole) {
        console.log('❌ Admin role not found in database');
        return;
      }

      // Get current admin roles (many-to-many relation through AdminUser)
      const currentRelations = await prisma.adminUser.findUnique({
        where: { id: adminUser.id },
        select: {
          roles: {
            select: { id: true }
          }
        }
      });

      // Update to include admin role
      await prisma.adminUser.update({
        where: { id: adminUser.id },
        data: {
          roles: {
            connect: { id: adminRole.id }
          }
        }
      });

      console.log('✅ Admin role assigned successfully!\n');

      // Verify
      const updated = await prisma.adminUser.findFirst({
        where: { email: 'admin@hotelmanager.com' },
        include: {
          roles: {
            select: { code: true, name: true }
          }
        }
      });

      console.log('✅ Updated admin user roles:', updated?.roles.map(r => r.code).join(', '));
    } else {
      console.log('✅ Admin user already has admin role');
    }

    // Check if admin role has permissions
    const adminRole = await prisma.adminRole.findFirst({
      where: { code: 'admin' },
      include: {
        permissions: {
          select: { action: true, subject: true }
        }
      }
    });

    if (adminRole) {
      console.log('\n📝 Admin role permissions:');
      if (adminRole.permissions.length === 0) {
        console.log('  ⚠️  No permissions assigned!');
      } else {
        const wildcardPerms = adminRole.permissions.filter(p => p.action === '*');
        if (wildcardPerms.length > 0) {
          console.log('  ✅ Wildcard permissions present');
        }
        console.log(`  Total: ${adminRole.permissions.length} permissions`);
        console.log(`  Sample: ${adminRole.permissions.slice(0, 3).map(p => `${p.action}:${p.subject}`).join(', ')}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyAdminRole().catch(console.error);

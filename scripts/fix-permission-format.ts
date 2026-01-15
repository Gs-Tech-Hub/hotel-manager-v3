/**
 * Fix Permission Format
 * Normalizes permission action/subject to be consistent
 * Changes "roles.read" action to "roles" action with "read" subject
 */

import { prisma } from '@/lib/auth/prisma';

async function fixPermissionFormat() {
  console.log('🔧 Fixing permission format...\n');

  try {
    // Get all permissions with dots in action
    const permsWithDots = await prisma.permission.findMany({
      where: { action: { contains: '.' } },
    });

    console.log(`Found ${permsWithDots.length} permissions with dots\n`);

    for (const perm of permsWithDots) {
      const [newAction, newSubject] = perm.action.split('.');

      // Check if new format already exists
      const existing = await prisma.permission.findFirst({
        where: {
          action: newAction,
          subject: newSubject || perm.subject,
        },
      });

      if (existing) {
        console.log(
          `  ⏭️  Permission ${newAction}/${newSubject} already exists, deleting old`
        );
        // Delete role_permissions linked to old permission
        await prisma.rolePermission.deleteMany({
          where: { permissionId: perm.id },
        });
        // Delete old permission
        await prisma.permission.delete({ where: { id: perm.id } });
      } else {
        // Update permission to new format
        await prisma.permission.update({
          where: { id: perm.id },
          data: {
            action: newAction,
            subject: newSubject || perm.subject,
          },
        });
        console.log(`  ✅ Updated ${perm.action} → ${newAction}/${newSubject}`);
      }
    }

    console.log('\n✨ Permission format fixed!');
  } catch (error) {
    console.error('❌ Error fixing permissions:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixPermissionFormat();

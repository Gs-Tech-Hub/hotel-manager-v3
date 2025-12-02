/**
 * Seed admin permissions for departments, department_sections, inventory_items, discounts, employees
 *
 * Usage:
 *   node --loader ts-node/esm src/scripts/seed-admin-permissions.ts
 */

import prisma from '@/lib/prisma';

const PERMISSIONS = [
  'departments.create',
  'departments.read',
  'departments.delete',

  'department_sections.create',
  'department_sections.read',
  'department_sections.delete',

  'inventory_items.create',
  'inventory_items.read',
  'inventory_items.delete',

  'discounts.create',
  'discounts.read',
  'discounts.delete',

  'employees.create',
  'employees.read',
  'employees.delete',
];

async function seed() {
  console.log('🌱 Seeding admin permissions...');

  try {
    const createdPerms: any[] = [];

    for (const action of PERMISSIONS) {
      const [act, subj] = action.split('.');

      // Upsert into Permission table (unified)
      const perm = await prisma.permission.upsert({
        where: { action_subject: { action: act, subject: subj } },
        update: {},
        create: {
          action: act,
          subject: subj,
          description: `${act} on ${subj}`,
        },
      } as any);

      createdPerms.push(perm);
      console.log(`✅ Permission ensured: ${act}.${subj}`);
    }

    // Ensure unified 'admin' role exists (in Role table)
    let adminRole = await prisma.role.findUnique({ where: { code: 'admin' } });
    if (!adminRole) {
      adminRole = await prisma.role.create({ data: { code: 'admin', name: 'Administrator', description: 'System administrator', type: 'admin', isActive: true } });
      console.log('✅ Created unified role: admin');
    } else {
      console.log('⏭️  Unified role admin already exists');
    }

    // Attach permissions to admin role
    for (const perm of createdPerms) {
      const exists = await prisma.rolePermission.findFirst({ where: { roleId: adminRole.id, permissionId: perm.id } });
      if (!exists) {
        await prisma.rolePermission.create({ data: { roleId: adminRole.id, permissionId: perm.id } });
        console.log(`🔗 Linked ${perm.action}.${perm.subject} -> role:admin`);
      }
    }

    console.log('\n✨ Seeding admin permissions complete');
  } catch (err) {
    console.error('❌ Error seeding permissions:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();

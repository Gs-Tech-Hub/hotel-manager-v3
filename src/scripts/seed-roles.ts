/**
 * Seed Script for Roles
 * 
 * Usage:
 *   node --loader ts-node/esm src/scripts/seed-roles.ts
 * 
 * Or add to package.json:
 *   "seed:roles": "ts-node src/scripts/seed-roles.ts"
 *   npm run seed:roles
 */

import { prisma } from '@/lib/auth/prisma';

const DEFAULT_ROLES = [
  {
    code: 'admin',
    name: 'Administrator',
    description: 'Full system access and control',
  },
  {
    code: 'manager',
    name: 'Manager',
    description: 'Can manage hotel operations, staff, and reports',
  },
  {
    code: 'staff',
    name: 'Staff Member',
    description: 'Can perform daily operations (check-ins, orders, etc.)',
  },
  {
    code: 'customer',
    name: 'Customer',
    description: 'Limited access to own data and booking information',
  },
  {
    code: 'front-desk',
    name: 'Front Desk',
    description: 'Can manage check-ins, bookings, and customer info',
  },
  {
    code: 'inventory-manager',
    name: 'Inventory Manager',
    description: 'Can manage inventory items and movements',
  },
];

async function seedRoles() {
  console.log('🌱 Seeding roles...');

  try {
    for (const roleData of DEFAULT_ROLES) {
      const existing = await prisma.adminRole.findUnique({
        where: { code: roleData.code },
      });

      if (existing) {
        console.log(`⏭️  Role "${roleData.code}" already exists, skipping...`);
        continue;
      }

      const role = await prisma.adminRole.create({
        data: roleData,
      });

      console.log(`✅ Created role: ${role.code} (${role.name})`);
    }

    console.log('\n✨ Seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding roles:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedRoles();

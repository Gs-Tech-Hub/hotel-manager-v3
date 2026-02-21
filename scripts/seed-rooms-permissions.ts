/**
 * Seed script for Rooms, Reservations, Cleaning, and Maintenance permissions
 * Run: npm run seed:rooms:permissions
 */

import { prisma } from '@/lib/auth/prisma';

const ROOM_PERMISSIONS = [
  // Rooms & Unit Management
  { action: 'rooms.view', subject: 'rooms', description: 'View room inventory and details' },
  { action: 'rooms.manage', subject: 'rooms', description: 'Create, update, delete units and room types' },

  // Reservations
  { action: 'reservations.view', subject: 'reservations', description: 'View all reservations' },
  { action: 'reservations.create', subject: 'reservations', description: 'Create new reservations (booking)' },
  { action: 'reservations.modify', subject: 'reservations', description: 'Modify existing reservations' },
  { action: 'reservations.cancel', subject: 'reservations', description: 'Cancel reservations' },
  { action: 'reservations.checkin', subject: 'reservations', description: 'Check-in guests' },
  { action: 'reservations.checkout', subject: 'reservations', description: 'Check-out guests' },

  // Cleaning Management
  { action: 'cleaning.view', subject: 'cleaning', description: 'View cleaning tasks and schedule' },
  { action: 'cleaning.assign', subject: 'cleaning', description: 'Assign cleaning tasks to staff' },
  { action: 'cleaning.work', subject: 'cleaning', description: 'Execute cleaning tasks (mark complete, log items)' },
  { action: 'cleaning.inspect', subject: 'cleaning', description: 'QA inspect cleaning tasks' },

  // Maintenance Management
  { action: 'maintenance.view', subject: 'maintenance', description: 'View maintenance requests and history' },
  { action: 'maintenance.request', subject: 'maintenance', description: 'Create maintenance work orders' },
  { action: 'maintenance.assign', subject: 'maintenance', description: 'Assign work orders to technicians' },
  { action: 'maintenance.work', subject: 'maintenance', description: 'Execute maintenance work (log progress, mark complete)' },
  { action: 'maintenance.verify', subject: 'maintenance', description: 'Verify/sign-off on completed maintenance' },

  // Pricing
  { action: 'pricing.manage', subject: 'pricing', description: 'Set base prices, create seasonal overrides' },
];

const ROLES_WITH_PERMISSIONS: Record<string, string[]> = {
  admin: [
    // Admin has all permissions
    'rooms.view',
    'rooms.manage',
    'reservations.view',
    'reservations.create',
    'reservations.modify',
    'reservations.cancel',
    'reservations.checkin',
    'reservations.checkout',
    'cleaning.view',
    'cleaning.assign',
    'cleaning.work',
    'cleaning.inspect',
    'maintenance.view',
    'maintenance.request',
    'maintenance.assign',
    'maintenance.work',
    'maintenance.verify',
    'pricing.manage',
  ],
  manager: [
    'rooms.manage',
    'reservations.view',
    'reservations.create',
    'reservations.modify',
    'reservations.cancel',
    'reservations.checkin',
    'reservations.checkout',
    'cleaning.inspect',
    'maintenance.view',
    'maintenance.verify',
    'pricing.manage',
  ],
  frontdesk: [
    'rooms.view',
    'reservations.view',
    'reservations.create',
    'reservations.modify',
    'reservations.checkin',
    'reservations.checkout',
    'cleaning.view',
  ],
  housekeeping: [
    'cleaning.view',
    'cleaning.work',
    'rooms.view',
  ],
  housekeeping_supervisor: [
    'cleaning.view',
    'cleaning.assign',
    'cleaning.work',
    'cleaning.inspect',
    'rooms.view',
  ],
  maintenance_tech: [
    'maintenance.view',
    'maintenance.work',
    'rooms.view',
  ],
  maintenance_manager: [
    'maintenance.view',
    'maintenance.request',
    'maintenance.assign',
    'maintenance.verify',
    'rooms.view',
  ],
};

async function seedPermissions() {
  console.log('🌱 Seeding rooms/reservations/cleaning/maintenance permissions...');

  try {
    // 1. Create/update permissions
    for (const perm of ROOM_PERMISSIONS) {
      await prisma.permission.upsert({
        where: {
          action_subject: {
            action: perm.action,
            subject: perm.subject || '',
          },
        },
        create: {
          action: perm.action,
          subject: perm.subject,
          description: perm.description,
        },
        update: {
          description: perm.description,
        },
      });
    }
    console.log(`✅ Seeded ${ROOM_PERMISSIONS.length} permissions`);

    // 2. Create/update roles and map permissions
    for (const [roleCode, actions] of Object.entries(ROLES_WITH_PERMISSIONS)) {
      // Find or create role
      const role = await prisma.role.upsert({
        where: { code: roleCode },
        create: {
          code: roleCode,
          name: roleCode.replace(/_/g, ' ').toUpperCase(),
          type: 'standard',
          isActive: true,
        },
        update: { isActive: true },
      });

      // Get permission IDs for these actions
      const permissions = await prisma.permission.findMany({
        where: {
          action: {
            in: actions,
          },
        },
      });

      // Clear existing role-permission mappings
      await prisma.rolePermission.deleteMany({
        where: { roleId: role.id },
      });

      // Create new mappings
      for (const perm of permissions) {
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: perm.id,
          },
        });
      }

      console.log(`✅ Mapped ${actions.length} permissions to role: ${roleCode}`);
    }

    console.log('✅ Rooms/reservations/cleaning/maintenance permissions seeded successfully');
  } catch (error) {
    console.error('❌ Error seeding permissions:', error);
    throw error;
  }
}

seedPermissions()
  .catch(console.error)
  .finally(() => process.exit(0));

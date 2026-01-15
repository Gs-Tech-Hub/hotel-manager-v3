/**
 * Seed Script for Employee Roles
 * Creates default roles and permissions for employee management
 * 
 * Usage:
 *   npm run seed:employee-roles
 */

import { prisma } from '@/lib/auth/prisma';

interface PermissionData {
  action: string;
  subject?: string;
  description?: string;
}

interface RoleData {
  code: string;
  name: string;
  description?: string;
  type?: string;
  permissions: PermissionData[];
}

const EMPLOYEE_ROLES: RoleData[] = [
  {
    code: 'staff',
    name: 'Staff Member',
    description: 'Basic staff with order and inventory access',
    type: 'employee',
    permissions: [
      { action: 'orders.create', subject: 'orders', description: 'Create orders' },
      { action: 'orders.read', subject: 'orders', description: 'View orders' },
      { action: 'orders.update', subject: 'orders', description: 'Update orders' },
      { action: 'inventory.read', subject: 'inventory', description: 'View inventory' },
      { action: 'roles.read', subject: 'roles', description: 'View roles' },
      { action: 'profile.read', subject: 'profile', description: 'View own profile' },
    ],
  },
  {
    code: 'manager',
    name: 'Manager',
    description: 'Can manage staff, orders, and reports',
    type: 'employee',
    permissions: [
      { action: 'orders.create', subject: 'orders', description: 'Create orders' },
      { action: 'orders.read', subject: 'orders', description: 'View orders' },
      { action: 'orders.update', subject: 'orders', description: 'Update orders' },
      { action: 'orders.delete', subject: 'orders', description: 'Delete orders' },
      { action: 'inventory.read', subject: 'inventory', description: 'View inventory' },
      { action: 'inventory.update', subject: 'inventory', description: 'Update inventory' },
      { action: 'inventory.transfer', subject: 'inventory', description: 'Transfer inventory' },
      { action: 'reports.read', subject: 'reports', description: 'View reports' },
      { action: 'roles.read', subject: 'roles', description: 'View roles' },
      { action: 'roles.create', subject: 'roles', description: 'Create roles' },
      { action: 'staff.read', subject: 'staff', description: 'View staff' },
      { action: 'profile.read', subject: 'profile', description: 'View own profile' },
    ],
  },
  {
    code: 'kitchen-staff',
    name: 'Kitchen Staff',
    description: 'Kitchen operations and order fulfillment',
    type: 'employee',
    permissions: [
      { action: 'orders.read', subject: 'orders', description: 'View orders' },
      { action: 'orders.update', subject: 'orders', description: 'Update order status' },
      { action: 'inventory.read', subject: 'inventory', description: 'View inventory' },
      { action: 'roles.read', subject: 'roles', description: 'View roles' },
      { action: 'profile.read', subject: 'profile', description: 'View own profile' },
    ],
  },
  {
    code: 'bar-staff',
    name: 'Bar Staff',
    description: 'Bar operations and beverage inventory',
    type: 'employee',
    permissions: [
      { action: 'orders.read', subject: 'orders', description: 'View orders' },
      { action: 'orders.update', subject: 'orders', description: 'Update order status' },
      { action: 'inventory.read', subject: 'inventory', description: 'View inventory' },
      { action: 'roles.read', subject: 'roles', description: 'View roles' },
      { action: 'profile.read', subject: 'profile', description: 'View own profile' },
    ],
  },
  {
    code: 'front-desk',
    name: 'Front Desk',
    description: 'Booking and check-in management',
    type: 'employee',
    permissions: [
      { action: 'bookings.read', subject: 'bookings', description: 'View bookings' },
      { action: 'bookings.create', subject: 'bookings', description: 'Create bookings' },
      { action: 'bookings.update', subject: 'bookings', description: 'Update bookings' },
      { action: 'rooms.read', subject: 'rooms', description: 'View rooms' },
      { action: 'orders.read', subject: 'orders', description: 'View orders' },
      { action: 'roles.read', subject: 'roles', description: 'View roles' },
      { action: 'profile.read', subject: 'profile', description: 'View own profile' },
    ],
  },
  {
    code: 'inventory-manager',
    name: 'Inventory Manager',
    description: 'Full inventory management and control',
    type: 'employee',
    permissions: [
      { action: 'inventory.read', subject: 'inventory', description: 'View inventory' },
      { action: 'inventory.create', subject: 'inventory', description: 'Create inventory items' },
      { action: 'inventory.update', subject: 'inventory', description: 'Update inventory' },
      { action: 'inventory.delete', subject: 'inventory', description: 'Delete inventory' },
      { action: 'inventory.transfer', subject: 'inventory', description: 'Transfer inventory' },
      { action: 'reports.read', subject: 'reports', description: 'View reports' },
      { action: 'roles.read', subject: 'roles', description: 'View roles' },
      { action: 'profile.read', subject: 'profile', description: 'View own profile' },
    ],
  },
  {
    code: 'viewer',
    name: 'Viewer',
    description: 'Read-only access to view data',
    type: 'employee',
    permissions: [
      { action: 'orders.read', subject: 'orders', description: 'View orders' },
      { action: 'inventory.read', subject: 'inventory', description: 'View inventory' },
      { action: 'bookings.read', subject: 'bookings', description: 'View bookings' },
      { action: 'reports.read', subject: 'reports', description: 'View reports' },
      { action: 'roles.read', subject: 'roles', description: 'View roles' },
      { action: 'profile.read', subject: 'profile', description: 'View own profile' },
    ],
  },
];

async function seedEmployeeRoles() {
  console.log('🌱 Seeding employee roles and permissions...\n');

  try {
    // First, ensure all permissions exist
    console.log('📝 Creating permissions...');
    const permissionsToCreate = new Map<string, PermissionData>();

    for (const role of EMPLOYEE_ROLES) {
      for (const perm of role.permissions) {
        const key = `${perm.action}:${perm.subject || ''}`;
        if (!permissionsToCreate.has(key)) {
          permissionsToCreate.set(key, perm);
        }
      }
    }

    const createdPermissions = new Map<string, { id: string }>();

    for (const [key, permData] of permissionsToCreate) {
      const existing = await prisma.permission.findFirst({
        where: {
          action: permData.action,
          subject: permData.subject || null,
        },
      });

      if (existing) {
        createdPermissions.set(key, { id: existing.id });
        console.log(`  ⏭️  Permission "${permData.action}" already exists`);
      } else {
        const perm = await prisma.permission.create({
          data: {
            action: permData.action,
            subject: permData.subject,
            description: permData.description,
          },
        });
        createdPermissions.set(key, { id: perm.id });
        console.log(`  ✅ Created permission: "${permData.action}"`);
      }
    }

    console.log('\n🎭 Creating roles...');

    // Now create roles and link permissions
    for (const roleData of EMPLOYEE_ROLES) {
      const existing = await prisma.role.findUnique({
        where: { code: roleData.code },
      });

      if (existing) {
        console.log(`  ⏭️  Role "${roleData.code}" already exists, updating permissions...\n`);
        
        // Update permissions for existing role
        const newPermissionIds = roleData.permissions
          .map((p) => {
            const key = `${p.action}:${p.subject || ''}`;
            return createdPermissions.get(key)?.id;
          })
          .filter(Boolean) as string[];

        // Remove old permissions
        await prisma.rolePermission.deleteMany({
          where: { roleId: existing.id },
        });

        // Add new permissions
        await Promise.all(
          newPermissionIds.map((permId) =>
            prisma.rolePermission.create({
              data: {
                roleId: existing.id,
                permissionId: permId,
              },
            })
          )
        );

        console.log(`  ✅ Updated ${newPermissionIds.length} permissions for role "${roleData.code}"`);
      } else {
        const role = await prisma.role.create({
          data: {
            code: roleData.code,
            name: roleData.name,
            description: roleData.description,
            type: roleData.type || 'standard',
            isActive: true,
          },
        });

        // Link permissions to this role
        const permissionIds = roleData.permissions
          .map((p) => {
            const key = `${p.action}:${p.subject || ''}`;
            return createdPermissions.get(key)?.id;
          })
          .filter(Boolean) as string[];

        await Promise.all(
          permissionIds.map((permId) =>
            prisma.rolePermission.create({
              data: {
                roleId: role.id,
                permissionId: permId,
              },
            })
          )
        );

        console.log(
          `✅ Created role: "${role.code}" (${role.name}) with ${permissionIds.length} permissions`
        );
      }
    }

    console.log('\n✨ Employee roles seeding completed successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`  - Total roles: ${EMPLOYEE_ROLES.length}`);
    console.log(`  - Total permissions: ${permissionsToCreate.size}`);
  } catch (error) {
    console.error('❌ Error seeding employee roles:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedEmployeeRoles();

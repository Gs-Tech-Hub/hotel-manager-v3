import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Core application seeding script - UNIFIED VERSION
 * 
 * Seeds all essential application-dependent data:
 * - Complete role hierarchy with comprehensive permissions
 * - Admin user
 * - Organization configuration
 * - Canonical departments
 * - All position/department mappings
 *
 * This is the SINGLE SOURCE OF TRUTH for core application setup.
 * Other seed files (seed-permissions.ts, seed-employee-roles.ts) are deprecated.
 * 
 * Does NOT seed demo data (customers, menu items, orders, etc.)
 * 
 * Usage:
 *   npm run seed:core
 */

// Small helper to retry transient Prisma errors
async function withRetries<T>(fn: () => Promise<T>, attempts = 3, delayMs = 200) {
  let lastErr: any = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const transientCodes = ['P5010', 'P2028', 'P6005'];
      const code = err?.code;
      if (!transientCodes.includes(code) && i === attempts - 1) throw err;
      await new Promise((res) => setTimeout(res, delayMs * Math.pow(2, i)));
    }
  }
  throw lastErr;
}

async function ensureOrganization() {
  console.log('Seeding organization...');

  const org = await withRetries(() =>
    prisma.organisationInfo.upsert({
      where: { id: '1' },
      update: {},
      create: {
        id: '1',
        name: process.env.ORG_NAME || 'Hotel Manager',
        address: process.env.ORG_ADDRESS || '123 Main Street',
        phone: process.env.ORG_PHONE || '+1234567890',
        email: process.env.ORG_EMAIL || 'hotel@manager.test',
        website: process.env.ORG_WEBSITE || null,
        logoDark: process.env.ORG_LOGO_DARK || null,
        logoLight: process.env.ORG_LOGO_LIGHT || null,
        facebook: process.env.ORG_FACEBOOK || null,
        instagram: process.env.ORG_INSTAGRAM || null,
        twitter: process.env.ORG_TWITTER || null,
        youTube: process.env.ORG_YOUTUBE || null,
        currency: process.env.ORG_CURRENCY || 'USD',
      },
    })
  );

  console.log(`✓ Organization ready: ${org.name}`);
  return org;
}

async function seedAdminRoles() {
  console.log('Seeding admin roles and permissions...');

  const rolesToSeed = [
    { code: 'admin', name: 'Administrator', description: 'Full system administrator access' },
    { code: 'manager', name: 'Manager', description: 'Manager with elevated permissions' },
    { code: 'staff', name: 'Staff', description: 'General staff member' },
  ];

  const adminRoles: Record<string, any> = {};

  for (const roleData of rolesToSeed) {
    const existing = await withRetries(() =>
      prisma.adminRole.findUnique({ where: { code: roleData.code } })
    );
    if (existing) {
      adminRoles[roleData.code] = existing;
    } else {
      adminRoles[roleData.code] = await withRetries(() =>
        prisma.adminRole.create({
          data: {
            code: roleData.code,
            name: roleData.name,
            description: roleData.description,
          },
        })
      );
    }
  }

  // Seed comprehensive admin permissions
  const permissions = [
    { action: 'manage', subject: '*' },
    { action: 'manage', subject: 'Order' },
    { action: 'manage', subject: 'Department' },
    { action: 'manage', subject: 'Restaurant' },
    { action: 'manage', subject: 'Drink' },
    { action: 'manage', subject: 'Payment' },
    { action: 'manage', subject: 'Booking' },
    { action: 'manage', subject: 'User' },
    { action: 'read', subject: 'AdminUser' },
    { action: 'manage', subject: 'AdminUser' },
    { action: 'manage', subject: 'inventory' },
    { action: 'manage', subject: 'section' },
    { action: 'manage', subject: 'discount' },
    { action: 'manage', subject: 'extra' },
  ];

  const adminRole = adminRoles['admin'];
  if (adminRole) {
    for (const perm of permissions) {
      const existing = await withRetries(() =>
        prisma.adminPermission.findFirst({
          where: {
            roleId: adminRole.id,
            action: perm.action,
            subject: perm.subject,
          },
        })
      );

      if (!existing) {
        await withRetries(() =>
          prisma.adminPermission.create({
            data: {
              action: perm.action,
              subject: perm.subject,
              roleId: adminRole.id,
              actionParameters: {},
              conditions: [],
              properties: {},
            } as any,
          })
        );
      }
    }
  }

  console.log(`✓ Seeded ${Object.keys(adminRoles).length} admin roles with permissions`);
  return adminRoles;
}

async function seedRoles() {
  console.log('Seeding unified roles...');

  interface RoleData {
    code: string;
    name: string;
    description: string;
  }

  // Comprehensive role list including department-scoped roles
  const rolesToSeed: RoleData[] = [
    // Core roles
    { code: 'admin', name: 'Administrator', description: 'Full system administrator access' },
    { code: 'manager', name: 'Manager', description: 'General manager with elevated permissions' },
    { code: 'staff', name: 'Staff', description: 'General staff member with limited access' },
    { code: 'employee', name: 'Employee', description: 'Basic employee with minimal access' },
    { code: 'cashier', name: 'Cashier', description: 'Cashier for payment processing' },
    { code: 'accountant', name: 'Accountant', description: 'Finance and accounting management' },
    
    // Management roles
    { code: 'pos_manager', name: 'POS Manager', description: 'Manages POS system and cashiers' },
    { code: 'inventory_staff', name: 'Inventory Staff', description: 'Full inventory management' },
    
    // Department-scoped roles
    { code: 'kitchen_staff', name: 'Kitchen Staff', description: 'Kitchen operations and order fulfillment' },
    { code: 'bar_staff', name: 'Bartender', description: 'Bar operations and beverage inventory' },
    { code: 'pos_staff', name: 'POS Staff', description: 'Point of sale operations' },
    { code: 'housekeeping_staff', name: 'Housekeeping Staff', description: 'Room cleaning and maintenance' },
    { code: 'front_desk', name: 'Front Desk Staff', description: 'Guest check-in/check-out and room management' },
    { code: 'customer_service', name: 'Customer Service Representative', description: 'Manages bookings and customer inquiries' },
    
    // Legacy/compatibility
    { code: 'receptionist', name: 'Receptionist', description: 'Receptionist (legacy name, same as Front Desk)' },
    { code: 'terminal_operator', name: 'Terminal Operator', description: 'POS terminal access and operations' },
  ];

  const roles: Record<string, any> = {};

  for (const roleData of rolesToSeed) {
    const existing = await withRetries(() =>
      prisma.role.findUnique({ where: { code: roleData.code } })
    );
    if (existing) {
      roles[roleData.code] = existing;
    } else {
      roles[roleData.code] = await withRetries(() =>
        prisma.role.create({
          data: {
            code: roleData.code,
            name: roleData.name,
            description: roleData.description,
          },
        })
      );
    }
  }

  console.log(`✓ Seeded ${Object.keys(roles).length} unified roles`);
  return roles;
}

async function seedPermissions(roles: Record<string, any>) {
  console.log('Seeding comprehensive permissions for all roles...');

  interface PermissionData {
    action: string;
    subject?: string | null;
  }

  interface PermissionSetData {
    [roleCode: string]: PermissionData[];
  }

  const permissionSets: PermissionSetData = {
    // ==================== ADMIN ====================
    admin: [
      { action: '*', subject: '*' }, // Full access
      { action: 'admin.view', subject: 'users' },
      { action: 'admin.create', subject: 'users' },
      { action: 'admin.edit', subject: 'users' },
      { action: 'admin.delete', subject: 'users' },
      { action: 'admin.manage', subject: 'roles' },
    ],

    // ==================== MANAGER ====================
    manager: [
      { action: 'dashboard.read', subject: 'dashboard' },
      { action: 'orders.read', subject: 'orders' },
      { action: 'orders.create', subject: 'orders' },
      { action: 'orders.update', subject: 'orders' },
      { action: 'orders.cancel', subject: 'orders' },
      { action: 'payments.read', subject: 'payments' },
      { action: 'payments.process', subject: 'payments' },
      { action: 'payments.refund', subject: 'payments' },
      { action: 'inventory.read', subject: 'inventory' },
      { action: 'inventory.update', subject: 'inventory' },
      { action: 'inventory.transfer', subject: 'inventory' },
      { action: 'extras.read', subject: 'extras' },
      { action: 'extras.create', subject: 'extras' },
      { action: 'extras.update', subject: 'extras' },
      { action: 'extras.delete', subject: 'extras' },
      { action: 'extras.allocate', subject: 'extras' },
      { action: 'extras.transfer', subject: 'extras' },
      { action: 'bookings.read', subject: 'bookings' },
      { action: 'bookings.create', subject: 'bookings' },
      { action: 'bookings.update', subject: 'bookings' },
      { action: 'bookings.checkout', subject: 'bookings' },
      { action: 'rooms.read', subject: 'rooms' },
      { action: 'rooms.update', subject: 'rooms' },
      { action: 'customers.read', subject: 'customers' },
      { action: 'customers.create', subject: 'customers' },
      { action: 'customers.update', subject: 'customers' },
      { action: 'discounts.read', subject: 'discounts' },
      { action: 'discounts.create', subject: 'discounts' },
      { action: 'discounts.update', subject: 'discounts' },
      { action: 'discounts.delete', subject: 'discounts' },
      { action: 'departments.read', subject: 'departments' },
      { action: 'departments.update', subject: 'departments' },
      { action: 'employees.read', subject: 'employees' },
      { action: 'employees.create', subject: 'employees' },
      { action: 'employees.update', subject: 'employees' },
      { action: 'employees.delete', subject: 'employees' },
      { action: 'reports.read', subject: 'reports' },
      { action: 'reports.generate', subject: 'reports' },
      { action: 'reports.export', subject: 'reports' },
      { action: 'analytics.read', subject: 'analytics' },
    ],

    // ==================== POS MANAGER ====================
    pos_manager: [
      { action: 'dashboard.read', subject: 'dashboard' },
      { action: 'orders.read', subject: 'orders' },
      { action: 'orders.create', subject: 'orders' },
      { action: 'orders.update', subject: 'orders' },
      { action: 'orders.delete', subject: 'orders' },
      { action: 'orders.cancel', subject: 'orders' },
      { action: 'payments.read', subject: 'payments' },
      { action: 'payments.process', subject: 'payments' },
      { action: 'payments.refund', subject: 'payments' },
      { action: 'inventory.read', subject: 'inventory' },
      { action: 'inventory.update', subject: 'inventory' },
      { action: 'inventory.transfer', subject: 'inventory' },
      { action: 'extras.read', subject: 'extras' },
      { action: 'bookings.read', subject: 'bookings' },
      { action: 'rooms.read', subject: 'rooms' },
      { action: 'departments.read', subject: 'departments' },
      { action: 'departments.update', subject: 'departments' },
      { action: 'discounts.read', subject: 'discounts' },
      { action: 'reports.read', subject: 'reports' },
      { action: 'reports.generate', subject: 'reports' },
      { action: 'reports.export', subject: 'reports' },
    ],

    // ==================== INVENTORY STAFF ====================
    inventory_staff: [
      { action: 'dashboard.read', subject: 'dashboard' },
      { action: 'inventory.read', subject: 'inventory' },
      { action: 'inventory.create', subject: 'inventory' },
      { action: 'inventory.update', subject: 'inventory' },
      { action: 'inventory.delete', subject: 'inventory' },
      { action: 'inventory.transfer', subject: 'inventory' },
      { action: 'extras.read', subject: 'extras' },
      { action: 'extras.create', subject: 'extras' },
      { action: 'extras.update', subject: 'extras' },
      { action: 'extras.delete', subject: 'extras' },
      { action: 'extras.allocate', subject: 'extras' },
      { action: 'extras.transfer', subject: 'extras' },
      { action: 'departments.read', subject: 'departments' },
      { action: 'reports.read', subject: 'reports' },
    ],

    // ==================== ACCOUNTANT ====================
    accountant: [
      { action: 'dashboard.read', subject: 'dashboard' },
      { action: 'payments.read', subject: 'payments' },
      { action: 'payments.process', subject: 'payments' },
      { action: 'payments.refund', subject: 'payments' },
      { action: 'orders.read', subject: 'orders' },
      { action: 'inventory.read', subject: 'inventory' },
      { action: 'bookings.read', subject: 'bookings' },
      { action: 'discounts.read', subject: 'discounts' },
      { action: 'departments.read', subject: 'departments' },
      { action: 'reports.read', subject: 'reports' },
      { action: 'reports.generate', subject: 'reports' },
      { action: 'reports.export', subject: 'reports' },
      { action: 'analytics.read', subject: 'analytics' },
    ],

    // ==================== CASHIER ====================
    cashier: [
      { action: 'orders.read', subject: 'orders' },
      { action: 'orders.create', subject: 'orders' },
      { action: 'orders.update', subject: 'orders' },
      { action: 'payments.read', subject: 'payments' },
      { action: 'payments.process', subject: 'payments' },
      { action: 'payments.refund', subject: 'payments' },
      { action: 'inventory.read', subject: 'inventory' },
      { action: 'departments.read', subject: 'departments' },
      { action: 'discounts.read', subject: 'discounts' },
    ],

    // ==================== STAFF ====================
    staff: [
      { action: 'dashboard.read', subject: 'dashboard' },
      { action: 'orders.read', subject: 'orders' },
      { action: 'orders.create', subject: 'orders' },
      { action: 'orders.update', subject: 'orders' },
      { action: 'payments.read', subject: 'payments' },
      { action: 'inventory.read', subject: 'inventory' },
      { action: 'bookings.read', subject: 'bookings' },
      { action: 'departments.read', subject: 'departments' },
      { action: 'reports.read', subject: 'reports' },
    ],

    // ==================== EMPLOYEE ====================
    employee: [
      { action: 'dashboard.read', subject: 'dashboard' },
      { action: 'orders.read', subject: 'orders' },
      { action: 'inventory.read', subject: 'inventory' },
      { action: 'bookings.read', subject: 'bookings' },
      { action: 'departments.read', subject: 'departments' },
    ],

    // ==================== KITCHEN STAFF ====================
    kitchen_staff: [
      { action: 'orders.read', subject: 'orders' },
      { action: 'orders.update', subject: 'orders' },
      { action: 'inventory.read', subject: 'inventory' },
      { action: 'departments.read', subject: 'departments' },
    ],

    // ==================== BAR STAFF ====================
    bar_staff: [
      { action: 'orders.read', subject: 'orders' },
      { action: 'orders.update', subject: 'orders' },
      { action: 'inventory.read', subject: 'inventory' },
      { action: 'departments.read', subject: 'departments' },
      { action: 'departments.update', subject: 'departments' },
    ],

    // ==================== POS STAFF ====================
    pos_staff: [
      { action: 'orders.read', subject: 'orders' },
      { action: 'orders.create', subject: 'orders' },
      { action: 'orders.update', subject: 'orders' },
      { action: 'inventory.read', subject: 'inventory' },
      { action: 'departments.read', subject: 'departments' },
      { action: 'discounts.read', subject: 'discounts' },
    ],

    // ==================== HOUSEKEEPING STAFF ====================
    housekeeping_staff: [
      { action: 'rooms.read', subject: 'rooms' },
      { action: 'rooms.update', subject: 'rooms' },
      { action: 'bookings.read', subject: 'bookings' },
      { action: 'inventory.read', subject: 'inventory' },
      { action: 'departments.read', subject: 'departments' },
    ],

    // ==================== FRONT DESK ====================
    front_desk: [
      { action: 'bookings.read', subject: 'bookings' },
      { action: 'bookings.create', subject: 'bookings' },
      { action: 'bookings.update', subject: 'bookings' },
      { action: 'bookings.checkout', subject: 'bookings' },
      { action: 'customers.read', subject: 'customers' },
      { action: 'customers.create', subject: 'customers' },
      { action: 'customers.update', subject: 'customers' },
      { action: 'rooms.read', subject: 'rooms' },
      { action: 'rooms.update', subject: 'rooms' },
      { action: 'orders.read', subject: 'orders' },
      { action: 'departments.read', subject: 'departments' },
      { action: 'discounts.read', subject: 'discounts' },
    ],

    // ==================== CUSTOMER SERVICE ====================
    customer_service: [
      { action: 'bookings.read', subject: 'bookings' },
      { action: 'bookings.create', subject: 'bookings' },
      { action: 'bookings.update', subject: 'bookings' },
      { action: 'customers.read', subject: 'customers' },
      { action: 'customers.create', subject: 'customers' },
      { action: 'customers.update', subject: 'customers' },
      { action: 'rooms.read', subject: 'rooms' },
      { action: 'orders.read', subject: 'orders' },
      { action: 'departments.read', subject: 'departments' },
      { action: 'discounts.read', subject: 'discounts' },
    ],

    // ==================== RECEPTIONIST (legacy, same as front_desk) ====================
    receptionist: [
      { action: 'bookings.read', subject: 'bookings' },
      { action: 'bookings.create', subject: 'bookings' },
      { action: 'bookings.update', subject: 'bookings' },
      { action: 'bookings.checkout', subject: 'bookings' },
      { action: 'customers.read', subject: 'customers' },
      { action: 'customers.create', subject: 'customers' },
      { action: 'customers.update', subject: 'customers' },
      { action: 'rooms.read', subject: 'rooms' },
      { action: 'rooms.update', subject: 'rooms' },
      { action: 'orders.read', subject: 'orders' },
      { action: 'departments.read', subject: 'departments' },
      { action: 'discounts.read', subject: 'discounts' },
    ],

    // ==================== TERMINAL OPERATOR ====================
    terminal_operator: [
      { action: 'orders.read', subject: 'orders' },
      { action: 'orders.create', subject: 'orders' },
      { action: 'orders.update', subject: 'orders' },
      { action: 'orders.delete', subject: 'orders' },
      { action: 'payments.read', subject: 'payments' },
      { action: 'payments.process', subject: 'payments' },
      { action: 'pos_terminal.access', subject: 'terminal' },
      { action: 'inventory.read', subject: 'inventory' },
      { action: 'departments.read', subject: 'departments' },
      { action: 'discounts.read', subject: 'discounts' },
    ],
  };

  let totalPermissions = 0;
  const createdRolePermissions: Set<string> = new Set();

  for (const [roleCode, permissions] of Object.entries(permissionSets)) {
    const role = roles[roleCode];
    if (!role) {
      console.warn(`  ⚠️  Role "${roleCode}" not found, skipping permissions`);
      continue;
    }

    for (const perm of permissions) {
      // First, get or create the permission (unique by action+subject)
      const permission = await withRetries(() =>
        prisma.permission.upsert({
          where: { action_subject: { action: perm.action, subject: perm.subject || '' } },
          update: {},
          create: {
            action: perm.action,
            subject: perm.subject || null,
          },
        })
      );

      // Then, check if role already has this permission
      const rolePermKey = `${role.id}:${permission.id}`;
      if (createdRolePermissions.has(rolePermKey)) continue;

      const existing = await withRetries(() =>
        prisma.rolePermission.findUnique({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id,
            },
          },
        })
      );

      if (!existing) {
        await withRetries(() =>
          prisma.rolePermission.create({
            data: {
              roleId: role.id,
              permissionId: permission.id,
            },
          })
        );
        totalPermissions++;
      }
      createdRolePermissions.add(rolePermKey);
    }
  }

  console.log(`✓ Seeded ${totalPermissions} role-permission links`);
}

async function ensureAdminUserWithRole(
  adminRoles: Record<string, any>,
  roles: Record<string, any>,
  email = process.env.SEED_ADMIN_EMAIL || 'admin@hotel.test',
  password = process.env.SEED_ADMIN_PASSWORD || 'admin123'
) {
  console.log('Seeding admin user...');

  const adminRole = adminRoles['admin'];
  if (!adminRole) throw new Error('Admin role not found');

  // Delete existing admin user to reset permissions
  const existing = await withRetries(() =>
    prisma.adminUser.findUnique({ where: { email } })
  );

  if (existing) {
    // Delete associated admin role assignments
    await withRetries(() =>
      prisma.adminUser.update({
        where: { email },
        data: {
          roles: { disconnect: [] }, // Clear all roles
        },
      })
    );

    // Delete the user
    await withRetries(() =>
      prisma.adminUser.delete({
        where: { email },
      })
    );
  }

  // Create fresh admin user with proper role
  const hashed = await bcrypt.hash(password, 10);
  const user = await withRetries(() =>
    prisma.adminUser.create({
      data: {
        email,
        username: 'admin',
        password: hashed,
        isActive: true,
        roles: {
          connect: {
            id: adminRole.id,
          },
        },
      },
    })
  );

  console.log(`✓ Admin user created and assigned admin role: ${email}`);

  // Also assign to unified RBAC system
  if (roles.admin) {
    const existingUserRole = await withRetries(() =>
      prisma.userRole.findFirst({
        where: {
          userId: user.id,
          userType: 'admin',
          roleId: roles.admin.id,
        },
      })
    );

    if (!existingUserRole) {
      await withRetries(() =>
        prisma.userRole.create({
          data: {
            userId: user.id,
            userType: 'admin',
            roleId: roles.admin.id,
            grantedAt: new Date(),
            grantedBy: user.id,
          },
        })
      );
      console.log(`✓ Admin user also assigned to unified admin role`);
    }
  }

  return user;
}

async function seedCanonicalDepartments() {
  console.log('Seeding canonical departments...');

  const departments = [
    { code: 'restaurant', name: 'Restaurant', description: 'Restaurant department' },
    { code: 'bar', name: 'Bar', description: 'Bar department' },
    { code: 'service', name: 'Service', description: 'Service department' },
    { code: 'reception', name: 'Reception', description: 'Reception department' },
    { code: 'housekeeping', name: 'Housekeeping', description: 'Housekeeping department' },
  ];

  let created = 0;

  for (const dept of departments) {
    const existing = await withRetries(() =>
      prisma.department.findUnique({ where: { code: dept.code } })
    );

    if (!existing) {
      await withRetries(() =>
        prisma.department.create({
          data: {
            code: dept.code,
            name: dept.name,
            description: dept.description,
          },
        })
      );
      created++;
    }
  }

  console.log(`✓ Seeded ${created} canonical departments`);
}

async function main() {
  try {
    console.log('\n🌱 Starting core application seed...\n');

    // Seed in order
    await ensureOrganization();
    const adminRoles = await seedAdminRoles();
    const roles = await seedRoles();
    await seedPermissions(roles);
    await ensureAdminUserWithRole(adminRoles, roles);
    await seedCanonicalDepartments();

    console.log('\n✅ Core application seed completed successfully.\n');
  } catch (err) {
    console.error('\n❌ Seed failed:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

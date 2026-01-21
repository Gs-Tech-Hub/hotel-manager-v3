import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Core application seeding script.
 * Seeds only application-dependent data:
 * - Roles and permissions (admin, manager, staff, employee, cashier)
 * - Admin user
 * - Organization configuration
 * - Canonical departments
 *
 * Does NOT seed demo data (customers, menu items, orders, etc.)
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
  console.log('Seeding roles...');

  const rolesToSeed = [
    { code: 'admin', name: 'Administrator', description: 'Full system administrator access' },
    { code: 'manager', name: 'Manager', description: 'Manager with elevated permissions' },
    { code: 'staff', name: 'Staff', description: 'Department staff with limited operational access' },
    { code: 'cashier', name: 'Cashier', description: 'Cashier for payment processing' },
    { code: 'accountant', name: 'Accountant', description: 'Finance and accounting management' },
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

  console.log(`✓ Seeded ${Object.keys(roles).length} roles`);
  return roles;
}

async function seedPermissions(roles: Record<string, any>) {
  console.log('Seeding permissions...');

  const permissionSets: Record<string, Array<{ action: string; subject: string | null }>> = {
    admin: [
      // Wildcard - full access
      { action: '*', subject: '*' },
      
      // Admin & Users
      { action: 'admin', subject: 'view' },
      { action: 'admin', subject: 'create' },
      { action: 'admin', subject: 'edit' },
      { action: 'admin', subject: 'delete' },
      { action: 'admin', subject: 'manage' },
      { action: 'users', subject: 'create' },
      { action: 'users', subject: 'read' },
      { action: 'users', subject: 'update' },
      { action: 'users', subject: 'delete' },
      
      // Roles & Permissions
      { action: 'roles', subject: 'create' },
      { action: 'roles', subject: 'read' },
      { action: 'roles', subject: 'update' },
      { action: 'roles', subject: 'delete' },
      { action: 'permissions', subject: 'create' },
      { action: 'permissions', subject: 'read' },
      { action: 'permissions', subject: 'update' },
      { action: 'permissions', subject: 'delete' },
      
      // Orders
      { action: 'orders', subject: 'create' },
      { action: 'orders', subject: 'read' },
      { action: 'orders', subject: 'update' },
      { action: 'orders', subject: 'delete' },
      { action: 'orders', subject: 'cancel' },
      
      // Payments
      { action: 'payments', subject: 'read' },
      { action: 'payments', subject: 'process' },
      { action: 'payments', subject: 'refund' },
      
      // Inventory
      { action: 'inventory', subject: 'read' },
      { action: 'inventory', subject: 'create' },
      { action: 'inventory', subject: 'update' },
      { action: 'inventory', subject: 'delete' },
      { action: 'inventory', subject: 'transfer' },
      { action: 'inventory_items', subject: 'create' },
      { action: 'inventory_items', subject: 'read' },
      { action: 'inventory_items', subject: 'update' },
      { action: 'inventory_items', subject: 'delete' },
      
      // Bookings
      { action: 'bookings', subject: 'create' },
      { action: 'bookings', subject: 'read' },
      { action: 'bookings', subject: 'update' },
      { action: 'bookings', subject: 'delete' },
      { action: 'bookings', subject: 'checkin' },
      { action: 'bookings', subject: 'checkout' },
      
      // Departments & Sections
      { action: 'departments', subject: 'read' },
      { action: 'departments', subject: 'create' },
      { action: 'departments', subject: 'update' },
      { action: 'departments', subject: 'delete' },
      { action: 'department_sections', subject: 'create' },
      { action: 'department_sections', subject: 'read' },
      { action: 'department_sections', subject: 'update' },
      { action: 'department_sections', subject: 'delete' },
      
      // Discounts & Extras
      { action: 'discounts', subject: 'create' },
      { action: 'discounts', subject: 'read' },
      { action: 'discounts', subject: 'update' },
      { action: 'discounts', subject: 'delete' },
      { action: 'extras', subject: 'create' },
      { action: 'extras', subject: 'read' },
      { action: 'extras', subject: 'update' },
      { action: 'extras', subject: 'delete' },
      
      // Employees
      { action: 'employees', subject: 'create' },
      { action: 'employees', subject: 'read' },
      { action: 'employees', subject: 'update' },
      { action: 'employees', subject: 'delete' },
      
      // Reports & Analytics
      { action: 'reports', subject: 'read' },
      { action: 'reports', subject: 'generate' },
      { action: 'reports', subject: 'export' },
      { action: 'analytics', subject: 'read' },
    ],
    manager: [
      // Orders
      { action: 'orders', subject: 'read' },
      { action: 'orders', subject: 'create' },
      { action: 'orders', subject: 'update' },
      { action: 'orders', subject: 'cancel' },
      
      // Payments
      { action: 'payments', subject: 'read' },
      { action: 'payments', subject: 'process' },
      { action: 'payments', subject: 'refund' },
      
      // Inventory
      { action: 'inventory', subject: 'read' },
      { action: 'inventory', subject: 'update' },
      { action: 'inventory', subject: 'transfer' },
      
      // Inventory Items
      { action: 'inventory_items', subject: 'read' },
      
      // Bookings
      { action: 'bookings', subject: 'read' },
      { action: 'bookings', subject: 'create' },
      { action: 'bookings', subject: 'update' },
      { action: 'bookings', subject: 'checkin' },
      { action: 'bookings', subject: 'checkout' },
      
      // Departments
      { action: 'departments', subject: 'read' },
      
      // Department Sections
      { action: 'department_sections', subject: 'read' },
      
      // Discounts
      { action: 'discounts', subject: 'read' },
      
      // Employees
      { action: 'employees', subject: 'read' },
      { action: 'employees', subject: 'update' },
      
      // Reports
      { action: 'reports', subject: 'read' },
      { action: 'reports', subject: 'generate' },
      { action: 'reports', subject: 'export' },
    ],
    staff: [
      // Orders (department scoped)
      { action: 'orders', subject: 'read' },
      { action: 'orders', subject: 'create' },
      
      // Payments (view only)
      { action: 'payments', subject: 'read' },
      
      // Inventory (view only)
      { action: 'inventory', subject: 'read' },
      { action: 'inventory_items', subject: 'read' },
      
      // Bookings (limited)
      { action: 'bookings', subject: 'read' },
      
      // Departments (read only)
      { action: 'departments', subject: 'read' },
      { action: 'department_sections', subject: 'read' },
      
      // Reports (read only)
      { action: 'reports', subject: 'read' },
    ],
    accountant: [
      // Payments (full financial access)
      { action: 'payments', subject: 'read' },
      { action: 'payments', subject: 'process' },
      { action: 'payments', subject: 'refund' },
      
      // Orders (view for accounting)
      { action: 'orders', subject: 'read' },
      
      // Inventory (cost tracking)
      { action: 'inventory', subject: 'read' },
      { action: 'inventory_items', subject: 'read' },
      
      // Bookings (revenue tracking)
      { action: 'bookings', subject: 'read' },
      
      // Discounts (financial impact)
      { action: 'discounts', subject: 'read' },
      
      // Reports (financial reporting)
      { action: 'reports', subject: 'read' },
      { action: 'reports', subject: 'generate' },
      { action: 'reports', subject: 'export' },
      
      // Analytics (financial insights)
      { action: 'analytics', subject: 'read' },
    ],
    cashier: [
      // Orders
      { action: 'orders', subject: 'read' },
      { action: 'orders', subject: 'create' },
      { action: 'orders', subject: 'update' },
      
      // Payments (cashier focused)
      { action: 'payments', subject: 'read' },
      { action: 'payments', subject: 'process' },
      { action: 'payments', subject: 'refund' },
      
      // Inventory (read-only for reference)
      { action: 'inventory', subject: 'read' },
      
      // Inventory Items
      { action: 'inventory_items', subject: 'read' },
      
      // Departments
      { action: 'departments', subject: 'read' },
      
      // Department Sections
      { action: 'department_sections', subject: 'read' },
      
      // Reports (transactions)
      { action: 'reports', subject: 'read' },
    ],
  };

  let totalPermissions = 0;
  const createdRolePermissions: Set<string> = new Set();

  for (const [roleCode, permissions] of Object.entries(permissionSets)) {
    const role = roles[roleCode];
    if (!role) continue;

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
    // { code: 'kitchen', name: 'Kitchen', description: 'Kitchen department' },
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

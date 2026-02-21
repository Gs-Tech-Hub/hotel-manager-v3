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
  const timer = Date.now();
  console.log('→ Seeding organization...');

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

  const duration = Date.now() - timer;
  console.log(`✓ Organization ready: ${org.name} (${duration}ms)`);
  return org;
}

async function seedAdminRoles() {
  const timer = Date.now();
  console.log('→ Seeding admin roles and permissions...');

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

  const duration = Date.now() - timer;
  console.log(`✓ Seeded ${Object.keys(adminRoles).length} admin roles with permissions (${duration}ms)`);
  return adminRoles;
}

async function seedRoles() {
  const timer = Date.now();
  console.log('→ Seeding unified roles...');

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

    // Cleaning and Maintenance roles
    { code: 'housekeeping_supervisor', name: 'Housekeeping Supervisor', description: 'Supervises cleaning tasks and staff' },
    { code: 'maintenance_tech', name: 'Maintenance Technician', description: 'Executes maintenance work orders' },
    { code: 'maintenance_manager', name: 'Maintenance Manager', description: 'Creates and manages maintenance requests' },
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

  const duration = Date.now() - timer;
  console.log(`✓ Seeded ${Object.keys(roles).length} unified roles (${duration}ms)`);
  return roles;
}

async function seedPermissions(roles: Record<string, any>) {
  const timer = Date.now();
  console.log('→ Seeding comprehensive permissions for all roles...');

  interface PermissionData {
    action: string;
    subject?: string | null;
  }

  interface PermissionSetData {
    [roleCode: string]: PermissionData[];
  }

  // KEY FIX: When action already contains the full permission (e.g., 'orders.read'),
  // use subject: null. This prevents malformed variants like 'orders.read.orders'.
  // The addPermissionVariants function will auto-generate both dot and colon formats.

  const permissionSets: PermissionSetData = {
    // ==================== ADMIN ====================
    admin: [
      { action: '*', subject: '*' }, // Full access
      // Core dashboard and analytics
      { action: 'dashboard.read', subject: null },
      { action: 'analytics.read', subject: null },
      { action: 'admin.view', subject: null },
      { action: 'admin.create', subject: null },
      { action: 'admin.edit', subject: null },
      { action: 'admin.delete', subject: null },
      { action: 'admin.manage', subject: null },
      // Orders management
      { action: 'orders.read', subject: null },
      { action: 'orders.create', subject: null },
      { action: 'orders.update', subject: null },
      { action: 'orders.delete', subject: null },
      { action: 'orders.cancel', subject: null },
      // Payments
      { action: 'payments.read', subject: null },
      { action: 'payments.process', subject: null },
      { action: 'payments.refund', subject: null },
      // Inventory
      { action: 'inventory.read', subject: null },
      { action: 'inventory.create', subject: null },
      { action: 'inventory.update', subject: null },
      { action: 'inventory.delete', subject: null },
      { action: 'inventory.transfer', subject: null },
      // Departments and sections
      { action: 'departments.read', subject: null },
      { action: 'departments.create', subject: null },
      { action: 'departments.update', subject: null },
      { action: 'departments.delete', subject: null },
      { action: 'department_sections.read', subject: null },
      { action: 'department_sections.create', subject: null },
      { action: 'department_sections.update', subject: null },
      { action: 'department_sections.delete', subject: null },
      // Bookings and reservations
      { action: 'bookings.read', subject: null },
      { action: 'bookings.create', subject: null },
      { action: 'bookings.update', subject: null },
      { action: 'bookings.delete', subject: null },
      { action: 'bookings.checkout', subject: null },
      { action: 'reservations.view', subject: null },
      { action: 'reservations.create', subject: null },
      { action: 'reservations.modify', subject: null },
      { action: 'reservations.cancel', subject: null },
      { action: 'reservations.checkin', subject: null },
      { action: 'reservations.checkout', subject: null },
      // Rooms
      { action: 'rooms.read', subject: null },
      { action: 'rooms.view', subject: null },
      { action: 'rooms.manage', subject: null },
      { action: 'rooms.update', subject: null },
      // Cleaning management
      { action: 'cleaning.view', subject: null },
      { action: 'cleaning.assign', subject: null },
      { action: 'cleaning.work', subject: null },
      { action: 'cleaning.inspect', subject: null },
      // Maintenance management
      { action: 'maintenance.view', subject: null },
      { action: 'maintenance.request', subject: null },
      { action: 'maintenance.assign', subject: null },
      { action: 'maintenance.work', subject: null },
      { action: 'maintenance.verify', subject: null },
      // Pricing
      { action: 'pricing.manage', subject: null },
      // Customers
      { action: 'customers.read', subject: null },
      { action: 'customers.create', subject: null },
      { action: 'customers.update', subject: null },
      { action: 'customers.delete', subject: null },
      // Discounts and extras
      { action: 'discounts.read', subject: null },
      { action: 'discounts.create', subject: null },
      { action: 'discounts.update', subject: null },
      { action: 'discounts.delete', subject: null },
      { action: 'extras.read', subject: null },
      { action: 'extras.create', subject: null },
      { action: 'extras.update', subject: null },
      { action: 'extras.delete', subject: null },
      { action: 'extras.allocate', subject: null },
      { action: 'extras.transfer', subject: null },
      // Games
      { action: 'games.read', subject: null },
      { action: 'games.create', subject: null },
      { action: 'games.update', subject: null },
      { action: 'games.delete', subject: null },
      { action: 'games.checkout', subject: null },
      // Employees
      { action: 'employees.read', subject: null },
      { action: 'employees.create', subject: null },
      { action: 'employees.update', subject: null },
      { action: 'employees.delete', subject: null },
      // Reports
      { action: 'reports.read', subject: null },
      { action: 'reports.generate', subject: null },
      { action: 'reports.export', subject: null },
      // Services permissions
      { action: 'services.read', subject: null },
      { action: 'services.create', subject: null },
      { action: 'services.update', subject: null },
      { action: 'services.delete', subject: null },
    ],

    // ==================== MANAGER ====================
    manager: [
      { action: 'dashboard.read', subject: null },
      { action: 'orders.read', subject: null },
      { action: 'orders.create', subject: null },
      { action: 'orders.update', subject: null },
      { action: 'orders.cancel', subject: null },
      { action: 'payments.read', subject: null },
      { action: 'payments.process', subject: null },
      { action: 'payments.refund', subject: null },
      { action: 'inventory.read', subject: null },
      { action: 'inventory.update', subject: null },
      { action: 'inventory.transfer', subject: null },
      { action: 'extras.read', subject: null },
      { action: 'extras.create', subject: null },
      { action: 'extras.update', subject: null },
      { action: 'extras.delete', subject: null },
      { action: 'extras.allocate', subject: null },
      { action: 'extras.transfer', subject: null },
      { action: 'games.read', subject: null },
      { action: 'games.create', subject: null },
      { action: 'games.update', subject: null },
      { action: 'games.checkout', subject: null },
      { action: 'bookings.read', subject: null },
      { action: 'bookings.create', subject: null },
      { action: 'bookings.update', subject: null },
      { action: 'bookings.checkout', subject: null },
      { action: 'reservations.view', subject: null },
      { action: 'reservations.create', subject: null },
      { action: 'reservations.modify', subject: null },
      { action: 'reservations.checkin', subject: null },
      { action: 'reservations.checkout', subject: null },
      { action: 'rooms.read', subject: null },
      { action: 'rooms.view', subject: null },
      { action: 'rooms.update', subject: null },
      { action: 'cleaning.view', subject: null },
      { action: 'cleaning.inspect', subject: null },
      { action: 'maintenance.view', subject: null },
      { action: 'maintenance.verify', subject: null },
      { action: 'pricing.manage', subject: null },
      { action: 'customers.read', subject: null },
      { action: 'customers.create', subject: null },
      { action: 'customers.update', subject: null },
      { action: 'discounts.read', subject: null },
      { action: 'discounts.create', subject: null },
      { action: 'discounts.update', subject: null },
      { action: 'discounts.delete', subject: null },
      { action: 'departments.read', subject: null },
      { action: 'departments.update', subject: null },
      { action: 'department_sections.read', subject: null },
      { action: 'employees.read', subject: null },
      { action: 'employees.create', subject: null },
      { action: 'employees.update', subject: null },
      { action: 'employees.delete', subject: null },
      { action: 'reports.read', subject: null },
      { action: 'reports.generate', subject: null },
      { action: 'reports.export', subject: null },
      { action: 'analytics.read', subject: null },
      // Services permissions
      { action: 'services.read', subject: null },
      { action: 'services.create', subject: null },
      { action: 'services.update', subject: null },
      { action: 'services.delete', subject: null },
      // Department Sections permissions
      { action: 'department_sections.create', subject: null },
      { action: 'department_sections.update', subject: null },
      { action: 'department_sections.delete', subject: null },
    ],

    // ==================== POS MANAGER ====================
    pos_manager: [
      { action: 'dashboard.read', subject: null },
      { action: 'orders.read', subject: null },
      { action: 'orders.create', subject: null },
      { action: 'orders.update', subject: null },
      { action: 'orders.delete', subject: null },
      { action: 'orders.cancel', subject: null },
      { action: 'payments.read', subject: null },
      { action: 'payments.process', subject: null },
      { action: 'payments.refund', subject: null },
      { action: 'inventory.read', subject: null },
      { action: 'inventory.update', subject: null },
      { action: 'inventory.transfer', subject: null },
      { action: 'extras.read', subject: null },
      { action: 'services.read', subject: null },
      { action: 'games.read', subject: null },
      { action: 'games.create', subject: null },
      { action: 'games.update', subject: null },
      { action: 'games.checkout', subject: null },
      // Services permissions
      { action: 'services.read', subject: null },
      { action: 'services.create', subject: null },
      { action: 'services.update', subject: null },
      { action: 'bookings.read', subject: null },
      { action: 'rooms.read', subject: null },
      { action: 'departments.read', subject: null },
      { action: 'department_sections.read', subject: null },
      { action: 'departments.update', subject: null },
      { action: 'discounts.read', subject: null },
      { action: 'reports.read', subject: null },
      { action: 'reports.generate', subject: null },
      { action: 'reports.export', subject: null },
    ],

    // ==================== INVENTORY STAFF ====================
    inventory_staff: [
      { action: 'dashboard.read', subject: null },
      { action: 'inventory.read', subject: null },
      { action: 'inventory.create', subject: null },
      { action: 'inventory.update', subject: null },
      { action: 'inventory.delete', subject: null },
      { action: 'inventory.transfer', subject: null },
      { action: 'extras.read', subject: null },
      { action: 'extras.create', subject: null },
      { action: 'extras.update', subject: null },
      { action: 'extras.delete', subject: null },
      { action: 'extras.allocate', subject: null },
      { action: 'extras.transfer', subject: null },
      { action: 'department_sections.read', subject: null },
      { action: 'department_sections.update', subject: null },
      { action: 'departments.read', subject: null },
      { action: 'reports.read', subject: null },
      // Services permissions
      { action: 'services.read', subject: null },
      { action: 'services.create', subject: null },
      { action: 'services.update', subject: null },
    ],

    // ==================== ACCOUNTANT ====================
    accountant: [
      { action: 'dashboard.read', subject: null },
      { action: 'payments.read', subject: null },
      { action: 'payments.process', subject: null },
      { action: 'payments.refund', subject: null },
      { action: 'orders.read', subject: null },
      // Services permissions
      { action: 'services.read', subject: null },
      { action: 'inventory.read', subject: null },
      { action: 'bookings.read', subject: null },
      { action: 'discounts.read', subject: null },
      { action: 'departments.read', subject: null },
      { action: 'department_sections.read', subject: null },
      { action: 'reports.read', subject: null },
      { action: 'reports.generate', subject: null },
      { action: 'reports.export', subject: null },
      { action: 'analytics.read', subject: null },
    ],

    // ==================== CASHIER ====================
    // Full permissions for: /pos, /pos/orders, /pos/food, /pos/drinks, /pos-terminals
    cashier: [
      // POS operations
      { action: 'orders.read', subject: null },
      { action: 'orders.create', subject: null },
      { action: 'orders.update', subject: null },
      { action: 'orders.delete', subject: null },
      // Payment processing
      { action: 'payments.read', subject: null },
      { action: 'payments.process', subject: null },
      // Services access
      { action: 'services.read', subject: null },
      { action: 'payments.refund', subject: null },
      // Inventory for stock checks
      { action: 'inventory.read', subject: null },
      // Department navigation
      { action: 'departments.read', subject: null },
      { action: 'department_sections.read', subject: null },
      // Discount application
      { action: 'discounts.read', subject: null },
      { action: 'discounts.apply', subject: null },
      // POS terminal
      { action: 'pos_terminal.access', subject: null },
    ],

    // ==================== STAFF ====================
    // Staff with broader access (Assistant Manager level) - can manage orders, bookings, customers, rooms
    staff: [
      { action: 'dashboard.read', subject: null },
      // Orders & POS
      { action: 'orders.read', subject: null },
      { action: 'orders.create', subject: null },
      { action: 'orders.update', subject: null },
      { action: 'orders.cancel', subject: null },
      // Payments
      { action: 'payments.read', subject: null },
      { action: 'payments.process', subject: null },
      { action: 'payments.refund', subject: null },
      // Inventory
      { action: 'inventory.read', subject: null },
      // Bookings
      { action: 'bookings.read', subject: null },
      { action: 'department_sections.update', subject: null },
      // Discounts
      { action: 'discounts.read', subject: null },
      { action: 'discounts.apply', subject: null },
      // Reports
      { action: 'reports.read', subject: null },
      // Services
      { action: 'services.read', subject: null },
      { action: 'services.create', subject: null },
      { action: 'services.update', subject: null },
      // Customers
      { action: 'customers.read', subject: null },
      { action: 'customers.create', subject: null },
      { action: 'customers.update', subject: null },
      // Rooms
      { action: 'rooms.read', subject: null },
      { action: 'rooms.update', subject: null },
      // Departments
      { action: 'departments.read', subject: null },
      { action: 'department_sections.read', subject: null },
      { action: 'department_sections.update', subject: null },
      // Discounts
      { action: 'discounts.read', subject: null },
      { action: 'discounts.apply', subject: null },
      // Reports
      { action: 'reports.read', subject: null },
    ],
    // ==================== EMPLOYEE ====================
    // Minimal access, read-only for most features
    employee: [
      { action: 'dashboard.read', subject: null },
      { action: 'orders.read', subject: null },
      { action: 'inventory.read', subject: null },
      { action: 'bookings.read', subject: null },
      { action: 'departments.read', subject: null },
      { action: 'department_sections.read', subject: null },
      { action: 'services.read', subject: null },
    ],

    // ==================== KITCHEN STAFF ====================
    // Full permissions for: /departments/kitchen operations
    kitchen_staff: [
      { action: 'orders.read', subject: null },
      { action: 'orders.update', subject: null },
      { action: 'inventory.read', subject: null },
      { action: 'departments.read', subject: null },
      { action: 'department_sections.read', subject: null },
      { action: 'department_sections.update', subject: null },
      { action: 'services.read', subject: null },
    ],

    // ==================== BAR STAFF ====================
    // Full permissions for: /departments/bar operations
    bar_staff: [
      { action: 'orders.read', subject: null },
      { action: 'orders.update', subject: null },
      { action: 'inventory.read', subject: null },
      { action: 'departments.read', subject: null },
      { action: 'department_sections.read', subject: null },
      { action: 'department_sections.update', subject: null },
      { action: 'departments.update', subject: null },
      { action: 'services.read', subject: null },
    ],

    // ==================== POS STAFF ====================
    // Full permissions for: /pos, /pos/orders, /pos/food, /pos/drinks
    pos_staff: [
      { action: 'orders.read', subject: null },
      { action: 'orders.create', subject: null },
      { action: 'orders.update', subject: null },
      { action: 'orders.delete', subject: null },
      { action: 'payments.read', subject: null },
      { action: 'payments.process', subject: null },
      { action: 'payments.refund', subject: null },
      { action: 'inventory.read', subject: null },
      { action: 'departments.read', subject: null },
      { action: 'department_sections.read', subject: null },
      { action: 'department_sections.update', subject: null },
      { action: 'discounts.read', subject: null },
      { action: 'discounts.apply', subject: null },
      { action: 'pos_terminal.access', subject: null },
      { action: 'services.read', subject: null },
    ],

    // ==================== HOUSEKEEPING STAFF ====================
    // Full permissions for: /rooms, /inventory for housekeeping, cleaning tasks
    housekeeping_staff: [
      { action: 'rooms.read', subject: null },
      { action: 'rooms.view', subject: null },
      { action: 'rooms.update', subject: null },
      { action: 'bookings.read', subject: null },
      { action: 'cleaning.view', subject: null },
      { action: 'cleaning.work', subject: null },
      { action: 'inventory.read', subject: null },
      { action: 'departments.read', subject: null },
      { action: 'department_sections.read', subject: null },
      { action: 'services.read', subject: null },
    ],

    // ==================== FRONT DESK ====================
    // Full permissions for: /bookings, /customers, /rooms, /pos orders
    front_desk: [
      { action: 'bookings.read', subject: null },
      { action: 'bookings.create', subject: null },
      { action: 'bookings.update', subject: null },
      { action: 'bookings.checkout', subject: null },
      { action: 'bookings.cancel', subject: null },
      { action: 'reservations.view', subject: null },
      { action: 'reservations.create', subject: null },
      { action: 'reservations.modify', subject: null },
      { action: 'reservations.checkin', subject: null },
      { action: 'reservations.checkout', subject: null },
      { action: 'customers.read', subject: null },
      { action: 'customers.create', subject: null },
      { action: 'customers.update', subject: null },
      { action: 'rooms.read', subject: null },
      { action: 'rooms.view', subject: null },
      { action: 'rooms.update', subject: null },
      { action: 'cleaning.view', subject: null },
      { action: 'orders.read', subject: null },
      { action: 'departments.read', subject: null },
      { action: 'department_sections.read', subject: null },
      { action: 'services.read', subject: null },
      { action: 'services.create', subject: null },
      { action: 'services.update', subject: null },
      { action: 'discounts.read', subject: null },
      { action: 'discounts.apply', subject: null },
    ],

    // ==================== CUSTOMER SERVICE ====================
    // Full permissions for: /bookings, /customers, /rooms
    customer_service: [
      { action: 'bookings.read', subject: null },
      { action: 'bookings.create', subject: null },
      { action: 'bookings.update', subject: null },
      { action: 'bookings.cancel', subject: null },
      { action: 'customers.read', subject: null },
      { action: 'customers.create', subject: null },
      { action: 'customers.update', subject: null },
      { action: 'rooms.read', subject: null },
      { action: 'orders.read', subject: null },
      { action: 'departments.read', subject: null },
      { action: 'services.read', subject: null },
      { action: 'services.create', subject: null },
      { action: 'services.update', subject: null },
      { action: 'department_sections.read', subject: null },
      { action: 'discounts.read', subject: null },
      { action: 'discounts.apply', subject: null },
    ],

    // ==================== RECEPTIONIST (legacy, same as front_desk) ====================
    // Full permissions for: /bookings, /customers, /rooms, /pos orders
    receptionist: [
      { action: 'bookings.read', subject: null },
      { action: 'bookings.create', subject: null },
      { action: 'bookings.update', subject: null },
      { action: 'bookings.checkout', subject: null },
      { action: 'bookings.cancel', subject: null },
      { action: 'customers.read', subject: null },
      { action: 'customers.create', subject: null },
      { action: 'customers.update', subject: null },
      { action: 'rooms.read', subject: null },
      { action: 'rooms.update', subject: null },
      { action: 'orders.read', subject: null },
      { action: 'departments.read', subject: null },
      { action: 'department_sections.read', subject: null },
      { action: 'discounts.read', subject: null },
      { action: 'discounts.apply', subject: null },
      { action: 'services.read', subject: null },
      { action: 'services.create', subject: null },
      { action: 'services.update', subject: null },
    ],

    // ==================== TERMINAL OPERATOR ====================
    // Full permissions for: /pos-terminals, /pos operations
    terminal_operator: [
      { action: 'orders.read', subject: null },
      { action: 'orders.create', subject: null },
      { action: 'orders.update', subject: null },
      { action: 'orders.delete', subject: null },
      { action: 'payments.read', subject: null },
      { action: 'payments.process', subject: null },
      { action: 'payments.refund', subject: null },
      { action: 'pos_terminal.access', subject: null },
      { action: 'inventory.read', subject: null },
      { action: 'departments.read', subject: null },
      { action: 'department_sections.read', subject: null },
      { action: 'department_sections.update', subject: null },
      { action: 'discounts.read', subject: null },
      { action: 'discounts.apply', subject: null },
      { action: 'services.read', subject: null },
    ],

    // ==================== HOUSEKEEPING SUPERVISOR ====================
    // Full permissions for: cleaning task assignment, inspection, and staff management
    housekeeping_supervisor: [
      { action: 'rooms.read', subject: null },
      { action: 'rooms.view', subject: null },
      { action: 'rooms.update', subject: null },
      { action: 'bookings.read', subject: null },
      { action: 'cleaning.view', subject: null },
      { action: 'cleaning.assign', subject: null },
      { action: 'cleaning.work', subject: null },
      { action: 'cleaning.inspect', subject: null },
      { action: 'inventory.read', subject: null },
      { action: 'departments.read', subject: null },
      { action: 'department_sections.read', subject: null },
      { action: 'services.read', subject: null },
    ],

    // ==================== MAINTENANCE TECHNICIAN ====================
    // Full permissions for: maintenance work execution
    maintenance_tech: [
      { action: 'rooms.read', subject: null },
      { action: 'rooms.view', subject: null },
      { action: 'maintenance.view', subject: null },
      { action: 'maintenance.work', subject: null },
      { action: 'inventory.read', subject: null },
      { action: 'departments.read', subject: null },
      { action: 'department_sections.read', subject: null },
      { action: 'services.read', subject: null },
    ],

    // ==================== MAINTENANCE MANAGER ====================
    // Full permissions for: maintenance request creation, assignment, and verification
    maintenance_manager: [
      { action: 'rooms.read', subject: null },
      { action: 'rooms.view', subject: null },
      { action: 'maintenance.view', subject: null },
      { action: 'maintenance.request', subject: null },
      { action: 'maintenance.assign', subject: null },
      { action: 'maintenance.work', subject: null },
      { action: 'maintenance.verify', subject: null },
      { action: 'inventory.read', subject: null },
      { action: 'departments.read', subject: null },
      { action: 'department_sections.read', subject: null },
      { action: 'services.read', subject: null },
    ],
  };

  let totalPermissions = 0;
  const createdRolePermissions: Set<string> = new Set();
  const roleArray = Object.entries(permissionSets);
  let roleIndex = 0;

  for (const [roleCode, permissions] of roleArray) {
    const role = roles[roleCode];
    if (!role) {
      console.warn(`  ⚠️  Role "${roleCode}" not found, skipping permissions`);
      continue;
    }

    roleIndex++;
    const roleTimer = Date.now();
    let rolePermCount = 0;

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
        rolePermCount++;
      }
      createdRolePermissions.add(rolePermKey);
    }

    const roleDuration = Date.now() - roleTimer;
    console.log(`  → ${roleCode.padEnd(20)} (${rolePermCount} perms, ${roleDuration}ms) [${roleIndex}/${roleArray.length}]`);
  }

  const duration = Date.now() - timer;
  console.log(`✓ Seeded ${totalPermissions} role-permission links (${duration}ms)`);
}

async function ensureAdminUserWithRole(
  adminRoles: Record<string, any>,
  roles: Record<string, any>,
  email = process.env.SEED_ADMIN_EMAIL || 'admin@hotelmanager.com',
  password = process.env.SEED_ADMIN_PASSWORD || 'admin@123'
) {
  const timer = Date.now();
  console.log('→ Seeding admin user...');

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
      console.log(`  → Assigned to unified admin role`);
    }
  }

  const duration = Date.now() - timer;
  console.log(`✓ Admin user ready: ${email} (${duration}ms)`);
  return user;
}


async function seedCanonicalDepartments() {
  const timer = Date.now();
  console.log('→ Seeding canonical departments...');

  const departments = [
    { code: 'restaurant', name: 'Restaurant', description: 'Restaurant department' },
    { code: 'bar', name: 'Bar', description: 'Bar department' },
    { code: 'service', name: 'Service', description: 'Service department' },
    { code: 'reception', name: 'Reception', description: 'Reception department' },
    { code: 'housekeeping', name: 'Housekeeping', description: 'Housekeeping department' },
    { code: 'games', name: 'Games & Entertainment', description: 'Arcade, pool, and entertainment', type: 'games', icon: 'gamepad' },
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
            type: (dept as any).type || null,
            icon: (dept as any).icon || null,
            metadata: {},
            isActive: true,
          },
        })
      );
      created++;
    }
  }

  const duration = Date.now() - timer;
  console.log(`✓ Seeded ${created} canonical departments (${duration}ms)`);
}

async function seedPaymentTypes() {
  const timer = Date.now();
  console.log('→ Seeding payment types...');

  const paymentTypes = [
    { type: 'cash', description: 'Cash payment' },
    { type: 'card', description: 'Card payment' },
    { type: 'bank_transfer', description: 'Bank transfer' },
    { type: 'mobile_payment', description: 'Mobile payment' },
    { type: 'employee', description: 'Employee charge' },
  ];

  let created = 0;

  for (const pt of paymentTypes) {
    const existing = await withRetries(() =>
      prisma.paymentType.findUnique({ where: { type: pt.type } })
    );

    if (!existing) {
      await withRetries(() =>
        prisma.paymentType.create({
          data: {
            type: pt.type,
            description: pt.description,
          },
        })
      );
      created++;
    }
  }

  const duration = Date.now() - timer;
  console.log(`✓ Seeded ${created} payment types (${duration}ms)`);
}

async function main() {
  const startTime = Date.now();
  try {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║       🌱 HOTEL MANAGER CORE SEEDING PROCESS 🌱           ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    console.log('📋 Seeding Steps:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Step 1: Organization
    let stepTimer = Date.now();
    console.log('[1/7] Organization Configuration');
    await ensureOrganization();
    console.log(`      ⏱️  ${Date.now() - stepTimer}ms\n`);

    // Step 2: Admin Roles
    stepTimer = Date.now();
    console.log('[2/7] Admin Role Setup (legacy)');
    const adminRoles = await seedAdminRoles();
    console.log(`      ⏱️  ${Date.now() - stepTimer}ms\n`);

    // Step 3: Unified Roles
    stepTimer = Date.now();
    console.log('[3/7] Unified Role System (16 roles)');
    const roles = await seedRoles();
    console.log(`      ⏱️  ${Date.now() - stepTimer}ms\n`);

    // Step 4: Permissions
    stepTimer = Date.now();
    console.log('[4/7] Permission Matrix & RBAC Links');
    await seedPermissions(roles);
    console.log(`      ⏱️  ${Date.now() - stepTimer}ms\n`);

    // Step 5: Admin User
    stepTimer = Date.now();
    console.log('[5/7] Admin User Account');
    await ensureAdminUserWithRole(adminRoles, roles);
    console.log(`      ⏱️  ${Date.now() - stepTimer}ms\n`);

    // Step 6: Departments
    stepTimer = Date.now();
    console.log('[6/7] Canonical Departments');
    await seedCanonicalDepartments();
    console.log(`      ⏱️  ${Date.now() - stepTimer}ms\n`);

    // Step 7: Payment Types
    stepTimer = Date.now();
    console.log('[7/7] Payment Type Configuration');
    await seedPaymentTypes();
    console.log(`      ⏱️  ${Date.now() - stepTimer}ms\n`);

    const totalDuration = Date.now() - startTime;
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`\n✅ SEED COMPLETE`);
    console.log(`   Total Time: ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s)`);
    console.log(`   Timestamp: ${new Date().toISOString()}\n`);
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

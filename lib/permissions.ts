/**
 * Permission Constants
 * 
 * Centralized definition of all available permissions in the system.
 * These permissions are stored in the `permission` table with subject: null
 * and should NEVER be called with a subject parameter in checkPermission().
 * 
 * Usage:
 *   const hasAccess = await checkPermission(ctx, PERMISSIONS.ORDERS.READ);
 *   // NOT: await checkPermission(ctx, PERMISSIONS.ORDERS.READ, 'orders');
 */

export const PERMISSIONS = {
  // Reports & Analytics
  REPORTS: {
    READ: 'reports.read',
    GENERATE: 'reports.generate',
    EXPORT: 'reports.export',
    SALES: 'reports.sales',
    PAYMENT: 'reports.payment',
    ORDERS: 'reports.orders',
    PAYMENTS: 'reports.payments',
  },

  // Orders
  ORDERS: {
    READ: 'orders.read',
    CREATE: 'orders.create',
    UPDATE: 'orders.update',
    DELETE: 'orders.delete',
    CANCEL: 'orders.cancel',
  },

  // Payments
  PAYMENTS: {
    READ: 'payments.read',
    PROCESS: 'payments.process',
    REFUND: 'payments.refund',
  },

  // POS Terminal
  POS_TERMINAL: {
    ACCESS: 'pos_terminal.access',
    MANAGE: 'pos_terminal.manage',
  },

  // Inventory
  INVENTORY: {
    READ: 'inventory.read',
    UPDATE: 'inventory.update',
    TRANSFER: 'inventory.transfer',
    DELETE: 'inventory.delete',
  },

  // Extras/Add-ons
  EXTRAS: {
    READ: 'extras.read',
    DELETE: 'extras.delete',
  },

  // Discounts
  DISCOUNTS: {
    READ: 'discounts.read',
    APPLY: 'discounts.apply',
  },

  // Departments
  DEPARTMENTS: {
    READ: 'departments.read',
    UPDATE: 'departments.update',
    CREATE: 'departments.create',
  },

  // Department Sections
  DEPARTMENT_SECTIONS: {
    READ: 'department_sections.read',
    CREATE: 'department_sections.create',
    UPDATE: 'department_sections.update',
    DELETE: 'department_sections.delete',
  },

  // Services
  SERVICES: {
    READ: 'services.read',
    CREATE: 'services.create',
    UPDATE: 'services.update',
    DELETE: 'services.delete',
  },

  // Dashboard
  DASHBOARD: {
    READ: 'dashboard.read',
  },

  // Bookings
  BOOKINGS: {
    READ: 'bookings.read',
    CREATE: 'bookings.create',
    UPDATE: 'bookings.update',
    CHECKOUT: 'bookings.checkout',
    CANCEL: 'bookings.cancel',
  },

  // Rooms
  ROOMS: {
    READ: 'rooms.read',
    UPDATE: 'rooms.update',
    MANAGE: 'rooms.manage',
  },

  // Reservations
  RESERVATIONS: {
    CREATE: 'reservations.create',
    MODIFY: 'reservations.modify',
    CANCEL: 'reservations.cancel',
    CHECKIN: 'reservations.checkin',
    CHECKOUT: 'reservations.checkout',
  },

  // Cleaning
  CLEANING: {
    VIEW: 'cleaning.view',
    ASSIGN: 'cleaning.assign',
    WORK: 'cleaning.work',
    MANAGE: 'cleaning.manage',
    INSPECT: 'cleaning.inspect',
  },

  // Maintenance
  MAINTENANCE: {
    VIEW: 'maintenance.view',
    REQUEST: 'maintenance.request',
    ASSIGN: 'maintenance.assign',
    WORK: 'maintenance.work',
    VERIFY: 'maintenance.verify',
  },

  // Terminals
  TERMINALS: {
    READ: 'terminals.read',
    CREATE: 'terminals.create',
    UPDATE: 'terminals.update',
    DELETE: 'terminals.delete',
  },

  // Customers
  CUSTOMERS: {
    READ: 'customers.read',
    CREATE: 'customers.create',
    UPDATE: 'customers.update',
  },

  // Reception
  RECEPTION: {
    READ: 'reception.read',
    MANAGE: 'reception.manage',
  },

  // Bar
  BAR: {
    READ: 'bar.read',
    MANAGE: 'bar.manage',
  },

  // Games
  GAMES: {
    READ: 'games.read',
    CREATE: 'games.create',
    UPDATE: 'games.update',
    CHECKOUT: 'games.checkout',
    MANAGE: 'games.manage',
  },

  // Employees
  EMPLOYEES: {
    READ: 'employees.read',
    UPDATE: 'employees.update',
  },

  // Analytics
  ANALYTICS: {
    READ: 'analytics.read',
  },
} as const;

/**
 * Helper to validate permission usage
 * IMPORTANT: Always call checkPermission(ctx, permission) WITHOUT a subject parameter
 * 
 * @example
 *   // ✓ CORRECT
 *   await checkPermission(ctx, PERMISSIONS.ORDERS.READ);
 *   
 *   // ✗ WRONG - DO NOT USE SUBJECT PARAMETER
 *   await checkPermission(ctx, PERMISSIONS.ORDERS.READ, 'orders');
 */
export function usePermission(permission: string): string {
  return permission;
}

/**
 * Get all permission strings for a feature
 * @example
 *   const orderPerms = getFeaturePermissions(PERMISSIONS.ORDERS);
 *   // Returns: ['orders.read', 'orders.create', 'orders.update', 'orders.delete', 'orders.cancel']
 */
export function getFeaturePermissions(feature: Record<string, string>): string[] {
  return Object.values(feature);
}

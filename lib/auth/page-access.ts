/**
 * Page Access Control
 *
 * Defines which roles/permissions are required to access specific pages.
 * Used by middleware and client components to enforce RBAC at page level.
 */

export type PageAccessRule = {
  /** Required roles (user must have at least one) */
  requiredRoles?: string[];
  /** Required permissions (user must have all) */
  requiredPermissions?: string[];
  /** Optional: require any of these permissions */
  requiredAnyPermissions?: string[];
  /** If true, admins automatically get access */
  adminBypass?: boolean;
  /** If true, authenticated users get access regardless of role */
  authenticatedOnly?: boolean;
};

/**
 * Page access rules mapped by pathname.
 * Pattern matching: exact paths and prefix patterns (with *).
 *
 * Rules are checked in order:
 * 1. Exact path match
 * 2. Prefix patterns (longest match wins)
 * 3. Default fallback (authenticated users only)
 */
export const pageAccessRules: Record<string, PageAccessRule> = {
  // ==================== DASHBOARD ====================
  "/dashboard": {
    authenticatedOnly: true,
  },

  // ==================== ADMIN PAGES ====================
  "/dashboard/admin/*": {
    requiredRoles: ["admin"],
    adminBypass: true,
  },

  "/dashboard/admin": {
    requiredRoles: ["admin"],
    adminBypass: true,
  },

  "/dashboard/admin/users": {
    requiredRoles: ["admin"],
    adminBypass: true,
  },

  "/dashboard/admin/users/*": {
    requiredRoles: ["admin"],
    adminBypass: true,
  },

  "/dashboard/admin/roles": {
    requiredRoles: ["admin"],
    adminBypass: true,
  },

  "/dashboard/admin/roles/*": {
    requiredRoles: ["admin"],
    adminBypass: true,
  },

  "/dashboard/admin/permissions": {
    requiredRoles: ["admin"],
    adminBypass: true,
  },

  "/dashboard/admin/permissions/*": {
    requiredRoles: ["admin"],
    adminBypass: true,
  },

  "/dashboard/admin/sessions": {
    requiredRoles: ["admin"],
    adminBypass: true,
  },

  "/dashboard/admin/page-access": {
    requiredRoles: ["admin"],
    adminBypass: true,
  },

  "/dashboard/admin/page-access/*": {
    requiredRoles: ["admin"],
    adminBypass: true,
  },

  // ==================== POS SYSTEM ====================
  "/pos": {
    requiredRoles: ["pos_staff", "cashier", "pos_manager", "admin"],
    requiredPermissions: ["orders.read"],
    adminBypass: true,
  },

  "/pos/orders": {
    requiredRoles: ["pos_staff", "cashier", "pos_manager", "admin"],
    requiredPermissions: ["orders.read"],
    adminBypass: true,
  },

  "/pos/orders/*": {
    requiredRoles: ["pos_staff", "cashier", "pos_manager", "admin"],
    requiredPermissions: ["orders.read"],
    adminBypass: true,
  },

  "/pos/food": {
    requiredRoles: ["pos_staff", "cashier", "pos_manager", "admin"],
    requiredPermissions: ["orders.read"],
    adminBypass: true,
  },

  "/pos/food/*": {
    requiredRoles: ["pos_staff", "cashier", "pos_manager", "admin"],
    requiredPermissions: ["orders.read"],
    adminBypass: true,
  },

  "/pos/drinks": {
    requiredRoles: ["pos_staff", "cashier", "pos_manager", "admin"],
    requiredPermissions: ["orders.read"],
    adminBypass: true,
  },

  "/pos/drinks/*": {
    requiredRoles: ["pos_staff", "cashier", "pos_manager", "admin"],
    requiredPermissions: ["orders.read"],
    adminBypass: true,
  },

  "/pos/reports": {
    requiredRoles: ["pos_manager", "manager", "staff", "admin"],
    requiredPermissions: ["reports.read"],
    adminBypass: true,
  },

  "/pos/reports/*": {
    requiredRoles: ["pos_manager", "manager", "staff", "admin"],
    requiredPermissions: ["reports.read"],
    adminBypass: true,
  },

  "/pos/departments": {
    requiredRoles: ["pos_manager", "admin"],
    requiredPermissions: ["departments.read"],
    adminBypass: true,
  },

  "/pos/departments/*": {
    requiredRoles: ["pos_manager", "admin"],
    requiredPermissions: ["departments.read"],
    adminBypass: true,
  },

  "/pos/inventory": {
    requiredRoles: ["pos_manager", "admin"],
    requiredPermissions: ["inventory.read"],
    adminBypass: true,
  },

  "/pos/inventory/*": {
    requiredRoles: ["pos_manager", "admin"],
    requiredPermissions: ["inventory.read"],
    adminBypass: true,
  },

  // ==================== POS TERMINALS ====================
  "/pos-terminals": {
    requiredRoles: ["terminal_operator", "cashier", "pos_manager", "admin"],
    requiredPermissions: ["pos_terminal.access"],
    adminBypass: true,
  },

  "/pos-terminals/*": {
    requiredRoles: ["terminal_operator", "cashier", "pos_manager", "admin"],
    requiredPermissions: ["pos_terminal.access"],
    adminBypass: true,
  },

  // ==================== BOOKINGS ====================
  "/bookings": {
    requiredRoles: ["receptionist", "manager", "admin"],
    requiredPermissions: ["bookings.read"],
    adminBypass: true,
  },

  "/bookings/*": {
    requiredRoles: ["receptionist", "manager", "admin"],
    requiredPermissions: ["bookings.read"],
    adminBypass: true,
  },

  // ==================== CUSTOMERS ====================
  "/customers": {
    requiredRoles: ["receptionist", "manager", "admin"],
    requiredPermissions: ["customers.read"],
    adminBypass: true,
  },

  "/customers/*": {
    requiredRoles: ["receptionist", "manager", "admin"],
    requiredPermissions: ["customers.read"],
    adminBypass: true,
  },

  // ==================== ROOMS ====================
  "/rooms": {
    requiredRoles: ["receptionist", "manager", "admin"],
    requiredPermissions: ["rooms.read"],
    adminBypass: true,
  },

  "/rooms/*": {
    requiredRoles: ["receptionist", "manager", "admin"],
    requiredPermissions: ["rooms.read"],
    adminBypass: true,
  },

  // ==================== INVENTORY ====================
  "/inventory": {
    requiredRoles: ["inventory_staff", "manager", "admin"],
    requiredPermissions: ["inventory.read"],
    adminBypass: true,
  },

  "/inventory/*": {
    requiredRoles: ["inventory_staff", "manager", "admin"],
    requiredPermissions: ["inventory.read"],
    adminBypass: true,
  },

  // ==================== DEPARTMENTS ====================
  "/departments": {
    requiredRoles: ["manager", "admin"],
    requiredPermissions: ["departments.read"],
    adminBypass: true,
  },

  "/departments/*": {
    requiredRoles: ["manager", "admin"],
    requiredPermissions: ["departments.read"],
    adminBypass: true,
  },

  // ==================== DOCS & REFERENCE ====================
  "/docs": {
    authenticatedOnly: true,
  },

  "/docs/*": {
    authenticatedOnly: true,
  },

  "/documentation": {
    authenticatedOnly: true,
  },

  "/documentation/*": {
    authenticatedOnly: true,
  },

  "/quick-reference": {
    authenticatedOnly: true,
  },

  "/quick-reference/*": {
    authenticatedOnly: true,
  },

  "/implementation-guide": {
    authenticatedOnly: true,
  },

  "/implementation-guide/*": {
    authenticatedOnly: true,
  },

  // ==================== DISCOUNTS ====================
  "/discounts": {
    requiredAnyPermissions: ["discounts.create", "discounts.read", "discounts.delete"],
    adminBypass: true,
  },

  "/discounts/*": {
    requiredAnyPermissions: ["discounts.create", "discounts.read", "discounts.delete"],
    adminBypass: true,
  },

  // ==================== EMPLOYEES ====================
  "/employees": {
    requiredRoles: ["manager", "admin"],
    requiredPermissions: ["employees.read"],
    adminBypass: true,
  },

  "/employees/*": {
    requiredRoles: ["manager", "admin"],
    requiredPermissions: ["employees.read"],
    adminBypass: true,
  },
};

/**
 * Get access rule for a given pathname.
 * Matches exact paths first, then longest prefix match.
 */
export function getPageAccessRule(pathname: string): PageAccessRule | null {
  // Try exact match first
  if (pageAccessRules[pathname]) {
    return pageAccessRules[pathname];
  }

  // Try prefix patterns (longest match wins)
  let longestMatch: string | null = null;
  let longestMatchLength = 0;

  for (const pattern of Object.keys(pageAccessRules)) {
    if (pattern.endsWith("*")) {
      const prefix = pattern.slice(0, -1); // Remove trailing *
      if (pathname.startsWith(prefix) && prefix.length > longestMatchLength) {
        longestMatch = pattern;
        longestMatchLength = prefix.length;
      }
    }
  }

  return longestMatch ? pageAccessRules[longestMatch] : null;
}

/**
 * Check if a user has access to a page based on their roles and permissions.
 *
 * @param rule Page access rule
 * @param userRoles User's roles
 * @param userPermissions User's permissions
 * @param userType User type ("admin" | "employee" | "other")
 * @returns true if user has access, false otherwise
 */
export function checkPageAccess(
  rule: PageAccessRule | null,
  userRoles: string[],
  userPermissions: string[],
  userType: string
): boolean {
  // No rule = authenticated users only
  if (!rule) {
    return true; // Allow if no specific rule (handled by middleware auth check)
  }

  // Admin bypass (userType is "admin" for admin users, also check roles array as fallback)
  if (rule.adminBypass && (userType === "admin" || userRoles.includes("admin"))) {
    return true;
  }

  // Authenticated only
  if (rule.authenticatedOnly) {
    return true;
  }

  // Check required roles (REQUIRED - no fallback)
  if (rule.requiredRoles && rule.requiredRoles.length > 0) {
    const hasRole = rule.requiredRoles.some((role) =>
      userRoles.includes(role)
    );
    if (!hasRole) {
      return false; // User lacks required role - deny
    }
  }

  // Check required permissions (all must be present)
  // NOTE: If permissions are not loaded (empty array), we skip permission checks
  // This allows graceful degradation if permission system is not yet seeded
  if (
    rule.requiredPermissions &&
    rule.requiredPermissions.length > 0 &&
    userPermissions.length > 0
  ) {
    const hasAllPermissions = rule.requiredPermissions.every((perm) =>
      userPermissions.includes(perm)
    );
    if (!hasAllPermissions) {
      return false; // User lacks required permissions
    }
  }

  // Check required any permissions (at least one must be present)
  // NOTE: If permissions are not loaded (empty array), we skip permission checks
  if (
    rule.requiredAnyPermissions &&
    rule.requiredAnyPermissions.length > 0 &&
    userPermissions.length > 0
  ) {
    const hasAnyPermission = rule.requiredAnyPermissions.some((perm) =>
      userPermissions.includes(perm)
    );
    if (!hasAnyPermission) {
      return false; // User lacks required permissions
    }
  }

  return true;
}

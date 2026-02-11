/**
 * Role-Based Landing Pages and Sidebar Customization
 *
 * Defines default landing pages, sidebar visibility, and specific permissions per role.
 * Users are redirected to their role-specific dashboard on login.
 */

export interface RolePermissions {
  /** Read access to this feature */
  read?: boolean;
  /** Create/Add new items */
  create?: boolean;
  /** Update/Edit existing items */
  update?: boolean;
  /** Delete items */
  delete?: boolean;
  /** Export data */
  export?: boolean;
  /** View reports */
  reports?: boolean;
}

export interface RoleLandingConfig {
  /** Role display name */
  displayName: string;
  /** Role description/purpose */
  description: string;
  /** Default landing page path for this role */
  landingPage: string;
  /** Pages to show/hide in sidebar for this role */
  sidebarGroups?: string[];
  /** Specific items to hide in sidebar */
  hiddenItems?: string[];
  /** Feature-level permissions */
  permissions?: {
    dashboard?: RolePermissions;
    orders?: RolePermissions;
    pos?: RolePermissions;
    inventory?: RolePermissions;
    bookings?: RolePermissions;
    rooms?: RolePermissions;
    customers?: RolePermissions;
    employees?: RolePermissions;
    departments?: RolePermissions;
    discounts?: RolePermissions;
    reports?: RolePermissions;
    settings?: RolePermissions;
    admin?: RolePermissions;
  };
}

export type RoleType =
  | "admin"
  | "manager"
  | "pos_manager"
  | "pos_staff"
  | "kitchen_staff"
  | "bar_staff"
  | "cashier"
  | "customer_service"
  | "housekeeping_staff"
  | "front_desk"
  | "staff"
  | "employee";

/**
 * Comprehensive role configuration with landing pages, sidebar, and permissions.
 * Map: roleCode -> { displayName, description, landingPage, sidebar preferences, permissions }
 */
export const roleLandingPages: Record<RoleType, RoleLandingConfig> = {
  // ==================== ADMIN ====================
  admin: {
    displayName: "System Administrator",
    description: "Full system access with complete control",
    landingPage: "/dashboard",
    sidebarGroups: [
      "General",
      "Hotel Management",
      "POS & Operations",
      "Administration",
    ],
    hiddenItems: [],
    permissions: {
      dashboard: { read: true, create: true, update: true, delete: true, reports: true },
      orders: { read: true, create: true, update: true, delete: true, export: true },
      pos: { read: true, create: true, update: true, delete: true },
      inventory: { read: true, create: true, update: true, delete: true, export: true },
      bookings: { read: true, create: true, update: true, delete: true },
      rooms: { read: true, create: true, update: true, delete: true },
      customers: { read: true, create: true, update: true, delete: true },
      employees: { read: true, create: true, update: true, delete: true, reports: true },
      departments: { read: true, create: true, update: true, delete: true },
      discounts: { read: true, create: true, update: true, delete: true },
      reports: { read: true, export: true },
      settings: { read: true, update: true },
      admin: { read: true, update: true },
    },
  },

  // ==================== MANAGER ====================
  manager: {
    displayName: "General Manager",
    description: "Oversees hotel operations, employees, and financials",
    landingPage: "/dashboard",
    sidebarGroups: ["General", "Hotel Management", "POS & Operations"],
    hiddenItems: [
      "/admin/users",
      "/admin/sessions",
      "/admin/roles",
      "/admin/page-access",
    ],
    permissions: {
      dashboard: { read: true, reports: true },
      orders: { read: true, create: true, update: true },
      pos: { read: true, reports: true },
      inventory: { read: true, create: true, update: true, export: true },
      bookings: { read: true, create: true, update: true },
      rooms: { read: true, update: true },
      customers: { read: true, create: true, update: true },
      employees: { read: true, create: true, update: true, reports: true },
      departments: { read: true, update: true },
      discounts: { read: true, create: true, update: true },
      reports: { read: true, export: true },
      settings: { read: true },
      admin: { read: true },
    },
  },

  // ==================== POS MANAGER ====================
  pos_manager: {
    displayName: "POS Manager",
    description: "Manages POS system, cashiers, and sales operations",
    landingPage: "/pos",
    sidebarGroups: ["POS & Operations", "Hotel Management"],
    hiddenItems: [
      "/admin",
      "/employees",
      "/bookings",
      "/customers",
      "/rooms",
      "/inventory",
      "/departments",
    ],
    permissions: {
      dashboard: { read: true },
      orders: { read: true, create: true, update: true },
      pos: { read: true, create: true, update: true, reports: true },
      inventory: { read: true },
      bookings: { read: true },
      rooms: { read: true },
      customers: { read: true },
      employees: { read: true },
      departments: { read: true },
      discounts: { read: true, create: true, update: true },
      reports: { read: true, export: true },
      settings: {},
      admin: {},
    },
  },

  // ==================== POS STAFF ====================
  pos_staff: {
    displayName: "POS Cashier",
    description: "Operates POS system and processes orders",
    landingPage: "/pos",
    sidebarGroups: ["POS & Operations"],
    hiddenItems: [
      "/dashboard",
      "/admin",
      "/employees",
      "/bookings",
      "/customers",
      "/rooms",
      "/inventory",
      "/departments",
      "/discounts",
      "/pos-terminals",
    ],
    permissions: {
      dashboard: {},
      orders: { read: true, create: true },
      pos: { read: true, create: true },
      inventory: { read: true },
      bookings: {},
      rooms: {},
      customers: { read: true },
      employees: {},
      departments: {},
      discounts: { read: true },
      reports: {},
      settings: {},
      admin: {},
    },
  },

  // ==================== KITCHEN STAFF ====================
  kitchen_staff: {
    displayName: "Kitchen Chef",
    description: "Prepares orders and manages kitchen operations",
    landingPage: "/departments",
    sidebarGroups: ["Hotel Management"],
    hiddenItems: [
      "/dashboard",
      "/admin",
      "/employees",
      "/bookings",
      "/customers",
      "/rooms",
      "/pos",
      "/pos-terminals",
      "/discounts",
      "/inventory",
      "/employees/salary-payments",
      "/employees/charges",
      "/employees/leaves",
    ],
    permissions: {
      dashboard: {},
      orders: { read: true, update: true },
      pos: { read: true },
      inventory: { read: true, update: true },
      bookings: {},
      rooms: {},
      customers: {},
      employees: {},
      departments: { read: true, update: true },
      discounts: {},
      reports: {},
      settings: {},
      admin: {},
    },
  },

  // ==================== BAR STAFF ====================
  bar_staff: {
    displayName: "Bartender",
    description: "Prepares drinks and manages bar inventory",
    landingPage: "/departments",
    sidebarGroups: ["Hotel Management"],
    hiddenItems: [
      "/dashboard",
      "/admin",
      "/employees",
      "/bookings",
      "/customers",
      "/rooms",
      "/pos",
      "/pos-terminals",
      "/discounts",
      "/inventory",
      "/employees/salary-payments",
      "/employees/charges",
      "/employees/leaves",
    ],
    permissions: {
      dashboard: {},
      orders: { read: true, update: true },
      pos: { read: true },
      inventory: { read: true, update: true },
      bookings: {},
      rooms: {},
      customers: {},
      employees: {},
      departments: { read: true, update: true },
      discounts: {},
      reports: {},
      settings: {},
      admin: {},
    },
  },

  // ==================== CASHIER ====================
  cashier: {
    displayName: "Cashier",
    description: "Handles payments and order completion",
    landingPage: "/pos",
    sidebarGroups: ["POS & Operations"],
    hiddenItems: [
      "/dashboard",
      "/admin",
      "/employees",
      "/bookings",
      "/customers",
      "/rooms",
      "/inventory",
      "/departments",
      "/pos-terminals",
    ],
    permissions: {
      dashboard: {},
      orders: { read: true, update: true },
      pos: { read: true, create: true, update: true },
      inventory: { read: true },
      bookings: { read: true },
      rooms: {},
      customers: { read: true },
      employees: {},
      departments: {},
      discounts: { read: true },
      reports: { read: true },
      settings: {},
      admin: {},
    },
  },

  // ==================== CUSTOMER SERVICE ====================
  customer_service: {
    displayName: "Customer Service Representative",
    description: "Manages bookings and customer inquiries",
    landingPage: "/bookings",
    sidebarGroups: ["Hotel Management"],
    hiddenItems: [
      "/dashboard",
      "/admin",
      "/employees",
      "/departments",
      "/inventory",
      "/pos",
      "/pos-terminals",
      "/discounts",
      "/employees/salary-payments",
      "/employees/charges",
      "/employees/leaves",
    ],
    permissions: {
      dashboard: {},
      orders: {},
      pos: { read: true },
      inventory: { read: true },
      bookings: { read: true, create: true, update: true },
      rooms: { read: true },
      customers: { read: true, create: true, update: true },
      employees: {},
      departments: {},
      discounts: { read: true },
      reports: { read: true },
      settings: {},
      admin: {},
    },
  },

  // ==================== HOUSEKEEPING STAFF ====================
  housekeeping_staff: {
    displayName: "Housekeeping Staff",
    description: "Manages room cleaning and maintenance",
    landingPage: "/rooms",
    sidebarGroups: ["Hotel Management"],
    hiddenItems: [
      "/dashboard",
      "/admin",
      "/employees",
      "/bookings",
      "/customers",
      "/inventory",
      "/pos",
      "/pos-terminals",
      "/discounts",
      "/departments",
      "/employees/salary-payments",
      "/employees/charges",
      "/employees/leaves",
    ],
    permissions: {
      dashboard: {},
      orders: {},
      pos: {},
      inventory: { read: true },
      bookings: { read: true },
      rooms: { read: true, update: true },
      customers: {},
      employees: {},
      departments: {},
      discounts: {},
      reports: {},
      settings: {},
      admin: {},
    },
  },

  // ==================== FRONT DESK ====================
  front_desk: {
    displayName: "Front Desk Staff",
    description: "Guest check-in/check-out and room management",
    landingPage: "/bookings",
    sidebarGroups: ["Hotel Management"],
    hiddenItems: [
      "/dashboard",
      "/admin",
      "/employees",
      "/inventory",
      "/pos",
      "/pos-terminals",
      "/discounts",
      "/departments",
      "/employees/salary-payments",
      "/employees/charges",
      "/employees/leaves",
    ],
    permissions: {
      dashboard: {},
      orders: {},
      pos: { read: true },
      inventory: { read: true },
      bookings: { read: true, create: true, update: true },
      rooms: { read: true, update: true },
      customers: { read: true, create: true, update: true },
      employees: {},
      departments: {},
      discounts: { read: true },
      reports: { read: true },
      settings: {},
      admin: {},
    },
  },

  // ==================== STAFF ====================
  staff: {
    displayName: "General Staff",
    description: "General employee with limited access",
    landingPage: "/dashboard",
    sidebarGroups: ["General"],
    hiddenItems: [
      "/admin",
      "/employees",
      "/bookings",
      "/customers",
      "/rooms",
      "/inventory",
      "/departments",
      "/pos",
      "/pos-terminals",
      "/discounts",
    ],
    permissions: {
      dashboard: { read: true },
      orders: { read: true },
      pos: { read: true },
      inventory: { read: true },
      bookings: {},
      rooms: {},
      customers: {},
      employees: {},
      departments: {},
      discounts: {},
      reports: { read: true },
      settings: {},
      admin: {},
    },
  },

  // ==================== EMPLOYEE ====================
  employee: {
    displayName: "Basic Employee",
    description: "Entry-level employee with minimal access",
    landingPage: "/dashboard",
    sidebarGroups: ["General"],
    hiddenItems: [
      "/admin",
      "/employees",
      "/bookings",
      "/customers",
      "/rooms",
      "/inventory",
      "/departments",
      "/pos",
      "/pos-terminals",
      "/discounts",
    ],
    permissions: {
      dashboard: { read: true },
      orders: {},
      pos: {},
      inventory: { read: true },
      bookings: {},
      rooms: {},
      customers: {},
      employees: {},
      departments: {},
      discounts: {},
      reports: {},
      settings: {},
      admin: {},
    },
  },
};

/**
 * Get the default landing page for a user's primary role
 * Users with a departmentId and department permissions are scoped to department operations
 * @param roles - Array of role codes for the user
 * @param departmentId - Optional department ID (used for scoping access)
 * @returns Default landing page path
 */
export function getDefaultLandingPage(roles: string[], departmentId?: string): string {
  if (!roles || roles.length === 0) {
    return "/dashboard";
  }

  // If user has a departmentId and is not admin, prioritize department access
  // This applies to managers, staff, and any department-bound employee
  if (departmentId && !roles.includes("admin")) {
    // Don't redirect if user is a specialized role with fixed landing page
    const specializedRoles = ["pos_manager", "pos_staff", "customer_service", "front_desk", "cashier"];
    const hasSpecializedRole = roles.some(r => specializedRoles.includes(r));
    
    if (!hasSpecializedRole) {
      // Generic roles (manager, staff, employee) with a department → department view
      const departmentRoles = ["manager", "staff", "employee", "kitchen_staff", "bar_staff", "housekeeping_staff"];
      const hasDepartmentRole = roles.some(r => departmentRoles.includes(r));
      
      if (hasDepartmentRole) {
        return "/departments";
      }
    }
  }

  // Priority order: admin > manager > specialized roles > employee
  const priority: RoleType[] = [
    "admin",
    "manager",
    "pos_manager",
    "customer_service",
    "front_desk",
    "cashier",
    "kitchen_staff",
    "bar_staff",
    "housekeeping_staff",
    "pos_staff",
    "staff",
    "employee",
  ];

  for (const role of priority) {
    if (roles.includes(role)) {
      return roleLandingPages[role as RoleType]?.landingPage || "/dashboard";
    }
  }

  return "/dashboard";
}

/**
 * Check if an item should be hidden from sidebar for given roles
 * Users with a departmentId should see department-related items
 * @param itemHref - The href of the sidebar item
 * @param roles - Array of role codes for the user
 * @param departmentId - Optional department ID (unhides department items)
 * @returns true if item should be hidden
 */
export function shouldHideSidebarItem(itemHref: string, roles: string[], departmentId?: string): boolean {
  if (!roles || roles.length === 0) {
    return true; // Hide all if no roles
  }

  // Admin sees everything
  if (roles.includes("admin")) {
    return false;
  }

  // If user has departmentId and is not a specialized role, show department items
  if (departmentId && !roles.includes("admin")) {
    const specializedRoles = ["pos_manager", "pos_staff", "customer_service", "front_desk", "cashier"];
    const hasSpecializedRole = roles.some(r => specializedRoles.includes(r));
    
    if (!hasSpecializedRole) {
      // Show department items for department-scoped users
      if (itemHref === "/departments" || itemHref?.startsWith("/departments/")) {
        return false;
      }
    }
  }

  // Check each role's hidden items
  for (const role of roles) {
    const config = roleLandingPages[role as RoleType];
    if (config?.hiddenItems?.includes(itemHref)) {
      return true;
    }
  }

  return false;
}

/**
 * Get allowed sidebar groups for a user's roles
 * @param roles - Array of role codes for the user
 * @returns Array of allowed sidebar group titles
 */
export function getAllowedSidebarGroups(roles: string[]): string[] {
  if (!roles || roles.length === 0) {
    return [];
  }

  // Admin sees all groups
  if (roles.includes("admin")) {
    return [
      "General",
      "Hotel Management",
      "POS & Operations",
      "Administration",
    ];
  }

  // Collect all allowed groups from user's roles
  const allowedGroups = new Set<string>();
  for (const role of roles) {
    const config = roleLandingPages[role as RoleType];
    config?.sidebarGroups?.forEach((group) => allowedGroups.add(group));
  }

  return Array.from(allowedGroups);
}

/**
 * Check if user has specific permission for a feature
 * @param roles - Array of role codes for the user
 * @param feature - Feature name (e.g., 'orders', 'inventory', 'admin')
 * @param action - Action type: 'read', 'create', 'update', 'delete', 'export', 'reports'
 * @returns true if user has the permission
 */
export function hasFeaturePermission(
  roles: string[],
  feature: keyof RoleLandingConfig["permissions"],
  action: keyof RolePermissions = "read"
): boolean {
  if (!roles || roles.length === 0) {
    return false;
  }

  // Admin has all permissions
  if (roles.includes("admin")) {
    return true;
  }

  // Check each role's feature permissions
  for (const role of roles) {
    const config = roleLandingPages[role as RoleType];
    const featurePerms = config?.permissions?.[feature];
    
    if (featurePerms && featurePerms[action]) {
      return true;
    }
  }

  return false;
}

/**
 * Get detailed info about a role
 * @param roleCode - Role code
 * @returns Role configuration with display name, description, permissions
 */
export function getRoleInfo(roleCode: string): RoleLandingConfig | null {
  return roleLandingPages[roleCode as RoleType] || null;
}

/**
 * Get all available roles (for dropdowns, role assignment, etc.)
 * @returns Array of all role configurations with codes
 */
export function getAllRoles(): Array<{ code: RoleType; config: RoleLandingConfig }> {
  return Object.entries(roleLandingPages).map(([code, config]) => ({
    code: code as RoleType,
    config,
  }));
}

/**
 * Check if user can perform CRUD operations on a feature
 * @param roles - User roles
 * @param feature - Feature name
 * @returns Object with CRUD capabilities
 */
export function getFeatureCapabilities(
  roles: string[],
  feature: keyof RoleLandingConfig["permissions"]
) {
  return {
    canRead: hasFeaturePermission(roles, feature, "read"),
    canCreate: hasFeaturePermission(roles, feature, "create"),
    canUpdate: hasFeaturePermission(roles, feature, "update"),
    canDelete: hasFeaturePermission(roles, feature, "delete"),
    canExport: hasFeaturePermission(roles, feature, "export"),
    canViewReports: hasFeaturePermission(roles, feature, "reports"),
  };
}

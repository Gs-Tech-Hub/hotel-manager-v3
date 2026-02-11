/**
 * Department-to-Role Mapping Configuration
 * 
 * Maps departments (from seed:core or created via dashboard) to their default employee roles.
 * This ensures employees assigned to a department automatically get the appropriate role.
 * 
 * Configuration is stored in Department.metadata.defaultRole
 * If not configured, falls back to canonical mappings based on department code/name.
 * 
 * Example:
 * - Employee in "restaurant" department → gets "kitchen_staff" role
 * - Employee in "bar" department → gets "bar_staff" role
 */

import { prisma } from "@/lib/auth/prisma";

export type DepartmentRoleMapping = {
  departmentCode: string;
  defaultRole: string;
};

/**
 * Default mappings for canonical departments (from seed:core)
 * Can be overridden by setting Department.metadata.defaultRole
 */
const CANONICAL_MAPPINGS: DepartmentRoleMapping[] = [
  { departmentCode: "restaurant", defaultRole: "kitchen_staff" },
  { departmentCode: "bar", defaultRole: "bar_staff" },
  { departmentCode: "service", defaultRole: "pos_staff" },
  { departmentCode: "reception", defaultRole: "front_desk" },
  { departmentCode: "housekeeping", defaultRole: "housekeeping_staff" },
];

/**
 * Get the default role for a department
 * Checks Department.metadata.defaultRole first, falls back to canonical mappings
 */
export async function getDefaultRoleForDepartment(
  departmentId: string,
  departmentCode?: string
): Promise<string | null> {
  try {
    // Fetch department with metadata
    const dept = await prisma.department.findUnique({
      where: departmentCode ? { code: departmentCode } : { id: departmentId },
      select: { code: true, metadata: true },
    });

    if (!dept) return null;

    // Check if department has a configured default role in metadata
    if (dept.metadata && typeof dept.metadata === "object") {
      const metadata = dept.metadata as Record<string, any>;
      if (metadata.defaultRole) {
        return metadata.defaultRole;
      }
    }

    // Fall back to canonical mappings
    const canonical = CANONICAL_MAPPINGS.find(
      (m) => m.departmentCode === dept.code
    );

    return canonical?.defaultRole || null;
  } catch (error) {
    console.error(
      `Error fetching role mapping for department ${departmentCode || departmentId}:`,
      error
    );
    // Fall back to canonical mappings on error
    if (departmentCode) {
      const canonical = CANONICAL_MAPPINGS.find(
        (m) => m.departmentCode === departmentCode
      );
      return canonical?.defaultRole || null;
    }
    return null;
  }
}

/**
 * Get all department-role mappings (canonical + configured via metadata)
 */
export async function getAllDepartmentRoleMappings(): Promise<
  DepartmentRoleMapping[]
> {
  try {
    const departments = await prisma.department.findMany({
      select: { code: true, metadata: true },
    });

    const mappings = new Map<string, string>();

    // Start with canonical mappings
    CANONICAL_MAPPINGS.forEach((m) => {
      mappings.set(m.departmentCode, m.defaultRole);
    });

    // Override with configured mappings from metadata
    departments.forEach((dept) => {
      if (dept.metadata && typeof dept.metadata === "object") {
        const metadata = dept.metadata as Record<string, any>;
        if (metadata.defaultRole) {
          mappings.set(dept.code, metadata.defaultRole);
        }
      }
    });

    return Array.from(mappings.entries()).map(([departmentCode, defaultRole]) => ({
      departmentCode,
      defaultRole,
    }));
  } catch (error) {
    console.error("Error fetching all department role mappings:", error);
    return CANONICAL_MAPPINGS;
  }
}

/**
 * Set/update the default role for a department (stored in metadata)
 */
export async function setDefaultRoleForDepartment(
  departmentId: string,
  defaultRole: string
): Promise<void> {
  try {
    // Fetch current metadata
    const dept = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { metadata: true },
    });

    const metadata = (dept?.metadata as Record<string, any>) || {};

    // Update with new defaultRole
    metadata.defaultRole = defaultRole;

    // Save back to database
    await prisma.department.update({
      where: { id: departmentId },
      data: { metadata },
    });
  } catch (error) {
    console.error(
      `Error setting role mapping for department ${departmentId}:`,
      error
    );
    throw error;
  }
}

/**
 * Reset a department's role mapping to its canonical value (remove from metadata)
 */
export async function resetDepartmentRoleMapping(
  departmentId: string
): Promise<void> {
  try {
    // Fetch current metadata
    const dept = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { metadata: true },
    });

    const metadata = (dept?.metadata as Record<string, any>) || {};

    // Remove defaultRole from metadata
    delete metadata.defaultRole;

    // Save back to database
    await prisma.department.update({
      where: { id: departmentId },
      data: { metadata },
    });
  } catch (error) {
    console.error(
      `Error resetting role mapping for department ${departmentId}:`,
      error
    );
    throw error;
  }
}


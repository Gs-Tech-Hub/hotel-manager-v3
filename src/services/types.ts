/**
 * Shared types for services
 */

export interface PermissionContext {
  userId: string;
  userType: "admin" | "employee" | "other";
  departmentId?: string | null;
}

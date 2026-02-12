/**
 * useRolePermissions Hook
 *
 * Provides easy access to feature-level permissions based on user roles.
 * Use this in components to determine what actions/features to show.
 */

import { useMemo } from "react";
import { useAuth } from "@/components/auth-context";
import {
  hasFeaturePermission,
  getFeatureCapabilities,
  getRoleInfo,
  type RoleLandingConfig,
} from "@/lib/auth/role-landing";

export interface RolePermissionsHook {
  /** Check if user can read a feature */
  canRead: (feature: keyof RoleLandingConfig["permissions"]) => boolean;
  /** Check if user can create in a feature */
  canCreate: (feature: keyof RoleLandingConfig["permissions"]) => boolean;
  /** Check if user can update in a feature */
  canUpdate: (feature: keyof RoleLandingConfig["permissions"]) => boolean;
  /** Check if user can delete in a feature */
  canDelete: (feature: keyof RoleLandingConfig["permissions"]) => boolean;
  /** Check if user can export from a feature */
  canExport: (feature: keyof RoleLandingConfig["permissions"]) => boolean;
  /** Check if user can view reports for a feature */
  canViewReports: (feature: keyof RoleLandingConfig["permissions"]) => boolean;
  /** Get all capabilities for a feature */
  getCapabilities: (feature: keyof RoleLandingConfig["permissions"]) => ReturnType<typeof getFeatureCapabilities>;
  /** Get info about user's primary role */
  getPrimaryRoleInfo: () => RoleLandingConfig | null;
}

/**
 * Hook to check feature-level permissions
 * Usage:
 *   const { canCreate, canDelete } = useRolePermissions();
 *   if (canCreate('orders')) { ... }
 */
export function useRolePermissions(): RolePermissionsHook {
  const { user } = useAuth();
  const roles = user?.roles || [];

  const primaryRoleInfo = useMemo(() => {
    if (roles.length === 0) return null;
    return getRoleInfo(roles[0]);
  }, [roles]);

  return useMemo(() => ({
    canRead: (feature) => hasFeaturePermission(roles, feature, "read"),
    canCreate: (feature) => hasFeaturePermission(roles, feature, "create"),
    canUpdate: (feature) => hasFeaturePermission(roles, feature, "update"),
    canDelete: (feature) => hasFeaturePermission(roles, feature, "delete"),
    canExport: (feature) => hasFeaturePermission(roles, feature, "export"),
    canViewReports: (feature) => hasFeaturePermission(roles, feature, "reports"),
    getCapabilities: (feature) => getFeatureCapabilities(roles, feature),
    getPrimaryRoleInfo: () => primaryRoleInfo,
  }), [roles, primaryRoleInfo]);
}

/**
 * Hook to check specific feature access
 * Usage:
 *   const orderCaps = useFeatureAccess('orders');
 *   if (orderCaps.canCreate) { ... }
 */
export function useFeatureAccess(feature: keyof RoleLandingConfig["permissions"]) {
  const { user } = useAuth();
  const roles = user?.roles || [];

  return useMemo(() => {
    return getFeatureCapabilities(roles, feature);
  }, [roles, feature]);
}

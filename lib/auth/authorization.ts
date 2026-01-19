/**
 * Authorization Utilities
 * Wrapper around RBAC for convenient permission checking in services
 */

import { checkPermission, PermissionContext } from './rbac';
import type { UserContext } from '@/lib/user-context';

/**
 * Require specific role(s)
 * Throws if context is missing or role is not found
 */
export function requireRole(
  ctx: UserContext | undefined,
  allowedRoles: string[]
): Error | null {
  if (!ctx?.userId) {
    return new Error('UNAUTHORIZED: User context required');
  }

  // If userRoles array is populated, check against it
  if (ctx.userRoles && Array.isArray(ctx.userRoles)) {
    const hasRole = ctx.userRoles.some((role) => allowedRoles.includes(role));
    if (!hasRole) {
      return new Error(`FORBIDDEN: Required role not found. Expected one of: ${allowedRoles.join(', ')}`);
    }
  }
  // Fallback to single userRole
  else if (ctx.userRole && !allowedRoles.includes(ctx.userRole)) {
    return new Error(`FORBIDDEN: Required role not found. Expected one of: ${allowedRoles.join(', ')}`);
  }

  return null;
}

/**
 * Require specific role or be the resource owner
 */
export function requireRoleOrOwner(
  ctx: UserContext | undefined,
  allowedRoles: string[],
  resourceOwnerId?: string
): Error | null {
  if (!ctx?.userId) {
    return new Error('UNAUTHORIZED: User context required');
  }

  // Check if user is the owner
  if (resourceOwnerId && ctx.userId === resourceOwnerId) {
    return null;
  }

  // Otherwise check role
  return requireRole(ctx, allowedRoles);
}

/**
 * Check permission for an action
 */
export async function checkPermissionFor(
  ctx: UserContext | undefined,
  action: string,
  subject?: string
): Promise<boolean> {
  if (!ctx?.userId) {
    return false;
  }

  const permCtx: PermissionContext = {
    userId: ctx.userId,
    userType: 'employee',
  };

  return await checkPermission(permCtx, action, subject);
}

// Re-export UserContext type for convenience
export type { UserContext };

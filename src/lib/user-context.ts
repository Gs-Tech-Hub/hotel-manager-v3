/**
 * User Context Extractor
 * Extracts user info from request headers and loads roles from database
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export type UserContext = {
  userId?: string;
  userRole?: string;
  userRoles?: string[]; // all role codes
  isAdmin?: boolean;
};

/**
 * Extract user context from request headers
 * Expects: x-user-id and x-user-role headers (set by auth middleware/reverse proxy)
 * Or manually inject for testing
 */
export function extractUserContext(req: NextRequest): UserContext {
  const userId = req.headers.get('x-user-id') || undefined;
  const userRole = req.headers.get('x-user-role') || undefined;

  return {
    userId,
    userRole,
  };
}

/**
 * Load full user with all roles from database
 * Use this when you need complete role information
 */
export async function loadUserWithRoles(userId: string): Promise<UserContext | null> {
  try {
    const user = await prisma.adminUser.findUnique({
      where: { id: userId },
      include: {
        roles: {
          select: { code: true, name: true },
        },
      },
    });

    if (!user) return null;

    const roleCodes = user.roles.map((r: { code: string; name: string }) => r.code);
    const primaryRole = roleCodes[0]; // Use first role as primary

    return {
      userId: user.id,
      userRole: primaryRole,
      userRoles: roleCodes,
      isAdmin: roleCodes.includes('admin'),
    };
  } catch (error) {
    console.error('Error loading user with roles:', error);
    return null;
  }
}

/**
 * Simple validation: require user to have at least one of the allowed roles
 */
export function hasAnyRole(ctx: UserContext | undefined, allowedRoles: string[] = []): boolean {
  if (!ctx) return false;
  
  // Check primary role
  if (ctx.userRole && allowedRoles.includes(ctx.userRole)) return true;
  
  // Check all roles
  if (ctx.userRoles) {
    return ctx.userRoles.some(r => allowedRoles.includes(r));
  }
  
  return false;
}

/**
 * Require user to be owner of resource OR have allowed role
 */
export function isOwnerOrHasRole(
  ctx: UserContext | undefined,
  resourceOwnerId: string,
  allowedRoles: string[] = []
): boolean {
  if (!ctx) return false;
  if (ctx.userId === resourceOwnerId) return true;
  return hasAnyRole(ctx, allowedRoles);
}

/**
 * Require user to have admin role
 */
export function isAdmin(ctx: UserContext | undefined): boolean {
  return ctx?.isAdmin === true || hasAnyRole(ctx, ['admin']);
}

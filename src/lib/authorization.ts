import { errorResponse, ErrorCodes } from '@/lib/api-response';

export type UserContext = {
  userId?: string;
  userRole?: string;
};

// Simple role check helper
export function hasAnyRole(userRole: string | undefined, allowed: string[] = []): boolean {
  if (!userRole) return false;
  return allowed.includes(userRole);
}

export function requireRoleOrOwner(
  ctx: UserContext | undefined,
  ownerId: string,
  allowedRoles: string[] = []
): null | ReturnType<typeof errorResponse> {
  // If user is owner, allow
  if (ctx?.userId && ctx.userId === ownerId) return null;

  // If user has any of allowed roles, allow
  if (ctx?.userRole && allowedRoles.includes(ctx.userRole)) return null;

  return errorResponse(ErrorCodes.FORBIDDEN, 'Access denied');
}

export function requireRole(
  ctx: UserContext | undefined,
  allowedRoles: string[] = []
): null | ReturnType<typeof errorResponse> {
  if (ctx?.userRole && allowedRoles.includes(ctx.userRole)) return null;
  return errorResponse(ErrorCodes.FORBIDDEN, 'Access denied');
}

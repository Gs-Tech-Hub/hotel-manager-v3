/**
 * POST /api/admin/users/[userId]/roles - Assign role to user
 * DELETE /api/admin/users/[userId]/roles/[roleId] - Revoke role from user
 * GET /api/admin/users/[userId]/roles - Get user roles
 * 
 * Admin only
 */

import { NextRequest } from 'next/server';
import { roleManagementService } from '@/services/role-management.service';
import { extractUserContext, isAdmin } from '@/lib/user-context';
import { sendSuccess, sendError, validateBody } from '@/lib/api-handler';
import { ErrorCodes } from '@/lib/api-response';

interface RouteParams {
  params: Promise<{
    userId: string;
    roleId?: string;
  }>;
}

// GET - Get user roles
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await params;
    const ctx = await extractUserContext(req);

    if (!isAdmin(ctx)) {
      return sendError(ErrorCodes.FORBIDDEN, 'Admin access required');
    }

    const roles = await roleManagementService.getUserRoles(userId);

    return sendSuccess(roles, 'User roles fetched successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch user roles';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}

// POST - Assign role to user
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await params;
    const ctx = await extractUserContext(req);

    if (!isAdmin(ctx)) {
      return sendError(ErrorCodes.FORBIDDEN, 'Admin access required');
    }

    const { data, error } = await validateBody<{
      roleId: string;
    }>(req, (body) => {
      if (!body.roleId) {
        throw new Error('roleId is required');
      }
      return body;
    });

    if (error) return error;

    const result = await roleManagementService.assignRoleToUser(userId, data.roleId);

    if ('error' in result) {
      return sendError(result.error.code, result.error.message);
    }

    return sendSuccess(result, 'Role assigned successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to assign role';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}

// DELETE - Revoke role from user
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId, roleId } = await params;
    const ctx = await extractUserContext(req);

    if (!isAdmin(ctx)) {
      return sendError(ErrorCodes.FORBIDDEN, 'Admin access required');
    }

    if (!roleId) {
      return sendError(ErrorCodes.INVALID_INPUT, 'roleId is required');
    }

    const result = await roleManagementService.revokeRoleFromUser(userId, roleId);

    if ('error' in result) {
      return sendError(result.error.code, result.error.message);
    }

    return sendSuccess(result, 'Role revoked successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to revoke role';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}

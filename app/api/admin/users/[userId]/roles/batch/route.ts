/**
 * PUT /api/admin/users/[userId]/roles - Set all roles for a user (batch)
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
  }>;
}

// PUT - Set user roles (batch, overwrites existing)
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await params;
    const ctx = extractUserContext(req);

    if (!isAdmin(ctx)) {
      return sendError(ErrorCodes.FORBIDDEN, 'Admin access required');
    }

    const { data, error } = await validateBody<{
      roleIds: string[];
    }>(req, (body) => {
      if (!Array.isArray(body.roleIds)) {
        throw new Error('roleIds must be an array');
      }
      return body;
    });

    if (error) return error;

    const result = await roleManagementService.setUserRoles(userId, data.roleIds);

    if ('error' in result) {
      return sendError(result.error.code, result.error.message);
    }

    return sendSuccess(result, 'User roles updated successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to set user roles';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}

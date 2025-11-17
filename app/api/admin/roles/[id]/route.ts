/**
 * GET /api/admin/roles/[id] - Get role by ID
 * PUT /api/admin/roles/[id] - Update role
 * DELETE /api/admin/roles/[id] - Delete role
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
    id: string;
  }>;
}

// GET - Get role by ID
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = extractUserContext(req);

    if (!isAdmin(ctx)) {
      return sendError(ErrorCodes.FORBIDDEN, 'Admin access required');
    }

    // For now, fetch all and filter (can be optimized with direct query)
    const roles = await roleManagementService.getAllRoles();

    if ('error' in roles) {
      return sendError(roles.error.code, roles.error.message);
    }

    const role = (roles as any[]).find(r => r.id === id);
    if (!role) {
      return sendError(ErrorCodes.NOT_FOUND, 'Role not found');
    }

    return sendSuccess(role, 'Role fetched successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch role';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}

// PUT - Update role
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = extractUserContext(req);

    if (!isAdmin(ctx)) {
      return sendError(ErrorCodes.FORBIDDEN, 'Admin access required');
    }

    const { data, error } = await validateBody<{
      name?: string;
      description?: string;
    }>(req, (body) => body);

    if (error) return error;

    const result = await roleManagementService.updateRole(id, data);

    if ('error' in result) {
      return sendError(result.error.code, result.error.message);
    }

    return sendSuccess(result, 'Role updated successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update role';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}

// DELETE - Delete role
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = extractUserContext(req);

    if (!isAdmin(ctx)) {
      return sendError(ErrorCodes.FORBIDDEN, 'Admin access required');
    }

    const result = await roleManagementService.deleteRole(id);

    if ('error' in result) {
      return sendError(result.error.code, result.error.message);
    }

    return sendSuccess(result, 'Role deleted successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete role';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}

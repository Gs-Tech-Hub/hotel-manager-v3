/**
 * GET /api/admin/roles - List all roles
 * POST /api/admin/roles - Create new role
 * 
 * Admin only
 */

import { NextRequest } from 'next/server';
import { roleManagementService } from '@/services/role-management.service';
import { extractUserContext, isAdmin } from '@/lib/user-context';
import { sendSuccess, sendError, validateBody } from '@/lib/api-handler';
import { ErrorCodes } from '@/lib/api-response';

// GET - List all roles
export async function GET(req: NextRequest) {
  try {
    const ctx = extractUserContext(req);

    // Check admin access
    if (!isAdmin(ctx)) {
      return sendError(ErrorCodes.FORBIDDEN, 'Admin access required');
    }

    const roles = await roleManagementService.getAllRoles();

    if ('error' in roles) {
      return sendError(roles.error.code, roles.error.message);
    }

    return sendSuccess(roles, 'Roles fetched successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch roles';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}

// POST - Create new role
export async function POST(req: NextRequest) {
  try {
    const ctx = extractUserContext(req);

    // Check admin access
    if (!isAdmin(ctx)) {
      return sendError(ErrorCodes.FORBIDDEN, 'Admin access required');
    }

    const { data, error } = await validateBody<{
      code: string;
      name: string;
      description?: string;
    }>(req, (body) => {
      if (!body.code || !body.name) {
        throw new Error('code and name are required');
      }
      return body;
    });

    if (error) return error;

    const result = await roleManagementService.createRole(
      data.code,
      data.name,
      data.description
    );

    if ('error' in result) {
      return sendError(result.error.code, result.error.message);
    }

    return sendSuccess(result, 'Role created successfully', 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create role';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}

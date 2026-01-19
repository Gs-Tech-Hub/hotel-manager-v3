import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { hasRole, checkPermission } from '@/lib/auth/rbac';
import { extractUserContext, loadUserWithRoles } from '@/lib/user-context';
import { listSections, createSection, deleteSection } from '@/services/admin/departmentSections';

/**
 * GET /api/departments/sections
 * List all department sections with pagination
 * Requires: admin role or department_sections read permission
 * 
 * Query Parameters:
 * - page: page number (default: 1)
 * - limit: items per page (default: 50, max: 200)
 * - departmentId: filter by department ID (optional)
 */
export const GET = withAuth(
  async (req, ctx) => {
    try {
      console.time('GET /api/departments/sections')
      
      // Check if user is admin or has permission
      const isAdmin = await loadUserWithRoles(ctx.userId).then(u => u?.isAdmin);
      const hasPermission = !isAdmin ? await hasRole(ctx, 'admin') : true;
      
      if (!isAdmin && !hasPermission) {
        return NextResponse.json(
          { success: false, error: 'Insufficient permissions' },
          { status: 403 }
        );
      }

      const url = new URL(req.url);
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
      const requestedLimit = parseInt(url.searchParams.get('limit') || '50');
      const MAX_LIMIT = 200;
      const limit = Math.min(MAX_LIMIT, requestedLimit);

      const departmentId = url.searchParams.get('departmentId') || undefined;
      const { rows, total } = await listSections({ page, limit, departmentId });

      const resp = NextResponse.json(
        { 
          success: true, 
          data: rows, 
          pagination: { 
            page, 
            limit, 
            total, 
            pages: Math.ceil(total / limit) 
          } 
        }, 
        { status: 200 }
      );
      console.timeEnd('GET /api/departments/sections')
      return resp
    } catch (error) {
      console.error('[API] List department sections error:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to list department sections' 
        }, 
        { status: 500 }
      );
    }
  }
);

/**
 * POST /api/departments/sections
 * Create a new department section
 * Requires: admin role or department_sections create permission
 * 
 * Request Body:
 * {
 *   name: string (required)
 *   departmentId: string (required)
 *   slug?: string
 *   metadata?: object
 * }
 */
export const POST = withAuth(
  async (req, ctx) => {
    try {
      console.time('POST /api/departments/sections')
      
      // Check if user is admin or has permission
      const userWithRoles = await loadUserWithRoles(ctx.userId);
      const isAdmin = userWithRoles?.isAdmin;
      
      if (!isAdmin) {
        // For non-admin employees, check if they have the specific permission
        const hasPermission = await checkPermission(ctx, 'department_sections', 'create');
        if (!hasPermission) {
          return NextResponse.json(
            { success: false, error: 'Insufficient permissions to create sections' },
            { status: 403 }
          );
        }
      }
      
      const body = await req.json();
      
      // Validate required fields
      if (!body.name || !body.departmentId) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Missing required fields: name, departmentId' 
          }, 
          { status: 400 }
        );
      }

      const section = await createSection(body, { userId: ctx.userId, userType: ctx.userType });

      const resp = NextResponse.json(
        { 
          success: true, 
          data: section 
        }, 
        { status: 201 }
      );
      console.timeEnd('POST /api/departments/sections')
      return resp
    } catch (error: any) {
      console.error('[API] Create department section error:', error);
      if (error?.message?.includes('Missing required')) {
        return NextResponse.json(
          { 
            success: false, 
            error: error.message 
          }, 
          { status: 400 }
        );
      }
      if (error?.message?.includes('Department not found')) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Department not found' 
          }, 
          { status: 404 }
        );
      }
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to create department section' 
        }, 
        { status: 500 }
      );
    }
  }
);

/**
 * DELETE /api/departments/sections?id={id}
 * Delete a department section (soft delete)
 * Requires: admin role or department_sections delete permission
 * 
 * Query Parameters:
 * - id: section ID (required)
 */
export const DELETE = withAuth(
  async (req, ctx) => {
    try {
      console.time('DELETE /api/departments/sections')
      
      // Check if user is admin or has permission
      const userWithRoles = await loadUserWithRoles(ctx.userId);
      const isAdmin = userWithRoles?.isAdmin;
      
      if (!isAdmin) {
        // For non-admin employees, check if they have the specific permission
        const hasPermission = await checkPermission(ctx, 'department_sections', 'delete');
        if (!hasPermission) {
          return NextResponse.json(
            { success: false, error: 'Insufficient permissions to delete sections' },
            { status: 403 }
          );
        }
      }
      
      const url = new URL(req.url);
      // Try to get ID from query string first (for dashboard delete), then from pathname (for direct DELETE calls)
      let id = url.searchParams.get('id');
      if (!id) {
        const last = url.pathname.split('/').pop();
        id = last ?? null;
      }
      if (!id) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Missing section id' 
          }, 
          { status: 400 }
        );
      }

      const section = await deleteSection(id!, { userId: ctx.userId, userType: ctx.userType });

      const resp = NextResponse.json(
        { 
          success: true, 
          data: section 
        }, 
        { status: 200 }
      );
      console.timeEnd('DELETE /api/departments/sections')
      return resp
    } catch (error: any) {
      console.error('[API] Delete department section error:', error);
      if (error?.message?.includes('Section not found')) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Section not found' 
          }, 
          { status: 404 }
        );
      }
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to delete department section' 
        }, 
        { status: 500 }
      );
    }
  }
);


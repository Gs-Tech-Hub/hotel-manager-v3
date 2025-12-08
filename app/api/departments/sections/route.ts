import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/middleware';
import { listSections, createSection, deleteSection } from '@/src/services/admin/departmentSections';

/**
 * GET /api/departments/sections
 * List all department sections with pagination
 * Requires: department_sections.read permission
 */
export const GET = withPermission(
  async (req, ctx) => {
    try {
      console.time('GET /api/departments/sections')
      const url = new URL(req.url);
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
      const requestedLimit = parseInt(url.searchParams.get('limit') || '50');
      const MAX_LIMIT = 200;
      const limit = Math.min(MAX_LIMIT, requestedLimit);

      const departmentId = url.searchParams.get('departmentId') || undefined;
      const { rows, total } = await listSections({ page, limit, departmentId });

      const resp = NextResponse.json({ success: true, data: rows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } }, { status: 200 });
      console.timeEnd('GET /api/departments/sections')
      return resp
    } catch (error) {
      console.error('[API] List department sections error:', error);
      return NextResponse.json({ error: 'Failed to list department sections' }, { status: 500 });
    }
  },
  'department_sections.read'
);

/**
 * POST /api/departments/sections
 * Create a new department section
 * Requires: department_sections.create permission
 */
export const POST = withPermission(
  async (req, ctx) => {
    try {
      console.time('POST /api/departments/sections')
      const body = await req.json();
      const section = await createSection(body, { userId: ctx.userId, userType: ctx.userType });

      const resp = NextResponse.json({ success: true, data: section }, { status: 201 });
      console.timeEnd('POST /api/departments/sections')
      return resp
    } catch (error: any) {
      console.error('[API] Create department section error:', error);
      if (error?.message?.includes('Missing required')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ error: 'Failed to create department section' }, { status: 500 });
    }
  },
  'department_sections.create'
);

/**
 * DELETE /api/departments/sections?id={id}
 * Delete a department section
 * Requires: department_sections.delete permission
 */
export const DELETE = withPermission(
  async (req, ctx) => {
    try {
      console.time('DELETE /api/departments/sections')
      const url = new URL(req.url);
      // Try to get ID from query string first (for dashboard delete), then from pathname (for direct DELETE calls)
      let id = url.searchParams.get('id');
      if (!id) {
        const last = url.pathname.split('/').pop();
        id = last ?? null;
      }
      if (!id) return NextResponse.json({ error: 'Missing section id' }, { status: 400 });

      const section = await deleteSection(id!, { userId: ctx.userId, userType: ctx.userType });

      const resp = NextResponse.json({ success: true, data: section }, { status: 200 });
      console.timeEnd('DELETE /api/departments/sections')
      return resp
    } catch (error) {
      console.error('[API] Delete department section error:', error);
      return NextResponse.json({ error: 'Failed to delete department section' }, { status: 500 });
    }
  },
  'department_sections.delete'
);

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/middleware';
import { listSections, createSection, deleteSection } from '@/src/services/admin/departmentSections';

export const GET = withPermission(
  async (req, ctx) => {
    try {
      const url = new URL(req.url);
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');

      const { rows, total } = await listSections({ page, limit });

      return NextResponse.json({ success: true, data: rows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } }, { status: 200 });
    } catch (error) {
      console.error('[ADMIN] List department sections error:', error);
      return NextResponse.json({ error: 'Failed to list department sections' }, { status: 500 });
    }
  },
  'department_sections.read'
);

export const POST = withPermission(
  async (req, ctx) => {
    try {
      const body = await req.json();
      const section = await createSection(body, { userId: ctx.userId, userType: ctx.userType });

      return NextResponse.json({ success: true, data: section }, { status: 201 });
    } catch (error: any) {
      console.error('[ADMIN] Create department section error:', error);
      if (error?.message?.includes('Missing required')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ error: 'Failed to create department section' }, { status: 500 });
    }
  },
  'department_sections.create'
);

export const DELETE = withPermission(
  async (req, ctx) => {
    try {
      const url = new URL(req.url);
      // Try to get ID from query string first (for dashboard delete), then from pathname (for direct DELETE calls)
      let id = url.searchParams.get('id');
      if (!id) {
        id = url.pathname.split('/').pop();
      }
      if (!id) return NextResponse.json({ error: 'Missing section id' }, { status: 400 });

      const section = await deleteSection(id!, { userId: ctx.userId, userType: ctx.userType });

      return NextResponse.json({ success: true, data: section }, { status: 200 });
    } catch (error) {
      console.error('[ADMIN] Delete department section error:', error);
      return NextResponse.json({ error: 'Failed to delete department section' }, { status: 500 });
    }
  },
  'department_sections.delete'
);

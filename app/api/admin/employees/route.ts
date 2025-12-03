import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/middleware';
import { listEmployees, createEmployee, deleteEmployee } from '@/src/services/admin/employees';

export const GET = withPermission(
  async (req, ctx) => {
    try {
      const url = new URL(req.url);
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');

      const { rows, total } = await listEmployees({ page, limit });

      return NextResponse.json({ success: true, data: rows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } }, { status: 200 });
    } catch (error) {
      console.error('[ADMIN] List employees error:', error);
      return NextResponse.json({ error: 'Failed to list employees' }, { status: 500 });
    }
  },
  'employees.read'
);

export const POST = withPermission(
  async (req, ctx) => {
    try {
      const body = await req.json();
      const employee = await createEmployee(body, { userId: ctx.userId, userType: ctx.userType });

      return NextResponse.json({ success: true, data: employee }, { status: 201 });
    } catch (error: any) {
      console.error('[ADMIN] Create employee error:', error);
      if (error?.message?.includes('already exists')) {
        return NextResponse.json({ error: 'Employee with this email already exists' }, { status: 409 });
      }
      if (error?.message?.includes('Missing required')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 });
    }
  },
  'employees.create'
);

export const DELETE = withPermission(
  async (req, ctx) => {
    try {
      const url = new URL(req.url);
      const id = url.pathname.split('/').pop();
      if (!id) return NextResponse.json({ error: 'Missing employee id' }, { status: 400 });

      const employee = await deleteEmployee(id, { userId: ctx.userId, userType: ctx.userType });

      return NextResponse.json({ success: true, data: employee }, { status: 200 });
    } catch (error) {
      console.error('[ADMIN] Delete employee error:', error);
      return NextResponse.json({ error: 'Failed to delete employee' }, { status: 500 });
    }
  },
  'employees.delete'
);

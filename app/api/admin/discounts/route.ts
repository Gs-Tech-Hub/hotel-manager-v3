import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/middleware';
import { listDiscounts, createDiscount, deleteDiscount } from '@/src/services/admin/discounts';

export const GET = withPermission(
  async (req, ctx) => {
    try {
      const url = new URL(req.url);
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');

      const { rows, total } = await listDiscounts({ page, limit });

      return NextResponse.json({ success: true, data: rows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } }, { status: 200 });
    } catch (error) {
      console.error('[ADMIN] List discounts error:', error);
      return NextResponse.json({ error: 'Failed to list discounts' }, { status: 500 });
    }
  },
  'discounts.read'
);

export const POST = withPermission(
  async (req, ctx) => {
    try {
      const body = await req.json();
      const discount = await createDiscount(body, { userId: ctx.userId, userType: ctx.userType });

      return NextResponse.json({ success: true, data: discount }, { status: 201 });
    } catch (error: any) {
      console.error('[ADMIN] Create discount error:', error);
      if (error?.message?.includes('Missing required')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ error: 'Failed to create discount' }, { status: 500 });
    }
  },
  'discounts.create'
);

export const DELETE = withPermission(
  async (req, ctx) => {
    try {
      const url = new URL(req.url);
      const id = url.pathname.split('/').pop();
      if (!id) return NextResponse.json({ error: 'Missing discount id' }, { status: 400 });

      const discount = await deleteDiscount(id, { userId: ctx.userId, userType: ctx.userType });

      return NextResponse.json({ success: true, data: discount }, { status: 200 });
    } catch (error) {
      console.error('[ADMIN] Delete discount error:', error);
      return NextResponse.json({ error: 'Failed to delete discount' }, { status: 500 });
    }
  },
  'discounts.delete'
);

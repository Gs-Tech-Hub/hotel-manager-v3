import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/middleware';
import { listInventoryItems, createInventoryItem, deleteInventoryItem } from '@/src/services/admin/inventoryItems';

export const GET = withPermission(
  async (req, ctx) => {
    try {
      const url = new URL(req.url);
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');

      const { rows, total } = await listInventoryItems({ page, limit });

      return NextResponse.json({ success: true, data: rows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } }, { status: 200 });
    } catch (error) {
      console.error('[ADMIN] List inventory items error:', error);
      return NextResponse.json({ error: 'Failed to list inventory items' }, { status: 500 });
    }
  },
  'inventory_items.read'
);

export const POST = withPermission(
  async (req, ctx) => {
    try {
      const body = await req.json();
      const item = await createInventoryItem(body, { userId: ctx.userId, userType: ctx.userType });

      return NextResponse.json({ success: true, data: item }, { status: 201 });
    } catch (error: any) {
      console.error('[ADMIN] Create inventory item error:', error);
      if (error?.message?.includes('already exists')) {
        return NextResponse.json({ error: 'Item with this SKU already exists' }, { status: 409 });
      }
      if (error?.message?.includes('Missing required')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ error: 'Failed to create inventory item' }, { status: 500 });
    }
  },
  'inventory_items.create'
);

export const DELETE = withPermission(
  async (req, ctx) => {
    try {
      const url = new URL(req.url);
      const id = url.pathname.split('/').pop();
      if (!id) return NextResponse.json({ error: 'Missing inventory item id' }, { status: 400 });

      const item = await deleteInventoryItem(id, { userId: ctx.userId, userType: ctx.userType });

      return NextResponse.json({ success: true, data: item }, { status: 200 });
    } catch (error) {
      console.error('[ADMIN] Delete inventory item error:', error);
      return NextResponse.json({ error: 'Failed to delete inventory item' }, { status: 500 });
    }
  },
  'inventory_items.delete'
);

import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/lib/auth/middleware";
import { listDepartments as svcList, createDepartment as svcCreate, deleteDepartment as svcDelete } from "@/src/services/admin/departments";

// List
export const GET = withPermission(
  async (req, ctx) => {
    try {
      const url = new URL(req.url);
      const page = parseInt(url.searchParams.get("page") || "1");
      const limit = parseInt(url.searchParams.get("limit") || "50");

      const { rows, total } = await svcList({ page, limit });

      return NextResponse.json({ success: true, data: rows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } }, { status: 200 });
    } catch (error) {
      console.error('[ADMIN] List departments error:', error);
      return NextResponse.json({ error: 'Failed to list departments' }, { status: 500 });
    }
  },
  "departments.read"
);

// Create
export const POST = withPermission(
  async (req, ctx) => {
    try {
      const body = await req.json();
      const dept = await svcCreate(body, { userId: ctx.userId, userType: ctx.userType });

      return NextResponse.json({ success: true, data: dept }, { status: 201 });
    } catch (error: any) {
      console.error('[ADMIN] Create department error:', error);
      if (error?.code === 'P2025' || error?.message?.includes('already exists')) {
        return NextResponse.json({ error: 'Department with this code already exists' }, { status: 409 });
      }
      if (error?.message?.includes('Missing required')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ error: 'Failed to create department' }, { status: 500 });
    }
  },
  "departments.create"
);

// Delete (soft)
export const DELETE = withPermission(
  async (req, ctx) => {
    try {
      const url = new URL(req.url);
      const id = url.pathname.split('/').pop();
      if (!id) return NextResponse.json({ error: 'Missing department id' }, { status: 400 });

      const dept = await svcDelete(id, { userId: ctx.userId, userType: ctx.userType });

      return NextResponse.json({ success: true, message: 'Department deactivated successfully', data: dept }, { status: 200 });
    } catch (error) {
      console.error('[ADMIN] Delete department error:', error);
      return NextResponse.json({ error: 'Failed to delete department' }, { status: 500 });
    }
  },
  "departments.delete"
);

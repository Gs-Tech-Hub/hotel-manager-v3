/**
 * Department Management API Routes
 * 
 * GET /api/departments             - List departments
 * POST /api/departments            - Create department (admin only)
 * DELETE /api/departments/[id]     - Delete department (admin only)
 * GET /api/departments/[code]      - Get department details
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractUserContext, loadUserWithRoles } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';
import { withPermission } from '@/lib/auth/middleware';

/**
 * GET /api/departments
 * List all departments
 */
export async function GET(request: NextRequest) {
  try {
    console.time('GET /api/departments')
    const url = new URL(request.url)
    const parentCode = url.searchParams.get('parentCode') || null
    // Extract user context
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'Not authenticated'),
        { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    const userWithRoles = await loadUserWithRoles(ctx.userId);
    if (!userWithRoles) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'User not found'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // If a parentCode is provided, return only child departments to avoid
    // loading the entire departments table into the client.
    let departments: any[] = []
    if (parentCode) {
      const parent = await (prisma as any).department.findUnique({ where: { code: parentCode } })
      if (!parent) {
        return NextResponse.json(successResponse([]))
      }
      // Match by code prefix (sections), or by referenceType/referenceId linkage.
      departments = await (prisma as any).department.findMany({
        where: {
          isActive: true,
          OR: [
            { code: { startsWith: `${parent.code}:` } },
            { referenceType: parent.code },
            { referenceId: parent.id },
          ],
        },
        orderBy: { code: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          isActive: true,
          slug: true,
          type: true,
          icon: true,
          image: true,
          referenceType: true,
          referenceId: true,
          metadata: true,
        },
      })
    } else {
      // Query all active departments (avoid including large relations directly)
      departments = await (prisma as any).department.findMany({
        where: { isActive: true },
        orderBy: { code: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          isActive: true,
          slug: true,
          type: true,
          icon: true,
          image: true,
          referenceType: true,
          referenceId: true,
          metadata: true,
        },
      });
    }

    // Aggregate order counts per department/status to avoid heavy joins
    const orderCounts = await (prisma as any).orderDepartment.groupBy({
      by: ['departmentId', 'status'],
      _count: { _all: true },
    });

    const countsByDept: Record<string, { total: number; pending: number; processing: number; fulfilled: number }> = {};
    for (const row of orderCounts) {
      const deptId = row.departmentId as string;
      if (!countsByDept[deptId]) countsByDept[deptId] = { total: 0, pending: 0, processing: 0, fulfilled: 0 };
      const cnt = (row as any)._count?._all || 0;
      countsByDept[deptId].total += cnt;
      if (row.status === 'pending') countsByDept[deptId].pending += cnt;
      if (row.status === 'processing') countsByDept[deptId].processing += cnt;
      if (row.status === 'fulfilled') countsByDept[deptId].fulfilled += cnt;
    }

    // Calculate stats for each department (handle sections specially)
    const departmentsWithStats: any[] = [];
    for (const dept of departments) {
      let stats = countsByDept[dept.id] || { total: 0, pending: 0, processing: 0, fulfilled: 0 };
      try {
        const codeStr = (dept.code || '').toString();
        if (codeStr.includes(':')) {
          // compute based on order lines referencing this section code
          const headerRows = await (prisma as any).orderLine.findMany({
            where: { departmentCode: dept.code },
            distinct: ['orderHeaderId'],
            select: { orderHeaderId: true },
          });
          const headerIds = (headerRows || []).map((h: any) => h.orderHeaderId).filter(Boolean);
          if (headerIds.length) {
            const hdrCounts = await (prisma as any).orderHeader.groupBy({ by: ['status'], where: { id: { in: headerIds } }, _count: { _all: true } });
            const tmp: any = { total: 0, pending: 0, processing: 0, fulfilled: 0 };
            for (const r of hdrCounts) {
              const cnt = (r as any)._count?._all || 0;
              tmp.total += cnt;
              if (r.status === 'pending') tmp.pending += cnt;
              if (r.status === 'processing') tmp.processing += cnt;
              if (r.status === 'fulfilled') tmp.fulfilled += cnt;
            }
            stats = tmp;
          } else {
            stats = { total: 0, pending: 0, processing: 0, fulfilled: 0 };
          }
        }
      } catch (e) {
        // ignore and fallback to countsByDept
      }

      departmentsWithStats.push({
        id: dept.id,
        code: dept.code,
        name: dept.name,
        description: dept.description,
        isActive: dept.isActive,
        slug: dept.slug,
        type: dept.type,
        icon: dept.icon,
        image: dept.image,
        referenceType: dept.referenceType,
        referenceId: dept.referenceId,
        metadata: dept.metadata || {},
        totalOrders: stats.total,
        pendingOrders: stats.pending,
        processingOrders: stats.processing,
        fulfilledOrders: stats.fulfilled,
      });
    }

    const resp = NextResponse.json(successResponse(departmentsWithStats));
    console.timeEnd('GET /api/departments')
    return resp
  } catch (error) {
    console.error('GET /api/departments error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch departments'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

/**
 * POST /api/departments
 * Create a new department (admin only)
 */
async function postHandler(request: NextRequest) {
  try {
    console.time('POST /api/departments')

    const body = await request.json();
    const { code, name, description, type, icon, image } = body;

    if (!code || !name) {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, 'code and name are required'),
        { status: 400 }
      );
    }

    // Check if department code already exists
    const existing = await (prisma as any).department.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json(
        errorResponse(ErrorCodes.CONFLICT, 'Department with this code already exists'),
        { status: 409 }
      );
    }

    // Create new department
    const department = await (prisma as any).department.create({
      data: {
        code,
        name,
        description: description || null,
        type: type || null,
        icon: icon || null,
        image: image || null,
        isActive: true,
        slug: code.toLowerCase(),
      },
    });

    const resp = NextResponse.json(
      successResponse(department),
      { status: 201 }
    );
    console.timeEnd('POST /api/departments')
    return resp
  } catch (error) {
    console.error('POST /api/departments error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to delete department'),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/departments/:id
 * Delete/deactivate a department (admin only)
 */
async function deleteHandler(request: NextRequest) {
  try {
    console.time('DELETE /api/departments')

    const url = new URL(request.url);
    const id = url.pathname.split('/').pop();

    if (!id) {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, 'Department ID is required'),
        { status: 400 }
      );
    }

    // Find department
    const department = await (prisma as any).department.findUnique({
      where: { id },
    });

    if (!department) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Department not found'),
        { status: 404 }
      );
    }

    // Soft delete by marking as inactive
    const updated = await (prisma as any).department.update({
      where: { id },
      data: { isActive: false },
    });

    const resp = NextResponse.json(successResponse(updated));
    console.timeEnd('DELETE /api/departments')
    return resp
  } catch (error) {
    console.error('DELETE /api/departments error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to delete department'),
      { status: 500 }
    );
  }
}

export const DELETE = withPermission(
  deleteHandler,
  'departments.delete'
);

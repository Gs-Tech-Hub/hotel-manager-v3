/**
 * Department Management API Routes
 * 
 * GET /api/departments             - List departments
 * GET /api/departments/[code]     - Get department details
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractUserContext, loadUserWithRoles } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';

/**
 * GET /api/departments
 * List all departments
 */
export async function GET(request: NextRequest) {
  try {
    // Extract user context if present. Departments listing is public, so
    // we don't require authentication here — but we still load full roles
    // when headers are provided to allow role-aware responses elsewhere.
    const ctx = await extractUserContext(request);
    let userWithRoles = null as any | null
    if (ctx?.userId) {
      userWithRoles = await loadUserWithRoles(ctx.userId);
    }

    // Query all active departments (avoid including large relations directly)
    const departments = await (prisma as any).department.findMany({
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

    return NextResponse.json(successResponse(departmentsWithStats));
  } catch (error) {
    console.error('GET /api/departments error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch departments'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

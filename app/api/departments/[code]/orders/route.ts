/**
 * Department-Specific Order Routes
 * 
 * GET /api/departments/[code]/orders  - Get orders for department
 * GET /api/departments/[code]/pending - Get pending items (kitchen display)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';

/**
 * GET /api/departments/[code]/orders
 * Get all orders for a specific department
 * 
 * Query parameters:
 * - status: filter by status (pending, processing, fulfilled, completed)
 * - page: pagination (default: 1)
 * - limit: page size (default: 20)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code: departmentCode } = await params;

    // Get user context
    const ctx = extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'Not authenticated'),
        { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    // Load full user with roles
    const userWithRoles = await loadUserWithRoles(ctx.userId);
    if (!userWithRoles || !hasAnyRole(userWithRoles, ['admin', 'manager', 'staff'])) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Only staff can view department orders'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

    // Get department
    const department = await (prisma as any).department.findUnique({
      where: { code: departmentCode },
    });

    if (!department) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Department not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Build filters
    const filters: any = {
      departmentId: department.id,
    };
    if (status) {
      filters.status = status;
    }

    // Query orders
    const skip = (page - 1) * limit;
    const [orderDepartments, total] = await Promise.all([
      (prisma as any).orderDepartment.findMany({
        where: filters,
        include: {
          orderHeader: {
            include: {
              customer: true,
              lines: {
                where: { departmentCode },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      (prisma as any).orderDepartment.count({ where: filters }),
    ]);

    // Transform response
    const orders = orderDepartments.map((od: any) => ({
      departmentOrderId: od.id,
      orderHeader: od.orderHeader,
      departmentStatus: od.status,
      lines: od.orderHeader.lines,
    }));

    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;

    return NextResponse.json(
      successResponse({
        department: {
          code: department.code,
          name: department.name,
        },
        orders,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasMore,
        },
      })
    );
  } catch (error) {
    console.error('GET /api/departments/[code]/orders error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch department orders'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

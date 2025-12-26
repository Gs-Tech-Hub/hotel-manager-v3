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
    const ctx = await extractUserContext(request);
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
    const fromDate = searchParams.get('fromDate') || undefined;
    const toDate = searchParams.get('toDate') || undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

    // Normalize code (decode if needed)
    let lookupCode = departmentCode;
    try {
      for (let i = 0; i < 3; i++) {
        const decoded = decodeURIComponent(lookupCode);
        if (decoded === lookupCode) break;
        lookupCode = decoded;
      }
    } catch (e) {
      lookupCode = departmentCode;
    }

    // Determine if this is a section code (contains ':')
    let filterCode: string | null = lookupCode;
    let department: any = null;

    if (lookupCode.includes(':')) {
      // Section code - use it directly for filtering orders
      const parts = lookupCode.split(':');
      const parentCode = parts[0];
      
      // Get parent department for response info
      department = await (prisma as any).department.findUnique({
        where: { code: parentCode },
      });
      
      // Filter will use the section code (departmentCode field in OrderLine)
      filterCode = lookupCode;
    } else {
      // Parent department code
      department = await (prisma as any).department.findUnique({
        where: { code: lookupCode },
      });
      
      // Filter will use departmentId for parent departments
      filterCode = null;
    }

    if (!department) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Department not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Build filters based on department vs section
    let orders: any[] = [];
    let total = 0;

    if (filterCode && filterCode.includes(':')) {
      // Section: filter by departmentCode in orderLine
      const lineWhere: any = { departmentCode: filterCode };
      if (status) {
        lineWhere.status = status;
      }

      const headerRows = await (prisma as any).orderLine.findMany({
        where: lineWhere,
        distinct: ['orderHeaderId'],
        select: { orderHeaderId: true },
      });

      const headerIds = (headerRows || []).map((h: any) => h.orderHeaderId).filter(Boolean);
      total = headerIds.length;

      const skip = (page - 1) * limit;
      const paginatedIds = headerIds.slice(skip, skip + limit);

      if (paginatedIds.length > 0) {
        // Build date filter for orderHeader
        const dateWhere: any = {};
        if (fromDate || toDate) {
          if (fromDate && toDate) {
            dateWhere.createdAt = {
              gte: new Date(fromDate),
              lte: new Date(new Date(toDate).getTime() + 86400000 - 1), // End of toDate
            };
          } else if (fromDate) {
            dateWhere.createdAt = { gte: new Date(fromDate) };
          } else if (toDate) {
            dateWhere.createdAt = { lte: new Date(new Date(toDate).getTime() + 86400000 - 1) };
          }
        }

        const orderHeaders = await (prisma as any).orderHeader.findMany({
          where: { id: { in: paginatedIds }, ...dateWhere },
          include: {
            customer: true,
            lines: {
              where: { departmentCode: filterCode },
            },
          },
          orderBy: { createdAt: 'desc' },
        });

        orders = orderHeaders.map((oh: any) => ({
          orderHeader: oh,
          departmentStatus: oh.status,
          lines: oh.lines,
        }));
      }
    } else {
      // Parent department: filter by departmentId in orderDepartment
      const filters: any = {
        departmentId: department.id,
      };
      if (status) {
        filters.status = status;
      }

      // Build date filter for orderHeader
      const dateWhere: any = {};
      if (fromDate || toDate) {
        if (fromDate && toDate) {
          dateWhere.createdAt = {
            gte: new Date(fromDate),
            lte: new Date(new Date(toDate).getTime() + 86400000 - 1), // End of toDate
          };
        } else if (fromDate) {
          dateWhere.createdAt = { gte: new Date(fromDate) };
        } else if (toDate) {
          dateWhere.createdAt = { lte: new Date(new Date(toDate).getTime() + 86400000 - 1) };
        }
      }

      const skip = (page - 1) * limit;
      const [orderDepartments, countTotal] = await Promise.all([
        (prisma as any).orderDepartment.findMany({
          where: {
            ...filters,
            ...(Object.keys(dateWhere).length > 0 ? { orderHeader: dateWhere } : {}),
          },
          include: {
            orderHeader: {
              where: Object.keys(dateWhere).length > 0 ? dateWhere : undefined,
              include: {
                customer: true,
                lines: {
                  where: { departmentCode: department.code },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        (prisma as any).orderDepartment.count({
          where: {
            ...filters,
            ...(Object.keys(dateWhere).length > 0 ? { orderHeader: dateWhere } : {}),
          },
        }),
      ]);

      total = countTotal;
      orders = orderDepartments.map((od: any) => ({
        departmentOrderId: od.id,
        orderHeader: od.orderHeader,
        departmentStatus: od.status,
        lines: od.orderHeader.lines,
      }));
    }

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

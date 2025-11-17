/**
 * Department Management API Routes
 * 
 * GET /api/departments             - List departments
 * GET /api/departments/[code]     - Get department details
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';

/**
 * GET /api/departments
 * List all departments
 */
export async function GET(request: NextRequest) {
  try {
    // Get user context
    const ctx = extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'Not authenticated'),
        { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    // Load full user with roles - anyone can view departments
    const userWithRoles = await loadUserWithRoles(ctx.userId);
    if (!userWithRoles) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'Not authenticated'),
        { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    // Query all active departments
    const departments = await (prisma as any).department.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
      include: {
        orderDepartments: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    // Calculate stats for each department
    const departmentsWithStats = departments.map((dept: any) => ({
      id: dept.id,
      code: dept.code,
      name: dept.name,
      description: dept.description,
      isActive: dept.isActive,
      totalOrders: dept.orderDepartments.length,
      pendingOrders: dept.orderDepartments.filter((od: any) => od.status === 'pending').length,
      processingOrders: dept.orderDepartments.filter((od: any) => od.status === 'processing').length,
      fulfilledOrders: dept.orderDepartments.filter((od: any) => od.status === 'fulfilled').length,
    }));

    return NextResponse.json(successResponse(departmentsWithStats));
  } catch (error) {
    console.error('GET /api/departments error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch departments'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

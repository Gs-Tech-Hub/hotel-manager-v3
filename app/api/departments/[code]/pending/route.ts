/**
 * Department Pending Items Route (Kitchen/Bar Display System)
 * 
 * GET /api/departments/[code]/pending - Get pending items for department
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';

/**
 * GET /api/departments/[code]/pending
 * Get pending items for department (kitchen/bar display system)
 * 
 * This endpoint returns items that need to be prepared for a department,
 * ordered by creation time (FIFO - first in, first out).
 * 
 * Query parameters:
 * - sortBy: "createdAt" (default) | "status" | "priority"
 * - includeProcessing: include items being prepared (default: true)
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
        errorResponse(ErrorCodes.FORBIDDEN, 'Only staff can view pending items'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const includeProcessing = searchParams.get('includeProcessing') !== 'false';

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

    // Get pending/processing items
    const statuses = includeProcessing ? ['pending', 'processing'] : ['pending'];

    const items = await (prisma as any).orderLine.findMany({
      where: {
        departmentCode,
        status: { in: statuses },
      },
      include: {
        orderHeader: {
          include: {
            customer: true,
            payments: true,
          },
        },
        fulfillments: true,
      },
      orderBy: {
        [sortBy]: 'asc',
      },
    });

    // Group by status
    const pending = items.filter((i: any) => i.status === 'pending');
    const processing = items.filter((i: any) => i.status === 'processing');

    // Calculate summary
    const summary = {
      totalPending: pending.length,
      totalProcessing: processing.length,
      totalItems: items.length,
      averageWaitTime: calculateAverageWaitTime(items),
    };

    // Transform response for display
    const displayItems = items.map((item: any) => ({
      id: item.id,
      lineNumber: item.lineNumber,
      productName: item.productName,
      quantity: item.quantity,
      status: item.status,
      orderNumber: item.orderHeader.orderNumber,
      customerName: item.orderHeader.customer?.name || 'Unknown',
      notes: item.orderHeader.notes,
      createdAt: item.createdAt,
      waitMinutes: Math.floor((Date.now() - item.createdAt.getTime()) / 60000),
      isPaid: item.orderHeader.payments.length > 0,
    }));

    return NextResponse.json(
      successResponse({
        data: {
          department: {
            code: department.code,
            name: department.name,
          },
          summary,
          items: displayItems,
          pending: displayItems.filter((i: any) => i.status === 'pending'),
          processing: displayItems.filter((i: any) => i.status === 'processing'),
        },
      })
    );
  } catch (error) {
    console.error('GET /api/departments/[code]/pending error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch pending items'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

/**
 * Calculate average wait time in minutes
 */
function calculateAverageWaitTime(items: any[]): number {
  if (items.length === 0) return 0;

  const totalWaitTime = items.reduce((sum: number, item: any) => {
    const waitTime = Date.now() - item.createdAt.getTime();
    return sum + waitTime;
  }, 0);

  return Math.floor(totalWaitTime / items.length / 60000);
}

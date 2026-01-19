/**
 * Open Orders API Route
 * 
 * GET /api/orders/open - List all pending orders (deferred payments)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';

/**
 * GET /api/orders/open
 * List all pending orders (deferred payments) for settlement
 * 
 * Query parameters:
 * - departmentCode: string (optional - filter by department)
 * - customerId: string (optional - filter by customer)
 * - limit: number (default: 50)
 * - offset: number (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
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
    if (!userWithRoles) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Only staff (cashier, manager, admin) can view open orders
    if (!hasAnyRole(userWithRoles, ['admin', 'manager', 'cashier', 'staff'])) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions to view open orders'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const departmentCode = searchParams.get('departmentCode');
    const customerId = searchParams.get('customerId');
    const paymentStatus = searchParams.get('paymentStatus') || 'unpaid'; // Default to unpaid orders
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build filter
    const whereClause: any = {
      paymentStatus: paymentStatus, // Filter by payment status instead of order status
    };

    if (departmentCode) {
      whereClause.departments = {
        some: {
          department: {
            code: departmentCode,
          },
        },
      };
    }

    if (customerId) {
      whereClause.customerId = customerId;
    }

    // Get total count
    const totalCount = await prisma.orderHeader.count({ where: whereClause });

    // Fetch orders with details
    const orders = await prisma.orderHeader.findMany({
      where: whereClause,
      include: {
        customer: true,
        lines: {
          include: {
            departmentSection: true,
          },
        },
        departments: {
          include: {
            department: true,
          },
        },
        payments: true,
        discounts: true,
      } as any,
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    });

    // Format response
    const formattedOrders = orders.map((order: any) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      customerName: `${order.customer.firstName} ${order.customer.lastName}`,
      customerEmail: order.customer.email,
      customerPhone: order.customer.phone,
      status: order.status,
      paymentStatus: order.paymentStatus,
      subtotal: order.subtotal,
      discountTotal: order.discountTotal,
      tax: order.tax,
      total: order.total,
      itemCount: order.lines.length,
      departmentCodes: order.departments.map((d: any) => d.department.code),
      departmentNames: order.departments.map((d: any) => d.department.name),
      departmentSections: [...new Set(order.lines.map((l: any) => l.departmentSection?.name).filter(Boolean))],
      totalPaid: order.payments
        .filter((p: any) => p.paymentStatus === 'completed')
        .reduce((sum: number, p: any) => sum + p.amount, 0),
      amountDue: order.total -
        order.payments
          .filter((p: any) => p.paymentStatus === 'completed')
          .reduce((sum: number, p: any) => sum + p.amount, 0),
      createdAt: order.createdAt,
      createdAtFormatted: order.createdAt.toLocaleString(),
      notes: order.notes,
      lineItems: order.lines.map((line: any) => ({
        id: line.id,
        productName: line.productName,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
        departmentSection: line.departmentSection?.name || line.departmentCode,
      })),
    }));

    return NextResponse.json(
      successResponse(
       { 
        data : {
          orders: formattedOrders,
          totalCount,
          limit,
          offset,
        },
        message :
        'Open orders retrieved successfully'
      }
      )
    );
  } catch (error) {
    try {
      const logger = await import('@/lib/logger');
      logger.error(error, { route: 'GET /api/orders/open' });
    } catch (e) {
      console.error('GET /api/orders/open error:', error);
    }
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to retrieve open orders'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}


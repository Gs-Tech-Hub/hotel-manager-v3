/**
 * Order Management API Routes
 * 
 * POST /api/orders - Create new order
 * GET  /api/orders - List orders with pagination/filters
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';
import { OrderService } from '@/services/order.service';

/**
 * POST /api/orders
 * Create a new order with items, discounts, and payment
 * 
 * Request body:
 * {
 *   customerId: string
 *   items: [
 *     { productId, productType, productName, departmentCode, quantity, unitPrice }
 *   ]
 *   discounts?: string[]
 *   notes?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
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
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Parse request body
    const body = await request.json();
    const { customerId: incomingCustomerId, items, discounts, notes } = body;

    // If no customerId provided (walk-in), create a guest customer record
    let customerId = incomingCustomerId
    if (!customerId) {
      try {
        // Create a minimal guest customer record (required fields per schema)
        const guest = await prisma.customer.create({
          data: {
            firstName: 'Guest',
            lastName: 'Customer',
            email: `guest+${Date.now()}@local`,
            phone: '0000000000',
          },
        });
        customerId = guest.id;
      } catch (err) {
        console.error('Failed to create guest customer:', err)
        return NextResponse.json(
          errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to create guest customer'),
          { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
        )
      }
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, 'items array is required and cannot be empty'),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Validate each item
    for (const item of items) {
      if (!item.productId || !item.quantity || !item.departmentCode || !item.unitPrice) {
        return NextResponse.json(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            'Each item must have productId, quantity, departmentCode, and unitPrice'
          ),
          { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
        );
      }
    }

    // Verify customer exists (should exist at this point)
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Customer not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Create order using service
    const orderService = new OrderService();
    const order = await orderService.createOrder(
      {
        customerId,
        items,
        discounts,
        notes,
      },
      userWithRoles
    );

    // Check if result is error response
    if ('error' in order) {
      return NextResponse.json(
        order,
        { status: getStatusCode(order.error.code) }
      );
    }

    // If client provided a payment object in the payload, record payment now
    if (order && !(order as any).error && body.payment) {
      try {
        const payment = body.payment as any;
        // payment should contain amount, paymentTypeId (or paymentMethod), transactionReference
        const paymentPayload = {
          amount: payment.amount,
          paymentMethod: payment.paymentMethod || payment.paymentMethodId || 'unknown',
          paymentTypeId: payment.paymentTypeId,
          transactionReference: payment.transactionReference,
        };
        // record payment (orderService.recordPayment will validate and move order to processing)
        await orderService.recordPayment((order as any).id, paymentPayload, userWithRoles);
      } catch (err) {
        console.error('Failed to record payment during order creation:', err);
        // continue — order was created, but payment recording failed; client can retry via payments endpoint
      }
    }

    // Return created order
    return NextResponse.json(
      successResponse(order, 'Order created successfully'),
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/orders error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to create order'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

/**
 * GET /api/orders
 * List orders with pagination and filtering
 * 
 * Query parameters:
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - customerId: string (filter)
 * - status: string (filter: pending, processing, fulfilled, completed, cancelled)
 * - fromDate: ISO date string (filter)
 * - toDate: ISO date string (filter)
 * - sortBy: string (default: createdAt)
 * - sortOrder: "asc" | "desc" (default: desc)
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

    // Load full user with roles
    const userWithRoles = await loadUserWithRoles(ctx.userId);
    if (!userWithRoles || !hasAnyRole(userWithRoles, ['admin', 'manager', 'staff'])) {
      // Allow customers to view their own orders
      if (!userWithRoles || !hasAnyRole(userWithRoles, ['customer'])) {
        return NextResponse.json(
          errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
          { status: getStatusCode(ErrorCodes.FORBIDDEN) }
        );
      }
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const customerId = searchParams.get('customerId') || undefined;
    const status = searchParams.get('status') || undefined;
    const fromDate = searchParams.get('fromDate') ? new Date(searchParams.get('fromDate')!) : undefined;
    const toDate = searchParams.get('toDate') ? new Date(searchParams.get('toDate')!) : undefined;
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

    // Customers can only view their own orders
    let filterCustomerId = customerId;
    if (userWithRoles && hasAnyRole(userWithRoles, ['customer'])) {
      filterCustomerId = ctx.userId;
    }

    // Build filters
    const filters: any = {};
    if (filterCustomerId) {
      filters.customerId = filterCustomerId;
    }
    if (status) {
      filters.status = status;
    }
    if (fromDate || toDate) {
      filters.createdAt = {};
      if (fromDate) filters.createdAt.gte = fromDate;
      if (toDate) filters.createdAt.lte = toDate;
    }

    // Build sort
    const sortOptions: any = {};
    sortOptions[sortBy] = sortOrder;

    // Query orders
    const skip = (page - 1) * limit;
    const [orders, total] = await Promise.all([
      prisma.orderHeader.findMany({
        where: filters,
        include: {
          customer: true,
          lines: true,
          departments: true,
          discounts: true,
          payments: true,
        },
        orderBy: sortOptions,
        skip,
        take: limit,
      }),
      prisma.orderHeader.count({ where: filters }),
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;

    return NextResponse.json(
      successResponse({
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
    console.error('GET /api/orders error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch orders'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

/**
 * Order Management API Routes
 * 
 * POST /api/orders - Create new order
 * GET  /api/orders - List orders with pagination/filters
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { checkPermission, type PermissionContext } from '@/lib/auth/rbac';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';
import { buildDateFilter } from '@/lib/date-filter';
import { OrderService } from '@/services/order.service';

/**
 * POST /api/orders
 * Create a new order with items, discounts, and payment
 * 
 * Request body:
 * {
 *   customerId: string
 *   items: [
 *     { productId, productType, productName, departmentCode, departmentSectionId?, quantity, unitPrice }
 *   ]
 *   discounts?: string[]
 *   notes?: string
 *   departmentSectionId?: string
 * }
 */
export async function POST(request: NextRequest) {
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

    // Build permission context for RBAC checks
    const permCtx: PermissionContext = {
      userId: ctx.userId,
      userType: userWithRoles.isAdmin ? 'admin' : hasAnyRole(userWithRoles, ['admin', 'manager', 'staff']) ? 'employee' : 'other',
    };

    // Require explicit permission to create orders
    const canCreate = await checkPermission(permCtx, 'orders.create', 'orders');
    if (!canCreate) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions to create orders'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Parse request body
    const body = await request.json();
    const { customerId: incomingCustomerId, items, discounts, notes, departmentSectionId } = body;

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
    let orderResult = await orderService.createOrder(
      {
        customerId,
        items,
        discounts,
        notes,
        departmentSectionId,
      },
      userWithRoles // Pass user context with userId for audit trail
    );

    // Check if result is error response (createOrder returns errorResponse object when it fails)
    if (orderResult && typeof orderResult === 'object' && 'success' in orderResult && orderResult.success === false) {
      return NextResponse.json(
        orderResult,
        { status: getStatusCode((orderResult as any).code) }
      );
    }

    // Handle payment processing
    // If client provided a payment object in the payload, process it
    if (orderResult && !(orderResult as any).error && body.payment) {
      const payment = body.payment as any;
      
      // Check if this is a deferred payment (pay later)
      if (payment.isDeferred || payment.method === 'deferred') {
        // Deferred order - leave status as 'pending', no payment recorded
        console.log(`Order ${(orderResult as any).id} created with deferred payment status`);
      } else if (payment.amount && payment.amount > 0 && (orderResult as any).id) {
        // Immediate payment - record payment and move to processing
        // CRITICAL: If payment processing fails, order creation FAILS (no partial order returned)
        try {
          const paymentPayload = {
            amount: payment.amount, // Already in cents from POS checkout
            paymentMethod: payment.paymentMethod || payment.method || payment.paymentMethodId || 'unknown',
            paymentTypeId: payment.paymentTypeId,
            transactionReference: payment.transactionReference,
          };
          
          console.log(`[Order API] Recording payment for order ${(orderResult as any).id}:`, paymentPayload);
          await orderService.recordPayment((orderResult as any).id, paymentPayload, userWithRoles);
          
          // Fetch updated order to get the new paymentStatus and status
          const updatedOrder = await prisma.orderHeader.findUnique({
            where: { id: (orderResult as any).id },
            include: { 
              customer: true, 
              lines: true, 
              departments: { include: { department: true } },
              discounts: { include: { discountRule: true } },
              payments: { include: { paymentType: true } },
              fulfillments: true,
              reservations: true,
            },
          });
          if (updatedOrder) {
            orderResult = updatedOrder;
          }
        } catch (err) {
          // CRITICAL: Payment failure means order creation FAILS
          // Delete the order and return error to prevent receipt printing
          try {
            await prisma.orderHeader.delete({ where: { id: (orderResult as any).id } });
            console.error(`Deleted order ${(orderResult as any).id} due to payment failure:`, err);
          } catch (delErr) {
            console.error(`Failed to cleanup order ${(orderResult as any).id}:`, delErr);
          }
          
          return NextResponse.json(
            errorResponse(ErrorCodes.INTERNAL_ERROR, `Payment processing failed: ${(err as any)?.message || 'Unknown error'}`),
            { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
          );
        }
      }
    }

    // Return created order (with updated paymentStatus if payment was processed)
    return NextResponse.json(
      successResponse({data : orderResult, message : 'Order created successfully'}),
      { status: 201 }
    );
  } catch (error) {
    try {
      const logger = await import('@/lib/logger')
      logger.error(error, { route: 'POST /api/orders' })
    } catch (e) {
      console.error('POST /api/orders error:', error)
    }
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

    // Build permission context
    const permCtx: PermissionContext = {
      userId: ctx.userId,
      userType: userWithRoles.isAdmin ? 'admin' : hasAnyRole(userWithRoles, ['admin', 'manager', 'staff']) ? 'employee' : 'other',
    };

    // Check read permission; employees/admins must have 'orders.read'.
    const hasReadPerm = await checkPermission(permCtx, 'orders.read', 'orders');

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const customerId = searchParams.get('customerId') || undefined;
    const status = searchParams.get('status') || undefined; // Order fulfillment status: pending, processing, fulfilled, completed, cancelled
    const paymentStatus = searchParams.get('paymentStatus') || undefined; // Payment status: unpaid, paid, partial, refunded
    const departmentCode = searchParams.get('departmentCode') || undefined;
    const departmentSectionId = searchParams.get('departmentSectionId') || undefined;
    const fromDate = searchParams.get('fromDate') || undefined; // YYYY-MM-DD format
    const toDate = searchParams.get('toDate') || undefined; // YYYY-MM-DD format
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

    // Customers can only view their own orders, and customers without 'orders.read' only see their own orders
    let filterCustomerId = customerId;
    if (!hasReadPerm) {
      if (hasAnyRole(userWithRoles, ['customer'])) {
        filterCustomerId = ctx.userId;
      } else {
        return NextResponse.json(
          errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions to view orders'),
          { status: getStatusCode(ErrorCodes.FORBIDDEN) }
        );
      }
    } else {
      // if user has read permission but is customer, still restrict to own orders
      if (hasAnyRole(userWithRoles, ['customer'])) {
        filterCustomerId = ctx.userId;
      }
    }

    // Build filters
    const filters: any = {};
    if (filterCustomerId) {
      filters.customerId = filterCustomerId;
    }
    // Filter by fulfillment status (pending, processing, fulfilled, completed, cancelled)
    if (status) {
      filters.status = status;
    }
    // Note: Payment status filtering done post-fetch based on actual paid amounts
    if (departmentCode) {
      // Filter orders with lines in the given department (by departmentCode)
      filters.lines = { some: { departmentCode } };
    }
    if (departmentSectionId) {
      // Filter orders with lines routed to the given department section
      filters.lines = { some: { departmentSectionId } };
    }
    // Build date filter using centralized utility (handles local timezone correctly)
    const dateFilter = buildDateFilter(fromDate, toDate);
    if (Object.keys(dateFilter).length > 0) {
      filters.createdAt = dateFilter.createdAt;
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
          lines: {
            include: {
              departmentSection: {
                include: {
                  department: true,
                },
              },
            },
          },
          extras: {
            include: {
              extra: true,
            },
          },
          departments: { include: { department: true } },
          discounts: true,
          payments: true,
          fulfillments: true,
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

    // Filter by payment status based on actual paid amounts (post-fetch)
    let filteredOrders = orders;
    if (paymentStatus) {
      filteredOrders = orders.filter(order => {
        const totalPaid = (order.payments || []).reduce((sum: number, p: any) => sum + (p.amount ?? 0), 0);
        const amountDue = (order.total ?? 0) - totalPaid;
        
        let calculatedStatus = 'unpaid';
        if (amountDue === 0) {
          calculatedStatus = 'paid';
        } else if (amountDue < (order.total ?? 0) && amountDue > 0) {
          calculatedStatus = 'partial';
        }
        
        return calculatedStatus === paymentStatus;
      });
    }

    return NextResponse.json(
      successResponse({
        data : {
        items: filteredOrders,
        meta: {
          page,
          limit,
          total: filteredOrders.length,
          totalPages: Math.ceil(filteredOrders.length / limit),
          hasMore: false,
        },
      }})
    );
  } catch (error) {
    console.error('GET /api/orders error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch orders'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}


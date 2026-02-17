import { NextRequest, NextResponse } from 'next/server';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/lib/auth/prisma';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';
import { extractUserContext } from '@/lib/user-context';

/**
 * POST /api/departments/[code]/games/checkout
 * End game session and redirect to payment
 * Order was created when game started, now just prepare for payment
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const ctx = await extractUserContext(request);
    
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED),
        { status: 401 }
      );
    }

    const { code } = await params;

    // Support section-style codes
    const rawCode = code;
    let departmentCode = rawCode;
    let resolvedSectionId: string | undefined = undefined;
    if (rawCode.includes(':')) {
      const parts = rawCode.split(':');
      departmentCode = parts[0];
      const sectionSlugOrId = parts.slice(1).join(':');
      const parentDept = await prisma.department.findFirst({ where: { code: departmentCode } });
      if (parentDept) {
        const section = await prisma.departmentSection.findFirst({ where: { departmentId: parentDept.id, OR: [ { slug: sectionSlugOrId }, { id: sectionSlugOrId } ] } });
        if (section) resolvedSectionId = section.id;
      }
    }

    const department = await prisma.department.findFirst({ where: { code: departmentCode } });

    if (!department) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Department not found'),
        { status: 404 }
      );
    }

    const body = await request.json();
    const { sessionId, terminalId } = body;

    // Validation
    if (!sessionId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Session ID is required'),
        { status: 400 }
      );
    }

    if (!terminalId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Terminal ID is required'),
        { status: 400 }
      );
    }

    // Get the session - verify it belongs to this department
    const session = await prisma.gameSession.findFirst({
      where: {
        id: sessionId,
        section: { departmentId: department.id }
      },
      include: { 
        section: true,
        customer: true,
        service: true,
      },
    });

    if (!session) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Game session not found'),
        { status: 404 }
      );
    }

    if (session.status === 'checked_out') {
      return NextResponse.json(
        errorResponse(ErrorCodes.CONFLICT, 'Session already checked out'),
        { status: 409 }
      );
    }

    // Find the OrderHeader for this game session
    // Query by customerId and look for order with game session context
    // OrderHeader notes field contains "Game session started"
    const orderHeader = await prisma.orderHeader.findFirst({
      where: {
        customerId: session.customerId,
        notes: { contains: 'Game session started' },
      },
      include: {
        customer: true,
      },
    });

    if (!orderHeader) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Order not found for this game session'),
        { status: 404 }
      );
    }

    // Verify the order belongs to the right department via OrderDepartment
    const orderDept = await prisma.orderDepartment.findFirst({
      where: {
        orderHeaderId: orderHeader.id,
        departmentId: department.id,
      },
    });

    if (!orderDept) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Order does not belong to this department'),
        { status: 403 }
      );
    }

    // Final price calculation with current game count
    let totalAmount = new Decimal(session.totalAmount || 0);
    
    if (session.service) {
      // Recalculate pricing from service based on final game count
      if (session.service.pricingModel === 'per_count' && session.service.pricePerCount) {
        // Price per game
        totalAmount = new Decimal(session.service.pricePerCount).times(session.gameCount);
      } else if (session.service.pricingModel === 'per_time' && session.service.pricePerMinute) {
        // For per_time, calculate based on game count
        const minutesPerGame = 15;
        const totalMinutes = session.gameCount * minutesPerGame;
        totalAmount = new Decimal(session.service.pricePerMinute).times(totalMinutes);
      }
    }

    // Convert Decimal to cents as integer for database
    const totalInCents = Math.round(totalAmount.toNumber() * 100);

    // Recalculate tax
    let taxRate = 0;
    try {
      const taxSettings = await (prisma as any).taxSettings.findFirst();
      if (taxSettings) {
        taxRate = taxSettings.taxRate ?? 0;
      }
    } catch (err) {
      console.warn('TaxSettings fetch failed, using default tax rate');
    }

    const taxCents = Math.round(totalInCents * (taxRate / 100));
    const finalTotalCents = totalInCents + taxCents;

    // Update order header with final totals
    const updatedOrderHeader = await prisma.orderHeader.update({
      where: { id: orderHeader.id },
      data: {
        subtotal: totalInCents,
        tax: taxCents,
        total: finalTotalCents,
      },
      include: {
        customer: true,
      },
    });

    // Update order line with final pricing
    await prisma.orderLine.updateMany({
      where: { orderHeaderId: orderHeader.id },
      data: {
        unitPrice: totalInCents,
        lineTotal: totalInCents,
      },
    });

    // Update game session to mark as completed
    const updatedSession = await prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        endedAt: new Date(),
        totalAmount: totalAmount,
      },
      include: {
        customer: true,
        gameType: true,
        section: true,
        service: true,
      },
    });

    // Prepare order data for frontend payment processing

    console.log('[Games Checkout] Game session completed, ready for payment:', {
      sessionId: sessionId,
      orderId: orderHeader.id,
      gameCount: session.gameCount,
      totalAmount: totalAmount,
      terminalId,
    });

    // Build redirect URL to terminal checkout with order ID
    const terminalCheckoutUrl = `/pos-terminals/${session.section.name.toLowerCase().replace(/\s+/g, '-')}/checkout?terminal=${terminalId}&addToOrder=${orderHeader.id}`;

    // Return order data and redirect URL for payment processing
    return NextResponse.json(
      successResponse({
        data: {
          orderId: orderHeader.id,
          orderNumber: orderHeader.orderNumber,
          terminalId: terminalId,
          checkoutUrl: terminalCheckoutUrl,
          session: updatedSession,
          gameCount: session.gameCount,
          order: {
            id: orderHeader.id,
            orderNumber: orderHeader.orderNumber,
            customerId: session.customerId,
            customerName: `${session.customer.firstName} ${session.customer.lastName}`,
            gameCount: session.gameCount,
            serviceName: session.service?.name || session.section.name,
            sectionName: session.section.name,
            subtotal: totalInCents,
            tax: taxCents,
            total: finalTotalCents,
            status: orderHeader.status,
            paymentStatus: orderHeader.paymentStatus,
            message: `Game session completed. Ready for payment: ${session.gameCount} ${session.service?.name || session.section.name} session(s)`,
          },
        },
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error processing checkout:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to process checkout'),
      { status: 500 }
    );
  }
}

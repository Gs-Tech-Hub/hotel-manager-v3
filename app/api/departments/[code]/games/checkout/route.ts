import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';
import { extractUserContext } from '@/lib/user-context';

/**
 * POST /api/departments/[code]/games/checkout
 * Checkout and create order for games using existing Order/Payment system
 * Returns the order data that can be passed to the terminal/POS checkout
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
    const { sessionId } = body;

    // Validation
    if (!sessionId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Session ID is required'),
        { status: 400 }
      );
    }

    // Get the session - verify it belongs to this department
    const session = await prisma.gameSession.findFirst({
      where: {
        id: sessionId,
        section: { departmentId: department.id }
      },
      include: { section: true, customer: true },
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

    // Get default payment type for checkout (use cash as default)
    const paymentType = await prisma.paymentType.findFirst({
      where: { type: 'cash' },
    });

    if (!paymentType) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Default cash payment type not configured. Please contact admin.'),
        { status: 404 }
      );
    }

    // Create Order for the games (status: pending payment, ready for terminal checkout)
    // Amount is stored in cents (multiply by 100)
    const totalInCents = Math.round(Number(session.totalAmount) * 100);

    const order = await prisma.order.create({
      data: {
        customerId: session.customerId,
        paymentTypeId: paymentType.id,
        total: totalInCents,
        orderStatus: 'Pending Payment',
      },
    });

    // Update game session with the order reference
    const updatedSession = await prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        endedAt: new Date(),
        orderId: order.id,
      },
      include: {
        customer: true,
        gameType: true,
        section: true,
        order: true,
      },
    });

    // Return order data formatted for terminal checkout
    return NextResponse.json(
      successResponse({
        data: {
          orderId: order.id,
          redirectUrl: `/pos-terminals/default/checkout?orderId=${order.id}`,
          session: updatedSession,
          order: {
            id: order.id,
            customerId: session.customerId,
            customerName: `${session.customer.firstName} ${session.customer.lastName}`,
            gameCount: session.gameCount,
            gameType: updatedSession.section.name, // Use section name as game type
            sectionName: updatedSession.section.name,
            amount: Number(session.totalAmount),
            amountInCents: totalInCents,
            paymentTypeId: paymentType.id,
            status: order.orderStatus,
            message: `Ready for checkout: ${session.gameCount} ${updatedSession.section.name} games`,
          },
          sectionId: resolvedSectionId,
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

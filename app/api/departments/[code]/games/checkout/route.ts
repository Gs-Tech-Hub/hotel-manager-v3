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
    // Calculate total based on service pricing or session amount
    let totalAmount = Number(session.totalAmount);
    
    if (session.service) {
      // Calculate pricing from service
      if (session.service.pricingModel === 'per_count') {
        // Price per game
        totalAmount = Number(session.service.pricePerCount) * session.gameCount;
      } else if (session.service.pricingModel === 'per_time') {
        // For per_time, use configured minutes or estimate
        // Default: 15 minutes per game for pricing purposes
        const minutesPerGame = 15;
        const totalMinutes = session.gameCount * minutesPerGame;
        totalAmount = Number(session.service.pricePerMinute) * totalMinutes;
      }
    }
    
    const totalInCents = Math.round(totalAmount * 100);

    // Create order with service as order line (don't add to inventory items)
    const order = await prisma.order.create({
      data: {
        customerId: session.customerId,
        paymentTypeId: paymentType.id,
        total: totalInCents,
        orderStatus: 'Pending Payment',
      },
      include: {
        customer: true,
        paymentType: true,
      },
    });

    // Find terminal that matches this section
    // Match terminal by section ID - the terminal ID is the section ID
    const terminal = {
      id: session.sectionId,
      name: session.section.name,
      departmentCode: department.code,
      status: 'online',
    };

    console.log('[Games Checkout] Terminal matched to section:', {
      departmentId: department.id,
      departmentCode: department.code,
      sectionId: session.sectionId,
      sectionName: session.section.name,
      terminalId: terminal.id,
    });

    // Calculate game statistics for this section
    const gameStats = await prisma.gameSession.groupBy({
      by: ['status'],
      where: { sectionId: session.sectionId },
      _count: true,
    });

    const stats = {
      totalGames: 0,
      activeGames: 0,
      concludedGames: 0,
    };

    for (const stat of gameStats) {
      stats.totalGames += stat._count;
      if (stat.status === 'active') {
        stats.activeGames = stat._count;
      } else if (stat.status === 'completed') {
        stats.concludedGames = stat._count;
      }
    }

    // Update game session with the order reference
    const updatedSession = await prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        endedAt: new Date(),
        orderId: order.id,
        totalAmount: totalAmount, // Store calculated amount
      },
      include: {
        customer: true,
        gameType: true,
        section: true,
        service: true,
        order: true,
      },
    });

    // Build redirect URL with proper terminal routing
    // Redirect to the terminal that matches this section
    // Use department code and section name in path, with section ID as terminal query param
    let redirectUrl = '/pos-terminals';
    if (terminal) {
      // Route format: /pos-terminals/[section-name]/checkout?terminal=[section-id]
      // The orderId is stored in the gameSession, NOT passed as a query parameter
      const sectionName = terminal.name.toLowerCase().replace(/\s+/g, '-');
      redirectUrl = `/pos-terminals/${sectionName}/checkout?terminal=${terminal.id}`;
      console.log('[Games Checkout] Using terminal redirect:', {
        terminalId: terminal.id,
        terminalName: terminal.name,
        sectionName: sectionName,
        redirectUrl,
      });
    } else {
      console.log('[Games Checkout] No terminal found, using default redirect:', redirectUrl);
    }

    // Return order data formatted for terminal checkout
    return NextResponse.json(
      successResponse({
        data: {
          orderId: order.id,
          terminalId: terminal?.id,
          terminalName: terminal?.name,
          sectionId: session.sectionId,
          sectionName: session.section.name,
          departmentId: department.id,
          departmentCode: departmentCode,
          redirectUrl: redirectUrl,
          session: updatedSession,
          stats: stats,
          order: {
            id: order.id,
            customerId: session.customerId,
            customerName: `${session.customer.firstName} ${session.customer.lastName}`,
            gameCount: session.gameCount,
            serviceName: session.service?.name || session.section.name,
            sectionName: session.section.name,
            amountInCents: totalInCents,
            paymentTypeId: paymentType.id,
            status: order.orderStatus,
            message: `Ready for payment: ${session.gameCount} ${session.service?.name || session.section.name} session(s)`,
            // Support for tax and discount application at POS terminal
            taxSupport: true,
            discountSupport: true,
            // Order preparation for terminal - no inventory items added
            preparationNote: 'Service order - counter already incremented. Prepare for payment only.',
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

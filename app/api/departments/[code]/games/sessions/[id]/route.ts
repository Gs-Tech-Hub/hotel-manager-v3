import { NextRequest, NextResponse } from 'next/server';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/lib/auth/prisma';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';
import { extractUserContext } from '@/lib/user-context';

/**
 * GET /api/departments/[code]/games/sessions/[id]
 * Get a specific game session
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string; id: string }> }
) {
  try {
    const ctx = await extractUserContext(request);
    
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED),
        { status: 401 }
      );
    }

    const { code, id } = await params;

    const department = await prisma.department.findFirst({
      where: { code },
    });

    if (!department) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Department not found'),
        { status: 404 }
      );
    }

    const session = await prisma.gameSession.findFirst({
      where: {
        id,
        section: { departmentId: department.id }
      },
      include: {
        customer: true,
        gameType: true,
        order: true,
      },
    });

    if (!session) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Game session not found'),
        { status: 404 }
      );
    }

    return NextResponse.json(
      successResponse({ data: { session } }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching game session:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch game session'),
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/departments/[code]/games/sessions/[id]
 * Update a game session (increment game count, update status)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ code: string; id: string }> }
) {
  try {
    const ctx = await extractUserContext(request);
    
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED),
        { status: 401 }
      );
    }

    const { code, id } = await params;

    const department = await prisma.department.findFirst({
      where: { code },
    });

    if (!department) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Department not found'),
        { status: 404 }
      );
    }

    const body = await request.json();
    const { action, gameCount, status } = body;

    // Get the session
    const session = await prisma.gameSession.findFirst({
      where: {
        id,
        section: { departmentId: department.id }
      },
      include: { 
        section: true,
        service: true,
        order: true,
      },
    });

    if (!session) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Game session not found'),
        { status: 404 }
      );
    }

    let updatedSession;

    if (action === 'increment_game') {
      // Increment game count
      const newGameCount = session.gameCount + 1;
      
      // Calculate new price based on service pricing model
      let newTotalAmount = new Decimal(session.totalAmount || 0);
      if (session.service) {
        if (session.service.pricingModel === 'per_count' && session.service.pricePerCount) {
          // Price per game
          newTotalAmount = new Decimal(session.service.pricePerCount).times(newGameCount);
        } else if (session.service.pricingModel === 'per_time' && session.service.pricePerMinute) {
          // For per_time, estimate price (15 minutes per game default)
          const minutesPerGame = 15;
          const totalMinutes = newGameCount * minutesPerGame;
          newTotalAmount = new Decimal(session.service.pricePerMinute).times(totalMinutes);
        }
      }

      // Update session
      updatedSession = await prisma.gameSession.update({
        where: { id },
        data: {
          gameCount: newGameCount,
          totalAmount: newTotalAmount,
        },
        include: {
          customer: true,
          gameType: true,
          service: true,
          section: true,
        },
      });

      // Update associated order header if exists
      // Find OrderHeader by customerId and notes containing "Game session"
      const orderHeader = await prisma.orderHeader.findFirst({
        where: {
          customerId: session.customerId,
          notes: { contains: 'Game session started' },
        },
      });

      if (orderHeader) {
        const totalInCents = Math.round(newTotalAmount.toNumber() * 100);
        
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

        await prisma.orderHeader.update({
          where: { id: orderHeader.id },
          data: {
            subtotal: totalInCents,
            tax: taxCents,
            total: finalTotalCents,
          },
        });

        // Update order line
        await prisma.orderLine.updateMany({
          where: { orderHeaderId: orderHeader.id },
          data: {
            unitPrice: totalInCents,
            lineTotal: totalInCents,
          },
        });
      }
    } else if (action === 'end_game') {
      // End game
      updatedSession = await prisma.gameSession.update({
        where: { id },
        data: {
          status: 'completed',
          endedAt: new Date(),
        },
        include: {
          customer: true,
          gameType: true,
          order: true,
        },
      });
    } else if (status) {
      // Update status
      updatedSession = await prisma.gameSession.update({
        where: { id },
        data: { status },
        include: {
          customer: true,
          gameType: true,
          order: true,
        },
      });
    } else {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Invalid action or missing required fields'),
        { status: 400 }
      );
    }

    return NextResponse.json(
      successResponse({ data: { session: updatedSession } }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating game session:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to update game session'),
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/lib/auth/prisma';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';
import { extractUserContext, loadUserWithRoles } from '@/lib/user-context';
import { isGamesStaffForDepartment } from '@/lib/auth/games-access';

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

    // Games access is department-scoped: only games_staff for this department
    const canAccessGames = await isGamesStaffForDepartment(ctx.userId, department.id);
    if (!canAccessGames) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Games access is restricted to Games department users'),
        { status: 403 }
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
        orderHeader: true,
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

    // Games access is department-scoped: only games_staff for this department
    const canAccessGames = await isGamesStaffForDepartment(ctx.userId, department.id);
    if (!canAccessGames) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Games access is restricted to Games department users'),
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, gameCount, status } = body;

    // Admin-only actions: decrement game count or cancel session
    if (action === 'decrement_game' || action === 'cancel_session') {
      const userWithRoles = await loadUserWithRoles(ctx.userId);
      const isAdmin = userWithRoles?.userType === 'admin' || userWithRoles?.userRoles?.some((r: any) => r.roleCode === 'admin');
      if (!isAdmin) {
        const actionLabel = action === 'decrement_game' ? 'decrement game count' : 'cancel game sessions';
        return NextResponse.json(
          errorResponse(ErrorCodes.FORBIDDEN, `Only admin can ${actionLabel}`),
          { status: 403 }
        );
      }
    }

    // Get the session
    const session = await prisma.gameSession.findFirst({
      where: {
        id,
        section: { departmentId: department.id }
      },
      include: { 
        section: true,
        service: true,
        orderHeader: true,
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
        const orderLine = await prisma.orderLine.findFirst({
          where: { orderHeaderId: orderHeader.id },
        });

        if (orderLine) {
          await prisma.orderLine.update({
            where: { id: orderLine.id },
            data: {
              unitPrice: totalInCents,
              lineTotal: totalInCents,
              quantity: newGameCount,
            },
          });

          // Update fulfillment record with new quantity
          await prisma.orderFulfillment.updateMany({
            where: {
              orderLineId: orderLine.id,
              status: 'fulfilled',
            },
            data: {
              fulfilledQuantity: newGameCount,
            },
          });
        }
      }
    } else if (action === 'decrement_game') {
      // Decrement game count (clamp at 1)
      const newGameCount = Math.max(1, session.gameCount - 1);

      // Calculate new price based on service pricing model
      let newTotalAmount = new Decimal(session.totalAmount || 0);
      if (session.service) {
        if (session.service.pricingModel === 'per_count' && session.service.pricePerCount) {
          newTotalAmount = new Decimal(session.service.pricePerCount).times(newGameCount);
        } else if (session.service.pricingModel === 'per_time' && session.service.pricePerMinute) {
          const minutesPerGame = 15;
          const totalMinutes = newGameCount * minutesPerGame;
          newTotalAmount = new Decimal(session.service.pricePerMinute).times(totalMinutes);
        }
      }

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

        const orderLine = await prisma.orderLine.findFirst({
          where: { orderHeaderId: orderHeader.id },
        });

        if (orderLine) {
          await prisma.orderLine.update({
            where: { id: orderLine.id },
            data: {
              unitPrice: totalInCents,
              lineTotal: totalInCents,
              quantity: newGameCount,
            },
          });

          await prisma.orderFulfillment.updateMany({
            where: {
              orderLineId: orderLine.id,
              status: 'fulfilled',
            },
            data: {
              fulfilledQuantity: newGameCount,
            },
          });
        }
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
          orderHeader: true,
        },
      });
    } else if (action === 'cancel_session') {
      // Cancel session (admin-only) - delete or mark cancelled
      updatedSession = await prisma.gameSession.update({
        where: { id },
        data: {
          status: 'cancelled',
          endedAt: new Date(),
        },
        include: {
          customer: true,
          gameType: true,
          orderHeader: true,
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
          orderHeader: true,
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

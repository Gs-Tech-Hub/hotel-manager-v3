import { NextRequest, NextResponse } from 'next/server';
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
        gameType: { departmentId: department.id }
      },
      include: { gameType: true },
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
      // Pricing is calculated at checkout, not here
      
      updatedSession = await prisma.gameSession.update({
        where: { id },
        data: {
          gameCount: newGameCount,
          // totalAmount will be calculated at checkout
        },
        include: {
          customer: true,
          gameType: true,
          order: true,
        },
      });
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

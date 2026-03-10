/**
 * POST /api/reservations - Create reservation
 * GET /api/reservations - List reservations (with filters)
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext } from '@/lib/user-context';
import { reservationService } from '@/src/services/ReservationService';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';
import { emailService } from '@/src/services/EmailService';
import { prisma } from '@/lib/auth/prisma';

export async function POST(request: NextRequest) {
  try {
    // Extract user context
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'User not authenticated'),
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { unitId, guestId, checkInDate, checkOutDate, source, notes, idempotencyKey } = body;

    // Create reservation
    const { reservation, cleaningTaskCreated } = await reservationService.createReservation(
      {
        unitId,
        guestId,
        checkInDate,
        checkOutDate,
        source,
        notes,
      },
      { userId: ctx.userId, userType: (ctx.userRole as any) || 'employee' },
      idempotencyKey
    );

    // Fetch guest and unit details for email
    const guest = await prisma.guest.findUnique({ where: { id: guestId } });
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      include: { roomType: true },
    });

    // Send confirmation email
    if (guest && unit) {
      const totalPrice = (reservation.totalPriceCents / 100).toFixed(2);
      const emailSent = await emailService.sendBookingConfirmation({
        recipientName: `${guest.firstName} ${guest.lastName}`,
        recipientEmail: guest.email,
        confirmationNumber: reservation.confirmationNo,
        checkInDate: new Date(checkInDate).toLocaleDateString(),
        checkOutDate: new Date(checkOutDate).toLocaleDateString(),
        roomNumber: unit.roomNumber,
        roomType: unit.roomType.name,
        totalPrice,
        guestName: `${guest.firstName} ${guest.lastName}`,
        phone: guest.phone || 'N/A',
      });

      if (!emailSent) {
        console.warn(`Failed to send confirmation email to ${guest.email}`);
      }

      // Send phone notification if phone exists
      if (guest.phone) {
        await emailService.sendPhoneNotification(
          guest.phone,
          `Booking confirmation: ${reservation.confirmationNo}. Check-in: ${new Date(checkInDate).toLocaleDateString()}`
        );
      }
    }

    return NextResponse.json(
      successResponse({
        data: {
          reservation,
          cleaningTaskCreated,
        },
        message: 'Reservation created successfully',
      }),
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating reservation:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    if (errorMsg.includes('Insufficient permissions')) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, errorMsg),
        { status: 403 }
      );
    }

    if (errorMsg.includes('Unit not available') || errorMsg.includes('Conflict')) {
      return NextResponse.json(
        errorResponse(ErrorCodes.CONFLICT, errorMsg),
        { status: 409 }
      );
    }

    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, errorMsg),
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const unitId = searchParams.get('unitId');
    const guestId = searchParams.get('guestId');

    // For now, get active reservations (can be expanded)
    const reservations = await reservationService.getActiveReservations();

    return NextResponse.json(
      successResponse({
        data:
        reservations }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching reservations:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, error instanceof Error ? error.message : 'Unknown error'),
      { status: 500 }
    );
  }
}

/**
 * GET /api/reservations/[id]/receipt
 * Get booking receipt for printing or email
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext } from '@/lib/user-context';
import { prisma } from '@/lib/auth/prisma';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'User not authenticated'),
        { status: 401 }
      );
    }

    const { id } = await params;

    // Fetch reservation with all related data
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        unit: { include: { roomType: true } },
        guest: true,
      },
    });

    if (!reservation) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Reservation not found'),
        { status: 404 }
      );
    }

    // Format receipt data
    const receiptData = {
      id: reservation.id,
      confirmationNo: reservation.confirmationNo,
      unit: {
        roomNumber: reservation.unit.roomNumber,
        roomType: reservation.unit.roomType.name,
      },
      guest: {
        firstName: reservation.guest.firstName,
        lastName: reservation.guest.lastName,
        email: reservation.guest.email,
        phone: reservation.guest.phone,
      },
      checkInDate: reservation.checkInDate.toISOString(),
      checkOutDate: reservation.checkOutDate.toISOString(),
      checkInTime: reservation.checkInTime?.toISOString(),
      checkOutTime: reservation.checkOutTime?.toISOString(),
      totalPriceCents: reservation.totalPriceCents,
      paidCents: reservation.paidCents,
      currency: reservation.currency,
      status: reservation.status,
      notes: reservation.notes,
      createdAt: reservation.createdAt.toISOString(),
      updatedAt: reservation.updatedAt.toISOString(),
    };

    return NextResponse.json(
      successResponse({
        data: receiptData,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching receipt:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, errorMsg),
      { status: 500 }
    );
  }
}

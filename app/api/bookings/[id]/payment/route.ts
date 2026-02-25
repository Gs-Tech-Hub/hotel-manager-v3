/**
 * POST /api/bookings/[id]/payment
 * Create payment for booking
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { amount, method } = body;

    if (!amount || !method) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Amount and method are required'),
        { status: 400 }
      );
    }

    // Fetch the booking
    const booking = await prisma.booking.findUnique({
      where: { id },
    });

    if (!booking) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Booking not found'),
        { status: 404 }
      );
    }

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        transactionID: `TXN-${Date.now()}`,
        paymentMethod: method,
        paymentStatus: 'completed',
        totalPrice: amount,
      },
    });

    // Update booking with payment
    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: {
        bookingStatus: 'confirmed',
        paymentId: payment.id,
      },
      include: {
        customer: true,
        unit: {
          include: {
            roomType: true,
          },
        },
        payment: true,
      },
    });

    return NextResponse.json(
      successResponse({ data: { booking: updatedBooking, payment } }),
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to process payment'),
      { status: 500 }
    );
  }
}

/**
 * Payment Types API
 * 
 * GET /api/payment-types - Get all payment types
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const paymentTypes = await prisma.paymentType.findMany({
      select: {
        id: true,
        type: true,
        description: true,
      },
      orderBy: {
        type: 'asc',
      },
    });

    return NextResponse.json(
      successResponse({ data: paymentTypes }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Payment Types Error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch payment types'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

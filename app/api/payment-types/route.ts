/**
 * Payment Types API
 * 
 * GET /api/payment-types - Get all payment types
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext, loadUserWithRoles } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    // Extract user context - payment types listing is available to authenticated users
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'Not authenticated'),
        { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    // Load user with roles for audit/logging
    const userWithRoles = await loadUserWithRoles(ctx.userId);
    if (!userWithRoles) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'User not found'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

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
      successResponse(paymentTypes),
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


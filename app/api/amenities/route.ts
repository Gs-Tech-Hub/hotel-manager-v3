/**
 * GET /api/amenities - List all amenities
 * POST /api/amenities - Create new amenity
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const amenities = await prisma.amenity.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(
      successResponse({ data: amenities }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching amenities:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, error instanceof Error ? error.message : 'Unknown error'),
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, icon } = body;

    if (!name) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Amenity name is required'),
        { status: 400 }
      );
    }

    const amenity = await prisma.amenity.create({
      data: {
        name,
        description: description || null,
        icon: icon || null,
      },
    });

    return NextResponse.json(
      successResponse({ data: amenity }),
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating amenity:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, error instanceof Error ? error.message : 'Unknown error'),
      { status: 500 }
    );
  }
}

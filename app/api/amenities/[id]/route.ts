/**
 * GET /api/amenities/[id] - Get a specific amenity
 * PUT /api/amenities/[id] - Update amenity
 * DELETE /api/amenities/[id] - Delete amenity
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const amenity = await prisma.amenity.findUnique({
      where: { id },
    });

    if (!amenity) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Amenity not found'),
        { status: 404 }
      );
    }

    return NextResponse.json(
      successResponse({ data: amenity }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching amenity:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, error instanceof Error ? error.message : 'Unknown error'),
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, icon } = body;

    if (!name) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Amenity name is required'),
        { status: 400 }
      );
    }

    const amenity = await prisma.amenity.update({
      where: { id },
      data: {
        name,
        description: description || null,
        icon: icon || null,
      },
    });

    return NextResponse.json(
      successResponse({ data: amenity }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating amenity:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, error instanceof Error ? error.message : 'Unknown error'),
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const amenity = await prisma.amenity.findUnique({
      where: { id },
    });

    if (!amenity) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Amenity not found'),
        { status: 404 }
      );
    }

    await prisma.amenity.delete({
      where: { id },
    });

    return NextResponse.json(
      successResponse({ message: 'Amenity deleted' }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting amenity:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, error instanceof Error ? error.message : 'Unknown error'),
      { status: 500 }
    );
  }
}

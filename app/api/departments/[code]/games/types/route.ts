import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';
import { extractUserContext } from '@/lib/user-context';

/**
 * GET /api/departments/[code]/games/types
 * Fetch all game types for this department
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const ctx = await extractUserContext(request);
    
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED),
        { status: 401 }
      );
    }

    const { code } = await params;

    // Support section-style codes
    const rawCode = code;
    let departmentCode = rawCode;
    let resolvedSectionId: string | undefined = undefined;
    if (rawCode.includes(':')) {
      const parts = rawCode.split(':');
      departmentCode = parts[0];
      const sectionSlugOrId = parts.slice(1).join(':');
      const parentDept = await prisma.department.findFirst({ where: { code: departmentCode } });
      if (parentDept) {
        const section = await prisma.departmentSection.findFirst({ where: { departmentId: parentDept.id, OR: [ { slug: sectionSlugOrId }, { id: sectionSlugOrId } ] } });
        if (section) resolvedSectionId = section.id;
      }
    }

    const department = await prisma.department.findFirst({ where: { code: departmentCode } });

    if (!department) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Department not found'),
        { status: 404 }
      );
    }

    const gameTypes = await prisma.gameType.findMany({
      where: { 
        departmentId: department.id,
        isActive: true 
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(
      successResponse({ data: { gameTypes, sectionId: resolvedSectionId } }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching game types:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch game types'),
      { status: 500 }
    );
  }
}

/**
 * POST /api/departments/[code]/games/types
 * Create a new game type for this department
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const ctx = await extractUserContext(request);
    
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED),
        { status: 401 }
      );
    }

    const { code } = await params;

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
    const { name, description, pricePerGame } = body;

    // Validation
    if (!name || pricePerGame === undefined) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Name and price per game are required'),
        { status: 400 }
      );
    }

    if (isNaN(parseFloat(pricePerGame)) || parseFloat(pricePerGame) < 0) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Price per game must be a valid positive number'),
        { status: 400 }
      );
    }

    // Check if game type already exists in this department
    const existingType = await prisma.gameType.findFirst({
      where: { 
        departmentId: department.id,
        name: name.trim() 
      },
    });

    if (existingType) {
      return NextResponse.json(
        errorResponse(ErrorCodes.CONFLICT, 'Game type already exists in this department'),
        { status: 409 }
      );
    }

    // Create new game type
    const gameType = await prisma.gameType.create({
      data: {
        name: name.trim(),
        description: description?.trim(),
        pricePerGame: parseFloat(pricePerGame),
        departmentId: department.id,
      },
    });

    return NextResponse.json(
      successResponse({ data: { gameType } }),
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating game type:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to create game type'),
      { status: 500 }
    );
  }
}

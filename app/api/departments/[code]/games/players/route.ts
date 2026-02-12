import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';
import { extractUserContext } from '@/lib/user-context';

/**
 * GET /api/departments/[code]/games/players
 * Fetch all customers or search by name/phone
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

    // Verify department exists
    const department = await prisma.department.findFirst({ where: { code: departmentCode } });

    if (!department) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Department not found'),
        { status: 404 }
      );
    }

    const searchParam = request.nextUrl.searchParams.get('search');

    const where = searchParam
      ? {
          OR: [
            { firstName: { contains: searchParam, mode: 'insensitive' as const } },
            { lastName: { contains: searchParam, mode: 'insensitive' as const } },
            { phone: { contains: searchParam, mode: 'insensitive' as const } },
            { email: { contains: searchParam, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const customers = await prisma.customer.findMany({
      where,
      include: {
        gameSessions: {
          where: { 
            status: 'active',
            ...(resolvedSectionId ? { sectionId: resolvedSectionId } : { gameType: { departmentId: department.id } })
          },
          include: { gameType: true, section: true },
          orderBy: { startedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json(
      successResponse({ data: { customers, sectionId: resolvedSectionId } }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch customers'),
      { status: 500 }
    );
  }
}

/**
 * POST /api/departments/[code]/games/players
 * Register or update a customer for games
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

    // Verify department exists
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
    const { firstName, lastName, phone, email } = body;

    // Validation
    if (!firstName || !phone) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'First name and phone are required'),
        { status: 400 }
      );
    }

    // Check if customer exists by phone
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        phone,
      },
    });

    if (existingCustomer) {
      return NextResponse.json(
        successResponse({ data: { customer: existingCustomer } }),
        { status: 200 }
      );
    }

    // Create new customer
    const customer = await prisma.customer.create({
      data: {
        firstName: firstName.trim(),
        lastName: lastName?.trim() || '',
        phone: phone.trim(),
        email: email?.trim() || `${firstName}${phone}@games.local`,
      },
    });

    return NextResponse.json(
      successResponse({ data: { customer } }),
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating customer:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to create customer'),
      { status: 500 }
    );
  }
}

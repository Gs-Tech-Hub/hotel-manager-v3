import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';
import { extractUserContext } from '@/lib/user-context';

/**
 * GET /api/departments/[code]/games/sessions
 * Fetch all game sessions for this department with optional filtering
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

    // Support section-style codes: "parent:section"
    const rawCode = code;
    let departmentCode = rawCode;
    let resolvedSectionId: string | undefined = undefined;

    if (rawCode.includes(':')) {
      const parts = rawCode.split(':');
      departmentCode = parts[0];
      const sectionSlugOrId = parts.slice(1).join(':');
      const parentDept = await prisma.department.findFirst({ where: { code: departmentCode } });
      if (parentDept) {
        const section = await prisma.departmentSection.findFirst({
          where: { departmentId: parentDept.id, OR: [ { slug: sectionSlugOrId }, { id: sectionSlugOrId } ] }
        });
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

    const status = request.nextUrl.searchParams.get('status') || 'active';
    const customerId = request.nextUrl.searchParams.get('customerId');

    // Build filter: sessions are linked to sections, not gameType anymore
    // If section is specified, filter by that section
    // Otherwise, get all sessions in this department via sections
    const where: any = {
      status: status || undefined
    };
    
    if (resolvedSectionId) {
      where.sectionId = resolvedSectionId;
    } else {
      // Get all sections in this department first
      const sections = await prisma.departmentSection.findMany({
        where: { departmentId: department.id, isActive: true },
        select: { id: true },
      });
      const sectionIds = sections.map(s => s.id);
      where.sectionId = { in: sectionIds };
    }
    
    if (customerId) {
      where.customerId = customerId;
    }

    const sessions = await prisma.gameSession.findMany({
      where,
      include: {
        customer: true,
        gameType: true,
        section: true,
        order: true,
      },
      orderBy: { startedAt: 'desc' },
      take: 100,
    });

    return NextResponse.json(
      successResponse({ data: { sessions, sectionId: resolvedSectionId } }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching game sessions:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch game sessions'),
      { status: 500 }
    );
  }
}

/**
 * POST /api/departments/[code]/games/sessions
 * Create a new game session for a customer
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

    // Support section-style codes: "parent:section"
    const rawCode = code;
    let departmentCode = rawCode;
    let resolvedSectionId: string | undefined = undefined;

    if (rawCode.includes(':')) {
      const parts = rawCode.split(':');
      departmentCode = parts[0];
      const sectionSlugOrId = parts.slice(1).join(':');
      const parentDept = await prisma.department.findFirst({ where: { code: departmentCode } });
      if (parentDept) {
        const section = await prisma.departmentSection.findFirst({
          where: { departmentId: parentDept.id, OR: [ { slug: sectionSlugOrId }, { id: sectionSlugOrId } ] }
        });
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

    const body = await request.json();
    const { customerId, serviceId } = body;

    // Validation: require sectionId (must be resolved from code or provided)
    if (!resolvedSectionId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Section ID is required (use format: department:section)'),
        { status: 400 }
      );
    }

    if (!customerId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Customer ID is required'),
        { status: 400 }
      );
    }

    // If serviceId provided, validate it
    if (serviceId) {
      const service = await prisma.serviceInventory.findUnique({
        where: { id: serviceId },
      });

      if (!service) {
        return NextResponse.json(
          errorResponse(ErrorCodes.NOT_FOUND, 'Service not found'),
          { status: 404 }
        );
      }

      // Service must belong to this section or department
      if (service.sectionId !== resolvedSectionId && service.departmentId !== department.id) {
        return NextResponse.json(
          errorResponse(ErrorCodes.FORBIDDEN, 'Service does not belong to this section or department'),
          { status: 403 }
        );
      }
    }

    // Check if section exists and belongs to this department
    const section = await prisma.departmentSection.findUnique({
      where: { id: resolvedSectionId },
    });

    if (!section || section.departmentId !== department.id) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Section not found or does not belong to this department'),
        { status: 404 }
      );
    }

    // Check if customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Customer not found'),
        { status: 404 }
      );
    }

    // Check for active session in this section
    const activeSession = await prisma.gameSession.findFirst({
      where: {
        customerId,
        sectionId: resolvedSectionId,
        status: 'active',
      },
    });

    if (activeSession) {
      return NextResponse.json(
        errorResponse(ErrorCodes.CONFLICT, 'Customer already has an active game session in this section'),
        { status: 409 }
      );
    }

    // Create new session with sectionId and optional serviceId
    const session = await prisma.gameSession.create({
      data: {
        customerId,
        sectionId: resolvedSectionId,
        serviceId: serviceId || null,
        gameCount: 1,
        totalAmount: 0, // Pricing calculated at checkout
        status: 'active',
      },
      include: {
        customer: true,
        gameType: true,
        section: true,
        service: true,
      },
    });

    return NextResponse.json(
      successResponse({ data: { session, sectionId: resolvedSectionId } }),
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating game session:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to create game session'),
      { status: 500 }
    );
  }
}

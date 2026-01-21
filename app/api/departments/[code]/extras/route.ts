import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';
import { extractUserContext } from '@/lib/user-context';
import { prisma } from '@/lib/auth/prisma';
import { DepartmentExtrasService } from '@/services/department-extras.service';

/**
 * GET: Fetch department-level extras (optionally filtered by section)
 * POST: Allocate new extras to department
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'User not authenticated'),
        { status: 401 }
      );
    }

    const { code: departmentCode } = await params;
    const sectionId = request.nextUrl.searchParams.get('sectionId');

    // Get department
    const dept = await prisma.department.findFirst({
      where: { code: departmentCode },
      select: { id: true },
    });

    if (!dept) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Department not found'),
        { status: 404 }
      );
    }

    // Fetch department extras
    const extras = await DepartmentExtrasService.getDepartmentExtras(
      dept.id,
      sectionId || undefined
    );

    return NextResponse.json(successResponse({ data: { extras } }), { status: 200 });
  } catch (error) {
    console.error('Error fetching department extras:', error);
    return NextResponse.json(
      errorResponse(
        ErrorCodes.INTERNAL_ERROR,
        'Failed to fetch department extras'
      ),
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'User not authenticated'),
        { status: 401 }
      );
    }

    const { code: departmentCode } = await params;
    const body = await request.json();
    const { extraId, quantity, sectionId } = body;

    console.log('POST /api/departments/[code]/extras - Request body:', { departmentCode, extraId, quantity, sectionId });

    if (!extraId || quantity === undefined) {
      return NextResponse.json(
        errorResponse(
          ErrorCodes.INVALID_INPUT,
          'extraId and quantity are required'
        ),
        { status: 400 }
      );
    }

    // Get department
    const dept = await prisma.department.findFirst({
      where: { code: departmentCode },
      select: { id: true },
    });

    console.log('Department lookup result:', { departmentCode, deptId: dept?.id });

    if (!dept) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Department not found'),
        { status: 404 }
      );
    }

    // Verify extra exists
    const extraExists = await prisma.extra.findUnique({
      where: { id: extraId },
      select: { id: true, name: true },
    });

    console.log('Extra lookup result:', { extraId, extra: extraExists });

    if (!extraExists) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, `Extra not found: ${extraId}`),
        { status: 404 }
      );
    }

    // Allocate extra to department
    const result = await DepartmentExtrasService.allocateExtraToDepartment(
      dept.id,
      extraId,
      quantity,
      sectionId
    );

    return NextResponse.json(
      successResponse({
        data: { extra: result },
        message: 'Extra allocated successfully',
      }),
      { status: 201 }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Error allocating extra:', errorMsg, error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, `Failed to allocate extra: ${errorMsg}`),
      { status: 500 }
    );
  }
}

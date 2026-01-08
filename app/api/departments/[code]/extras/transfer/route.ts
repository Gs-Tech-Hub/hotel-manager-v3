import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';
import { extractUserContext } from '@/src/lib/user-context';
import { prisma } from '@/lib/prisma';
import { DepartmentExtrasService } from '@/src/services/department-extras.service';

/**
 * POST: Transfer extras between sections within same department
 */
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
    const { extraId, sourceSectionId, destinationSectionId, quantity } = body;

    if (
      !extraId ||
      !sourceSectionId ||
      !destinationSectionId ||
      quantity === undefined
    ) {
      return NextResponse.json(
        errorResponse(
          ErrorCodes.INVALID_INPUT,
          'extraId, sourceSectionId, destinationSectionId, and quantity are required'
        ),
        { status: 400 }
      );
    }

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

    // Transfer extras
    const result = await DepartmentExtrasService.transferExtrasBetweenSections(
      dept.id,
      extraId,
      sourceSectionId,
      destinationSectionId,
      quantity
    );

    return NextResponse.json(
      successResponse({
        message: 'Extras transferred successfully',
        extra: result,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error transferring extras:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, `Transfer failed: ${message}`),
      { status: 500 }
    );
  }
}

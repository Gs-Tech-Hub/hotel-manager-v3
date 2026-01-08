import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';
import { extractUserContext } from '@/src/lib/user-context';
import { prisma } from '@/lib/prisma';
import { DepartmentExtrasService } from '@/src/services/department-extras.service';

/**
 * GET: Get extras not yet allocated to this department
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

    // Get unallocated extras
    const extras = await DepartmentExtrasService.getUnallocatedExtras(dept.id);

    return NextResponse.json(successResponse({ extras }), { status: 200 });
  } catch (error) {
    console.error('Error fetching unallocated extras:', error);
    return NextResponse.json(
      errorResponse(
        ErrorCodes.INTERNAL_ERROR,
        'Failed to fetch unallocated extras'
      ),
      { status: 500 }
    );
  }
}

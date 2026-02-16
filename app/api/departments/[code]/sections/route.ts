/**
 * GET /api/departments/[code]/sections
 * Get all sections for a specific department
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';

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

    // Get department by code
    const dept = await prisma.department.findFirst({
      where: { code: departmentCode },
      select: { id: true, name: true, code: true },
    });

    if (!dept) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Department not found'),
        { status: 404 }
      );
    }

    // Get all sections for this department
    const sections = await prisma.departmentSection.findMany({
      where: { departmentId: dept.id },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(
      successResponse({
        data: {
          department: {
            id: dept.id,
            name: dept.name,
            code: dept.code,
          },
          sections,
          count: sections.length,
        },
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Get department sections error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch sections'),
      { status: 500 }
    );
  }
}

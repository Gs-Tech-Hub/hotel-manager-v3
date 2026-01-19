import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext } from '@/lib/user-context';
import { prisma } from '@/lib/auth/prisma';
import { errorResponse, successResponse } from '@/lib/api-response';

/**
 * GET /api/employees/[id]/employment
 * Get employment data for an employee
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await extractUserContext(req);
    if (!ctx.userId) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'User not authenticated'), { status: 401 });
    }

    const { id } = await params;

    const employment = await (prisma as any).employmentData.findUnique({
      where: { userId: id },
      include: {
        leaves: { orderBy: { startDate: 'desc' } },
        charges: { orderBy: { date: 'desc' } },
        termination: true,
      },
    });

    if (!employment) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Employment data not found'),
        { status: 404 }
      );
    }

    return NextResponse.json(successResponse(employment), { status: 200 });
  } catch (error) {
    console.error('[API] Failed to get employment data:', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to get employment data'),
      { status: 500 }
    );
  }
}

/**
 * POST /api/employees/[id]/employment
 * Create or update employment data for an employee
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await extractUserContext(req);
    if (!ctx.userId) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'User not authenticated'), { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const {
      employmentDate,
      position,
      department,
      salary,
      salaryType = 'monthly',
      salaryFrequency = 'monthly',
      employmentStatus = 'active',
      contractType,
      reportsTo,
    } = body;

    // Validate required fields
    if (!employmentDate || !position) {
      return NextResponse.json(
        errorResponse('BAD_REQUEST', 'Missing required fields: employmentDate, position'),
        { status: 400 }
      );
    }

    // Check if employee exists
    const employee = await prisma.pluginUsersPermissionsUser.findUnique({
      where: { id },
    });

    if (!employee) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Employee not found'),
        { status: 404 }
      );
    }

    // Check if employment data already exists
    const existing = await (prisma as any).employmentData.findUnique({
      where: { userId: id },
    });

    const employment = await (existing
      ? (prisma as any).employmentData.update({
          where: { userId: id },
          data: {
            employmentDate: new Date(employmentDate),
            position,
            department: department || null,
            salary: salary ? parseFloat(salary.toString()) : existing.salary,
            salaryType,
            salaryFrequency,
            employmentStatus,
            contractType: contractType || null,
            reportsTo: reportsTo || null,
          },
        })
      : (prisma as any).employmentData.create({
          data: {
            userId: id,
            employmentDate: new Date(employmentDate),
            position,
            department: department || null,
            salary: salary ? parseFloat(salary.toString()) : 0,
            salaryType,
            salaryFrequency,
            employmentStatus,
            contractType: contractType || null,
            reportsTo: reportsTo || null,
          },
        }));

    console.log(
      `[API] ${existing ? 'Updated' : 'Created'} employment data for employee: ${id}`
    );

    return NextResponse.json(successResponse(employment), { status: existing ? 200 : 201 });
  } catch (error: any) {
    console.error('[API] Failed to manage employment data:', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', error.message || 'Failed to manage employment data'),
      { status: 500 }
    );
  }
}

/**
 * PUT /api/employees/[id]/employment
 * Update employment status (same as POST for now, kept for REST semantics)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return POST(req, { params });
}

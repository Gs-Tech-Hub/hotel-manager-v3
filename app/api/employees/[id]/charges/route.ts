import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext } from '@/lib/user-context';
import { prisma } from '@/lib/auth/prisma';
import { errorResponse, successResponse } from '@/lib/api-response';

/**
 * GET /api/employees/[id]/charges
 * Get all charges/debts for an employee
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
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status');
    const chargeType = searchParams.get('chargeType');

    // Check if employment data exists
    const employment = await (prisma as any).employmentData.findUnique({
      where: { userId: id },
    });

    if (!employment) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Employment data not found'),
        { status: 404 }
      );
    }

    // Build filter
    const where: any = { employmentDataId: employment.id };
    if (status) {
      where.status = status;
    }
    if (chargeType) {
      where.chargeType = chargeType;
    }

    const charges = await (prisma as any).employeeCharge.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    // Calculate statistics
    const stats = {
      total: charges.length,
      totalAmount: charges.reduce((sum: number, c: any) => sum + Number(c.amount), 0),
      totalPaid: charges.reduce((sum: number, c: any) => sum + Number(c.paidAmount), 0),
      pending: charges.filter((c: any) => c.status === 'pending').length,
      paid: charges.filter((c: any) => c.status === 'paid').length,
      partiallyPaid: charges.filter((c: any) => c.status === 'partially_paid').length,
    };

    return NextResponse.json(
      successResponse({ data: { charges, statistics: stats } }),
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] Failed to get charges:', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to get charges'),
      { status: 500 }
    );
  }
}

/**
 * POST /api/employees/[id]/charges
 * Create a new charge/debt for an employee
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
      chargeType,
      amount,
      description,
      reason,
      date,
      dueDate,
    } = body;

    // Validate required fields
    if (!chargeType || !amount || !date) {
      return NextResponse.json(
        errorResponse('BAD_REQUEST', 'Missing required fields: chargeType, amount, date'),
        { status: 400 }
      );
    }

    // Check if employment data exists
    const employment = await (prisma as any).employmentData.findUnique({
      where: { userId: id },
    });

    if (!employment) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Employment data not found'),
        { status: 404 }
      );
    }

    // Create charge with employee data included
    const charge = await (prisma as any).employeeCharge.create({
      data: {
        employmentDataId: employment.id,
        chargeType,
        amount: parseFloat(amount.toString()),
        description: description || null,
        reason: reason || null,
        date: new Date(date),
        dueDate: dueDate ? new Date(dueDate) : null,
        status: 'pending',
      },
      include: {
        employmentData: {
          include: {
            user: {
              select: {
                id: true,
                firstname: true,
                lastname: true,
                email: true,
              },
            },
          },
        },
      },
    });

    // Update total charges in employment data
    await (prisma as any).employmentData.update({
      where: { userId: id },
      data: {
        totalCharges: {
          increment: Number(charge.amount),
        },
      },
    });

    console.log(`[API] Created charge for employee: ${id}`, { chargeId: charge.id, employeeId: id });

    return NextResponse.json(successResponse({ data: charge }), { status: 201 });
  } catch (error: any) {
    console.error('[API] Failed to create charge:', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', error.message || 'Failed to create charge'),
      { status: 500 }
    );
  }
}

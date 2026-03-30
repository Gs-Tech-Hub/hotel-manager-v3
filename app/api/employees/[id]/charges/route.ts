import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { checkPermission, type PermissionContext } from '@/lib/auth/rbac';
import { prisma } from '@/lib/auth/prisma';
import { errorResponse, successResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';

/**
 * GET /api/employees/[id]/charges
 * Get all charges/debts for an employee
 * Requires: employees.read permission
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await extractUserContext(req);
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'User not authenticated'),
        { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    // Load user with roles
    const userWithRoles = await loadUserWithRoles(ctx.userId);
    if (!userWithRoles) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Check permission to read employee data
    const permCtx: PermissionContext = {
      userId: ctx.userId,
      userType: userWithRoles.isAdmin ? 'admin' : 'employee',
    };

    const canRead = await checkPermission(permCtx, 'employees.read');
    if (!canRead) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions to view employee charges'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
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
        errorResponse(ErrorCodes.NOT_FOUND, 'Employment data not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
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
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to get charges'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

/**
 * POST /api/employees/[id]/charges
 * Create a new charge/debt for an employee
 * Requires: employees.update permission (includes charge management)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await extractUserContext(req);
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'User not authenticated'),
        { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    // Load user with roles
    const userWithRoles = await loadUserWithRoles(ctx.userId);
    if (!userWithRoles) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Check permission to update employees (includes charge management)
    const permCtx: PermissionContext = {
      userId: ctx.userId,
      userType: userWithRoles.isAdmin ? 'admin' : 'employee',
    };

    const canCreate = await checkPermission(permCtx, 'employees.update');
    if (!canCreate) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions to create employee charges'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
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
      status = 'pending',
    } = body;

    // Validate required fields
    if (!chargeType || !amount || !date) {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, 'Missing required fields: chargeType, amount, date'),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Check if employment data exists
    const employment = await (prisma as any).employmentData.findUnique({
      where: { userId: id },
    });

    if (!employment) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Employment data not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
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
        status: status || 'pending',
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

    console.log(`[API] Employee charge created: ${id} by ${ctx.userId}`, { chargeId: charge.id, amount: charge.amount, type: chargeType });

    return NextResponse.json(successResponse({ data: charge }), { status: 201 });
  } catch (error: any) {
    console.error('[API] Failed to create charge:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, error.message || 'Failed to create charge'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

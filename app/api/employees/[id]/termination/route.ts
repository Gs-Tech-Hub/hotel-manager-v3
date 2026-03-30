import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { checkPermission, type PermissionContext } from '@/lib/auth/rbac';
import { prisma } from '@/lib/auth/prisma';
import { errorResponse, successResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';
import { PERMISSIONS } from '@/lib/permissions';

/**
 * GET /api/employees/[id]/termination
 * Get termination data for an employee
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await extractUserContext(req);
    if (!ctx.userId) {
      return NextResponse.json(errorResponse(ErrorCodes.UNAUTHORIZED, 'User not authenticated'), { status: 401 });
    }

    // Load user with roles for RBAC
    const userWithRoles = await loadUserWithRoles(ctx.userId);
    if (!userWithRoles) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Check permission to view employee termination
    const permCtx: PermissionContext = {
      userId: ctx.userId,
      userType: (userWithRoles.isAdmin ? 'admin' : hasAnyRole(userWithRoles, ['admin', 'manager', 'hr_manager']) ? 'employee' : 'other') as 'admin' | 'employee' | 'other',
    };

    const canViewTermination = await checkPermission(permCtx, PERMISSIONS.EMPLOYEES.TERMINATE);
    if (!canViewTermination) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions to view termination'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    const { id } = await params;

    // Check if employment data exists
    const employment = await (prisma as any).employmentData.findUnique({
      where: { userId: id },
      include: { termination: true },
    });

    if (!employment) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Employment data not found'),
        { status: 404 }
      );
    }

    if (!employment.termination) {
      return NextResponse.json(
        successResponse({ message: 'Employee is currently active' }),
        { status: 200 }
      );
    }

    return NextResponse.json(successResponse(employment.termination), { status: 200 });
  } catch (error) {
    console.error('[API] Failed to get termination data:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to get termination data'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

/**
 * POST /api/employees/[id]/termination
 * Terminate an employee
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await extractUserContext(req);
    if (!ctx.userId) {
      return NextResponse.json(errorResponse(ErrorCodes.UNAUTHORIZED, 'User not authenticated'), { status: 401 });
    }

    // Load user with roles for RBAC
    const userWithRoles = await loadUserWithRoles(ctx.userId);
    if (!userWithRoles) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Check permission to terminate employees
    const permCtx: PermissionContext = {
      userId: ctx.userId,
      userType: (userWithRoles.isAdmin ? 'admin' : hasAnyRole(userWithRoles, ['admin', 'manager', 'hr_manager']) ? 'employee' : 'other') as 'admin' | 'employee' | 'other',
    };

    const canTerminate = await checkPermission(permCtx, PERMISSIONS.EMPLOYEES.TERMINATE);
    if (!canTerminate) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions to terminate employees'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const {
      terminationDate,
      reason,
      details,
      finalSettlement,
    } = body;

    // Validate required fields
    if (!terminationDate || !reason) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Missing required fields: terminationDate, reason'),
        { status: getStatusCode(ErrorCodes.BAD_REQUEST) }
      );
    }

    // Check if employment data exists
    const employment = await (prisma as any).employmentData.findUnique({
      where: { userId: id },
      include: { termination: true },
    });

    if (!employment) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Employment data not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Check if already terminated
    if (employment.termination) {
      return NextResponse.json(
        errorResponse(ErrorCodes.CONFLICT, 'Employee has already been terminated'),
        { status: getStatusCode(ErrorCodes.CONFLICT) }
      );
    }

    // Create termination record
    const termination = await (prisma as any).employeeTermination.create({
      data: {
        employmentDataId: employment.id,
        terminationDate: new Date(terminationDate),
        reason,
        details: details || null,
        finalSettlement: finalSettlement ? parseFloat(finalSettlement.toString()) : 0,
        settlementStatus: 'pending',
      },
    });

    // Update employment status
    await (prisma as any).employmentData.update({
      where: { userId: id },
      data: {
        employmentStatus: 'terminated',
        terminationDate: new Date(terminationDate),
        terminationReason: reason,
        terminationNotes: details || null,
      },
    });

    console.log(`[API] Terminated employee: ${id}`);

    return NextResponse.json(successResponse(termination), { status: 201 });
  } catch (error: any) {
    console.error('[API] Failed to terminate employee:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, error.message || 'Failed to terminate employee'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

/**
 * PUT /api/employees/[id]/termination
 * Update termination settlement
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await extractUserContext(req);
    if (!ctx.userId) {
      return NextResponse.json(errorResponse(ErrorCodes.UNAUTHORIZED, 'User not authenticated'), { status: 401 });
    }

    // Load user with roles for RBAC
    const userWithRoles = await loadUserWithRoles(ctx.userId);
    if (!userWithRoles) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Check permission to update termination
    const permCtx: PermissionContext = {
      userId: ctx.userId,
      userType: (userWithRoles.isAdmin ? 'admin' : hasAnyRole(userWithRoles, ['admin', 'manager', 'hr_manager', 'accountant']) ? 'employee' : 'other') as 'admin' | 'employee' | 'other',
    };

    const canTerminate = await checkPermission(permCtx, PERMISSIONS.EMPLOYEES.TERMINATE);
    if (!canTerminate) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions to update termination'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const {
      settlementStatus,
      settlementDate,
      notes,
    } = body;

    // Check if employment data exists
    const employment = await (prisma as any).employmentData.findUnique({
      where: { userId: id },
      include: { termination: true },
    });

    if (!employment || !employment.termination) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Termination record not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    const termination = await (prisma as any).employeeTermination.update({
      where: { id: employment.termination.id },
      data: {
        settlementStatus: settlementStatus || employment.termination.settlementStatus,
        settlementDate: settlementDate ? new Date(settlementDate) : employment.termination.settlementDate,
        notes: notes !== undefined ? notes : employment.termination.notes,
      },
    });

    console.log(`[API] Updated termination for employee: ${id}`);

    return NextResponse.json(successResponse(termination), { status: 200 });
  } catch (error: any) {
    console.error('[API] Failed to update termination:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, error.message || 'Failed to update termination'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

/**
 * DELETE /api/employees/[id]/termination
 * Restore a terminated employee (soft restore)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await extractUserContext(req);
    if (!ctx.userId) {
      return NextResponse.json(errorResponse(ErrorCodes.UNAUTHORIZED, 'User not authenticated'), { status: 401 });
    }

    // Load user with roles for RBAC
    const userWithRoles = await loadUserWithRoles(ctx.userId);
    if (!userWithRoles) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Check permission to restore/terminate employees
    const permCtx: PermissionContext = {
      userId: ctx.userId,
      userType: (userWithRoles.isAdmin ? 'admin' : hasAnyRole(userWithRoles, ['admin', 'manager', 'hr_manager']) ? 'employee' : 'other') as 'admin' | 'employee' | 'other',
    };

    const canTerminate = await checkPermission(permCtx, PERMISSIONS.EMPLOYEES.TERMINATE);
    if (!canTerminate) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions to restore employees'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    const { id } = await params;

    // Check if employment data exists
    const employment = await (prisma as any).employmentData.findUnique({
      where: { userId: id },
      include: { termination: true },
    });

    if (!employment || !employment.termination) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Termination record not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Delete termination record
    await (prisma as any).employeeTermination.delete({
      where: { id: employment.termination.id },
    });

    // Restore employment status
    await (prisma as any).employmentData.update({
      where: { userId: id },
      data: {
        employmentStatus: 'active',
        terminationDate: null,
        terminationReason: null,
        terminationNotes: null,
      },
    });

    console.log(`[API] Restored employee: ${id}`);

    return NextResponse.json(
      successResponse({ message: 'Employee restored' }),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[API] Failed to restore employee:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, error.message || 'Failed to restore employee'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

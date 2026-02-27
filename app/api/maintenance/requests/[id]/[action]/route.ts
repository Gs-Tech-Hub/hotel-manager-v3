/**
 * POST /api/maintenance/requests/[id]/start - Start a maintenance request
 * POST /api/maintenance/requests/[id]/complete - Mark request as completed
 * POST /api/maintenance/requests/[id]/verify - Verify a completed request
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { maintenanceService } from '@/src/services/MaintenanceService';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';
import { checkPermission, type PermissionContext } from '@/lib/auth/rbac';
import { prisma } from '@/lib/auth/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  try {
    const { id: requestId, action } = await params;
    const ctx = await extractUserContext(request);

    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'User not authenticated'),
        { status: 401 }
      );
    }

    // Load user with roles and check permissions
    const user = await loadUserWithRoles(ctx.userId);
    if (!user) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'User not found'),
        { status: 401 }
      );
    }

    const permCtx: PermissionContext = {
      userId: ctx.userId,
      userType: user.isAdmin ? 'admin' : hasAnyRole(user, ['admin', 'manager', 'staff']) ? 'employee' : 'other',
    };

    // Check action permissions
    if (action === 'start' || action === 'log') {
      // 'log' and 'start' are equivalent - start work on a maintenance request
      const hasAccess = await checkPermission(permCtx, 'maintenance.work', 'maintenance');
      if (!hasAccess) {
        return NextResponse.json(
          errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions to start maintenance request'),
          { status: 403 }
        );
      }

      // Mark as IN_PROGRESS
      const mainReq = await prisma.maintenanceRequest.findUnique({
        where: { id: requestId },
      });

      if (!mainReq) {
        return NextResponse.json(
          errorResponse(ErrorCodes.NOT_FOUND, 'Maintenance request not found'),
          { status: 404 }
        );
      }

      const updated = await prisma.maintenanceRequest.update({
        where: { id: requestId },
        data: {
          status: 'IN_PROGRESS',
          startedAt: new Date(),
        },
      });

      return NextResponse.json(
        successResponse({ data: updated, message: 'Maintenance work started' }),
        { status: 200 }
      );
    } else if (action === 'complete') {
      const hasAccess = await checkPermission(permCtx, 'maintenance.work', 'maintenance');
      if (!hasAccess) {
        return NextResponse.json(
          errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions to complete maintenance request'),
          { status: 403 }
        );
      }

      let body: any = {};
      const contentLength = request.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > 0) {
        try {
          body = await request.json();
        } catch (e) {
          body = {};
        }
      }

      const mainReq = await prisma.maintenanceRequest.findUnique({
        where: { id: requestId },
        include: { unit: true },
      });

      if (!mainReq) {
        return NextResponse.json(
          errorResponse(ErrorCodes.NOT_FOUND, 'Maintenance request not found'),
          { status: 404 }
        );
      }

      const updated = await prisma.maintenanceRequest.update({
        where: { id: requestId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          ...(body.actualCostCents && { actualCostCents: body.actualCostCents }),
          ...(body.completionNotes && { notes: body.completionNotes }),
        },
      });

      return NextResponse.json(
        successResponse({ data: updated, message: 'Maintenance request completed' }),
        { status: 200 }
      );
    } else if (action === 'verify') {
      const hasAccess = await checkPermission(permCtx, 'maintenance.verify', 'maintenance');
      if (!hasAccess) {
        return NextResponse.json(
          errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions to verify maintenance request'),
          { status: 403 }
        );
      }

      let body: any = {};
      const contentLength = request.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > 0) {
        try {
          body = await request.json();
        } catch (e) {
          body = {};
        }
      }
      const approved = body.approved === true;

      const mainReq = await prisma.maintenanceRequest.findUnique({
        where: { id: requestId },
        include: { unit: true },
      });

      if (!mainReq) {
        return NextResponse.json(
          errorResponse(ErrorCodes.NOT_FOUND, 'Maintenance request not found'),
          { status: 404 }
        );
      }

      const newStatus = approved ? 'VERIFIED' : 'REJECTED';
      const updated = await prisma.maintenanceRequest.update({
        where: { id: requestId },
        data: {
          status: newStatus,
          verifiedAt: approved ? new Date() : null,
          verifiedById: approved ? ctx.userId : null,
          ...(body.verificationNotes && { notes: body.verificationNotes }),
        },
      });

      // If request is verified/approved, mark room as AVAILABLE
      if (approved && mainReq.unit) {
        // Check if there are other active maintenance requests
        const otherActiveRequests = await prisma.maintenanceRequest.findMany({
          where: {
            unitId: mainReq.unitId,
            id: { not: requestId },
            status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED'] },
          },
        });

        if (otherActiveRequests.length === 0) {
          // All maintenance requests are done and verified, mark room available
          await prisma.unit.update({
            where: { id: mainReq.unitId },
            data: {
              status: 'AVAILABLE',
              statusUpdatedAt: new Date(),
            },
          });

          // Log status change
          await prisma.unitStatusHistory.create({
            data: {
              unitId: mainReq.unitId,
              previousStatus: 'MAINTENANCE',
              newStatus: 'AVAILABLE',
              reason: 'Maintenance request completed and verified',
              changedBy: ctx.userId,
            },
          });
        }
      }

      return NextResponse.json(
        successResponse({ data: updated, message: approved ? 'Request verified' : 'Request rejected' }),
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, `Unknown action: ${action}`),
        { status: 400 }
      );
    }
  } catch (error) {
    console.error(`Error performing maintenance request action:`, error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    if (errorMsg.includes('Insufficient permissions')) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, errorMsg),
        { status: 403 }
      );
    }

    if (errorMsg.includes('not found')) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, errorMsg),
        { status: 404 }
      );
    }

    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, errorMsg),
      { status: 500 }
    );
  }
}

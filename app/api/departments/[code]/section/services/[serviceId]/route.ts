import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/auth/prisma'
import { extractUserContext, loadUserWithRoles } from '@/lib/user-context'
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response'
import { checkPermission, type PermissionContext } from '@/lib/auth/rbac'

/**
 * DELETE /api/departments/[code]/section/services/[serviceId]
 * Remove a service from a specific section (does not delete the service globally)
 * 
 * Params:
 *   - code: department code (e.g., "RESTAURANT")
 *   - serviceId: service inventory ID to remove from section
 * 
 * This soft-deletes the ServiceInventory record scoped to the section,
 * keeping the global service definition intact if it exists elsewhere.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ code: string; serviceId: string }> }
) {
  try {
    const ctx = await extractUserContext(request)
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'User not authenticated'),
        { status: 401 }
      )
    }

    const { code: departmentCode, serviceId } = await params

    // Load user with roles
    const userWithRoles = await loadUserWithRoles(ctx.userId)
    if (!userWithRoles) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'User not found'),
        { status: 401 }
      )
    }

    // Check permission
    const permCtx: PermissionContext = {
      userId: ctx.userId!,
      userType: (userWithRoles.userType as any) || 'employee'
    }

    const canDelete = userWithRoles.isAdmin || (await checkPermission(permCtx, 'services.delete', 'services'))
    if (!canDelete) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions to remove services'),
        { status: 403 }
      )
    }

    // Get the service
    const service = await prisma.serviceInventory.findUnique({
      where: { id: serviceId },
      include: { section: true, department: true }
    })

    if (!service) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Service not found'),
        { status: 404 }
      )
    }

    // Soft delete the service (set isActive to false)
    // This removes it from listings without hard deletion
    const updated = await prisma.serviceInventory.update({
      where: { id: serviceId },
      data: { isActive: false }
    })

    return NextResponse.json(
      successResponse({ data: updated, message: 'Service removed from section' }),
      { status: 200 }
    )
  } catch (error) {
    console.error('DELETE /api/departments/[code]/section/services/[serviceId] error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to remove service from section'),
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/auth/prisma'
import { extractUserContext, loadUserWithRoles } from '@/lib/user-context'
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response'
import { checkPermission, type PermissionContext } from '@/lib/auth/rbac'

/**
 * DELETE /api/departments/[code]/section/inventory/[itemId]
 * Remove inventory from a specific section (does not delete the item globally)
 * 
 * Params:
 *   - code: department code (e.g., "RESTAURANT")
 *   - itemId: inventory item ID to remove from section
 * 
 * This deletes the DepartmentInventory record scoped to the section,
 * keeping the global InventoryItem and other department variants intact.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ code: string; itemId: string }> }
) {
  try {
    const ctx = await extractUserContext(request)
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'User not authenticated'),
        { status: 401 }
      )
    }

    const { code: departmentCode, itemId } = await params

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

    const canDelete = userWithRoles.isAdmin || (await checkPermission(permCtx, 'inventory.delete', 'inventory'))
    if (!canDelete) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions to remove inventory'),
        { status: 403 }
      )
    }

    // Get the department to find parent if this is a section request
    const dept = await prisma.department.findFirst({
      where: { code: departmentCode.toLowerCase() }
    })

    if (!dept) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Department not found'),
        { status: 404 }
      )
    }

    // Get section ID from code if provided as section code (e.g., "RESTAURANT:bar")
    let sectionId = null
    if (departmentCode.includes(':')) {
      const parts = departmentCode.split(':')
      const sectionSlugOrId = parts.slice(1).join(':')
      
      const section = await prisma.departmentSection.findFirst({
        where: {
          departmentId: dept.id,
          OR: [
            { slug: sectionSlugOrId },
            { id: sectionSlugOrId }
          ]
        }
      })

      if (section) {
        sectionId = section.id
      }
    }

    // Find the DepartmentInventory record to delete
    const deptInv = await prisma.departmentInventory.findFirst({
      where: {
        departmentId: dept.id,
        sectionId: sectionId,
        inventoryItemId: itemId
      }
    })

    if (!deptInv) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Inventory item not found in this section'),
        { status: 404 }
      )
    }

    // Delete the section-specific inventory record
    await prisma.departmentInventory.delete({
      where: { id: deptInv.id }
    })

    return NextResponse.json(
      successResponse({ data: { id: deptInv.id, itemId }, message: 'Inventory removed from section' }),
      { status: 200 }
    )
  } catch (error) {
    console.error('DELETE /api/departments/[code]/section/inventory/[itemId] error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to remove inventory from section'),
      { status: 500 }
    )
  }
}

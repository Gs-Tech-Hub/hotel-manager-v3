import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/auth/prisma'
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ code: string; id: string; itemId: string }> }) {
  try {
    const { code, id, itemId } = await params

    // Handle both department and section codes
    let dept: any = await prisma.department.findUnique({ where: { code } })
    
    // If not found and code contains ':', it might be a section code
    if (!dept && code.includes(':')) {
      const parts = code.split(':')
      const parentCode = parts[0]
      const sectionSlugOrId = parts.slice(1).join(':')
      
      const parentDept = await prisma.department.findUnique({ where: { code: parentCode } })
      if (parentDept) {
        const section = await prisma.departmentSection.findFirst({
          where: {
            departmentId: parentDept.id,
            isActive: true,
            OR: [
              { slug: sectionSlugOrId },
              { id: sectionSlugOrId }
            ]
          }
        })
        
        if (section) {
          dept = {
            id: section.id,
            code: code,
            isSection: true,
            parentDeptId: parentDept.id,
          }
        }
      }
    }
    
    if (!dept) return NextResponse.json(errorResponse(ErrorCodes.NOT_FOUND, 'Department/section not found'), { status: getStatusCode(ErrorCodes.NOT_FOUND) })

    // Find the transfer
    const transfer = await prisma.departmentTransfer.findUnique({
      where: { id },
      include: { toDepartment: true, items: true }
    })

    if (!transfer) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Transfer not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      )
    }

    // Permission check: only transfer destination department/section can remove items
    // For sections, check against parent department ID
    const removerDeptId = (dept as any).isSection ? (dept as any).parentDeptId : dept.id
    if (transfer.toDepartmentId !== removerDeptId) {
      // Also check if this is a transfer TO a section with matching code in notes
      if ((dept as any).isSection && transfer.notes) {
        try {
          const parsed = JSON.parse(transfer.notes)
          if (parsed.toDepartmentCode !== code) {
            return NextResponse.json(errorResponse(ErrorCodes.FORBIDDEN, 'Not allowed to remove from this transfer'), { status: getStatusCode(ErrorCodes.FORBIDDEN) })
          }
        } catch (e) {
          return NextResponse.json(errorResponse(ErrorCodes.FORBIDDEN, 'Not allowed to remove from this transfer'), { status: getStatusCode(ErrorCodes.FORBIDDEN) })
        }
      } else {
        return NextResponse.json(errorResponse(ErrorCodes.FORBIDDEN, 'Not allowed to remove from this transfer'), { status: getStatusCode(ErrorCodes.FORBIDDEN) })
      }
    }

    // Only allow removing items from pending transfers
    if (transfer.status !== 'pending') {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, `Cannot remove items from ${transfer.status} transfer`),
        { status: getStatusCode(ErrorCodes.BAD_REQUEST) }
      )
    }

    // Find and delete the item
    const itemToDelete = transfer.items.find(it => it.id === itemId)
    if (!itemToDelete) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Item not found in transfer'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      )
    }

    // Delete the transfer item
    await prisma.departmentTransferItem.delete({
      where: { id: itemId }
    })

    // Check if transfer has any items left
    const remainingItems = await prisma.departmentTransferItem.count({
      where: { transferId: id }
    })

    // If no items remain, delete the transfer
    if (remainingItems === 0) {
      await prisma.departmentTransfer.delete({
        where: { id }
      })
    }

    return NextResponse.json(
      successResponse({
        data: {
          message: 'Item removed from transfer',
          transferDeleted: remainingItems === 0,
        },
      }),
      { status: 200 }
    )
  } catch (error) {
    console.error('Remove transfer item error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to remove item'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    )
  }
}

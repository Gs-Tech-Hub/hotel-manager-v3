import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/auth/prisma'
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response'

export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string; id: string }> }) {
  try {
    const { code, id } = await params

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
      include: { fromDepartment: true, toDepartment: true }
    })

    if (!transfer) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Transfer not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      )
    }

    // Permission check: only transfer destination department/section can cancel
    // For sections, check against parent department ID
    const cancellerDeptId = (dept as any).isSection ? (dept as any).parentDeptId : dept.id
    if (transfer.toDepartmentId !== cancellerDeptId) {
      // Also check if this is a transfer TO a section with matching code in notes
      if ((dept as any).isSection && transfer.notes) {
        try {
          const parsed = JSON.parse(transfer.notes)
          if (parsed.toDepartmentCode !== code) {
            return NextResponse.json(errorResponse(ErrorCodes.FORBIDDEN, 'Not allowed to cancel this transfer'), { status: getStatusCode(ErrorCodes.FORBIDDEN) })
          }
        } catch (e) {
          return NextResponse.json(errorResponse(ErrorCodes.FORBIDDEN, 'Not allowed to cancel this transfer'), { status: getStatusCode(ErrorCodes.FORBIDDEN) })
        }
      } else {
        return NextResponse.json(errorResponse(ErrorCodes.FORBIDDEN, 'Not allowed to cancel this transfer'), { status: getStatusCode(ErrorCodes.FORBIDDEN) })
      }
    }

    // Only allow canceling pending transfers
    if (transfer.status !== 'pending') {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, `Cannot cancel ${transfer.status} transfer`),
        { status: getStatusCode(ErrorCodes.BAD_REQUEST) }
      )
    }

    // Update transfer status to canceled
    const updated = await prisma.departmentTransfer.update({
      where: { id },
      data: {
        status: 'canceled',
        updatedAt: new Date(),
      },
    })

    return NextResponse.json(
      successResponse({
        data: {
          transfer: updated,
          message: 'Transfer canceled successfully',
        },
      }),
      { status: 200 }
    )
  } catch (error) {
    console.error('Cancel transfer error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to cancel transfer'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    )
  }
}

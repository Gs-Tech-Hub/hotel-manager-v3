import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/auth/prisma'
import { transferService } from '@/services/inventory/transfer.service'
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

    const transfer = await (prisma as any).departmentTransfer.findUnique({ where: { id }, include: { fromDepartment: true, toDepartment: true } })
    if (!transfer) return NextResponse.json(errorResponse(ErrorCodes.NOT_FOUND, 'Transfer not found'), { status: getStatusCode(ErrorCodes.NOT_FOUND) })

    // Permission check: only transfer destination department/section can approve
    // For sections, check against parent department ID
    const approverDeptId = (dept as any).isSection ? (dept as any).parentDeptId : dept.id
    if (transfer.toDepartmentId !== approverDeptId) {
      // Also check if this is a transfer TO a section with matching code in notes
      if ((dept as any).isSection && transfer.notes) {
        try {
          const parsed = JSON.parse(transfer.notes)
          if (parsed.toDepartmentCode !== code) {
            return NextResponse.json(errorResponse(ErrorCodes.FORBIDDEN, 'Not allowed to approve this transfer'), { status: getStatusCode(ErrorCodes.FORBIDDEN) })
          }
        } catch (e) {
          return NextResponse.json(errorResponse(ErrorCodes.FORBIDDEN, 'Not allowed to approve this transfer'), { status: getStatusCode(ErrorCodes.FORBIDDEN) })
        }
      } else {
        return NextResponse.json(errorResponse(ErrorCodes.FORBIDDEN, 'Not allowed to approve this transfer'), { status: getStatusCode(ErrorCodes.FORBIDDEN) })
      }
    }

    const result = await transferService.approveTransfer(id)
    if (!result.success) {
      // Map common validation-like failures to a validation error so callers
      // receive a 4xx instead of 5xx and can display friendly messages.
      const msg = result.message || 'Receive failed'
      const isValidation = msg.includes('No inventory record') || msg.includes('Insufficient') || msg.includes('not found')
      const code = isValidation ? ErrorCodes.VALIDATION_ERROR : ErrorCodes.INTERNAL_ERROR
      return NextResponse.json(errorResponse(code, msg), { status: getStatusCode(code) })
    }

    return NextResponse.json(successResponse({ message: 'Transfer received and executed' }))
  } catch (err: any) {
    console.error('approve transfer error', err)
    return NextResponse.json(errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to approve transfer'), { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) })
  }
}

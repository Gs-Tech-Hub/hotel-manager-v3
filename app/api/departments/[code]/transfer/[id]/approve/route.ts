import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { transferService } from '@/src/services/transfer.service'
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response'

export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string; id: string }> }) {
  try {
    const { code, id } = await params

    const dept = await prisma.department.findUnique({ where: { code } })
    if (!dept) return NextResponse.json(errorResponse(ErrorCodes.NOT_FOUND, 'Department not found'), { status: getStatusCode(ErrorCodes.NOT_FOUND) })

    const transfer = await (prisma as any).departmentTransfer.findUnique({ where: { id }, include: { fromDepartment: true, toDepartment: true } })
    if (!transfer) return NextResponse.json(errorResponse(ErrorCodes.NOT_FOUND, 'Transfer not found'), { status: getStatusCode(ErrorCodes.NOT_FOUND) })

    // Simple permission check: only transfer destination department can approve
    if (transfer.toDepartmentId !== dept.id) {
      return NextResponse.json(errorResponse(ErrorCodes.FORBIDDEN, 'Not allowed to approve this transfer'), { status: getStatusCode(ErrorCodes.FORBIDDEN) })
    }

    const result = await transferService.approveTransfer(id)
    if (!result.success) return NextResponse.json(errorResponse(ErrorCodes.INTERNAL_ERROR, result.message || 'Approval failed'), { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) })

    return NextResponse.json(successResponse({ message: 'Transfer approved and executed' }))
  } catch (err: any) {
    console.error('approve transfer error', err)
    return NextResponse.json(errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to approve transfer'), { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) })
  }
}

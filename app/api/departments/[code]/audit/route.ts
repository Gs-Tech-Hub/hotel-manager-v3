import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response'

// GET /api/departments/[code]/audit
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params
    const dept = await prisma.department.findUnique({ where: { code } })
    if (!dept) return NextResponse.json(errorResponse(ErrorCodes.NOT_FOUND, 'Department not found'), { status: getStatusCode(ErrorCodes.NOT_FOUND) })

    // Fetch transfers where this department is either sender or receiver
    const transfers = await prisma.departmentTransfer.findMany({ where: { OR: [{ fromDepartmentId: dept.id }, { toDepartmentId: dept.id }] }, include: { items: true }, orderBy: { createdAt: 'desc' }, take: 200 })

    // Fetch inventory movements that reference these transfer IDs
    const transferIds = transfers.map(t => t.id)
    const movements = transferIds.length > 0 ? await prisma.inventoryMovement.findMany({ where: { reference: { in: transferIds } }, orderBy: { createdAt: 'desc' }, take: 500 }) : []

    return NextResponse.json(successResponse({ transfers, movements }))
  } catch (err: any) {
    console.error('GET /api/departments/[code]/audit error', err)
    return NextResponse.json(errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch audit data'), { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) })
  }
}

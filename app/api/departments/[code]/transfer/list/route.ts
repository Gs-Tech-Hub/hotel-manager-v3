import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response'

// GET /api/departments/[code]/transfer/list?page=1&pageSize=20&direction=sent|received
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params
    const url = new URL(request.url)
    const page = Math.max(1, Number(url.searchParams.get('page') || '1'))
    const pageSize = Math.min(100, Math.max(5, Number(url.searchParams.get('pageSize') || '20')))
    const direction = url.searchParams.get('direction') || 'all'

    const dept = await prisma.department.findUnique({ where: { code } })
    if (!dept) return NextResponse.json(errorResponse(ErrorCodes.NOT_FOUND, 'Department not found'), { status: getStatusCode(ErrorCodes.NOT_FOUND) })

    const skip = (page - 1) * pageSize
    let where: any = {}
    if (direction === 'sent') where.fromDepartmentId = dept.id
    else if (direction === 'received') where.toDepartmentId = dept.id
    else where = { OR: [{ fromDepartmentId: dept.id }, { toDepartmentId: dept.id }] }

    const [items, total] = await Promise.all([
      prisma.departmentTransfer.findMany({ where, include: { items: true }, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
      prisma.departmentTransfer.count({ where }),
    ])

    return NextResponse.json(successResponse({ items, total, page, pageSize }))
  } catch (err: any) {
    console.error('GET /api/departments/[code]/transfer/list error', err)
    return NextResponse.json(errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch transfers'), { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) })
  }
}

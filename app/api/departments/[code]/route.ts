import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { extractUserContext, loadUserWithRoles } from '@/lib/user-context'
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response'

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params

    // allow public reads but include role/context if provided
    const ctx = extractUserContext(request)
    let userWithRoles = null as any | null
    if (ctx?.userId) userWithRoles = await loadUserWithRoles(ctx.userId)

    const dept = await (prisma as any).department.findUnique({
      where: { code },
      include: { orderDepartments: { select: { id: true, status: true } } },
    })

    if (!dept) {
      return NextResponse.json(errorResponse(ErrorCodes.NOT_FOUND, 'Department not found'), { status: getStatusCode(ErrorCodes.NOT_FOUND) })
    }

    const payload = {
      id: dept.id,
      code: dept.code,
      name: dept.name,
      description: dept.description,
      slug: dept.slug,
      type: dept.type,
      icon: dept.icon,
      image: dept.image,
      referenceType: dept.referenceType,
      referenceId: dept.referenceId,
      metadata: dept.metadata || {},
      isActive: dept.isActive,
      totalOrders: dept.orderDepartments.length,
      pendingOrders: dept.orderDepartments.filter((od: any) => od.status === 'pending').length,
      processingOrders: dept.orderDepartments.filter((od: any) => od.status === 'processing').length,
      fulfilledOrders: dept.orderDepartments.filter((od: any) => od.status === 'fulfilled').length,
    }

    return NextResponse.json(successResponse(payload))
  } catch (error) {
    console.error('GET /api/departments/[code] error:', error)
    return NextResponse.json(errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch department'), { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) })
  }
}

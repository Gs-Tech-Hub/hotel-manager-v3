import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { extractUserContext, loadUserWithRoles } from '@/lib/user-context'
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response'

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params
    // Normalize/decode the incoming code param. Some clients double-encode
    // path segments (e.g. % -> %25) which leads to mismatches against stored
    // department codes (which contain ':' characters). Decode repeatedly
    // until stable (max 3 iterations) to be robust against double-encoding.
    let lookupCode = code
    try {
      for (let i = 0; i < 3; i++) {
        const decoded = decodeURIComponent(lookupCode)
        if (decoded === lookupCode) break
        lookupCode = decoded
      }
    } catch (e) {
      // ignore decode errors and fall back to raw code
      lookupCode = code
    }

    // allow public reads but include role/context if provided
    const ctx = await extractUserContext(request)
    let userWithRoles = null as any | null
    if (ctx?.userId) userWithRoles = await loadUserWithRoles(ctx.userId)

    const dept = await (prisma as any).department.findUnique({ where: { code: lookupCode } })

    if (!dept) {
      return NextResponse.json(errorResponse(ErrorCodes.NOT_FOUND, 'Department not found'), { status: getStatusCode(ErrorCodes.NOT_FOUND) })
    }

    // Use counts instead of including the full relation to keep the response
    // lightweight and avoid potential engine fetch issues.
    const totalOrders = await (prisma as any).orderDepartment.count({ where: { departmentId: dept.id } })
    const pendingOrders = await (prisma as any).orderDepartment.count({ where: { departmentId: dept.id, status: 'pending' } })
    const processingOrders = await (prisma as any).orderDepartment.count({ where: { departmentId: dept.id, status: 'processing' } })
    const fulfilledOrders = await (prisma as any).orderDepartment.count({ where: { departmentId: dept.id, status: 'fulfilled' } })

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
      totalOrders,
      pendingOrders,
      processingOrders,
      fulfilledOrders,
    }

    return NextResponse.json(successResponse(payload))
  } catch (error) {
    console.error('GET /api/departments/[code] error:', error)
    return NextResponse.json(errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch department'), { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) })
  }
}

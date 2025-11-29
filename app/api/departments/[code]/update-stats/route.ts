import { NextRequest, NextResponse } from 'next/server'
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context'
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { updateDepartmentStats } from '@/scripts/update-department-stats'

export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params

    const ctx = await extractUserContext(request)
    if (!ctx?.userId) {
      return NextResponse.json(errorResponse(ErrorCodes.UNAUTHORIZED, 'Not authenticated'), { status: getStatusCode(ErrorCodes.UNAUTHORIZED) })
    }

    const user = await loadUserWithRoles(ctx.userId)
    if (!user || !hasAnyRole(user, ['admin', 'manager'])) {
      return NextResponse.json(errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'), { status: getStatusCode(ErrorCodes.FORBIDDEN) })
    }

    // Ensure department exists
    const dept = await prisma.department.findUnique({ where: { code } })
    if (!dept) return NextResponse.json(errorResponse(ErrorCodes.NOT_FOUND, 'Department not found'), { status: getStatusCode(ErrorCodes.NOT_FOUND) })

    // Optionally allow ?noProducts=true to skip product-level grouping (faster)
    const url = new URL(request.url)
    const noProducts = url.searchParams.get('noProducts') === 'true'

    await updateDepartmentStats(!noProducts, code)

    return NextResponse.json(successResponse({ department: code, updated: true }))
  } catch (err: any) {
    console.error('POST /api/departments/[code]/update-stats error:', err)
    return NextResponse.json(errorResponse(ErrorCodes.INTERNAL_ERROR, err?.message || 'Failed to update department stats'), { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) })
  }
}

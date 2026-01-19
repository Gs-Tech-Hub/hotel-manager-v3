import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/auth/prisma'
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

    let dept = await (prisma as any).department.findUnique({ where: { code: lookupCode } })

    // If there's no department row for the requested code, it may be a
    // logical "section" stored in the `departmentSection` table. Try to
    // resolve a section by parsing the code as `parent:slug` and loading the
    // corresponding `departmentSection`. If found, synthesize a lightweight
    // department-like payload so UI clients can treat sections similarly.
    let sectionRow: any = null
    if (!dept) {
      try {
        const parts = (lookupCode || '').toString().split(':')
        if (parts.length >= 2) {
          const parentCode = parts[0]
          const slugOrId = parts.slice(1).join(':')
          const parent = await (prisma as any).department.findUnique({ where: { code: parentCode } })
          if (parent) {
            // Try to find a matching section by slug or id under the parent
            sectionRow = await (prisma as any).departmentSection.findFirst({
              where: {
                departmentId: parent.id,
                isActive: true,
                OR: [
                  { slug: slugOrId },
                  { id: slugOrId }
                ]
              }
            })

            if (sectionRow) {
              // Build a synthetic dept-like object for the section
              dept = {
                id: sectionRow.id,
                code: `${parent.code}:${sectionRow.slug || sectionRow.id}`,
                name: sectionRow.name,
                description: sectionRow.metadata?.description || sectionRow.metadata?.note || null,
                slug: sectionRow.slug || null,
                type: parent.type,
                icon: parent.icon,
                image: parent.image || null,
                referenceType: parent.referenceType,
                referenceId: parent.referenceId,
                metadata: sectionRow.metadata || {},
                isActive: sectionRow.isActive,
                // mark as section so callers can distinguish if needed
                _isSection: true,
              }
            }
          }
        }
      } catch (err) {
        // ignore and fall through to Not Found below
      }
    }

    if (!dept) {
      return NextResponse.json(errorResponse(ErrorCodes.NOT_FOUND, 'Department not found'), { status: getStatusCode(ErrorCodes.NOT_FOUND) })
    }

    // Use counts instead of including the full relation to keep the response
    // lightweight and avoid potential engine fetch issues.

    // For sections we compute stats based on order lines referencing the
    // section code (departmentCode stored on order lines). For parent
    // departments we keep the existing behavior based on OrderDepartment.
    let totalOrders = 0
    let pendingOrders = 0
    let processingOrders = 0
    let fulfilledOrders = 0

    try {
      const codeStr = (dept.code || '').toString()
      if (codeStr.includes(':')) {
        const headerRows = await (prisma as any).orderLine.findMany({
          where: { departmentCode: dept.code },
          distinct: ['orderHeaderId'],
          select: { orderHeaderId: true },
        })
        const headerIds = (headerRows || []).map((h: any) => h.orderHeaderId).filter(Boolean)
        if (headerIds.length) {
          const hdrCounts = await (prisma as any).orderHeader.groupBy({ by: ['status'], where: { id: { in: headerIds } }, _count: { _all: true } })
          for (const r of hdrCounts) {
            const cnt = (r as any)._count?._all || 0
            totalOrders += cnt
            if (r.status === 'pending') pendingOrders += cnt
            if (r.status === 'processing') processingOrders += cnt
            if (r.status === 'fulfilled') fulfilledOrders += cnt
          }
        }
      } else {
        totalOrders = await (prisma as any).orderDepartment.count({ where: { departmentId: dept.id } })
        pendingOrders = await (prisma as any).orderDepartment.count({ where: { departmentId: dept.id, status: 'pending' } })
        processingOrders = await (prisma as any).orderDepartment.count({ where: { departmentId: dept.id, status: 'processing' } })
        fulfilledOrders = await (prisma as any).orderDepartment.count({ where: { departmentId: dept.id, status: 'fulfilled' } })
      }
    } catch (e) {
      // ignore and keep zeros
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
      totalOrders,
      pendingOrders,
      processingOrders,
      fulfilledOrders,
    }

    return NextResponse.json(successResponse({ data: payload }))
  } catch (error) {
    console.error('GET /api/departments/[code] error:', error)
    return NextResponse.json(errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch department'), { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) })
  }
}

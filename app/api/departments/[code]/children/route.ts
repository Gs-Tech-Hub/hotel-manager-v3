import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response'

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    console.time('GET /api/departments/[code]/children')
    const { code } = await params
    let lookupCode = code
    try {
      for (let i = 0; i < 3; i++) {
        const decoded = decodeURIComponent(lookupCode)
        if (decoded === lookupCode) break
        lookupCode = decoded
      }
    } catch (e) {
      lookupCode = code
    }

    const parent = await (prisma as any).department.findUnique({ where: { code: lookupCode } })
    if (!parent) {
      return NextResponse.json(errorResponse(ErrorCodes.NOT_FOUND, 'Department not found'), { status: getStatusCode(ErrorCodes.NOT_FOUND) })
    }

    // Child departments (sections stored as departments with code prefix)
    const children = await (prisma as any).department.findMany({
      where: {
        isActive: true,
        OR: [
          { code: { startsWith: `${parent.code}:` } },
          { referenceType: parent.code },
          { referenceId: parent.id },
        ],
      },
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        slug: true,
        type: true,
        icon: true,
        metadata: true,
      },
    })

    // Department sections (separate admin table)
    const sections = await (prisma as any).departmentSection.findMany({
      where: { departmentId: parent.id, isActive: true },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, slug: true, metadata: true, isActive: true },
    })

    const resp = NextResponse.json(successResponse({ departments: children, sections }), { status: 200 })
    console.timeEnd('GET /api/departments/[code]/children')
    return resp
  } catch (error) {
    console.error('GET /api/departments/[code]/children error:', error)
    return NextResponse.json(errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch children'), { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/auth/prisma'
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

    console.log(`[children] Parent department: ${parent.code} (id: ${parent.id})`)

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

    console.log(`[children] Found ${children.length} child departments`)

    // Department sections (separate admin table)
    // Note: Fetch ALL sections first to debug, then filter
    const allSections = await (prisma as any).departmentSection.findMany({
      where: { departmentId: parent.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, slug: true, metadata: true, isActive: true },
    })

    console.log(`[children] Found ${allSections.length} total sections (active+inactive) for department ${parent.id}`)
    
    // Filter to only active sections for the response
    const sections = allSections.filter((s: any) => s.isActive !== false)
    console.log(`[children] Returning ${sections.length} active sections`)

    const resp = NextResponse.json(successResponse({ data: { departments: children, sections } }), { status: 200 })
    console.timeEnd('GET /api/departments/[code]/children')
    return resp
  } catch (error) {
    console.error('GET /api/departments/[code]/children error:', error)
    return NextResponse.json(errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch children'), { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) })
  }
}

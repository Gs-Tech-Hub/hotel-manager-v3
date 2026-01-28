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

    // Department sections - use the SAME mechanism as pos/terminals
    // Query with isActive: true and include department, then filter by parent
    const allSectionsWithDepts = await (prisma as any).departmentSection.findMany({
      where: {
        isActive: true
      },
      include: {
        department: {
          select: {
            id: true,
            code: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    console.log(`[children] Found ${allSectionsWithDepts.length} ACTIVE sections total in database`)
    
    // Also check if there are ANY sections at all (inactive included)
    const allSectionsEverywhere = await (prisma as any).departmentSection.findMany({
      select: { id: true, name: true, departmentId: true, isActive: true }
    })
    console.log(`[children] Total sections in database (active + inactive): ${allSectionsEverywhere.length}`)
    
    if (allSectionsEverywhere.length > 0) {
      console.log(`[children] First section: id=${allSectionsEverywhere[0].id}, name=${allSectionsEverywhere[0].name}, deptId=${allSectionsEverywhere[0].departmentId}, isActive=${allSectionsEverywhere[0].isActive}`)
    }

    // Filter to only sections belonging to this parent department
    const sections = allSectionsWithDepts
      .filter((s: any) => s.department.id === parent.id)
      .map((s: any) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        metadata: s.metadata,
        isActive: s.isActive
      }))

    console.log(`[children] Sections matching parent ${parent.id}: ${sections.length}`)

    const resp = NextResponse.json(successResponse({ data: { departments: children, sections } }), { status: 200 })
    console.timeEnd('GET /api/departments/[code]/children')
    return resp
  } catch (error) {
    console.error('GET /api/departments/[code]/children error:', error)
    return NextResponse.json(errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch children'), { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) })
  }
}

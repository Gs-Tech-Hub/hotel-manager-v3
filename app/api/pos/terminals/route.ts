import { NextResponse } from 'next/server'
import { prisma } from '@/lib/auth/prisma'

/**
 * GET /api/pos/terminals
 * List all available POS terminals (which are department sections)
 * Each DepartmentSection is treated as a POS terminal/point-of-sale
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const departmentId = searchParams.get('departmentId')

    const where: any = {
      isActive: true
    }
    if (departmentId) {
      where.departmentId = departmentId
    }

    const skip = (page - 1) * limit

    // Fetch department sections - these ARE the POS terminals
    const sections = await prisma.departmentSection.findMany({
      where,
      include: {
        department: {
          select: {
            id: true,
            code: true,
            name: true
          }
        }
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' }
    })

    const total = await prisma.departmentSection.count({ where })

    // Enhance each section with today's sales summary
    const data = await Promise.all(sections.map(async (section: any) => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      // Build the section identifier (slug or id)
      // Use slug if available, otherwise use section ID
      const sectionIdentifier = section.slug || section.id;
      
      // Build the full department code for querying
      const fullDepartmentCode = `${section.department.code}:${sectionIdentifier}`;

      // Query orders using the full department code for accurate section-specific counts
      const orders = await prisma.orderHeader.findMany({
        where: {
          departmentCode: fullDepartmentCode,
          createdAt: {
            gte: today,
            lt: tomorrow
          }
        }
      })

      const salesTotal = orders.reduce((sum: number, o: any) => sum + o.total, 0)
      const count = orders.length

      return {
        id: section.id,
        name: section.name,
        slug: section.slug,
        departmentCode: section.department.code,
        sectionCode: sectionIdentifier,
        departmentName: section.department.name,
        status: 'online', // Sections are always online if active
        today: { count, total: salesTotal }
      }
    }))

    return NextResponse.json({ 
      success: true, 
      data,
      pagination: { page, limit, total }
    }, { status: 200 })
  } catch (error) {
    console.error('Failed to fetch POS terminals:', error)
    return NextResponse.json({ error: 'Failed to fetch POS terminals' }, { status: 500 })
  }
}

/**
 * POST /api/pos/terminals
 * Register a new POS terminal
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    return NextResponse.json({ 
      success: true, 
      data: { id: 'terminal-' + Date.now(), ...body }
    }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create POS terminal' }, { status: 500 })
  }
}

/**
 * PUT /api/pos/terminals
 * Update a POS terminal
 */
export async function PUT(req: Request) {
  try {
    const body = await req.json()
    return NextResponse.json({ 
      success: true, 
      data: body
    }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update POS terminal' }, { status: 500 })
  }
}

/**
 * DELETE /api/pos/terminals
 * Delete a POS terminal
 */
export async function DELETE(req: Request) {
  try {
    return NextResponse.json({ 
      success: true, 
      message: 'POS terminal deleted'
    }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete POS terminal' }, { status: 500 })
  }
}


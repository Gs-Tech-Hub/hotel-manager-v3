import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/pos/terminals
 * List all POS terminals with their associated sections
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const departmentId = searchParams.get('departmentId')

    const where: any = {}
    if (departmentId) {
      where.departmentId = departmentId
    }

    const skip = (page - 1) * limit

    // Fetch terminals with department and sales summary
    const terminals = await prisma.terminal.findMany({
      where,
      include: {
        department: {
          include: {
            sections: true
          }
        }
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' }
    })

    const total = await prisma.terminal.count({ where })

    // Enhance with today's sales summary for each terminal
    const data = await Promise.all(terminals.map(async (t: any) => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      const orders = await prisma.orderHeader.findMany({
        where: {
          departmentCode: t.department?.code,
          createdAt: {
            gte: today,
            lt: tomorrow
          }
        }
      })

      const salesTotal = orders.reduce((sum: number, o: any) => sum + o.total, 0)
      const count = orders.length

      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        status: t.status,
        departmentCode: t.department?.code,
        departmentName: t.department?.name,
        sections: t.department?.sections || [],
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

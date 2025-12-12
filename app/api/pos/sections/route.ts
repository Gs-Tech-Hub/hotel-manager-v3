import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/pos/sections
 * List all available POS sections (department sections that can initiate sales)
 * Query parameters:
 * - departmentId: filter by specific department (optional)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const departmentId = searchParams.get('departmentId')

    const where: any = {
      isActive: true
    }

    if (departmentId) {
      where.departmentId = departmentId
    }

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
      orderBy: { createdAt: 'desc' }
    })

    // Enhance with today's sales summary for each section
    const data = await Promise.all(sections.map(async (section: any) => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      const orders = await prisma.orderHeader.findMany({
        where: {
          departmentCode: section.department.code,
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
        departmentId: section.departmentId,
        departmentCode: section.department.code,
        departmentName: section.department.name,
        isActive: section.isActive,
        today: { count, total: salesTotal }
      }
    }))

    return NextResponse.json({ 
      success: true, 
      data
    }, { status: 200 })
  } catch (error) {
    console.error('Failed to fetch POS sections:', error)
    return NextResponse.json({ error: 'Failed to fetch POS sections' }, { status: 500 })
  }
}

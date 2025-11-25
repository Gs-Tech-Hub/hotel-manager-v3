import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/**
 * GET /api/admin/pos/terminals
 * Returns available department-section combinations for POS sales.
 * Each "terminal" in the response is really a department-section pair that can process sales.
 * Example response:
 * {
 *   success: true,
 *   data: [
 *     { id: "restaurant:main", name: "Restaurant — Main", departmentCode: "restaurant", defaultSectionId: "restaurant-main", today: { count: 0, total: 0 } },
 *     { id: "bar:main", name: "Bar — Main", departmentCode: "bar-and-clubs", defaultSectionId: "bar-main", today: { count: 0, total: 0 } }
 *   ]
 * }
 */
export async function GET() {
  try {
    // Query all section departments (codes containing ':' or tagged with section metadata)
    const sections = await prisma.department.findMany({
      where: {
        isActive: true,
        OR: [
          { code: { contains: ':' } }, // per-entity sections like "restaurant:<id>:main"
          { metadata: { path: ['section'], equals: 'main' } }, // or tagged with section metadata
        ],
      },
    })

    const results: Array<any> = []

    for (const section of sections) {
      // Extract parent department code from section code.
      // Format: "restaurant:main" or "restaurant:<id>:main" => "restaurant"
      const parts = section.code.split(':')
      const departmentCode = parts[0]

      // Convert section code to defaultSectionId (replace ':' with '-')
      const defaultSectionId = section.code.replace(/:/g, '-')

      results.push({
        id: section.code, // Use the section code as the unique ID
        name: section.name,
        departmentCode,
        defaultSectionId,
        slug: slugify(section.name),
        status: 'online',
        today: { count: 0, total: 0 }, // Placeholder; can be populated with actual sales data
      })
    }

    return NextResponse.json({ success: true, data: results })
  } catch (err) {
    console.error('GET /api/admin/pos/terminals error', err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}

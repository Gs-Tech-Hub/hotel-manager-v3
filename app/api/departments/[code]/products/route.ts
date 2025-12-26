import { NextRequest, NextResponse } from 'next/server'
import { sectionService } from '@/src/services/section.service'
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response'

/**
 * GET /api/departments/[code]/products
 * Query params: ?type=drink|inventoryItem&page=1&pageSize=20&search=...&fromDate=2024-01-01&toDate=2024-12-31
 * Returns paginated list of products relevant to the department with available quantity.
 * Date filters apply to sold items reporting (amountSold, unitsSold).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params
    const url = new URL(request.url)
    const type = url.searchParams.get('type') || ''
    const page = Math.max(1, Number(url.searchParams.get('page') || '1'))
    const pageSize = Math.min(100, Math.max(5, Number(url.searchParams.get('pageSize') || '20')))
    const search = url.searchParams.get('search') || ''
    const includeDetails = url.searchParams.get('details') === 'true'
    const sectionFilter = url.searchParams.get('section') || null
    const fromDate = url.searchParams.get('fromDate') || null
    const toDate = url.searchParams.get('toDate') || null

    // Use sectionService for all logic
    const result = await sectionService.getProducts({
      departmentCode: code,
      type,
      page,
      pageSize,
      search,
      sectionFilter,
      includeDetails,
      fromDate,
      toDate,
    })
    return NextResponse.json(successResponse(result))
  } catch (err: any) {
    console.error('GET /api/departments/[code]/products error', err)
    return NextResponse.json(errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch products'), { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) })
  }
}

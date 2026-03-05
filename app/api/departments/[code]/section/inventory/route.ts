import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/auth/prisma'
import { sectionInventoryService } from '@/services/section-inventory.service'
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response'

/**
 * GET /api/departments/[code]/section/inventory
 * Get inventory for a specific section
 * 
 * Returns section-specific inventory with quantities
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code: sectionCode } = await params
    const { searchParams } = new URL(request.url)
    const op = searchParams.get('op')

    if (op === 'audit') {
      // Get audit trail
      const result = await sectionInventoryService.getSectionInventoryAudit(sectionCode, {
        itemId: searchParams.get('itemId') || undefined,
        movementType: searchParams.get('movementType') as any,
        limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
        offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0
      })

      if (!result.success) {
        return NextResponse.json(
          errorResponse(ErrorCodes.NOT_FOUND, result.message || 'Failed to fetch audit trail'),
          { status: getStatusCode(ErrorCodes.NOT_FOUND) }
        )
      }

      return NextResponse.json(successResponse({ data: result.data, message: 'Section inventory audit retrieved' }))
    }

    if (op === 'summary') {
      // Get stock summary
      const result = await sectionInventoryService.getSectionStockSummary(sectionCode)

      if (!result.success) {
        return NextResponse.json(
          errorResponse(ErrorCodes.NOT_FOUND, result.message || 'Failed to fetch stock summary'),
          { status: getStatusCode(ErrorCodes.NOT_FOUND) }
        )
      }

      return NextResponse.json(successResponse({ data: result.data, message: 'Section stock summary retrieved' }))
    }

    // Check for single product lookup: GET /api/departments/[code]/section/inventory?productId=X&sectionId=Y
    const productId = searchParams.get('productId')
    const sectionId = searchParams.get('sectionId')
    
    if (productId && sectionId) {
      // Single product quantity check for a section
      // Get the department from the code
      const dept = await prisma.department.findUnique({
        where: { code: sectionCode }
      })
      
      if (!dept) {
        return NextResponse.json(
          errorResponse(ErrorCodes.NOT_FOUND, 'Department not found'),
          { status: getStatusCode(ErrorCodes.NOT_FOUND) }
        )
      }
      
      const inv = await prisma.departmentInventory.findFirst({
        where: {
          departmentId: dept.id,
          sectionId: sectionId,
          inventoryItemId: productId
        }
      })
      
      const quantity = inv?.quantity || 0
      return NextResponse.json(
        successResponse({ 
          data: { 
            productId, 
            sectionId, 
            quantity,
            available: quantity
          }, 
          message: 'Product inventory retrieved' 
        })
      )
    }

    // Default: get full inventory
    const result = await sectionInventoryService.getSectionInventory(sectionCode)

    if (!result.success) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, result.message || 'Failed to fetch section inventory'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      )
    }

    return NextResponse.json(successResponse({ data: result.data, message: 'Section inventory retrieved' }))
  } catch (error) {
    console.error('GET /api/departments/[code]/section/inventory error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch section inventory'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    )
  }
}

/**
 * POST /api/departments/[code]/section/inventory?op=adjust
 * Adjust section inventory directly
 * 
 * Body: {
 *   "itemId": "string",
 *   "delta": number (positive or negative),
 *   "reason": "string",
 *   "reference": "string (optional)"
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code: sectionCode } = await params
    const { searchParams } = new URL(request.url)
    const op = searchParams.get('op')

    if (op !== 'adjust') {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, 'Only op=adjust is supported'),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      )
    }

    const body = await request.json().catch(() => null)
    if (!body || !body.itemId || body.delta === undefined || !body.reason) {
      return NextResponse.json(
        errorResponse(ErrorCodes.INVALID_INPUT, 'Missing required fields: itemId, delta, reason'),
        { status: getStatusCode(ErrorCodes.INVALID_INPUT) }
      )
    }

    const result = await sectionInventoryService.adjustSectionInventory(
      sectionCode,
      body.itemId,
      body.delta,
      body.reason,
      body.reference
    )

    if (!result.success) {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, result.message || 'Failed to adjust inventory'),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      )
    }

    return NextResponse.json(successResponse({ data: result.data, message: result.message ?? 'Section inventory adjusted' }))
  } catch (error) {
    console.error('POST /api/departments/[code]/section/inventory error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to adjust section inventory'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    )
  }
}

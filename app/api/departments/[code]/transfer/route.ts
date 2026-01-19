import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/auth/prisma'
import { transferService } from '@/services/inventory/transfer.service'
import { stockService } from '@/services/stock.service'
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response'

/**
 * POST /api/departments/[code]/transfer
 * Body: { toDepartmentCode: string, items: [{ type: 'drink', id: string, quantity: number }] }
 * 
 * Uses stockService for ALL inventory validation to ensure consistency between
 * what displays (products endpoint) and what can be transferred (transfer endpoint).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    console.time('POST /api/departments/[code]/transfer')
    const { code: fromCode } = await params
    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json(errorResponse(ErrorCodes.INVALID_INPUT, 'Invalid JSON body'), { status: getStatusCode(ErrorCodes.INVALID_INPUT) })
    }
    // Input limits to prevent excessively large requests
    const MAX_ITEMS = 50
    const MAX_PRODUCT_ID_LENGTH = 128
    const MAX_QUANTITY = 100000

    const { toDepartmentCode, items } = body as { toDepartmentCode?: string; items?: Array<any> }
    if (!toDepartmentCode || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(errorResponse(ErrorCodes.INVALID_INPUT, 'toDepartmentCode and items[] are required'), { status: getStatusCode(ErrorCodes.INVALID_INPUT) })
    }

    if (items.length > MAX_ITEMS) {
      return NextResponse.json(errorResponse(ErrorCodes.VALIDATION_ERROR, `Too many items in transfer (max ${MAX_ITEMS})`), { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) })
    }

    const fromDept = await prisma.department.findUnique({ where: { code: fromCode } })
    
    // Handle destination: could be a department or a section (section code includes ':')
    let toDept: any = null
    let toDepartmentId = toDepartmentCode
    let destinationCode = toDepartmentCode
    
    if (toDepartmentCode.includes(':')) {
      // Destination is a section - look it up in departmentSection table
      const parts = toDepartmentCode.split(':')
      const parentCode = parts[0]
      const sectionSlugOrId = parts.slice(1).join(':')
      
      const parentDept = await prisma.department.findUnique({ where: { code: parentCode } })
      if (!parentDept) {
        return NextResponse.json(errorResponse(ErrorCodes.NOT_FOUND, 'Parent department for destination section not found'), { status: getStatusCode(ErrorCodes.NOT_FOUND) })
      }
      
      const section = await prisma.departmentSection.findFirst({
        where: {
          departmentId: parentDept.id,
          isActive: true,
          OR: [
            { slug: sectionSlugOrId },
            { id: sectionSlugOrId }
          ]
        }
      })
      
      if (!section) {
        return NextResponse.json(errorResponse(ErrorCodes.NOT_FOUND, 'Destination section not found'), { status: getStatusCode(ErrorCodes.NOT_FOUND) })
      }
      
      // For transfer records, use the parent department ID (sections don't have IDs in departments table)
      // The actual destination code (with section) is stored in notes
      toDept = parentDept
      toDepartmentId = parentDept.id
      destinationCode = toDepartmentCode
    } else {
      // Destination is a department
      toDept = await prisma.department.findUnique({ where: { code: toDepartmentCode } })
    }
    
    if (!fromDept || !toDept) {
      return NextResponse.json(errorResponse(ErrorCodes.NOT_FOUND, 'Source or destination department not found'), { status: getStatusCode(ErrorCodes.NOT_FOUND) })
    }

    // Only support drink transfers for now; create a persistent transfer request
    const unsupported = items.find((it: any) => it.type !== 'drink' && it.type !== 'inventoryItem')
    if (unsupported) {
      return NextResponse.json(errorResponse(ErrorCodes.VALIDATION_ERROR, 'Only transfers of type "drink" or "inventoryItem" are supported by this endpoint'), { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) })
    }

    // Normalize and validate items
    const mappedItems = items.map((it: any) => {
      const productId = String(it.id ?? '')
      const productType = String(it.type ?? '')
      const quantity = Number(it.quantity ?? 0)
      return { productType, productId, quantity }
    })

    for (const mi of mappedItems) {
      if (!mi.productId || mi.productId.length > MAX_PRODUCT_ID_LENGTH) {
        return NextResponse.json(errorResponse(ErrorCodes.VALIDATION_ERROR, `Invalid product id`), { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) })
      }
      if (!Number.isFinite(mi.quantity) || mi.quantity <= 0 || mi.quantity > MAX_QUANTITY) {
        return NextResponse.json(errorResponse(ErrorCodes.VALIDATION_ERROR, `Invalid quantity for product ${mi.productId}`), { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) })
      }
    }

    // Use stockService for ALL availability validation - single source of truth
    // This ensures consistency between what displays and what can be transferred
    const availabilityChecks = await stockService.checkAvailabilityBatch(
      'drink', // productType - handle drinks first
      mappedItems.filter(m => m.productType === 'drink').map(m => ({ productId: m.productId, requiredQuantity: m.quantity })),
      fromDept.id
    )

    for (const check of availabilityChecks) {
      if (!check.hasStock) {
        return NextResponse.json(errorResponse(ErrorCodes.VALIDATION_ERROR, check.message || `Insufficient stock for product ${check.productId}`), { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) })
      }
    }

    // Check inventory items separately
    const invItems = mappedItems.filter(m => m.productType === 'inventoryItem')
    if (invItems.length) {
      const invChecks = await stockService.checkAvailabilityBatch('inventoryItem', invItems.map(m => ({ productId: m.productId, requiredQuantity: m.quantity })), fromDept.id)
      for (const check of invChecks) {
        if (!check.hasStock) {
          return NextResponse.json(errorResponse(ErrorCodes.VALIDATION_ERROR, check.message || `Insufficient inventory for product ${check.productId}`), { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) })
        }
      }
    }

    // create transfer record (pending)
    // Pass both source and destination codes (which may be section codes like "RESTAURANT:bar") 
    // so they can be properly resolved during approval
    const created = await transferService.createTransfer(fromDept.id, toDepartmentId, mappedItems, undefined, { from: fromCode, to: destinationCode })

    const resp = NextResponse.json(successResponse({ data: { transfer: created }, message: 'Transfer request created' }))
    console.timeEnd('POST /api/departments/[code]/transfer')
    return resp
  } catch (error: any) {
    console.error('POST /api/departments/[code]/transfer error:', error)
    const msg = typeof error === 'string' ? error : error?.message ?? 'Transfer failed'
    return NextResponse.json(errorResponse(ErrorCodes.INTERNAL_ERROR, msg), { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) })
  }
}

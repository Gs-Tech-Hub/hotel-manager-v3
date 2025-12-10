import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { transferService } from '@/services/inventory/transfer.service'
import { sectionService } from '@/src/services/section.service'
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response'

/**
 * POST /api/departments/[code]/transfer
 * Body: { toDepartmentCode: string, items: [{ type: 'drink', id: string, quantity: number }] }
 * NOTE: current implementation supports transfers for `drink` items (Bar <-> Restaurant).
 * For other inventory item types we'd need schema changes (per-department quantities) or a transfer table.
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
    // Validate inventoryItem transfers up-front: prefer per-department inventory but allow using global inventory if available
    for (const mi of mappedItems) {
      if (mi.productType === 'inventoryItem') {
        const rec = await prisma.departmentInventory.findFirst({ where: { departmentId: fromDept.id, sectionId: null, inventoryItemId: mi.productId } })
        if (rec) {
          if ((rec.quantity ?? 0) < (mi.quantity ?? 0)) {
            return NextResponse.json(errorResponse(ErrorCodes.VALIDATION_ERROR, `Insufficient inventory for department ${fromDept.id} and item ${mi.productId}`), { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) })
          }
        } else {
          // No per-department record: check global inventory as a fallback
          const inv = await prisma.inventoryItem.findUnique({ where: { id: mi.productId } })
          if (!inv) {
            return NextResponse.json(errorResponse(ErrorCodes.VALIDATION_ERROR, `No inventory record for department ${fromDept.id} and item ${mi.productId}`), { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) })
          }
          if ((inv.quantity ?? 0) < (mi.quantity ?? 0)) {
            return NextResponse.json(errorResponse(ErrorCodes.VALIDATION_ERROR, `Insufficient inventory for item ${mi.productId}`), { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) })
          }
        }
      }
    }

    // Validate drink availability via SectionService (preflight)
    const drinkItems = mappedItems.filter((m) => m.productType === 'drink')
    if (drinkItems.length) {
      const validation = await sectionService.validateDrinksAvailability(fromDept.code, drinkItems.map((d) => ({ productId: d.productId, quantity: d.quantity })))
      if (!validation.success) {
        return NextResponse.json(errorResponse(ErrorCodes.VALIDATION_ERROR, validation.message || 'Drink validation failed'), { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) })
      }
    }

    // create transfer record (pending)
    // Pass the destination code (which may be a section code like "RESTAURANT:bar") 
    // so it can be properly resolved during approval
    const created = await transferService.createTransfer(fromDept.id, toDepartmentId, mappedItems, undefined, destinationCode)

    const resp = NextResponse.json(successResponse({ message: 'Transfer request created', transfer: created }))
    console.timeEnd('POST /api/departments/[code]/transfer')
    return resp
  } catch (error: any) {
    console.error('POST /api/departments/[code]/transfer error:', error)
    const msg = typeof error === 'string' ? error : error?.message ?? 'Transfer failed'
    return NextResponse.json(errorResponse(ErrorCodes.INTERNAL_ERROR, msg), { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) })
  }
}

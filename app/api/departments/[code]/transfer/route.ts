import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { transferService } from '@/src/services/transfer.service'
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response'

/**
 * POST /api/departments/[code]/transfer
 * Body: { toDepartmentCode: string, items: [{ type: 'drink', id: string, quantity: number }] }
 * NOTE: current implementation supports transfers for `drink` items (Bar <-> Restaurant).
 * For other inventory item types we'd need schema changes (per-department quantities) or a transfer table.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code: fromCode } = await params
    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json(errorResponse(ErrorCodes.INVALID_INPUT, 'Invalid JSON body'), { status: getStatusCode(ErrorCodes.INVALID_INPUT) })
    }

    const { toDepartmentCode, items } = body as { toDepartmentCode?: string; items?: Array<any> }
    if (!toDepartmentCode || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(errorResponse(ErrorCodes.INVALID_INPUT, 'toDepartmentCode and items[] are required'), { status: getStatusCode(ErrorCodes.INVALID_INPUT) })
    }

    const fromDept = await prisma.department.findUnique({ where: { code: fromCode } })
    const toDept = await prisma.department.findUnique({ where: { code: toDepartmentCode } })
    if (!fromDept || !toDept) {
      return NextResponse.json(errorResponse(ErrorCodes.NOT_FOUND, 'Source or destination department not found'), { status: getStatusCode(ErrorCodes.NOT_FOUND) })
    }

    // Only support drink transfers for now; create a persistent transfer request
    const unsupported = items.find((it: any) => it.type !== 'drink' && it.type !== 'inventoryItem')
    if (unsupported) {
      return NextResponse.json(errorResponse(ErrorCodes.VALIDATION_ERROR, 'Only transfers of type "drink" or "inventoryItem" are supported by this endpoint'), { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) })
    }

    const mappedItems = items.map((it: any) => ({ productType: it.type, productId: it.id, quantity: Number(it.quantity || 0) }))
    // create transfer record (pending)
    const created = await transferService.createTransfer(fromDept.id, toDept.id, mappedItems)

    return NextResponse.json(successResponse({ message: 'Transfer request created', transfer: created }))
  } catch (error: any) {
    console.error('POST /api/departments/[code]/transfer error:', error)
    const msg = typeof error === 'string' ? error : error?.message ?? 'Transfer failed'
    return NextResponse.json(errorResponse(ErrorCodes.INTERNAL_ERROR, msg), { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) })
  }
}

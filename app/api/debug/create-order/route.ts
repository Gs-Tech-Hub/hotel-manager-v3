import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { OrderService } from '@/services/order.service'
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response'

// Temporary debug route — DO NOT COMMIT to production
export async function GET(_req: NextRequest) {
  try {
    // create a guest customer
    const guest = await prisma.customer.create({ data: { firstName: 'DBG', lastName: 'Guest', email: `dbg+${Date.now()}@local`, phone: '000' } })

    // build a sample payload with multiple items targeting the restaurant:main section
    const items = [] as any[]
    for (let i = 0; i < 3; i++) {
      items.push({ productId: `dbg-prod-${i}`, productType: 'inventory', productName: `Debug Item ${i}`, departmentCode: 'restaurant:main', quantity: 1, unitPrice: 500 })
    }

    const svc = new OrderService()
    const result = await svc.createOrder({ customerId: guest.id, items, notes: 'Debug create-order' })

    if ('error' in result) {
      return NextResponse.json(result, { status: getStatusCode(result.error.code) })
    }

    return NextResponse.json(successResponse(result, 'Debug order created'), { status: 201 })
  } catch (err) {
    try { const logger = await import('@/lib/logger'); logger.error(err, { route: 'debug.create-order' }) } catch {}
    return NextResponse.json(errorResponse(ErrorCodes.INTERNAL_ERROR, 'Debug route failed'), { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) })
  }
}

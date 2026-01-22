import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/auth/prisma'
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response'

// GET /api/departments/[code]/audit
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params
    const dept = await prisma.department.findUnique({ where: { code } })
    if (!dept) return NextResponse.json(errorResponse(ErrorCodes.NOT_FOUND, 'Department not found'), { status: getStatusCode(ErrorCodes.NOT_FOUND) })

    // Fetch transfers where this department is either sender or receiver
    const transfers = await prisma.departmentTransfer.findMany({ where: { OR: [{ fromDepartmentId: dept.id }, { toDepartmentId: dept.id }] }, include: { items: true }, orderBy: { createdAt: 'desc' }, take: 200 })

    // Fetch inventory movements that reference these transfer IDs
    const transferIds = transfers.map(t => t.id)
    const movements = transferIds.length > 0 ? await prisma.inventoryMovement.findMany({ where: { reference: { in: transferIds } }, orderBy: { createdAt: 'desc' }, take: 500 }) : []

    // Enrich transfers and movements with human-friendly names
    // Departments map
    const deptIds = Array.from(new Set(transfers.flatMap((t) => [t.fromDepartmentId, t.toDepartmentId].filter(Boolean))))
    const departments = deptIds.length > 0 ? await prisma.department.findMany({ where: { id: { in: deptIds } }, select: { id: true, name: true, code: true } }) : []
    const deptMap = new Map(departments.map((d) => [d.id, d]))

    // Collect product ids by type
    const inventoryIds = new Set<string>()
    const drinkIds = new Set<string>()
    const foodIds = new Set<string>()
    for (const t of transfers) {
      for (const it of t.items || []) {
        if (it.productType === 'inventoryItem') inventoryIds.add(it.productId)
        else if (it.productType === 'drink') drinkIds.add(it.productId)
        else if (it.productType === 'food') foodIds.add(it.productId)
      }
    }

    // Fetch current extras for this department (for display)
    const departmentExtras = await prisma.departmentExtra.findMany({
      where: { departmentId: dept.id },
      include: { extra: true, section: true },
    })
    console.log(`[audit] Found ${departmentExtras.length} extras for department ${dept.code}`)

    const [inventoryItems, drinks, foodItems] = await Promise.all([
      inventoryIds.size > 0 ? prisma.inventoryItem.findMany({ where: { id: { in: Array.from(inventoryIds) } }, select: { id: true, name: true } }) : [],
      drinkIds.size > 0 ? prisma.drink.findMany({ where: { id: { in: Array.from(drinkIds) } }, select: { id: true, name: true } }) : [],
      foodIds.size > 0 ? prisma.foodItem.findMany({ where: { id: { in: Array.from(foodIds) } }, select: { id: true, name: true } }) : [],
    ])

    const invMap = new Map(inventoryItems.map((i) => [i.id, i.name]))
    const drinkMap = new Map(drinks.map((d) => [d.id, d.name]))
    const foodMap = new Map(foodItems.map((f) => [f.id, f.name]))

    const enrichedTransfers = transfers.map((t) => ({
      ...t,
      fromDepartmentName: deptMap.get(t.fromDepartmentId)?.name || null,
      toDepartmentName: deptMap.get(t.toDepartmentId)?.name || null,
      items: (t.items || []).map((it) => ({
        ...it,
        productName: it.productType === 'inventoryItem' ? invMap.get(it.productId) || null : it.productType === 'drink' ? drinkMap.get(it.productId) || null : it.productType === 'food' ? foodMap.get(it.productId) || null : null,
      })),
    }))

    // Enrich movements with inventory item names
    const movementItemIds = Array.from(new Set(movements.map((m) => m.inventoryItemId).filter(Boolean)))
    const movementItems = movementItemIds.length > 0 ? await prisma.inventoryItem.findMany({ where: { id: { in: movementItemIds } }, select: { id: true, name: true } }) : []
    const movementMap = new Map(movementItems.map((mi) => [mi.id, mi.name]))
    const enrichedMovements = movements.map((m) => ({ ...m, inventoryItemName: movementMap.get(m.inventoryItemId) || null }))

    // Convert department extras to transfer-like display format
    const extraTransfers = departmentExtras.map((extra, idx) => ({
      id: `extra_${extra.id}`,
      status: 'allocated',
      fromDepartmentId: dept.id,
      toDepartmentId: dept.id,
      fromDepartmentName: dept.name,
      toDepartmentName: extra.section?.name || 'General Stock',
      createdAt: extra.createdAt,
      updatedAt: extra.updatedAt,
      items: [{
        productType: 'extra',
        productId: extra.extraId,
        productName: extra.extra.name,
        quantity: extra.quantity,
      }],
    }))
    console.log(`[audit] Converting ${extraTransfers.length} extras to transfer format`)

    return NextResponse.json(successResponse({ data: { transfers: [...enrichedTransfers, ...extraTransfers], movements: enrichedMovements } }))
  } catch (err: any) {
    console.error('GET /api/departments/[code]/audit error', err)
    return NextResponse.json(errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch audit data'), { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) })
  }
}

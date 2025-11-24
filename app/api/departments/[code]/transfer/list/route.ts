import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response'

// GET /api/departments/[code]/transfer/list?page=1&pageSize=20&direction=sent|received
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params
    const url = new URL(request.url)
    const page = Math.max(1, Number(url.searchParams.get('page') || '1'))
    const pageSize = Math.min(100, Math.max(5, Number(url.searchParams.get('pageSize') || '20')))
    const direction = url.searchParams.get('direction') || 'all'

    const dept = await prisma.department.findUnique({ where: { code } })
    if (!dept) return NextResponse.json(errorResponse(ErrorCodes.NOT_FOUND, 'Department not found'), { status: getStatusCode(ErrorCodes.NOT_FOUND) })

    const skip = (page - 1) * pageSize
    let where: any = {}
    if (direction === 'sent') where.fromDepartmentId = dept.id
    else if (direction === 'received') where.toDepartmentId = dept.id
    else where = { OR: [{ fromDepartmentId: dept.id }, { toDepartmentId: dept.id }] }

    let [items, total] = await Promise.all([
      prisma.departmentTransfer.findMany({ where, include: { items: true }, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
      prisma.departmentTransfer.count({ where }),
    ])

    // Enrich transfers with friendly department and product names
    const deptIds = Array.from(new Set(items.flatMap((t: any) => [t.fromDepartmentId, t.toDepartmentId].filter(Boolean))))
    const departments = await prisma.department.findMany({ where: { id: { in: deptIds } } })
    const deptMap = new Map(departments.map((d: any) => [d.id, d]))

    // Collect product ids by type
    const drinkIds: string[] = []
    const foodIds: string[] = []
    const inventoryIds: string[] = []
    for (const t of items) {
      for (const it of t.items) {
        if (it.productType === 'drink') drinkIds.push(it.productId)
        else if (it.productType === 'food') foodIds.push(it.productId)
        else inventoryIds.push(it.productId)
      }
    }

    const [drinks, foods, inventories] = await Promise.all([
      drinkIds.length ? prisma.drink.findMany({ where: { id: { in: drinkIds } } }) : Promise.resolve([]),
      foodIds.length ? prisma.foodItem.findMany({ where: { id: { in: foodIds } } }) : Promise.resolve([]),
      inventoryIds.length ? prisma.inventoryItem.findMany({ where: { id: { in: inventoryIds } } }) : Promise.resolve([]),
    ])

    const drinkMap = new Map(drinks.map((d: any) => [d.id, d]))
    const foodMap = new Map(foods.map((f: any) => [f.id, f]))
    const invMap = new Map(inventories.map((i: any) => [i.id, i]))

    const enriched = items.map((t: any) => {
      const fromDept = deptMap.get(t.fromDepartmentId)
      const toDept = deptMap.get(t.toDepartmentId)
      const itemsWithNames = t.items.map((it: any) => {
        let productName = it.productName || null
        if (!productName) {
          if (it.productType === 'drink') productName = drinkMap.get(it.productId)?.name || null
          else if (it.productType === 'food') productName = foodMap.get(it.productId)?.name || null
          else productName = invMap.get(it.productId)?.name || null
        }
        return { ...it, productName }
      })
      return { ...t, fromDepartmentName: fromDept?.name || null, toDepartmentName: toDept?.name || null, items: itemsWithNames }
    })

    return NextResponse.json(successResponse({ items: enriched, total, page, pageSize }))
  } catch (err: any) {
    console.error('GET /api/departments/[code]/transfer/list error', err)
    return NextResponse.json(errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch transfers'), { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) })
  }
}

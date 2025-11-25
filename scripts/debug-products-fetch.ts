import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Try to find a department code to test:
  // Prefer code from last completed transfer's destination
  const lastTransfer = await prisma.departmentTransfer.findFirst({ where: { status: 'completed' }, orderBy: { updatedAt: 'desc' } })
  let dept: any = null
  if (lastTransfer && lastTransfer.toDepartmentId) {
    dept = await prisma.department.findUnique({ where: { id: lastTransfer.toDepartmentId } })
    console.log('Using destination department from last completed transfer')
  }

  if (!dept) {
    // fallback: let user pass code via env var DEBUG_DEPT_CODE
    const code = process.env.DEBUG_DEPT_CODE
    if (!code) {
      console.error('No department found from transfers and DEBUG_DEPT_CODE not provided')
      process.exit(1)
    }
    dept = await prisma.department.findUnique({ where: { code } })
    if (!dept) {
      console.error('No department with code', code)
      process.exit(1)
    }
    console.log('Using department by code from DEBUG_DEPT_CODE')
  }

  console.log(`\nDepartment: id=${dept.id} code=${dept.code} name=${dept.name} type=${dept.type} referenceType=${dept.referenceType} referenceId=${dept.referenceId}`)

  // Now mimic the generic inventory branch in route.ts: fetch inventory items filtered by dept.type
  const where: any = {}

  // replicate the mapping logic used by the API handler
  const deptToCategoryMap: Record<string, string> = {
    restaurants: 'food',
    restaurant: 'food',
    bars: 'drinks',
    'bar-and-clubs': 'drinks',
    gyms: 'supplies',
    housekeeping: 'supplies',
    laundry: 'supplies',
    games: 'supplies',
    security: 'supplies',
  }

  let mappedCategory: string | undefined = undefined
  if (dept?.type) {
    const raw = String(dept.type).toLowerCase()
    if (deptToCategoryMap[raw]) mappedCategory = deptToCategoryMap[raw]
    else if (['food', 'drinks', 'supplies', 'toiletries', 'misc'].includes(raw)) mappedCategory = raw
  }

  console.log('Computed mappedCategory =', mappedCategory)
  if (mappedCategory) where.category = mappedCategory

  const items = await prisma.inventoryItem.findMany({ where, orderBy: { name: 'asc' } })
  console.log(`\nFound ${items.length} inventory items matching dept.type=${dept.type}`)

  // Get balances for this department
  const itemIds = items.map((i) => i.id)
  const balances = await (prisma as any).departmentInventory.findMany({ where: { departmentId: dept.id, inventoryItemId: { in: itemIds } } })
  const balancesMap = new Map(balances.map((b: any) => [b.inventoryItemId, b.quantity]))

  const mapped = items.map((it) => ({ id: it.id, name: it.name, category: it.category, globalQty: it.quantity, deptQty: balancesMap.get(it.id) ?? null }))

  console.log('\nSample mapped items (first 20):')
  mapped.slice(0, 20).forEach((m) => console.log(`  - ${m.name} (category=${m.category}) global=${m.globalQty} dept=${m.deptQty}`))

  // If dept.type is missing or no items found, show fallback using all items
  if ((!dept.type || items.length === 0) && itemIds.length === 0) {
    const allItems = await prisma.inventoryItem.findMany({ orderBy: { name: 'asc' } })
    console.log(`\nFallback: total inventory items = ${allItems.length}`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const depts = await prisma.department.findMany({ select: { id: true, name: true, code: true } })
  const items = await prisma.inventoryItem.findMany({ select: { id: true, name: true, category: true, quantity: true } })

  console.log('\n=== DEPARTMENTS ===')
  depts.forEach((d) => console.log(`  ${d.name} (${d.code})`))

  console.log('\n=== ITEMS BY CATEGORY ===')
  const byCategory = new Map<string, typeof items>()
  items.forEach((i) => {
    if (!byCategory.has(i.category)) byCategory.set(i.category, [])
    byCategory.get(i.category)!.push(i)
  })

  for (const [cat, catItems] of byCategory) {
    console.log(`\n${cat} (${catItems.length} items):`)
    catItems.forEach((i) => console.log(`  - ${i.name} qty=${i.quantity}`))
  }

  console.log('\n=== DEPARTMENT INVENTORIES ===')
  const deptInvs = await prisma.departmentInventory.groupBy({
    by: ['departmentId', 'inventoryItemId'],
    _sum: { quantity: true },
  })
  console.log(`Total DepartmentInventory rows: ${deptInvs.length}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('\n=== DEPARTMENT INVENTORY QUANTITIES ===')
  const deptInvs = await prisma.departmentInventory.findMany({
    select: { departmentId: true, inventoryItemId: true, quantity: true },
  })

  console.log(`Total DepartmentInventory rows: ${deptInvs.length}`)
  console.log(`Sample (first 20):`)
  deptInvs.slice(0, 20).forEach((di) => {
    console.log(`  dept=${di.departmentId.substring(0, 8)}... item=${di.inventoryItemId.substring(0, 8)}... qty=${di.quantity}`)
  })

  console.log(`\n=== SUMS BY ITEM ===`)
  const sumByItem = await prisma.departmentInventory.groupBy({
    by: ['inventoryItemId'],
    _sum: { quantity: true },
  })

  const items = await prisma.inventoryItem.findMany()
  const itemMap = new Map(items.map((i) => [i.id, i]))

  for (const sum of sumByItem.slice(0, 10)) {
    const item = itemMap.get(sum.inventoryItemId)
    console.log(`  ${item?.name || 'UNKNOWN'}: sum(dept)=${sum._sum.quantity} global=${item?.quantity}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

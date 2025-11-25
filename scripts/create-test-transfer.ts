import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Get all departments
  const allDepts = await prisma.department.findMany()

  // Find two supply departments
  const supplyDepts = allDepts.filter((d) => {
    const c = String(d.code || '').toLowerCase()
    return ['security', 'gym', 'games', 'housekeeping', 'laundry'].some((s) => c.includes(s))
  })

  if (supplyDepts.length < 2) {
    console.error('Could not find 2 supply departments')
    return
  }

  const [fromDept, toDept] = supplyDepts.slice(0, 2)

  // Get a supplies item
  const item = await prisma.inventoryItem.findFirst({ where: { category: 'supplies' } })
  if (!item) {
    console.error('No supplies items found')
    return
  }

  console.log(`\nCreating test transfer:`)
  console.log(`  From: ${fromDept.name} (${fromDept.code})`)
  console.log(`  To: ${toDept.name} (${toDept.code})`)
  console.log(`  Item: ${item.name}`)
  console.log(`  Qty: 10`)

  const sourceStock = await prisma.departmentInventory.findUnique({
    where: {
      departmentId_inventoryItemId: {
        departmentId: fromDept.id,
        inventoryItemId: item.id,
      },
    },
  })

  console.log(`  Source stock: ${sourceStock?.quantity || 0}\n`)

  const transfer = await prisma.departmentTransfer.create({
    data: {
      fromDepartmentId: fromDept.id,
      toDepartmentId: toDept.id,
      status: 'pending',
      items: {
        create: [
          {
            productType: 'inventoryItem',
            productId: item.id,
            quantity: 10,
          },
        ],
      },
    },
    include: { items: true },
  })

  console.log(`Transfer created successfully!`)
  console.log(`  ID: ${transfer.id}`)
  console.log(`  Status: ${transfer.status}`)
  console.log(`  Items: ${transfer.items.length}`)
  console.log(`\nNow approve it:`)
  console.log(`  npx tsx scripts/run-approve-transfer.ts ${transfer.id}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

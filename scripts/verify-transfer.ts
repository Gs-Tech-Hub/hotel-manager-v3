import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Get the last completed transfer
  const transfer = await prisma.departmentTransfer.findFirst({
    where: { status: 'completed' },
    orderBy: { updatedAt: 'desc' },
    include: { items: true },
  })

  if (!transfer) {
    console.log('No completed transfers found')
    return
  }

  console.log(`\n=== LAST COMPLETED TRANSFER ===`)
  console.log(`Transfer ID: ${transfer.id}`)
  console.log(`From Department: ${transfer.fromDepartmentId}`)
  console.log(`To Department: ${transfer.toDepartmentId}`)
  console.log(`Items: ${transfer.items.length}`)

  // Get transfer items with product details
  for (const item of transfer.items) {
    const invItem = await prisma.inventoryItem.findUnique({ where: { id: item.productId } })

    console.log(`\n  Item: ${invItem?.name} (qty=${item.quantity})`)

    // Check department stocks
    const fromStock = await prisma.departmentInventory.findFirst({
      where: {
        departmentId: transfer.fromDepartmentId,
        sectionId: null,
        inventoryItemId: item.productId,
      },
    })

    const toStock = await prisma.departmentInventory.findFirst({
      where: {
        departmentId: transfer.toDepartmentId,
        sectionId: null,
        inventoryItemId: item.productId,
      },
    })

    console.log(`    From stock: ${fromStock?.quantity || 0}`)
    console.log(`    To stock: ${toStock?.quantity || 0}`)
  }

  // Check movements
  const movements = await prisma.inventoryMovement.findMany({
    where: {
      reference: transfer.id, // use the actual field name in the schema
    },
  })

  console.log(`\nInventory Movements: ${movements.length}`)
  movements.forEach((m) => {
    console.log(`  - Type: ${m.movementType}, Qty: ${m.quantity}, Ref: ${m.reference?.substring(0, 8) || 'N/A'}...`)
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

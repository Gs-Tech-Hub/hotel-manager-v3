import { PrismaClient } from '@prisma/client'
import { transferService } from '@/src/services/transfer.service'

const prisma = new PrismaClient()

async function main() {
  console.log('Running transfer integration test...')

  // Create two departments
  const deptA = await prisma.department.create({ data: { code: `TEST_A_${Date.now()}`, name: 'Test A', type: 'housekeeping' } })
  const deptB = await prisma.department.create({ data: { code: `TEST_B_${Date.now()}`, name: 'Test B', type: 'housekeeping' } })

  // Create an inventory item
  const item = await prisma.inventoryItem.create({ data: {
    name: `Test Item ${Date.now()}`,
    sku: `TEST-SKU-${Date.now()}`,
    category: 'supplies',
    quantity: 100,
    unitPrice: 1.5 as any,
    inventoryTypeId: (await prisma.inventoryType.upsert({ where: { typeName: 'test-type' }, update: {}, create: { typeName: 'test-type' } })).id,
  }})

  // Initialize department balances
  await (prisma as any).departmentInventory.create({ data: { departmentId: deptA.id, inventoryItemId: item.id, quantity: 50 } })
  await (prisma as any).departmentInventory.create({ data: { departmentId: deptB.id, inventoryItemId: item.id, quantity: 10 } })

  // Create transfer from A -> B of 5 units
  const transfer = await transferService.createTransfer(deptA.id, deptB.id, [{ productType: 'inventoryItem', productId: item.id, quantity: 5 }], 'test-run')
  console.log('Transfer created:', transfer.id)

  // Approve/execute transfer
  const result = await transferService.approveTransfer(transfer.id)
  console.log('Approve result:', result)

  // Verify balances
  const fromRecord = await (prisma as any).departmentInventory.findUnique({ where: { departmentId_inventoryItemId: { departmentId: deptA.id, inventoryItemId: item.id } } })
  const toRecord = await (prisma as any).departmentInventory.findUnique({ where: { departmentId_inventoryItemId: { departmentId: deptB.id, inventoryItemId: item.id } } })

  console.log('From qty (should be 45):', fromRecord?.quantity)
  console.log('To qty (should be 15):', toRecord?.quantity)

  if ((fromRecord?.quantity ?? 0) !== 45 || (toRecord?.quantity ?? 0) !== 15) {
    throw new Error('Balances did not match expected values')
  }

  console.log('Test passed')
}

main().catch((e) => {
  console.error('Test failed', e)
  process.exit(1)
}).finally(async () => {
  await prisma.$disconnect()
})

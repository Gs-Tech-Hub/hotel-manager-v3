import { PrismaClient } from '@prisma/client'
import { transferService } from '../src/services/transfer.service'

const prisma = new PrismaClient()

async function run() {
  try {
    console.log('Starting transfer integration test...')

    // Create two temporary departments
    const from = await prisma.department.create({ data: { code: `test-from-${Date.now()}`, name: 'Test From Dept' } })
    const to = await prisma.department.create({ data: { code: `test-to-${Date.now()}`, name: 'Test To Dept' } })

    // Ensure an inventory type exists for the test item
    const invType = await prisma.inventoryType.upsert({ where: { typeName: 'test-type' }, update: {}, create: { typeName: 'test-type' } })

    // Create an inventory item (provide required fields)
    const sku = `TEST-SKU-${Date.now()}`
    const item = await prisma.inventoryItem.create({ data: { name: `Test Item ${Date.now()}`, sku, category: 'test', itemType: 'test', quantity: 100, unitPrice: 1.0 as any, inventoryTypeId: invType.id } })

    // Create department inventory record for source with quantity 10
    await prisma.departmentInventory.create({ data: { departmentId: from.id, inventoryItemId: item.id, quantity: 10 } })

    // Create transfer request via service
    const transfer = await transferService.createTransfer(from.id, to.id, [ { productType: 'inventoryItem', productId: item.id, quantity: 4 } ])
    console.log('Created transfer:', transfer.id)

    // Approve/execute the transfer
    const result = await transferService.approveTransfer(transfer.id)
    if (!result.success) throw new Error('Approval failed: ' + result.message)
    console.log('Transfer approved/executed')

    // Fetch updated balances
    const fromRecord = await prisma.departmentInventory.findUnique({ where: { departmentId_inventoryItemId: { departmentId: from.id, inventoryItemId: item.id } } })
    const toRecord = await prisma.departmentInventory.findUnique({ where: { departmentId_inventoryItemId: { departmentId: to.id, inventoryItemId: item.id } } })

    if (!fromRecord) throw new Error('Source record missing after transfer')
    if (!toRecord) throw new Error('Destination record missing after transfer')

    console.log(`Source quantity after transfer: ${fromRecord.quantity} (expected 6)`)
    console.log(`Destination quantity after transfer: ${toRecord.quantity} (expected 4)`)

    if (fromRecord.quantity !== 6) throw new Error('Unexpected source quantity')
    if (toRecord.quantity !== 4) throw new Error('Unexpected destination quantity')

    // Check inventoryMovement entries referencing the transfer
    const movements = await prisma.inventoryMovement.findMany({ where: { reference: transfer.id } })
    console.log('Inventory movements created:', movements.length)
    if (movements.length < 2) throw new Error('Expected at least 2 inventoryMovement records for transfer')

    console.log('Transfer integration test passed.')
    process.exit(0)
  } catch (err: any) {
    console.error('Test failed:', err)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

run()
import { PrismaClient } from '@prisma/client'
import { transferService } from '../src/services/transfer.service'

const prisma = new PrismaClient()

async function run() {
  try {
    console.log('Starting transfer integration test...')

    // Create two temporary departments
    const from = await prisma.department.create({ data: { code: `test-from-${Date.now()}`, name: 'Test From Dept' } })
    const to = await prisma.department.create({ data: { code: `test-to-${Date.now()}`, name: 'Test To Dept' } })

    // Ensure an inventory type exists for the test item
    const invType = await prisma.inventoryType.upsert({ where: { typeName: 'test-type' }, update: {}, create: { typeName: 'test-type' } })

    // Create an inventory item (provide required fields)
    const sku = `TEST-SKU-${Date.now()}`
    const item = await prisma.inventoryItem.create({ data: { name: `Test Item ${Date.now()}`, sku, category: 'test', itemType: 'test', quantity: 100, unitPrice: 1.0 as any, inventoryTypeId: invType.id } })

    // Create department inventory record for source with quantity 10
    await prisma.departmentInventory.create({ data: { departmentId: from.id, inventoryItemId: item.id, quantity: 10 } })

    // Create transfer request via service
    const transfer = await transferService.createTransfer(from.id, to.id, [ { productType: 'inventoryItem', productId: item.id, quantity: 4 } ])
    console.log('Created transfer:', transfer.id)

    // Approve/execute the transfer
    const result = await transferService.approveTransfer(transfer.id)
    if (!result.success) throw new Error('Approval failed: ' + result.message)
    console.log('Transfer approved/executed')

    // Fetch updated balances
    const fromRecord = await prisma.departmentInventory.findUnique({ where: { departmentId_inventoryItemId: { departmentId: from.id, inventoryItemId: item.id } } })
    const toRecord = await prisma.departmentInventory.findUnique({ where: { departmentId_inventoryItemId: { departmentId: to.id, inventoryItemId: item.id } } })

    if (!fromRecord) throw new Error('Source record missing after transfer')
    if (!toRecord) throw new Error('Destination record missing after transfer')

    console.log(`Source quantity after transfer: ${fromRecord.quantity} (expected 6)`)
    console.log(`Destination quantity after transfer: ${toRecord.quantity} (expected 4)`)

    if (fromRecord.quantity !== 6) throw new Error('Unexpected source quantity')
    if (toRecord.quantity !== 4) throw new Error('Unexpected destination quantity')

    // Check inventoryMovement entries referencing the transfer
    const movements = await prisma.inventoryMovement.findMany({ where: { reference: transfer.id } })
    console.log('Inventory movements created:', movements.length)
    if (movements.length < 2) throw new Error('Expected at least 2 inventoryMovement records for transfer')

    console.log('Transfer integration test passed.')
    process.exit(0)
  } catch (err: any) {
    console.error('Test failed:', err)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

run()
import { PrismaClient } from '@prisma/client'
import { transferService } from '../src/services/transfer.service'

const prisma = new PrismaClient()

async function run() {
  try {
    console.log('Starting transfer integration test...')

    // Create two temporary departments
    const from = await prisma.department.create({ data: { code: `test-from-${Date.now()}`, name: 'Test From Dept' } })
    const to = await prisma.department.create({ data: { code: `test-to-${Date.now()}`, name: 'Test To Dept' } })

    // Create an inventory item
    const item = await prisma.inventoryItem.create({ data: { name: `Test Item ${Date.now()}`, unitPrice: 100 } })

    // Create department inventory record for source with quantity 10
    await prisma.departmentInventory.create({ data: { departmentId: from.id, inventoryItemId: item.id, quantity: 10 } })

    // Create transfer request via service
    const transfer = await transferService.createTransfer(from.id, to.id, [ { productType: 'inventoryItem', productId: item.id, quantity: 4 } ])
    console.log('Created transfer:', transfer.id)

    // Approve/execute the transfer
    const result = await transferService.approveTransfer(transfer.id)
    if (!result.success) throw new Error('Approval failed: ' + result.message)
    console.log('Transfer approved/executed')

    // Fetch updated balances
    const fromRecord = await prisma.departmentInventory.findUnique({ where: { departmentId_inventoryItemId: { departmentId: from.id, inventoryItemId: item.id } } })
    const toRecord = await prisma.departmentInventory.findUnique({ where: { departmentId_inventoryItemId: { departmentId: to.id, inventoryItemId: item.id } } })

    if (!fromRecord) throw new Error('Source record missing after transfer')
    if (!toRecord) throw new Error('Destination record missing after transfer')

    console.log(`Source quantity after transfer: ${fromRecord.quantity} (expected 6)`)
    console.log(`Destination quantity after transfer: ${toRecord.quantity} (expected 4)`)

    if (fromRecord.quantity !== 6) throw new Error('Unexpected source quantity')
    if (toRecord.quantity !== 4) throw new Error('Unexpected destination quantity')

    // Check inventoryMovement entries referencing the transfer
    const movements = await prisma.inventoryMovement.findMany({ where: { reference: transfer.id } })
    console.log('Inventory movements created:', movements.length)
    if (movements.length < 2) throw new Error('Expected at least 2 inventoryMovement records for transfer')

    console.log('Transfer integration test passed.')
    process.exit(0)
  } catch (err: any) {
    console.error('Test failed:', err)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

run()
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

import { PrismaClient } from '@prisma/client'
import { transferService } from '../src/services/inventory/transfer.service'

const prisma = new PrismaClient()

async function main() {
  try {
    console.log('Running transfer integration test...')

    // Create two departments
    const deptA = await prisma.department.create({ data: { code: `TEST_A_${Date.now()}`, name: 'Test A', type: 'housekeeping' } })
    const deptB = await prisma.department.create({ data: { code: `TEST_B_${Date.now()}`, name: 'Test B', type: 'housekeeping' } })

    // Ensure an inventory type exists for the test item
    const invType = await prisma.inventoryType.upsert({
      where: { typeName: 'test-type' },
      update: {},
      create: { typeName: 'test-type' },
    })

    // Create an inventory item
    const item = await prisma.inventoryItem.create({
      data: {
        name: `Test Item ${Date.now()}`,
        sku: `TEST-SKU-${Date.now()}`,
        category: 'supplies',
        quantity: 100,
        unitPrice: 1.5 as any,
        inventoryTypeId: invType.id,
      },
    })

    // Initialize department balances
    await prisma.departmentInventory.create({ data: { departmentId: deptA.id, inventoryItemId: item.id, quantity: 50 } })
    await prisma.departmentInventory.create({ data: { departmentId: deptB.id, inventoryItemId: item.id, quantity: 10 } })

    // Create transfer from A -> B of 5 units
    const transfer = await transferService.createTransfer(
      deptA.id,
      deptB.id,
      [{ productType: 'inventoryItem', productId: item.id, quantity: 5 }],
      'test-run'
    )
    console.log('Transfer created:', transfer.id)

    // Approve/execute transfer
    const result = await transferService.approveTransfer(transfer.id)
    console.log('Approve result:', result)

    // Verify balances
    const fromRecord = await prisma.departmentInventory.findFirst({
      where: { departmentId: deptA.id, sectionId: null, inventoryItemId: item.id },
    })
    const toRecord = await prisma.departmentInventory.findFirst({
      where: { departmentId: deptB.id, sectionId: null, inventoryItemId: item.id },
    })

    console.log('From qty (should be 45):', fromRecord?.quantity)
    console.log('To qty (should be 15):', toRecord?.quantity)

    if ((fromRecord?.quantity ?? 0) !== 45 || (toRecord?.quantity ?? 0) !== 15) {
      throw new Error('Balances did not match expected values')
    }

    console.log('Test passed')
    process.exit(0)
  } catch (e: any) {
    console.error('Test failed', e)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

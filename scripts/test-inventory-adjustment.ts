import { prisma } from '@/lib/prisma';
import { inventoryItemService } from '@/services/inventory.service';

async function main() {
  console.log('Testing inventory adjustment with DepartmentInventory...\n');

  try {
    // Get restaurant department
    const restaurant = await prisma.department.findFirst({ where: { code: 'restaurant' } });
    if (!restaurant) {
      console.error('Restaurant department not found');
      return;
    }

    console.log(`✓ Found restaurant department: ${restaurant.id}`);

    // Find an inventory item (use Caesar Salad from previous test)
    const item = await prisma.inventoryItem.findFirst({
      where: { name: { contains: 'Caesar' } },
    });

    if (!item) {
      console.error('Caesar Salad inventory item not found');
      return;
    }

    console.log(`✓ Found inventory item: ${item.name} (${item.id})`);

    // Get initial quantity from DepartmentInventory
    let deptInv = await prisma.departmentInventory.findFirst({
      where: {
        departmentId: restaurant.id,
        inventoryItemId: item.id,
        sectionId: null,
      },
    });

    const initialQuantity = deptInv?.quantity ?? 0;
    console.log(`\nInitial quantity in DepartmentInventory: ${initialQuantity}`);

    // Adjust inventory using the service
    const adjustmentAmount = 5;

    console.log(`\nAdjusting quantity by +${adjustmentAmount}...`);
    const startTime = Date.now();
    
    const result = await inventoryItemService.adjustQuantity(
      item.id,
      adjustmentAmount,
      'Test adjustment'
    );

    const duration = Date.now() - startTime;
    console.log(`✓ Adjustment completed in ${duration}ms`);

    if (!result) {
      console.error('Failed to adjust inventory');
      return;
    }

    console.log(`✓ Service returned item with quantity: ${result.quantity}`);

    // Verify the change persisted in DepartmentInventory
    deptInv = await prisma.departmentInventory.findFirst({
      where: {
        departmentId: restaurant.id,
        inventoryItemId: item.id,
        sectionId: null,
      },
    });

    const finalQuantity = deptInv?.quantity ?? 0;
    console.log(`\nFinal quantity in DepartmentInventory: ${finalQuantity}`);

    // Verify the math
    const expected = initialQuantity + adjustmentAmount;
    if (finalQuantity === expected) {
      console.log(`\n✅ SUCCESS: Quantity correctly updated in DepartmentInventory`);
      console.log(`   Before: ${initialQuantity}`);
      console.log(`   After:  ${finalQuantity}`);
      console.log(`   Change: +${adjustmentAmount}`);
    } else {
      console.error(`\n❌ FAILED: Quantity mismatch`);
      console.error(`   Expected: ${expected}`);
      console.error(`   Got: ${finalQuantity}`);
      return;
    }

    // Verify the movement was recorded
    const movement = await prisma.inventoryMovement.findFirst({
      where: {
        inventoryItemId: item.id,
        reason: 'Test adjustment',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (movement) {
      console.log(`\n✓ Movement recorded: ${movement.movementType} - ${movement.quantity} units`);
    } else {
      console.warn('\n⚠ Movement record not found');
    }

    // Test a negative adjustment (decrement)
    console.log('\n\nTesting negative adjustment (-3)...');
    const decrementAmount = -3;
    
    const result2 = await inventoryItemService.adjustQuantity(
      item.id,
      decrementAmount,
      'Test decrement'
    );

    if (!result2) {
      console.error('Failed to adjust inventory');
      return;
    }

    deptInv = await prisma.departmentInventory.findFirst({
      where: {
        departmentId: restaurant.id,
        inventoryItemId: item.id,
        sectionId: null,
      },
    });

    const afterDecrement = deptInv?.quantity ?? 0;
    const expectedAfterDecrement = finalQuantity + decrementAmount;

    if (afterDecrement === expectedAfterDecrement) {
      console.log(`✅ SUCCESS: Decrement worked correctly`);
      console.log(`   Before: ${finalQuantity}`);
      console.log(`   After:  ${afterDecrement}`);
      console.log(`   Change: ${decrementAmount}`);
    } else {
      console.error(`❌ FAILED: Decrement didn't work as expected`);
      console.error(`   Expected: ${expectedAfterDecrement}`);
      console.error(`   Got: ${afterDecrement}`);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

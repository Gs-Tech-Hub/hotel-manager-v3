import { prisma } from '@/lib/auth/prisma';
import { inventoryMovementService } from '@/services/inventory.service';

/**
 * Test restocking: record a movement and verify DepartmentInventory is updated
 */
async function main() {
  console.log('Testing restocking (recordMovement)...\n');

  try {
    const restaurant = await prisma.department.findFirst({ where: { code: 'restaurant' } });
    if (!restaurant) {
      console.error('Restaurant department not found');
      return;
    }

    // Find Caesar Salad
    const caesarSalad = await prisma.inventoryItem.findFirst({
      where: { name: { contains: 'Caesar' } },
    });

    if (!caesarSalad) {
      console.error('Caesar Salad not found');
      return;
    }

    console.log(`✓ Found Caesar Salad: ${caesarSalad.id}`);

    // Get initial quantity
    const beforeDeptInv = await prisma.departmentInventory.findFirst({
      where: {
        departmentId: restaurant.id,
        inventoryItemId: caesarSalad.id,
        sectionId: null,
      },
    });

    const beforeQty = beforeDeptInv?.quantity ?? 0;
    console.log(`\nInitial DepartmentInventory quantity: ${beforeQty}`);

    // Record a restocking movement (simulating receiving 15 units)
    const restockAmount = 15;
    console.log(`\nRecording restock: +${restockAmount} units`);

    const startTime = Date.now();
    const movement = await inventoryMovementService.recordMovement(
      caesarSalad.id,
      'in',
      restockAmount,
      'Delivery from supplier'
    );
    const duration = Date.now() - startTime;

    console.log(`✓ Movement recorded in ${duration}ms`);

    if (!movement) {
      console.error('Failed to record movement');
      return;
    }

    console.log(`✓ Movement ID: ${movement.id}`);

    // Get updated quantity
    const afterDeptInv = await prisma.departmentInventory.findFirst({
      where: {
        departmentId: restaurant.id,
        inventoryItemId: caesarSalad.id,
        sectionId: null,
      },
    });

    const afterQty = afterDeptInv?.quantity ?? 0;
    console.log(`\nFinal DepartmentInventory quantity: ${afterQty}`);

    // Verify the math
    const expected = beforeQty + restockAmount;
    if (afterQty === expected) {
      console.log(`\n✅ SUCCESS: Restocking updated DepartmentInventory correctly`);
      console.log(`   Before: ${beforeQty}`);
      console.log(`   Added:  ${restockAmount}`);
      console.log(`   After:  ${afterQty}`);
    } else {
      console.error(`\n❌ FAILED: Quantity mismatch`);
      console.error(`   Expected: ${expected}`);
      console.error(`   Got: ${afterQty}`);
      return;
    }

    // Test a consumption (out) movement
    console.log('\n\nTesting consumption (recordMovement with movementType: out)...');
    const consumeAmount = 5;
    console.log(`Recording consumption: -${consumeAmount} units`);

    const movement2 = await inventoryMovementService.recordMovement(
      caesarSalad.id,
      'out',
      consumeAmount,
      'Served'
    );

    if (!movement2) {
      console.error('Failed to record consumption');
      return;
    }

    const finalDeptInv = await prisma.departmentInventory.findFirst({
      where: {
        departmentId: restaurant.id,
        inventoryItemId: caesarSalad.id,
        sectionId: null,
      },
    });

    const finalQty = finalDeptInv?.quantity ?? 0;
    const expectedFinal = afterQty - consumeAmount;

    if (finalQty === expectedFinal) {
      console.log(`✅ SUCCESS: Consumption updated DepartmentInventory correctly`);
      console.log(`   Before: ${afterQty}`);
      console.log(`   Consumed: ${consumeAmount}`);
      console.log(`   After: ${finalQty}`);
    } else {
      console.error(`❌ FAILED: Consumption quantity mismatch`);
      console.error(`   Expected: ${expectedFinal}`);
      console.error(`   Got: ${finalQty}`);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

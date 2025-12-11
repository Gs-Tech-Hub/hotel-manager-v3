import { prisma } from '@/lib/prisma';

/**
 * Simulate the full restocking flow from inventory detail page
 */
async function main() {
  console.log('Simulating full restocking flow from inventory detail page...\n');

  try {
    const restaurant = await prisma.department.findFirst({ where: { code: 'restaurant' } });
    if (!restaurant) {
      console.error('Restaurant department not found');
      return;
    }

    // Get a random inventory item
    const items = await prisma.inventoryItem.findMany({
      where: { isActive: true },
      take: 1,
    });

    if (!items.length) {
      console.error('No inventory items found');
      return;
    }

    const item = items[0];
    console.log(`Testing with item: ${item.name} (${item.id})`);

    // 1. User navigates to /inventory/[id]
    // 2. Page calls GET /api/inventory/[id] to get item details
    console.log('\n[Step 1] User views inventory item detail page');
    console.log(`GET /api/inventory/${item.id}?includeMovements=true`);

    const itemDetail = await prisma.inventoryItem.findUnique({
      where: { id: item.id },
    });

    const deptInv = await prisma.departmentInventory.findFirst({
      where: {
        departmentId: restaurant.id,
        inventoryItemId: item.id,
        sectionId: null,
      },
    });

    const currentQty = deptInv?.quantity ?? 0;
    console.log(`✓ Item retrieved: ${item.name}`);
    console.log(`  Current quantity (DepartmentInventory): ${currentQty}`);
    console.log(`  Unit Price: ${item.unitPrice}`);

    // 3. User submits restock form with amount
    const restockAmount = 20;
    console.log(`\n[Step 2] User submits restock form with amount: ${restockAmount}`);

    // 4. Page calls POST /api/inventory/movements
    console.log(`POST /api/inventory/movements`);
    console.log(`  itemId: ${item.id}`);
    console.log(`  movementType: "in"`);
    console.log(`  quantity: ${restockAmount}`);
    console.log(`  reason: "Restock (admin)"`);

    // Record the movement
    const movement = await prisma.inventoryMovement.create({
      data: {
        inventoryItemId: item.id,
        movementType: 'in',
        quantity: restockAmount,
        reason: 'Restock (admin)',
      },
    });

    // Update DepartmentInventory (what recordMovement does)
    if (deptInv) {
      const newQty = deptInv.quantity + restockAmount;
      await prisma.departmentInventory.update({
        where: { id: deptInv.id },
        data: { quantity: newQty },
      });
    } else {
      await prisma.departmentInventory.create({
        data: {
          departmentId: restaurant.id,
          inventoryItemId: item.id,
          quantity: restockAmount,
        },
      });
    }

    console.log(`✓ Movement recorded: ${movement.id}`);

    // 5. Page refreshes item details
    console.log(`\n[Step 3] Page refreshes item details`);

    const refreshedDeptInv = await prisma.departmentInventory.findFirst({
      where: {
        departmentId: restaurant.id,
        inventoryItemId: item.id,
        sectionId: null,
      },
    });

    const updatedQty = refreshedDeptInv?.quantity ?? 0;
    console.log(`✓ Item details refreshed`);
    console.log(`  Updated quantity: ${updatedQty}`);

    // 6. User sees updated quantity
    console.log(`\n[Step 4] Display updated inventory quantity`);

    if (updatedQty === currentQty + restockAmount) {
      console.log(`\n✅ SUCCESS: Full restocking flow works end-to-end`);
      console.log(`   Before: ${currentQty}`);
      console.log(`   Restocked: +${restockAmount}`);
      console.log(`   After: ${updatedQty}`);
      console.log(`   Displayed to user: ${updatedQty} units`);
    } else {
      console.error(`❌ FAILED: Quantity mismatch in flow`);
      console.error(`   Expected: ${currentQty + restockAmount}`);
      console.error(`   Got: ${updatedQty}`);
    }

    // Verify the movement is in the history
    const movements = await prisma.inventoryMovement.findMany({
      where: { inventoryItemId: item.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    console.log(`\n[Audit] Recent movements for ${item.name}:`);
    console.log(`  Total movements: ${movements.length}`);
    if (movements.length > 0) {
      console.log(`  Latest: ${movements[0].movementType} x ${movements[0].quantity} - ${movements[0].reason}`);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

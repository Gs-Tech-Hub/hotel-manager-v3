import { prisma } from '@/lib/auth/prisma';
import { StockService } from '@/services/stock.service';

/**
 * Test that the inventory display API returns correct quantities from DepartmentInventory
 */
async function main() {
  console.log('Testing inventory display API returns DepartmentInventory quantities...\n');

  try {
    // Get restaurant department
    const restaurant = await prisma.department.findFirst({ where: { code: 'restaurant' } });
    if (!restaurant) {
      console.error('Restaurant department not found');
      return;
    }

    console.log(`✓ Found restaurant department: ${restaurant.id}`);

    // Find the Caesar Salad item
    const caesarSalad = await prisma.inventoryItem.findFirst({
      where: { name: { contains: 'Caesar' } },
    });

    if (!caesarSalad) {
      console.error('Caesar Salad not found');
      return;
    }

    console.log(`✓ Found Caesar Salad item: ${caesarSalad.id}`);

    // Get current balance from DepartmentInventory
    const deptInv = await prisma.departmentInventory.findFirst({
      where: {
        departmentId: restaurant.id,
        inventoryItemId: caesarSalad.id,
        sectionId: null,
      },
    });

    const deptInvQuantity = deptInv?.quantity ?? 0;
    console.log(`\nCurrent DepartmentInventory quantity: ${deptInvQuantity}`);

    // Now test what the API endpoint would return
    const stockService = new StockService();
    const apiBalance = await stockService.getBalance('inventoryItem', caesarSalad.id, restaurant.id);
    console.log(`API balance via StockService: ${apiBalance}`);

    // Verify they match
    if (apiBalance === deptInvQuantity) {
      console.log(`\n✅ SUCCESS: API balance matches DepartmentInventory`);
    } else {
      console.error(`\n❌ MISMATCH: API balance (${apiBalance}) != DepartmentInventory (${deptInvQuantity})`);
    }

    // Also check what the legacy table shows (for comparison)
    console.log(`\n--- Legacy Table Comparison ---`);
    console.log(`InventoryItem.quantity: ${caesarSalad.quantity}`);

    const drink = await prisma.drink.findFirst({
      where: { name: { contains: 'Caesar' } },
    });
    if (drink) {
      console.log(`Drink.quantity: ${drink.quantity}`);
      console.log(`Drink.barStock: ${drink.barStock}`);
      console.log(`Drink.restaurantStock: ${drink.restaurantStock}`);
    }

    console.log(`\n--- Conclusion ---`);
    console.log(`Inventory display shows: ${apiBalance} (from DepartmentInventory)`);
    console.log(`Legacy InventoryItem shows: ${caesarSalad.quantity} (NOT USED)`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

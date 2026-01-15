import { prisma } from '@/lib/auth/prisma';
import { StockService } from '@/services/stock.service';

/**
 * Comprehensive verification that inventory display uses DepartmentInventory
 */
async function main() {
  console.log('Comprehensive inventory display verification...\n');

  try {
    const restaurant = await prisma.department.findFirst({ where: { code: 'restaurant' } });
    if (!restaurant) {
      console.error('Restaurant department not found');
      return;
    }

    const stockService = new StockService();

    // Get several inventory items
    const items = await prisma.inventoryItem.findMany({
      where: { isActive: true },
      take: 5,
    });

    console.log(`Checking ${items.length} inventory items:\n`);
    console.log('Item Name'.padEnd(30) + ' | DeptInv | Legacy | Match');
    console.log('-'.repeat(70));

    let allMatches = true;

    for (const item of items) {
      // Get from DepartmentInventory
      const deptInv = await prisma.departmentInventory.findFirst({
        where: {
          departmentId: restaurant.id,
          inventoryItemId: item.id,
          sectionId: null,
        },
      });
      const deptInvQty = deptInv?.quantity ?? 0;

      // Get via API StockService
      const apiQty = await stockService.getBalance('inventoryItem', item.id, restaurant.id);

      // Get legacy value
      const legacyQty = item.quantity;

      // Check if display matches DepartmentInventory
      const matches = apiQty === deptInvQty;
      allMatches = allMatches && matches;

      const matchSymbol = matches ? '✓' : '✗';
      console.log(
        item.name.substring(0, 29).padEnd(30) +
          ` | ${String(deptInvQty).padEnd(7)} | ${String(legacyQty).padEnd(6)} | ${matchSymbol}`
      );
    }

    console.log('-'.repeat(70));

    if (allMatches) {
      console.log(
        '\n✅ SUCCESS: All inventory items display DepartmentInventory quantities correctly'
      );
    } else {
      console.log('\n❌ FAILURE: Some items display mismatches');
    }

    // Show summary
    const totalDeptInv = await prisma.departmentInventory.aggregate({
      where: {
        departmentId: restaurant.id,
        sectionId: null,
      },
      _sum: { quantity: true },
    });

    const totalLegacy = await prisma.inventoryItem.aggregate({
      where: { isActive: true },
      _sum: { quantity: true },
    });

    console.log(
      `\nTotal quantities:\n  DepartmentInventory: ${totalDeptInv._sum.quantity ?? 0}\n  Legacy InventoryItem: ${totalLegacy._sum.quantity ?? 0}`
    );
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

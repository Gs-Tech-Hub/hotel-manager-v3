/**
 * Seed script for extras
 * Creates test extras (both standalone and inventory-tracked)
 * 
 * Usage: npx ts-node scripts/seed-extras.ts
 */

import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('Seeding extras...');

  try {
    // Get or create kitchen department
    let kitchenDept = await prisma.department.findFirst({
      where: { code: 'KITCHEN' }
    });

    if (!kitchenDept) {
      kitchenDept = await prisma.department.create({
        data: {
          code: 'KITCHEN',
          name: 'Kitchen',
          description: 'Kitchen department',
          isActive: true
        }
      });
      console.log('Created Kitchen department');
    }

    // Get some inventory items to link with
    const inventoryItems = await prisma.inventoryItem.findMany({
      take: 5
    });

    console.log(`Found ${inventoryItems.length} inventory items available for linking`);

    // Create standalone extras (sauce, condiments, etc.)
    const standaloneExtras = [
      {
        name: 'Extra Hot Sauce',
        description: 'Additional hot sauce on the side',
        unit: 'portion',
        price: 50, // $0.50 in cents
        departmentId: kitchenDept.id,
        trackInventory: false,
        isActive: true,
      },
      {
        name: 'Extra Sour Cream',
        description: 'Additional sour cream',
        unit: 'portion',
        price: 75, // $0.75 in cents
        departmentId: kitchenDept.id,
        trackInventory: false,
        isActive: true,
      },
      {
        name: 'Guacamole Add-on',
        description: 'Fresh guacamole on the side',
        unit: 'portion',
        price: 250, // $2.50 in cents
        departmentId: kitchenDept.id,
        trackInventory: false,
        isActive: true,
      },
      {
        name: 'Extra Cheese',
        description: 'Additional melted cheese',
        unit: 'portion',
        price: 100, // $1.00 in cents
        departmentId: kitchenDept.id,
        trackInventory: false,
        isActive: true,
      },
    ];

    const createdStandalone = await Promise.all(
      standaloneExtras.map(extra =>
        prisma.extra.create({ data: extra })
      )
    );

    console.log(`Created ${createdStandalone.length} standalone extras`);

    // Create inventory-tracked extras (if inventory items exist)
    if (inventoryItems.length > 0) {
      const trackedExtras = inventoryItems.slice(0, 3).map((item, index) => ({
        name: `Premium ${item.name} Add-on`,
        description: `Extra portion of ${item.name}`,
        unit: 'portion',
        price: Math.round(parseFloat(item.unitPrice.toString()) * 100),
        departmentId: kitchenDept.id,
        productId: item.id,
        trackInventory: true,
        isActive: true,
      }));

      const createdTracked = await Promise.all(
        trackedExtras.map(extra =>
          prisma.extra.create({ data: extra })
        )
      );

      console.log(`Created ${createdTracked.length} inventory-tracked extras`);
    }

    // Summary
    const allExtras = await prisma.extra.findMany();
    console.log(`\n✅ Seeding complete! Total extras: ${allExtras.length}`);
    console.log('\nExtras created:');
    allExtras.forEach(extra => {
      console.log(`  - ${extra.name} (${extra.unit}) - $${(extra.price / 100).toFixed(2)} - ${extra.trackInventory ? 'Tracked' : 'Standalone'}`);
    });

  } catch (error) {
    console.error('Error seeding extras:', error);
    throw error;
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

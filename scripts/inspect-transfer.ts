import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Get restaurant department
  const restaurant = await prisma.department.findFirst({ where: { code: 'restaurant' } });
  if (!restaurant) {
    console.log('No restaurant department found');
    process.exit(1);
  }

  // Get sections
  const sections = await prisma.departmentSection.findMany({
    where: { departmentId: restaurant.id },
    select: { id: true, name: true, slug: true }
  });
  console.log('Sections in restaurant:', sections);

  // Get salad inventory item
  const salad = await prisma.inventoryItem.findFirst({
    where: { name: { contains: 'salad', mode: 'insensitive' } },
    select: { id: true, name: true }
  });
  console.log('Salad item:', salad);

  // Show current inventory for salad
  if (salad) {
    const invs = await prisma.departmentInventory.findMany({
      where: { inventoryItemId: salad.id },
      select: { departmentId: true, sectionId: true, quantity: true }
    });
    console.log('Current salad inventory:', invs);
  }

  await prisma.$disconnect();
}

main();

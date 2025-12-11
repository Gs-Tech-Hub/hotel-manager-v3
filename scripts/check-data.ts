import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const depts = await prisma.department.findMany({ select: { id: true, code: true, name: true }, take: 5 });
  console.log('Departments:', depts);
  
  const items = await prisma.inventoryItem.findMany({ select: { id: true, name: true }, take: 3 });
  console.log('Inventory Items:', items);
  
  await prisma.$disconnect();
}

main();

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Running demo seed...');

  // Create a demo customer
  const customer = await prisma.customer.upsert({
    where: { email: 'demo@hotel.test' },
    update: {},
    create: {
      firstName: 'Demo',
      lastName: 'Customer',
      email: 'demo@hotel.test',
      phone: '0000000000',
    },
  });

  // Ensure a payment type exists
  const paymentType = await prisma.paymentType.upsert({
    where: { type: 'cash' },
    update: {},
    create: { type: 'cash', description: 'Cash payment' },
  });

  // Food types & categories
  const foodType = await prisma.foodType.upsert({
    where: { typeName: 'main' },
    update: {},
    create: { typeName: 'main', description: 'Main courses' },
  });

  let menuCategory = await prisma.menuCategory.findFirst({ where: { categoryName: 'Starters' } });
  if (!menuCategory) {
    menuCategory = await prisma.menuCategory.create({
      data: { categoryName: 'Starters', description: 'Appetizers and starters' },
    });
  }

  // Create demo food items
  const foodItems = [
    { name: 'Margherita Pizza', price: 1200 },
    { name: 'Caesar Salad', price: 800 },
    { name: 'Grilled Chicken', price: 1500 },
  ];

  // Use createMany with skipDuplicates to add demo food items
  await prisma.foodItem.createMany({
    skipDuplicates: true,
    data: foodItems.map((f) => ({
      name: f.name,
      price: (f.price / 100).toFixed(2),
      description: `${f.name} - demo item`,
      availability: true,
      foodTypeId: foodType.id,
      menuCategoryId: menuCategory.id,
    })),
  });

  // Drink types
  const drinkType = await prisma.drinkType.upsert({
    where: { typeName: 'soft' },
    update: {},
    create: { typeName: 'soft', description: 'Soft drinks' },
  });

  // Create demo drinks
  const drinks = [
    { name: 'Coca Cola', price: 300 },
    { name: 'Orange Juice', price: 350 },
    { name: 'Mineral Water', price: 150 },
  ];

  await prisma.drink.createMany({
    skipDuplicates: true,
    data: drinks.map((d) => ({
      name: d.name,
      price: d.price,
      description: `${d.name} - demo item`,
      availability: true,
      drinkTypeId: drinkType.id,
      quantity: 100,
    })),
  });

  // Create a simple order linked to demo customer (best-effort — some DBs may have schema differences)
  // Create a full OrderHeader with lines/departments/payments for testing (best-effort)
  try {
    const orderHeaderExisting = await prisma.orderHeader.findFirst({ where: { customerId: customer.id } });
    if (!orderHeaderExisting) {
      // Ensure a department exists
      let department = await prisma.department.findFirst({ where: { code: 'REST' } });
      if (!department) {
        department = await prisma.department.create({ data: { code: 'REST', name: 'Restaurant', description: 'Restaurant department' } });
      }

      // Pick a food and a drink if available
      const pizza = await prisma.foodItem.findFirst({ where: { name: 'Margherita Pizza' } });
      const cola = await prisma.drink.findFirst({ where: { name: 'Coca Cola' } });

      const orderNumber = `DEMO-${Date.now()}`;

      const header = await prisma.orderHeader.create({
        data: {
          orderNumber,
          customerId: customer.id,
          departmentCode: department.code,
          status: 'pending',
          subtotal: 0,
          discountTotal: 0,
          tax: 0,
          total: 0,
        },
      });

      // Create lines
      const linesData: any[] = [];
      if (pizza) {
        linesData.push({
          orderHeaderId: header.id,
          departmentCode: department.code,
          productId: pizza.id,
          productType: 'food',
          productName: pizza.name,
          quantity: 1,
          unitPrice: Math.round(Number((pizza as any).price) * 100) || 1200,
          unitDiscount: 0,
          lineTotal: Math.round(Number((pizza as any).price) * 100) || 1200,
        });
      }
      if (cola) {
        linesData.push({
          orderHeaderId: header.id,
          departmentCode: department.code,
          productId: cola.id,
          productType: 'drink',
          productName: cola.name,
          quantity: 2,
          unitPrice: cola.price || 300,
          unitDiscount: 0,
          lineTotal: (cola.price || 300) * 2,
        });
      }

      // Create lines in a transaction and compute totals
      await prisma.$transaction(async (tx) => {
        let subtotal = 0;
        // Ensure each order line has a lineNumber (incremental per order)
        let lineNumber = 1;
        for (const ld of linesData) {
          // assign a lineNumber if missing
          if (ld.lineNumber == null) ld.lineNumber = lineNumber++;
          await tx.orderLine.create({ data: ld });
          subtotal += ld.lineTotal;
        }

        // Link department
        await tx.orderDepartment.create({ data: { orderHeaderId: header.id, departmentId: department.id, status: 'pending' } });

        // Create a payment record
        await tx.orderPayment.create({ data: { orderHeaderId: header.id, amount: subtotal, paymentMethod: 'cash', paymentStatus: 'completed', paymentTypeId: paymentType.id } });

        // Update header totals
        await tx.orderHeader.update({ where: { id: header.id }, data: { subtotal, total: subtotal } });
      });
    }
  } catch (err: any) {
    console.warn('Skipping full OrderHeader seed due to schema mismatch or DB error:', err?.message || err);
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

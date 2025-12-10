import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding departments and inventory (restaurants)')

  // Create restaurant entity and department
  let restaurant = await prisma.restaurant.findFirst({ where: { name: 'Main Hotel Restaurant' } })
  if (!restaurant) {
    restaurant = await prisma.restaurant.create({ data: { name: 'Main Hotel Restaurant', location: 'Ground Floor', description: 'Primary hotel restaurant' } })
  }

  const restaurantDept = await prisma.department.upsert({
    where: { code: `restaurant:${restaurant.id}:main` },
    update: {},
    create: {
      code: `restaurant:${restaurant.id}:main`,
      name: 'Restaurant - Main',
      description: 'Main restaurant section',
      type: 'restaurants',
      referenceType: 'Restaurant',
      referenceId: restaurant.id,
    },
  })

  // Re-introduce typed domain models for foods and drinks, keep toiletries/misc as inventory items
  // Food items (foodItem)
  const foods = [
    { name: 'Egg Noodles', price: 6.5 },
    { name: 'Chicken Noodles', price: 8.0 },
    { name: 'Beef Stir Fry', price: 12.0 },
    { name: 'Vegetable Fried Rice', price: 7.5 },
    { name: 'Seafood Pasta', price: 13.0 },
    { name: 'Margherita Pizza', price: 11.0 },
    { name: 'Caesar Salad', price: 7.0 },
    { name: 'Grilled Salmon', price: 15.0 },
    { name: 'Pancake Stack', price: 5.5 },
    { name: 'Beef Burger', price: 10.0 },
  ]

  const foodType = await prisma.foodType.upsert({ where: { typeName: 'main' }, update: {}, create: { typeName: 'main' } })
  let menuCategory = await prisma.menuCategory.findFirst({ where: { categoryName: 'Main' } })
  if (!menuCategory) menuCategory = await prisma.menuCategory.create({ data: { categoryName: 'Main', description: 'Main menu' } })

  for (const f of foods) {
    const existing = await prisma.foodItem.findFirst({ where: { name: f.name, restaurantId: restaurant.id } })
    if (!existing) {
      await prisma.foodItem.create({
        data: {
          name: f.name,
          description: `${f.name} - from seed`,
          price: Number(f.price).toFixed(2),
          availability: true,
          foodTypeId: foodType.id,
          menuCategoryId: menuCategory.id,
          restaurantId: restaurant.id,
        },
      })
    }
  }

  // Create a Bar entity + department so we can seed drinks
  let bar = await prisma.barAndClub.findFirst({ where: { name: 'Main Hotel Bar' } })
  if (!bar) {
    bar = await prisma.barAndClub.create({ data: { name: 'Main Hotel Bar', location: 'Lobby Bar', description: 'Hotel bar and club' } })
  }
  const barDept = await prisma.department.upsert({
    where: { code: `bar:${bar.id}:main` },
    update: {},
    create: {
      code: `bar:${bar.id}:main`,
      name: 'Bar - Main',
      description: 'Main bar section',
      type: 'bars',
      referenceType: 'BarAndClub',
      referenceId: bar.id,
    },
  })

  // Drinks (drink model)
  const drinks = [
    { name: 'Coca Cola', price: 2.5 },
    { name: 'Tonic Water', price: 2.0 },
    { name: 'Orange Juice', price: 3.0 },
    { name: 'Lemonade', price: 2.5 },
    { name: 'Gin & Tonic', price: 6.0 },
    { name: 'Old Fashioned', price: 8.0 },
    { name: 'Mojito', price: 7.0 },
    { name: 'Espresso Martini', price: 8.5 },
    { name: 'Mineral Water', price: 1.5 },
    { name: 'Craft Beer', price: 5.0 },
  ]

  const drinkTypeId = (await prisma.drinkType.upsert({ where: { typeName: 'mixed' }, update: {}, create: { typeName: 'mixed' } })).id

  for (const d of drinks) {
    const existing = await prisma.drink.findFirst({ where: { name: d.name, barAndClubId: bar.id } })
    if (!existing) {
      await prisma.drink.create({ data: {
        name: d.name,
        description: `${d.name} - from seed`,
        price: Math.round(d.price * 100),
        availability: true,
        drinkTypeId,
        quantity: 200,
        barStock: 200,
        threshold: 10,
        barAndClubId: bar.id,
      }})
    }
  }

  // Housekeeping department (no external reference)
  const hkDept = await prisma.department.upsert({
    where: { code: 'HOUSEKEEPING' },
    update: {},
    create: { code: 'HOUSEKEEPING', name: 'Housekeeping', description: 'Housekeeping and toiletries', type: 'housekeeping' },
  })

  // Toiletries and misc as inventory_items
  const toiletries = [
    { name: 'Shampoo (200ml)', sku: 'TOIL-SHAMPOO-200', category: 'toiletries', quantity: 500, unitPrice: 1.5 },
    { name: 'Soap Bar', sku: 'TOIL-SOAP', category: 'toiletries', quantity: 1000, unitPrice: 0.5 },
    { name: 'Toothpaste (50ml)', sku: 'TOIL-TOOTHPASTE', category: 'toiletries', quantity: 400, unitPrice: 0.8 },
    { name: 'Toothbrush', sku: 'TOIL-TOOTHBRUSH', category: 'toiletries', quantity: 300, unitPrice: 0.6 },
    { name: 'Lotion (100ml)', sku: 'TOIL-LOTION-100', category: 'toiletries', quantity: 200, unitPrice: 2.0 },
    { name: 'Shaving Kit', sku: 'TOIL-SHAVING', category: 'toiletries', quantity: 150, unitPrice: 3.5 },
    { name: 'Sanitary Bag', sku: 'TOIL-SANITARY', category: 'toiletries', quantity: 250, unitPrice: 0.9 },
    { name: 'Hair Comb', sku: 'TOIL-COMB', category: 'toiletries', quantity: 180, unitPrice: 0.4 },
    { name: 'Sewing Kit', sku: 'TOIL-SEW', category: 'toiletries', quantity: 120, unitPrice: 1.2 },
    { name: 'Laundry Bag', sku: 'TOIL-LAUNDRY', category: 'toiletries', quantity: 80, unitPrice: 2.5 },
  ]

  const misc = [
    { name: 'Napkins Pack', sku: 'MISC-NAP', category: 'misc', quantity: 1000, unitPrice: 0.2 },
    { name: 'Paper Cups (100)', sku: 'MISC-CUPS', category: 'misc', quantity: 500, unitPrice: 1.0 },
    { name: 'Plastic Cutlery Set', sku: 'MISC-FORKS', category: 'misc', quantity: 400, unitPrice: 0.5 },
  ]

  const allItems = [...toiletries, ...misc]
  // upsert inventoryType as generic 'stock'
  const inventoryType = await prisma.inventoryType.upsert({ where: { typeName: 'stock' }, update: {}, create: { typeName: 'stock', category: 'stock' } })
  for (const it of allItems) {
    const existing = await prisma.inventoryItem.findFirst({ where: { sku: it.sku } })
    if (!existing) {
      await prisma.inventoryItem.create({ data: {
        name: it.name,
        description: `${it.name} - seeded`,
        sku: it.sku,
        category: it.category,
        quantity: it.quantity,
        reorderLevel: 10,
        unitPrice: it.unitPrice,
        location: 'Central Store',
        inventoryTypeId: inventoryType.id,
      }})
    }
  }

  // Initialize per-department balances for housekeeping (toiletries) and restaurant (misc)
  const hkItems = await prisma.inventoryItem.findMany({ where: { sku: { in: toiletries.map((t) => t.sku) } } })
  // restaurantDept already upserted above; reuse it
  // const restaurantDept = await prisma.department.findUnique({ where: { code: `restaurant:${restaurant.id}:main` } })
  const restaurantMiscItems = await prisma.inventoryItem.findMany({ where: { sku: { in: misc.map((m) => m.sku) } } })

  for (const item of hkItems) {
    const existing = await prisma.departmentInventory.findFirst({
      where: { departmentId: hkDept.id, sectionId: null, inventoryItemId: item.id },
    })
    if (existing) {
      await prisma.departmentInventory.update({
        where: { id: existing.id },
        data: {
          quantity: item.quantity,
          unitPrice: item.unitPrice as any,
        },
      })
    } else {
      await prisma.departmentInventory.create({
        data: {
          departmentId: hkDept.id,
          inventoryItemId: item.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice as any,
        },
      })
    }
  }

  if (restaurantDept) {
    for (const item of restaurantMiscItems) {
      const existing = await prisma.departmentInventory.findFirst({
        where: { departmentId: restaurantDept.id, sectionId: null, inventoryItemId: item.id },
      })
      if (existing) {
        await prisma.departmentInventory.update({
          where: { id: existing.id },
          data: {
            quantity: item.quantity,
            unitPrice: item.unitPrice as any,
          },
        })
      } else {
        await prisma.departmentInventory.create({
          data: {
            departmentId: restaurantDept.id,
            inventoryItemId: item.id,
            quantity: item.quantity,
            unitPrice: item.unitPrice as any,
          },
        })
      }
    }
  }

  console.log('Inventory seed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

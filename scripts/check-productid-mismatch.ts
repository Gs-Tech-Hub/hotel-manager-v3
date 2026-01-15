import { prisma } from '@/lib/auth/prisma';

async function main() {
  try {
    console.log('=== Checking productId values in orderLine ===\n')

    // Get all orderLines for restaurant:main
    const orderLines = await prisma.orderLine.findMany({
      where: { departmentCode: 'restaurant:main' },
      select: {
        productId: true,
        productName: true,
        status: true,
        quantity: true
      },
      distinct: ['productId']
    })

    console.log(`Found ${orderLines.length} unique productIds in restaurant:main orders:`)
    for (const ol of orderLines) {
      console.log(`  productId: "${ol.productId}", productName: "${ol.productName}"`)
    }

    console.log('\n=== Checking if these productIds exist in any table ===\n')
    const productIds = orderLines.map(ol => ol.productId)

    for (const pid of productIds) {
      const inv = await prisma.inventoryItem.findUnique({ where: { id: pid } })
      const food = await prisma.foodItem.findUnique({ where: { id: pid } })
      const drink = await prisma.drink.findUnique({ where: { id: pid } })

      console.log(`"${pid}":`)
      console.log(`  - InventoryItem: ${inv ? inv.name : 'NOT FOUND'}`)
      console.log(`  - FoodItem: ${food ? food.name : 'NOT FOUND'}`)
      console.log(`  - Drink: ${drink ? drink.name : 'NOT FOUND'}`)
    }

    console.log('\n=== Checking inventoryItem IDs for target products ===\n')
    const targetProducts = ['Caesar Salad', 'Grilled Chicken', 'Margherita Pizza']
    const items = await prisma.inventoryItem.findMany({
      where: { name: { in: targetProducts } },
      select: { id: true, name: true }
    })

    console.log('Target products:')
    for (const it of items) {
      console.log(`  "${it.name}": ${it.id}`)
    }

  } catch (e) {
    console.error('Error:', e)
  } finally {
    await prisma.$disconnect()
  }
}

main()

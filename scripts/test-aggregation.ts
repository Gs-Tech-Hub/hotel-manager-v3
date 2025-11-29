import { prisma } from '@/lib/prisma'

async function main() {
  try {
    console.log('=== Testing Order Aggregation Query ===\n')

    const inventoryItems = await prisma.inventoryItem.findMany({
      where: { name: { in: ['Caesar Salad', 'Grilled Chicken', 'Margherita Pizza'] } },
      select: { id: true, name: true }
    })

    console.log(`Found ${inventoryItems.length} inventory items`)
    const ids = inventoryItems.map(i => i.id)

    console.log('\nInventory Item IDs:', ids)

    // Test the aggregation query
    console.log('\n--- Testing soldGroups query (inventory items) ---')
    const soldGroups = await prisma.orderLine.groupBy({
      by: ['productId'],
      where: {
        productId: { in: ids },
        OR: [
          { orderHeader: { status: { in: ['completed', 'fulfilled'] } } },
          { status: 'fulfilled' }
        ],
        departmentCode: 'restaurant:main'
      },
      _sum: { quantity: true, lineTotal: true }
    })

    console.log(`Found ${soldGroups.length} product groups with sales`)
    for (const sg of soldGroups) {
      const item = inventoryItems.find(i => i.id === sg.productId)
      console.log(`  ${item?.name} (${sg.productId}): qty=${sg._sum.quantity}, total=${sg._sum.lineTotal}`)
    }

    // Now test without the section filter
    console.log('\n--- Testing without section filter ---')
    const allSoldGroups = await prisma.orderLine.groupBy({
      by: ['productId'],
      where: {
        productId: { in: ids },
        OR: [
          { orderHeader: { status: { in: ['completed', 'fulfilled'] } } },
          { status: 'fulfilled' }
        ]
      },
      _sum: { quantity: true, lineTotal: true }
    })

    console.log(`Found ${allSoldGroups.length} product groups (no section filter)`)
    for (const sg of allSoldGroups) {
      const item = inventoryItems.find(i => i.id === sg.productId)
      console.log(`  ${item?.name} (${sg.productId}): qty=${sg._sum.quantity}, total=${sg._sum.lineTotal}`)
    }

    // Test raw orderLine query to see what's actually stored
    console.log('\n--- Raw orderLine data ---')
    const orderLines = await prisma.orderLine.findMany({
      where: {
        productId: { in: ids },
        departmentCode: 'restaurant:main'
      },
      select: {
        productId: true,
        productName: true,
        status: true,
        quantity: true,
        lineTotal: true,
        orderHeader: { select: { id: true, status: true } }
      }
    })

    console.log(`Found ${orderLines.length} order lines for these products`)
    for (const ol of orderLines) {
      console.log(`  ${ol.productName}: status=${ol.status}, headerStatus=${ol.orderHeader.status}, qty=${ol.quantity}`)
    }

  } catch (e) {
    console.error('Error:', e)
  } finally {
    await prisma.$disconnect()
  }
}

main()

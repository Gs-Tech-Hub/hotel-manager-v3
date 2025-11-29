import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('\n=== ORDER LINES FOR RESTAURANT:MAIN ===')
  const orderLines = await prisma.orderLine.findMany({
    where: { departmentCode: 'restaurant:main' },
    take: 50,
  })
  console.log('Found', orderLines.length, 'order lines')
  
  const uniqueProductIds = new Set(orderLines.map(ol => ol.productId))
  console.log('\nUnique productIds in orders:')
  uniqueProductIds.forEach(pid => {
    const count = orderLines.filter(ol => ol.productId === pid).length
    console.log(`  "${pid}" (${count} lines)`)
  })

  console.log('\n=== SAMPLE INVENTORY ITEMS ===')
  const invItems = await prisma.inventoryItem.findMany({
    take: 5,
  })
  console.log('Found', invItems.length, 'sample inventory items:')
  invItems.forEach(item => {
    console.log(`  ID: ${item.id}, Name: ${item.name}`)
  })

  console.log('\n=== CHECKING MATCHES ===')
  const invIds = invItems.map(i => i.id)
  invIds.forEach(id => {
    const prefixed = `menu-${id}`
    const hasRaw = uniqueProductIds.has(id)
    const hasPrefixed = uniqueProductIds.has(prefixed)
    console.log(`  "${id}": raw=${hasRaw}, prefixed=${hasPrefixed}`)
  })

  await prisma.$disconnect()
}

main().catch(console.error)

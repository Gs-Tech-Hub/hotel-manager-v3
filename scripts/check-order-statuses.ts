import { prisma } from '@/lib/prisma'

async function main() {
  try {
    console.log('=== Order Header Statuses ===')
    const headers = await prisma.orderHeader.findMany({
      select: {
        id: true,
        orderNumber: true,
        status: true,
        createdAt: true,
        _count: { select: { lines: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    })
    
    console.log('Order Headers:')
    for (const h of headers) {
      console.log(`  ${h.orderNumber} (${h.id.slice(0,8)}) - Status: ${h.status}, Lines: ${h._count.lines}`)
    }

    console.log('\n=== Order Line Statuses (for restaurant:main) ===')
    const lines = await prisma.orderLine.findMany({
      where: {
        departmentCode: 'restaurant:main'
      },
      select: {
        id: true,
        productId: true,
        productName: true,
        status: true,
        quantity: true,
        lineTotal: true,
        orderHeader: { select: { id: true, status: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    })

    console.log(`\nFound ${lines.length} order lines for restaurant:main:`)
    for (const l of lines) {
      console.log(`  Line: ${l.productName} (${l.quantity}x) - Line Status: ${l.status}, Header Status: ${l.orderHeader.status}`)
    }

    console.log('\n=== Status Breakdown ===')
    const statusCounts = await prisma.orderLine.groupBy({
      by: ['status'],
      where: { departmentCode: 'restaurant:main' },
      _count: true
    })

    for (const sc of statusCounts) {
      console.log(`  ${sc.status}: ${sc._count}`)
    }

    console.log('\n=== Testing Order Line Aggregation ===')
    const productIds = lines.map(l => l.productId)
    const uniqueProducts = [...new Set(productIds)]
    
    for (const prodId of uniqueProducts.slice(0, 3)) {
      console.log(`\nProduct ${prodId}:`)
      
      const completed = await prisma.orderLine.aggregate({
        where: {
          productId: prodId,
          departmentCode: 'restaurant:main',
          OR: [ { orderHeader: { status: 'completed' } }, { status: 'fulfilled' } ]
        },
        _sum: { quantity: true, lineTotal: true }
      })
      
      console.log(`  Completed/Fulfilled: units=${completed._sum.quantity}, amount=${completed._sum.lineTotal}`)
      
      const pending = await prisma.orderLine.aggregate({
        where: {
          productId: prodId,
          departmentCode: 'restaurant:main',
          status: { in: ['pending', 'processing'] },
          orderHeader: { status: { not: 'cancelled' } }
        },
        _sum: { quantity: true }
      })
      
      console.log(`  Pending/Processing: units=${pending._sum.quantity}`)
    }

  } catch (e) {
    console.error('Error:', e)
  } finally {
    await prisma.$disconnect()
  }
}

main()

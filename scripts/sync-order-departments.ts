import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function syncAllMismatchedOrderDepartments(limit = 1000) {
  try {
    console.log('Finding mismatched orderDepartment rows...')

    // Fetch a batch of orderDepartment rows and compare against their header statuses
    const rows = await prisma.orderDepartment.findMany({
      include: { orderHeader: true },
      take: limit,
    });

    const mismatches = rows.filter((r: any) => r.orderHeader && r.status !== r.orderHeader.status);

    if (!mismatches || mismatches.length === 0) {
      console.log('No mismatched rows found')
      return
    }

    console.log('Mismatches found:', mismatches.length)

    for (const m of mismatches) {
      try {
        await prisma.orderDepartment.update({ where: { id: m.id }, data: { status: (m.orderHeader.status as any) } })
        console.log(`Synced od=${m.id} header=${m.orderHeaderId} -> ${m.orderHeader.status}`)
      } catch (e) {
        console.warn('Failed to sync orderDepartment', m.id, e)
      }
    }

    console.log('Sync pass complete')
  } catch (err) {
    console.error('syncAllMismatchedOrderDepartments error', err)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  const args = process.argv.slice(2)
  const limitArg = args[0] ? Number(args[0]) : 1000
  syncAllMismatchedOrderDepartments(limitArg).catch((e) => { console.error(e); process.exit(1) })
}

export { syncAllMismatchedOrderDepartments }

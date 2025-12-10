import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  const centralCode = args.find((a) => a.startsWith('--central='))?.split('=')[1] ?? 'CENTRAL_STORE'

  console.log(`Consolidate inventory (apply=${apply}) central=${centralCode})`)

  // Ensure central store department exists
  let central = await prisma.department.findUnique({ where: { code: centralCode } })
  if (!central) {
    if (apply) {
      central = await prisma.department.create({ data: { code: centralCode, name: 'Central Store', description: 'Auto-created central inventory store', type: 'store' } })
      console.log(`Created central department ${centralCode} id=${central.id}`)
    } else {
      console.log(`Central department ${centralCode} not found (run with --apply to create)`)
    }
  } else {
    console.log(`Central department found: ${central.code} id=${central.id}`)
  }

  const items = await prisma.inventoryItem.findMany({ include: { departmentInventories: true } })
  let toCreate = 0
  let toUpdate = 0

  for (const it of items) {
    const deptSum = (it.departmentInventories || []).reduce((s: number, d: any) => s + (d.quantity || 0), 0)
    const diff = (it.quantity || 0) - deptSum
    if (diff === 0) continue

    console.log(`Item ${it.sku} (${it.name}): global=${it.quantity} sum(dept)=${deptSum} diff=${diff}`)

    if (!apply) continue

    // create or update central record to balance totals
    if (!central) throw new Error('Central department missing; recreate with --apply')
    const existing = await prisma.departmentInventory.findFirst({ where: { departmentId: central.id, sectionId: null, inventoryItemId: it.id } })
    if (existing) {
      // update quantity by diff
      await prisma.departmentInventory.update({ where: { id: existing.id }, data: { quantity: { increment: diff } } })
      toUpdate++
    } else {
      await prisma.departmentInventory.create({ data: { departmentId: central.id, inventoryItemId: it.id, quantity: Math.max(0, diff), unitPrice: it.unitPrice as any } })
      toCreate++
    }
  }

  console.log(`Consolidation complete. Created departmentInventory: ${toCreate}, Updated: ${toUpdate}`)
}

main()
  .catch((e) => {
    console.error('Consolidation failed', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const args = process.argv.slice(2)
  const strategyArg = args.find((a) => a.startsWith('--strategy='))
  const strategy = strategyArg ? strategyArg.split('=')[1] : 'report'
  const apply = args.includes('--apply')

  console.log(`Normalize inventories: strategy=${strategy} apply=${apply}`)

  const departments = await prisma.department.findMany()
  const items = await prisma.inventoryItem.findMany()

  if (strategy === 'consolidate-to-global') {
    // For each inventory item, set inventoryItem.quantity = sum(departmentInventory.quantity)
    const diffs: Array<{ itemId: string; global: number; deptSum: number }> = []
    for (const it of items) {
      const sum = await prisma.departmentInventory.aggregate({ where: { inventoryItemId: it.id }, _sum: { quantity: true } })
      const deptSum = Number(sum._sum.quantity ?? 0)
      const global = Number(it.quantity ?? 0)
      if (global !== deptSum) diffs.push({ itemId: it.id, global, deptSum })
    }

    console.log(`Items with difference: ${diffs.length}`)
    for (const d of diffs) console.log(`- ${d.itemId} global=${d.global} deptSum=${d.deptSum}`)

    if (apply) {
      for (const d of diffs) {
        await prisma.inventoryItem.update({ where: { id: d.itemId }, data: { quantity: d.deptSum } })
      }
      console.log('Consolidation applied')
    } else {
      console.log('Dry-run complete. Use --apply to persist changes.')
    }
  } else if (strategy === 'distribute-even') {
    // For each inventory item, distribute inventoryItem.quantity evenly among departments that match its category
    const byCategory = new Map<string, any>()
    for (const d of departments) {
      // group departments by category mapping (simple code heuristic)
      byCategory.set(d.id, d)
    }

    const changes: Array<{ itemId: string; deptId: string; oldQty: number; newQty: number }> = []
    for (const it of items) {
      // find departments that map to this item's category by code heuristic
      const matching = departments.filter((d) => {
        const code = String(d.code ?? '').toLowerCase()
        if (!code) return false
        if (it.category === 'drinks' && (code.includes('bar') || code.includes('club'))) return true
        if (it.category === 'food' && (code.includes('rest') || code.includes('restaurant'))) return true
        if (it.category === 'supplies') return true
        return false
      })
      if (matching.length === 0) continue
      const per = Math.floor(Number(it.quantity ?? 0) / matching.length)
      for (const md of matching) {
        const existing = await prisma.departmentInventory.findFirst({ where: { departmentId: md.id, sectionId: null, inventoryItemId: it.id } })
        const oldQty = existing ? existing.quantity : 0
        if (oldQty !== per) changes.push({ itemId: it.id, deptId: md.id, oldQty, newQty: per })
      }
    }

    console.log(`Department inventory changes to apply: ${changes.length}`)
    if (!apply) {
      for (const c of changes.slice(0, 50)) console.log(`- item=${c.itemId} dept=${c.deptId} ${c.oldQty} -> ${c.newQty}`)
      if (changes.length > 50) console.log(`...and ${changes.length - 50} more`) 
      console.log('Dry-run complete. Use --apply to persist changes.')
    } else {
      for (const c of changes) {
        const existing = await prisma.departmentInventory.findFirst({ where: { departmentId: c.deptId, sectionId: null, inventoryItemId: c.itemId } })
        if (existing) {
          await prisma.departmentInventory.update({ where: { id: existing.id }, data: { quantity: c.newQty } })
        } else {
          await prisma.departmentInventory.create({ data: { departmentId: c.deptId, inventoryItemId: c.itemId, quantity: c.newQty } })
        }
      }
      console.log('Distribution applied')
    }
  } else {
    console.log('Unknown strategy. Supported: consolidate-to-global, distribute-even')
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('normalize failed', e)
  process.exit(1)
})

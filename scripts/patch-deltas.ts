import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function mapDeptCodeToCategory(code?: string | null): string | undefined {
  if (!code) return undefined
  const c = String(code).toLowerCase()
  if (c.includes('bar') || c.includes('club')) return 'drinks'
  if (c.includes('rest') || c.includes('restaurant')) return 'food'
  if (['drinks', 'food', 'supplies', 'toiletries', 'misc'].includes(c)) return c
  return 'supplies'
}

async function main() {
  console.log('Patching rounding deltas to match InventoryItem quantities where possible')
  const items = await prisma.inventoryItem.findMany()
  const departments = await prisma.department.findMany()

  const issues: Array<string> = []
  let patched = 0

  for (const it of items) {
    const sumAgg = await prisma.departmentInventory.aggregate({ where: { inventoryItemId: it.id }, _sum: { quantity: true } })
    const deptSum = Number(sumAgg._sum.quantity ?? 0)
    const global = Number(it.quantity ?? 0)
    const delta = global - deptSum
    if (delta === 0) continue

    // choose candidate departments: first prefer those that map to the item's category
    const matching = departments.filter((d) => mapDeptCodeToCategory(d.code) === it.category)
    const candidates = matching.length ? matching : departments

    if (delta > 0) {
      // add delta to first candidate (create row if missing)
      const target = candidates[0]
      const existing = await prisma.departmentInventory.findFirst({ where: { departmentId: target.id, sectionId: null, inventoryItemId: it.id } })
      if (!existing) {
        await prisma.departmentInventory.create({ data: { departmentId: target.id, inventoryItemId: it.id, quantity: delta, unitPrice: it.unitPrice as any } })
      } else {
        await prisma.departmentInventory.update({ where: { id: existing.id }, data: { quantity: existing.quantity + delta } })
      }
      patched++
      continue
    }

    // delta < 0 : need to remove -delta from departments. iterate candidates and decrement where possible
    let remaining = -delta
    for (const d of candidates) {
      if (remaining <= 0) break
      const existing = await prisma.departmentInventory.findFirst({ where: { departmentId: d.id, sectionId: null, inventoryItemId: it.id } })
      if (!existing || existing.quantity <= 0) continue
      const take = Math.min(existing.quantity, remaining)
      await prisma.departmentInventory.update({ where: { id: existing.id }, data: { quantity: existing.quantity - take } })
      remaining -= take
    }

    if (remaining > 0) {
      issues.push(`Could not remove full ${-delta} for item ${it.id}; leftover ${remaining}`)
    }
    patched++
  }

  console.log(`Patched items: ${patched}. Issues: ${issues.length}`)
  for (const i of issues) console.warn(i)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('patch-deltas failed', e)
  process.exit(1)
})

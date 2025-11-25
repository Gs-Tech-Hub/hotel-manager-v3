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
  // CLI args: --assign=zero|single|even|from-global (default zero)
  // --clear-transfers (default true) --chunk=1000
  const args = process.argv.slice(2)
  const assignArg = args.find((a) => a.startsWith('--assign='))
  const assign = assignArg ? assignArg.split('=')[1] : 'zero'
  const clearTransfers = !args.includes('--no-clear-transfers')
  const chunkArg = args.find((a) => a.startsWith('--chunk='))
  const chunk = chunkArg ? Number(chunkArg.split('=')[1]) : 1000

  console.log(`Fast seeding DepartmentInventory (assign=${assign}, clearTransfers=${clearTransfers}, chunk=${chunk})`)

  const [departments, items] = await Promise.all([
    prisma.department.findMany(),
    prisma.inventoryItem.findMany(),
  ])

  const deptMap = new Map(departments.map((d) => [d.id, d]))

  // Build create payloads
  const toCreate: Array<any> = []
  const deptIdsSet = new Set<string>()
  const itemIdsSet = new Set<string>()

  for (const item of items) {
    const matching = departments.filter((d) => mapDeptCodeToCategory(d.code) === item.category)
    if (matching.length === 0) continue

    if (assign === 'single') {
      const target = matching[0]
      const qty = Number(item.quantity ?? 0)
      toCreate.push({ departmentId: target.id, inventoryItemId: item.id, quantity: qty, unitPrice: item.unitPrice as any })
      deptIdsSet.add(target.id)
      itemIdsSet.add(item.id)
    } else if (assign === 'even' || assign === 'from-global') {
      const total = assign === 'from-global' ? Number(item.quantity ?? 0) : Number(item.quantity ?? 0)
      const per = Math.floor(total / matching.length)
      for (const md of matching) {
        toCreate.push({ departmentId: md.id, inventoryItemId: item.id, quantity: per, unitPrice: item.unitPrice as any })
        deptIdsSet.add(md.id)
        itemIdsSet.add(item.id)
      }
    } else {
      // zero
      for (const md of matching) {
        toCreate.push({ departmentId: md.id, inventoryItemId: item.id, quantity: 0, unitPrice: item.unitPrice as any })
        deptIdsSet.add(md.id)
        itemIdsSet.add(item.id)
      }
    }
  }

  // Delete existing DepartmentInventory rows for affected departments/items (fast)
  if (toCreate.length === 0) {
    console.log('No DepartmentInventory targets found; nothing to do.')
    return
  }

  const deptIds = Array.from(deptIdsSet)
  const itemIds = Array.from(itemIdsSet)

  console.log(`Preparing to reset ${toCreate.length} department-inventory rows across ${deptIds.length} departments and ${itemIds.length} items.`)

  // Clear existing relevant DepartmentInventory rows
  await prisma.departmentInventory.deleteMany({ where: { departmentId: { in: deptIds }, inventoryItemId: { in: itemIds } } })
  console.log('Deleted old DepartmentInventory rows for target sets.')

  // Bulk insert in chunks
  for (let i = 0; i < toCreate.length; i += chunk) {
    const batch = toCreate.slice(i, i + chunk)
    await prisma.departmentInventory.createMany({ data: batch })
    console.log(`Inserted batch ${i / chunk + 1} (${batch.length} rows)`)    
  }

  console.log('DepartmentInventory reseed complete.')

  if (clearTransfers) {
    // Delete inventory movements and transfers
    const mv = await prisma.inventoryMovement.deleteMany()
    const dt = await prisma.departmentTransfer.deleteMany()
    console.log(`Cleared transfer history: inventoryMovements=${mv.count}, departmentTransfers=${dt.count}`)
  }
}

main()
  .catch((e) => {
    console.error('Fast seed failed', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

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
  // CLI args: --assign=single|even|zero (default: zero). single -> assign full item.quantity to first matching department.
  const args = process.argv.slice(2)
  const assignArg = args.find((a) => a.startsWith('--assign='))
  const assign = assignArg ? assignArg.split('=')[1] : 'zero'

  console.log(`Seeding DepartmentInventory records (assign strategy=${assign})`)

  const departments = await prisma.department.findMany()
  const items = await prisma.inventoryItem.findMany()

  let created = 0

  for (const item of items) {
    // find departments that map to this item's category
    const matching = departments.filter((d) => mapDeptCodeToCategory(d.code) === item.category)
    if (matching.length === 0) continue

    // for each matching department, upsert a DepartmentInventory record if missing
    if (assign === 'single') {
      const target = matching[0]
      const existing = await prisma.departmentInventory.findUnique({ where: { departmentId_inventoryItemId: { departmentId: target.id, inventoryItemId: item.id } } })
      if (!existing) {
        await prisma.departmentInventory.create({ data: { departmentId: target.id, inventoryItemId: item.id, quantity: item.quantity, unitPrice: item.unitPrice as any } })
        created++
      }
    } else if (assign === 'even') {
      const per = Math.floor(item.quantity / matching.length)
      for (const md of matching) {
        const existing = await prisma.departmentInventory.findUnique({ where: { departmentId_inventoryItemId: { departmentId: md.id, inventoryItemId: item.id } } })
        if (!existing) {
          await prisma.departmentInventory.create({ data: { departmentId: md.id, inventoryItemId: item.id, quantity: per, unitPrice: item.unitPrice as any } })
          created++
        }
      }
    } else {
      // default: create zeroed records for missing departments so transfers can create/increment later
      for (const md of matching) {
        const existing = await prisma.departmentInventory.findUnique({ where: { departmentId_inventoryItemId: { departmentId: md.id, inventoryItemId: item.id } } })
        if (!existing) {
          await prisma.departmentInventory.create({ data: { departmentId: md.id, inventoryItemId: item.id, quantity: 0, unitPrice: item.unitPrice as any } })
          created++
        }
      }
    }
  }

  console.log(`Seeding complete. DepartmentInventory records created: ${created}`)
}

main()
  .catch((e) => {
    console.error('Seeding failed', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

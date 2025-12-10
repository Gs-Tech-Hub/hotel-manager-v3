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
  // CLI args:
  // --assign=single|even|zero|from-global (default: zero)
  // --force (boolean) -> overwrite existing DepartmentInventory values instead of skipping them
  const args = process.argv.slice(2)
  const assignArg = args.find((a) => a.startsWith('--assign='))
  const assign = assignArg ? assignArg.split('=')[1] : 'zero'
  const force = args.includes('--force')

  console.log(`Seeding DepartmentInventory records (assign strategy=${assign}, force=${force})`)

  const departments = await prisma.department.findMany()
  const items = await prisma.inventoryItem.findMany()

  let created = 0
  let updated = 0

  for (const item of items) {
    // find departments that map to this item's category
    const matching = departments.filter((d) => mapDeptCodeToCategory(d.code) === item.category)
    if (matching.length === 0) continue

    if (assign === 'single') {
      const target = matching[0]
      const dataQty = item.quantity
      const existing = await prisma.departmentInventory.findFirst({ where: { departmentId: target.id, sectionId: null, inventoryItemId: item.id } })
      if (!existing) {
        await prisma.departmentInventory.create({ data: { departmentId: target.id, inventoryItemId: item.id, quantity: dataQty, unitPrice: item.unitPrice as any } })
        created++
      } else if (force) {
        await prisma.departmentInventory.update({ where: { id: existing.id }, data: { quantity: dataQty, unitPrice: item.unitPrice as any } })
        updated++
      }
    } else if (assign === 'even') {
      const per = Math.floor(item.quantity / matching.length)
      for (const md of matching) {
        const existing = await prisma.departmentInventory.findFirst({ where: { departmentId: md.id, sectionId: null, inventoryItemId: item.id } })
        if (!existing) {
          await prisma.departmentInventory.create({ data: { departmentId: md.id, inventoryItemId: item.id, quantity: per, unitPrice: item.unitPrice as any } })
          created++
        } else if (force) {
          await prisma.departmentInventory.update({ where: { id: existing.id }, data: { quantity: per, unitPrice: item.unitPrice as any } })
          updated++
        }
      }
    } else if (assign === 'from-global') {
      // Distribute this item's global quantity among matching departments (evenly). With --force, overwrite existing quantities.
      const total = Number(item.quantity ?? 0)
      const per = Math.floor(total / matching.length)
      for (const md of matching) {
        const existing = await prisma.departmentInventory.findFirst({ where: { departmentId: md.id, sectionId: null, inventoryItemId: item.id } })
        if (!existing) {
          await prisma.departmentInventory.create({ data: { departmentId: md.id, inventoryItemId: item.id, quantity: per, unitPrice: item.unitPrice as any } })
          created++
        } else if (force) {
          await prisma.departmentInventory.update({ where: { id: existing.id }, data: { quantity: per, unitPrice: item.unitPrice as any } })
          updated++
        }
      }
    } else {
      // default: create zeroed records for missing departments so transfers can create/increment later
      for (const md of matching) {
        const existing = await prisma.departmentInventory.findFirst({ where: { departmentId: md.id, sectionId: null, inventoryItemId: item.id } })
        if (!existing) {
          await prisma.departmentInventory.create({ data: { departmentId: md.id, inventoryItemId: item.id, quantity: 0, unitPrice: item.unitPrice as any } })
          created++
        } else if (force) {
          await prisma.departmentInventory.update({ where: { id: existing.id }, data: { quantity: 0, unitPrice: item.unitPrice as any } })
          updated++
        }
      }
    }
  }

  console.log(`Seeding complete. DepartmentInventory records created: ${created}, updated: ${updated}`)
}

main()
  .catch((e) => {
    console.error('Seeding failed', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

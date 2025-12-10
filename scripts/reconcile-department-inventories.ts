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
  console.log('Reconciling DepartmentInventory totals vs InventoryItem.quantity...')

  const items = await prisma.inventoryItem.findMany({ include: { departmentInventories: true } })
  let mismatches = 0

  for (const item of items) {
    const deptSum = (item.departmentInventories || []).reduce((s: number, d: any) => s + (d.quantity || 0), 0)
    if (deptSum !== item.quantity) {
      mismatches++
      console.log(`Mismatch for item ${item.id} (${item.name}) sku=${item.sku} category=${item.category}: inventoryItem.quantity=${item.quantity} vs sum(department)=${deptSum}`)
      // list missing department records for this category
      const depts = await prisma.department.findMany()
      const matching = depts.filter((d) => mapDeptCodeToCategory(d.code) === item.category)
      if (matching.length === 0) {
        console.log(`  No departments mapped to category='${item.category}'`)
      } else {
        for (const md of matching) {
          const rec = await prisma.departmentInventory.findFirst({ where: { departmentId: md.id, sectionId: null, inventoryItemId: item.id } })
          if (!rec) console.log(`  Missing DepartmentInventory for dept ${md.code} (${md.id})`)
        }
      }
    }
  }

  console.log(`Reconcile complete. Items with mismatches: ${mismatches}`)
}

main()
  .catch((e) => {
    console.error('Reconcile failed', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

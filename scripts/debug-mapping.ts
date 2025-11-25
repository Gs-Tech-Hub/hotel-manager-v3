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
  const depts = await prisma.department.findMany()
  const items = await prisma.inventoryItem.findMany()

  console.log('\n=== DEPARTMENT → CATEGORY MAPPING ===')
  const deptsByCategory = new Map<string, string[]>()
  depts.forEach((d) => {
    const cat = mapDeptCodeToCategory(d.code)
    if (!deptsByCategory.has(cat || 'unknown')) deptsByCategory.set(cat || 'unknown', [])
    deptsByCategory.get(cat || 'unknown')!.push(`${d.name} (${d.code})`)
  })

  for (const [cat, deptNames] of deptsByCategory) {
    console.log(`\n${cat}:`)
    deptNames.forEach((d) => console.log(`  - ${d}`))
  }

  console.log('\n=== ITEMS MAPPED TO DEPARTMENTS ===')
  let totalCreated = 0
  for (const item of items) {
    const matching = depts.filter((d) => mapDeptCodeToCategory(d.code) === item.category)
    totalCreated += matching.length
    console.log(
      `${item.name} (${item.category}): ${matching.length} depts => ` +
        matching.map((d) => d.code).join(', '),
    )
  }
  console.log(`\nTotal DepartmentInventory rows that should be created: ${totalCreated}`)

  console.log('\n=== ACTUAL DEPARTMENT INVENTORIES ===')
  const actual = await prisma.departmentInventory.groupBy({
    by: ['departmentId'],
    _count: true,
  })
  console.log(`Actual rows by dept:`)
  for (const row of actual) {
    const dept = depts.find((d) => d.id === row.departmentId)
    console.log(`  ${dept?.name}: ${row._count}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

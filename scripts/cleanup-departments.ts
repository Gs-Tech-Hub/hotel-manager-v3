import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  const hardDelete = args.includes('--hard-delete')

  console.log(`Cleanup departments (apply=${apply})`)

  const depts = await prisma.department.findMany({ orderBy: { code: 'asc' } })

  // Detect obvious test departments
  const testCandidates = depts.filter((d) => /test|dummy|dev|staging/i.test(`${d.code} ${d.name}`))
  if (testCandidates.length === 0) console.log('No obvious test departments found')
  else {
    console.log('Test-like departments:')
    for (const t of testCandidates) console.log(` - ${t.code} (${t.name}) id=${t.id}`)
    if (apply) {
      for (const t of testCandidates) {
        if (hardDelete) {
          console.log(`Hard-deleting department ${t.code}`)
          await prisma.department.delete({ where: { id: t.id } })
        } else {
          console.log(`Deactivating department ${t.code}`)
          await prisma.department.update({ where: { id: t.id }, data: { isActive: false } })
        }
      }
    }
  }

  // Find duplicate codes (should be unique) and duplicate names
  const codeMap: Record<string, number> = {}
  const dupCodes: any[] = []
  for (const d of depts) {
    if (codeMap[d.code]) dupCodes.push(d)
    else codeMap[d.code] = 1
  }
  if (dupCodes.length > 0) {
    console.log('Duplicate department codes detected:')
    for (const d of dupCodes) console.log(` - ${d.code} (${d.name}) id=${d.id}`)
  } else console.log('No duplicate department codes')

  // Detect similar departments by name (simple heuristic)
  const nameMap: Record<string, any[]> = {}
  for (const d of depts) {
    const key = d.name?.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    nameMap[key] = nameMap[key] || []
    nameMap[key].push(d)
  }
  const similar = Object.values(nameMap).filter((arr) => arr.length > 1)
  if (similar.length > 0) {
    console.log('Departments with similar normalized names (possible duplicates):')
    for (const group of similar) {
      console.log('Group:')
      for (const d of group) console.log(` - ${d.code} (${d.name}) id=${d.id}`)
    }
    if (apply) {
      // For safety, do not auto-merge — only deactivate/delete duplicates beyond the first in each group
      for (const group of similar) {
        const [keep, ...rest] = group
        for (const r of rest) {
          if (hardDelete) {
            console.log(`Hard-deleting duplicate department ${r.code} (keeping ${keep.code})`)
            await prisma.department.delete({ where: { id: r.id } })
          } else {
            console.log(`Deactivating duplicate department ${r.code} (keeping ${keep.code})`)
            await prisma.department.update({ where: { id: r.id }, data: { isActive: false } })
          }
        }
      }
    }
  } else {
    console.log('No similar department name groups found')
  }

  console.log('Cleanup script finished')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

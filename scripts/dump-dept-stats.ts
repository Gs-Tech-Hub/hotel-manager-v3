import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function dumpDeptStats() {
  try {
    const depts = await prisma.department.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } })

    console.log('Departments and metadata/stats:')
    for (const d of depts) {
      // count orderDepartment rows for this dept
      const counts = await prisma.orderDepartment.groupBy({ by: ['status'], where: { departmentId: d.id }, _count: { _all: true } })
      const map: any = { total: 0 }
      for (const r of counts) {
        const cnt = (r as any)._count?._all || 0
        map.total += cnt
        map[r.status] = cnt
      }

      console.log('---')
      console.log('code:', d.code)
      console.log('id:', d.id)
      console.log('metadata.stats:', (d.metadata || {}).stats || null)
      console.log('orderDepartment counts:', map)
    }
  } catch (e) {
    console.error('dumpDeptStats error', e)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) dumpDeptStats()

export { dumpDeptStats }

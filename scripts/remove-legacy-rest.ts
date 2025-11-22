import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    const legacy = await prisma.department.findFirst({ where: { code: 'REST' } })
    if (!legacy) {
      console.log('No legacy department with code REST found.')
      return
    }

    const canonical = await prisma.department.findFirst({ where: { code: 'restaurant' } })
    if (!canonical) {
      console.log('No canonical department with code restaurant found. Skipping migration.')
      return
    }

    console.log(`Found legacy ${legacy.code} (id=${legacy.id}), canonical restaurant id=${canonical.id}`)

    try {
      await prisma.orderDepartment.updateMany({ where: { departmentId: legacy.id }, data: { departmentId: canonical.id } })
      await prisma.terminal.updateMany({ where: { departmentId: legacy.id }, data: { departmentId: canonical.id } })
      await prisma.departmentInventory.updateMany({ where: { departmentId: legacy.id }, data: { departmentId: canonical.id } })
      await prisma.departmentTransfer.updateMany({ where: { fromDepartmentId: legacy.id }, data: { fromDepartmentId: canonical.id } })
      await prisma.departmentTransfer.updateMany({ where: { toDepartmentId: legacy.id }, data: { toDepartmentId: canonical.id } })
    } catch (err) {
      console.warn('Partial migration warnings (continuing):', err)
    }

    // Finally delete legacy department (if still exists)
    try {
      await prisma.department.delete({ where: { id: legacy.id } })
      console.log('Legacy REST department removed.')
    } catch (err) {
      console.warn('Failed to delete legacy department (it may have dependent rows):', err)
    }
  } catch (err) {
    console.error('remove-legacy-rest error', err)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) main()

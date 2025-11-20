import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const depts = await prisma.department.findMany({
    where: { isActive: true },
    select: {
      code: true,
      name: true,
      slug: true,
      type: true,
      icon: true,
      image: true,
      metadata: true,
      isActive: true,
    },
    orderBy: { code: 'asc' },
  })

  console.log(JSON.stringify(depts, null, 2))
}

main()
  .catch((e) => {
    console.error('check-departments error', e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

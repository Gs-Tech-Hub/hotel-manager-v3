import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seed() {
  try {
    const existing = await prisma.organisationInfo.findFirst()
    if (existing) {
      console.log('OrganisationInfo already exists:', existing.id)
      return
    }

    const created = await prisma.organisationInfo.create({
      data: {
        name: 'My Hotel',
        address: null,
        email: null,
        phone: null,
        website: null,
        logoDark: null,
        logoLight: null,
        currency: 'USD',
      },
    })

    console.log('Created OrganisationInfo:', created.id)
  } catch (e) {
    console.error('Failed to seed organisation info', e)
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) seed()

export { seed }

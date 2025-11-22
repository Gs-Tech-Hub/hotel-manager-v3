import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    // Find or create a canonical restaurant
    let restaurant = await prisma.restaurant.findFirst()
    if (!restaurant) {
      console.log('No Restaurant found — creating default Restaurant')
      restaurant = await prisma.restaurant.create({ data: { name: 'Default Restaurant', location: 'Main Site', description: 'Auto-created default restaurant by linking script' } })
    }

    let bar = await prisma.barAndClub.findFirst()
    if (!bar) {
      console.log('No BarAndClub found — creating default Bar')
      bar = await prisma.barAndClub.create({ data: { name: 'Default Bar', location: 'Main Site', description: 'Auto-created default bar by linking script' } })
    }

    // Link food items where restaurantId is null
    const foods = await prisma.foodItem.findMany({ where: { restaurantId: null } })
    console.log(`Found ${foods.length} food items with null restaurantId`)
    for (const f of foods) {
      await prisma.foodItem.update({ where: { id: f.id }, data: { restaurantId: restaurant.id } })
    }

    // Link drinks where barAndClubId is null
    const drinks = await prisma.drink.findMany({ where: { barAndClubId: null } })
    console.log(`Found ${drinks.length} drinks with null barAndClubId`)
    for (const d of drinks) {
      await prisma.drink.update({ where: { id: d.id }, data: { barAndClubId: bar.id } })
    }

    console.log('Linking complete.')
  } catch (err) {
    console.error('link-menu-to-entities error', err)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) main()

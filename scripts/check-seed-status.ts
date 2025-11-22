import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    console.log('\n=== Departments (first 200) ===')
    const departments = await prisma.department.findMany({ select: { id: true, code: true, name: true, referenceType: true, referenceId: true }, orderBy: { code: 'asc' }, take: 200 })
    console.table(departments.map(d => ({ id: d.id, code: d.code, name: d.name, referenceType: d.referenceType, referenceId: d.referenceId })))

    const dupMap: Record<string, number> = {}
    for (const d of departments) dupMap[d.code] = (dupMap[d.code] || 0) + 1
    const duplicates = Object.entries(dupMap).filter(([_, c]) => c > 1)
    console.log('\nDuplicate department codes (code -> count):', duplicates.length ? duplicates : 'none')

    console.log('\n=== Legacy department checks ===')
    const legacy = await prisma.department.findMany({ where: { code: { in: ['REST', 'RESTAURANT'] } }, select: { id: true, code: true, name: true } })
    console.table(legacy)

    console.log('\n=== Food items summary ===')
    const foodTotal = await prisma.foodItem.count()
    const foodWithRestaurant = await prisma.foodItem.count({ where: { restaurantId: { not: null } } })
    console.log(`Food items total: ${foodTotal}, linked to restaurants: ${foodWithRestaurant}`)

    const sampleFood = await prisma.foodItem.findMany({ take: 10, select: { id: true, name: true, price: true, restaurantId: true } })
    console.table(sampleFood)

    console.log('\n=== Drink items summary ===')
    const drinkTotal = await prisma.drink.count()
    const drinksWithBar = await prisma.drink.count({ where: { barAndClubId: { not: null } } })
    console.log(`Drinks total: ${drinkTotal}, linked to bars: ${drinksWithBar}`)
    const sampleDrinks = await prisma.drink.findMany({ take: 10, select: { id: true, name: true, price: true, barAndClubId: true } })
    console.table(sampleDrinks)

    console.log('\n=== Inventory summary ===')
    const inventoryTotal = await prisma.inventoryItem.count()
    const deptInventoryTotal = await prisma.departmentInventory.count()
    console.log(`Inventory items total: ${inventoryTotal}, DepartmentInventory entries: ${deptInventoryTotal}`)
    const sampleInventory = await prisma.inventoryItem.findMany({ take: 10, select: { id: true, name: true, sku: true, quantity: true, category: true } })
    console.table(sampleInventory)

    console.log('\n=== DepartmentInventory samples ===')
    const sampleDeptInv = await prisma.departmentInventory.findMany({ take: 20, select: { id: true, departmentId: true, inventoryItemId: true, quantity: true } })
    console.table(sampleDeptInv)

    console.log('\nCheck complete.')
  } catch (err) {
    console.error('check-seed-status error', err)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  main()
}

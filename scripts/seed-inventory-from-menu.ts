import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

async function upsertInventoryType(typeName: string, description?: string) {
  const existing = await prisma.inventoryType.findUnique({ where: { typeName } })
  if (existing) return existing
  return prisma.inventoryType.create({ data: { typeName, description: description || '' } })
}

async function main() {
  try {
    const restaurantDept = (await prisma.department.findUnique({ where: { code: 'restaurant:main' } })) || (await prisma.department.findUnique({ where: { code: 'restaurant' } }))
    const barDept = (await prisma.department.findUnique({ where: { code: 'bar:main' } })) || (await prisma.department.findUnique({ where: { code: 'bar-and-clubs' } }))

    if (!restaurantDept) console.warn('No restaurant department (restaurant:main or restaurant) found; food items will still be created as inventory items but not assigned to a department.')
    if (!barDept) console.warn('No bar department (bar:main or bar-and-clubs) found; drink items will still be created as inventory items but not assigned to a department.')

    const foodType = await upsertInventoryType('food', 'Food items derived from menu/FoodItem')
    const drinkType = await upsertInventoryType('drinks', 'Drink items derived from menu/Drink')

    // Upsert food items into inventory
    const foods = await prisma.foodItem.findMany()
    console.log(`Found ${foods.length} food items; creating/updating inventory records...`)
    for (const f of foods) {
      const sku = `FOOD-${slugify(f.name).toUpperCase()}`
      let inv = await prisma.inventoryItem.findUnique({ where: { sku } })
      const unitPrice = (f.price as any)?.toString ? (f.price as any).toString() : String(f.price || 0)
      if (inv) {
        await prisma.inventoryItem.update({ where: { sku }, data: { name: f.name, description: f.description || undefined, category: 'food', itemType: 'food', unitPrice } })
      } else {
        inv = await prisma.inventoryItem.create({ data: { name: f.name, description: f.description || undefined, sku, category: 'food', itemType: 'food', quantity: 100, reorderLevel: 10, unitPrice, inventoryTypeId: foodType.id } })
      }

      if (restaurantDept) {
        // upsert department inventory
        try {
          await prisma.departmentInventory.upsert({
            where: { departmentId_inventoryItemId: { departmentId: restaurantDept.id, inventoryItemId: inv.id } },
            update: { quantity: 100 },
            create: { departmentId: restaurantDept.id, inventoryItemId: inv.id, quantity: 100 },
          })
        } catch (err) {
          console.warn('Failed upserting DepartmentInventory for food item', f.name, err)
        }
      }
    }

    // Upsert drinks into inventory
    const drinks = await prisma.drink.findMany()
    console.log(`Found ${drinks.length} drinks; creating/updating inventory records...`)
    for (const d of drinks) {
      const sku = `DRINK-${slugify(d.name).toUpperCase()}`
      let inv = await prisma.inventoryItem.findUnique({ where: { sku } })
      const unitPrice = String(d.price || 0)
      if (inv) {
        await prisma.inventoryItem.update({ where: { sku }, data: { name: d.name, description: d.description || undefined, category: 'drinks', itemType: 'drink', unitPrice } })
      } else {
        inv = await prisma.inventoryItem.create({ data: { name: d.name, description: d.description || undefined, sku, category: 'drinks', itemType: 'drink', quantity: 200, reorderLevel: 10, unitPrice, inventoryTypeId: drinkType.id } })
      }

      if (barDept) {
        try {
          await prisma.departmentInventory.upsert({
            where: { departmentId_inventoryItemId: { departmentId: barDept.id, inventoryItemId: inv.id } },
            update: { quantity: 200 },
            create: { departmentId: barDept.id, inventoryItemId: inv.id, quantity: 200 },
          })
        } catch (err) {
          console.warn('Failed upserting DepartmentInventory for drink item', d.name, err)
        }
      }
    }

    console.log('Inventory seeding from menu completed.')
  } catch (err) {
    console.error('seed-inventory-from-menu error', err)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) main()

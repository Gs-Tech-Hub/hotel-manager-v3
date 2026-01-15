/**
 * Price Migration Script (Template)
 * Use this to migrate non-standard prices to the proper format
 * 
 * BEFORE RUNNING:
 * 1. Backup your database
 * 2. Run audit-prices.js to identify issues
 * 3. Verify the problematic items and conversion logic
 * 4. Test on a copy of your database first
 * 
 * Usage:
 * node scripts/migrate-prices.js
 */

import { prisma } from '@/lib/auth/prisma';

async function migratePrice(currentValue) {
  const num = Number(currentValue || 0);

  // If price looks like cents (> 1000), convert to dollars
  if (num > 1000) {
    return (num / 100).toFixed(2);
  }

  // Otherwise keep as-is (assume already in dollars)
  return num.toFixed(2);
}

async function migratePrices() {
  console.log('⚠️  Price Migration Starting...');
  console.log('Make sure you have a database backup!');
  console.log('');

  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Ask for confirmation
  rl.question('Continue? (yes/no): ', async (answer) => {
    if (answer !== 'yes') {
      console.log('Migration cancelled');
      rl.close();
      await prisma.$disconnect();
      process.exit(0);
    }

    try {
      // Migrate Drinks
      console.log('\n📝 Migrating Drink prices...');
      const drinks = await prisma.drink.findMany({
        select: { id: true, price: true },
      });

      let drinksMigrated = 0;
      for (const drink of drinks) {
        const newPrice = await migratePrice(drink.price);
        if (Number(newPrice) !== Number(drink.price)) {
          await prisma.drink.update({
            where: { id: drink.id },
            data: { price: new Decimal(newPrice) },
          });
          drinksMigrated++;
          console.log(`  ✓ Updated drink ${drink.id}: ${drink.price} → ${newPrice}`);
        }
      }
      console.log(`Drinks migrated: ${drinksMigrated}/${drinks.length}`);

      // Migrate Food Items
      console.log('\n📝 Migrating Food Item prices...');
      const foods = await prisma.foodItem.findMany({
        select: { id: true, price: true },
      });

      let foodsMigrated = 0;
      for (const food of foods) {
        const newPrice = await migratePrice(food.price);
        if (Number(newPrice) !== Number(food.price)) {
          await prisma.foodItem.update({
            where: { id: food.id },
            data: { price: new Decimal(newPrice) },
          });
          foodsMigrated++;
          console.log(`  ✓ Updated food ${food.id}: ${food.price} → ${newPrice}`);
        }
      }
      console.log(`Foods migrated: ${foodsMigrated}/${foods.length}`);

      // Migrate Inventory Items
      console.log('\n📝 Migrating Inventory Item prices...');
      const inventory = await prisma.inventoryItem.findMany({
        select: { id: true, unitPrice: true },
      });

      let inventoryMigrated = 0;
      for (const item of inventory) {
        const newPrice = await migratePrice(item.unitPrice);
        if (Number(newPrice) !== Number(item.unitPrice)) {
          await prisma.inventoryItem.update({
            where: { id: item.id },
            data: { unitPrice: new Decimal(newPrice) },
          });
          inventoryMigrated++;
          console.log(`  ✓ Updated inventory ${item.id}: ${item.unitPrice} → ${newPrice}`);
        }
      }
      console.log(`Inventory migrated: ${inventoryMigrated}/${inventory.length}`);

      // Summary
      console.log('\n✅ Migration Complete');
      console.log(
        `Total items migrated: ${drinksMigrated + foodsMigrated + inventoryMigrated}`
      );
    } catch (error) {
      console.error('❌ Migration failed:', error);
    } finally {
      rl.close();
      await prisma.$disconnect();
    }
  });
}

migratePrice();

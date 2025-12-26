/**
 * Price Data Audit Script
 * Run this to identify items with non-standard price formats
 * 
 * Usage:
 * node scripts/audit-prices.js
 */

import { prisma } from '@/lib/prisma';

async function auditPrices() {
  console.log('🔍 Starting price audit...\n');

  try {
    // Audit Drinks
    console.log('📍 DRINKS AUDIT');
    const drinks = await prisma.drink.findMany({
      select: { id: true, name: true, price: true },
    });

    const suspiciousDrinks = drinks.filter((d) => {
      const num = Number(d.price || 0);
      // If price is > 1000, it might be stored as cents instead of dollars
      return num > 1000;
    });

    console.log(`Total drinks: ${drinks.length}`);
    console.log(`Suspicious prices (>$1000): ${suspiciousDrinks.length}`);
    if (suspiciousDrinks.length > 0) {
      console.log('  Examples:');
      suspiciousDrinks.slice(0, 5).forEach((d) => {
        console.log(`  - ${d.name}: ${d.price} (might be ${(Number(d.price) / 100).toFixed(2)})`);
      });
    }
    console.log('');

    // Audit Food Items
    console.log('📍 FOOD ITEMS AUDIT');
    const foods = await prisma.foodItem.findMany({
      select: { id: true, name: true, price: true },
    });

    const suspiciousFoods = foods.filter((f) => {
      const num = Number(f.price || 0);
      return num > 1000;
    });

    console.log(`Total food items: ${foods.length}`);
    console.log(`Suspicious prices (>$1000): ${suspiciousFoods.length}`);
    if (suspiciousFoods.length > 0) {
      console.log('  Examples:');
      suspiciousFoods.slice(0, 5).forEach((f) => {
        console.log(`  - ${f.name}: ${f.price} (might be ${(Number(f.price) / 100).toFixed(2)})`);
      });
    }
    console.log('');

    // Audit Inventory Items
    console.log('📍 INVENTORY ITEMS AUDIT');
    const inventory = await prisma.inventoryItem.findMany({
      select: { id: true, name: true, unitPrice: true },
    });

    const suspiciousInventory = inventory.filter((i) => {
      const num = Number(i.unitPrice || 0);
      return num > 1000;
    });

    console.log(`Total inventory items: ${inventory.length}`);
    console.log(`Suspicious prices (>$1000): ${suspiciousInventory.length}`);
    if (suspiciousInventory.length > 0) {
      console.log('  Examples:');
      suspiciousInventory.slice(0, 5).forEach((i) => {
        console.log(
          `  - ${i.name}: ${i.unitPrice} (might be ${(Number(i.unitPrice) / 100).toFixed(2)})`
        );
      });
    }
    console.log('');

    // Summary
    console.log('📊 SUMMARY');
    const totalSuspicious =
      suspiciousDrinks.length + suspiciousFoods.length + suspiciousInventory.length;
    console.log(`Total items with suspicious prices: ${totalSuspicious}`);

    if (totalSuspicious === 0) {
      console.log('✅ All prices appear to be in standard format (dollars)');
    } else {
      console.log('⚠️  Found items that might need migration');
      console.log('   Run migration script to standardize if confirmed');
    }
  } catch (error) {
    console.error('❌ Audit failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

auditPrices();

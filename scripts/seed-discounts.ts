/**
 * Discount Seeding Script
 * 
 * Creates sample discount rules with various types and configurations:
 * - Percentage discounts (seasonal, customer loyalty)
 * - Fixed amount discounts
 * - Employee discounts
 * - Department-specific discounts
 * - Time-limited promotions
 * 
 * Usage: npx ts-node scripts/seed-discounts.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedDiscounts() {
  try {
    console.log('🔄 Seeding discount rules...\n');

    // Get current date for time window examples
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const nextYear = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    // Sample discount rules
    const discounts = [
      // Active percentage discount - Summer promo
      {
        code: 'SUMMER2025',
        name: 'Summer Special',
        description: '15% off all food and beverages',
        type: 'percentage',
        value: 15,
        startDate: twoMonthsAgo,
        endDate: nextMonth,
        minOrderAmount: 1000, // $10 minimum
        maxUsagePerCustomer: 5,
        maxTotalUsage: 100,
        applicableDepts: JSON.stringify(['RESTAURANT', 'BAR_CLUB']),
        isActive: true,
      },

      // Active fixed discount - Happy hour
      {
        code: 'HAPPY20',
        name: 'Happy Hour Special',
        description: 'Get $2 off any drink order',
        type: 'fixed',
        value: 200, // $2 in cents
        startDate: twoMonthsAgo,
        endDate: nextYear,
        minOrderAmount: 300, // $3 minimum
        maxUsagePerCustomer: 3,
        maxTotalUsage: 500,
        applicableDepts: JSON.stringify(['BAR_CLUB']),
        isActive: true,
      },

      // Active employee discount
      {
        code: 'EMPLOYEE15',
        name: 'Employee Discount',
        description: '15% off employee meals',
        type: 'percentage',
        value: 15,
        startDate: twoMonthsAgo,
        endDate: nextYear,
        minOrderAmount: 0,
        maxUsagePerCustomer: null, // Unlimited per employee
        maxTotalUsage: null,
        applicableDepts: JSON.stringify(['RESTAURANT']),
        isActive: true,
      },

      // Upcoming promo
      {
        code: 'NEWYEAR25',
        name: 'New Year 2025 Celebration',
        description: '20% off all items during New Year week',
        type: 'percentage',
        value: 20,
        startDate: tomorrow,
        endDate: nextWeek,
        minOrderAmount: 2000, // $20 minimum
        maxUsagePerCustomer: 1,
        maxTotalUsage: 50,
        applicableDepts: JSON.stringify([]),
        isActive: true,
      },

      // Bulk order discount
      {
        code: 'BULK50',
        name: 'Bulk Order Discount',
        description: '$5 off orders $50 and above',
        type: 'fixed',
        value: 500, // $5 in cents
        startDate: twoMonthsAgo,
        endDate: nextYear,
        minOrderAmount: 5000, // $50 minimum
        maxUsagePerCustomer: 10,
        maxTotalUsage: 200,
        applicableDepts: JSON.stringify([]),
        isActive: true,
      },

      // Weekend special
      {
        code: 'WEEKEND10',
        name: 'Weekend Special',
        description: '10% off weekend orders',
        type: 'percentage',
        value: 10,
        startDate: twoMonthsAgo,
        endDate: nextYear,
        minOrderAmount: 500, // $5 minimum
        maxUsagePerCustomer: 2,
        maxTotalUsage: 300,
        applicableDepts: JSON.stringify(['RESTAURANT', 'BAR_CLUB']),
        isActive: true,
      },

      // Loyalty program
      {
        code: 'LOYALTY25',
        name: 'Loyalty Member',
        description: '25% off for premium members',
        type: 'percentage',
        value: 25,
        startDate: twoMonthsAgo,
        endDate: nextYear,
        minOrderAmount: 0,
        maxUsagePerCustomer: null,
        maxTotalUsage: null,
        applicableDepts: JSON.stringify([]),
        isActive: true,
      },

      // Limited time offer
      {
        code: 'FLASH10',
        name: 'Flash Sale',
        description: '10% off today only',
        type: 'percentage',
        value: 10,
        startDate: now,
        endDate: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 24 hours
        minOrderAmount: 800, // $8 minimum
        maxUsagePerCustomer: 1,
        maxTotalUsage: 100,
        applicableDepts: JSON.stringify(['RESTAURANT']),
        isActive: true,
      },

      // Inactive/expired discount
      {
        code: 'EXPIRED2024',
        name: 'Last Year Promo',
        description: 'This discount has expired',
        type: 'percentage',
        value: 20,
        startDate: new Date(2024, 0, 1),
        endDate: new Date(2024, 11, 31),
        minOrderAmount: 1000,
        maxUsagePerCustomer: 5,
        maxTotalUsage: 50,
        applicableDepts: JSON.stringify([]),
        isActive: false,
      },

      // Referral bonus
      {
        code: 'REFER100',
        name: 'Referral Bonus',
        description: 'Refer a friend and get $1 off your next order',
        type: 'fixed',
        value: 100, // $1 in cents
        startDate: twoMonthsAgo,
        endDate: nextYear,
        minOrderAmount: 500, // $5 minimum
        maxUsagePerCustomer: 5,
        maxTotalUsage: null,
        applicableDepts: JSON.stringify([]),
        isActive: true,
      },

      // First-time customer
      {
        code: 'WELCOME20',
        name: 'Welcome to [Restaurant]',
        description: '20% off your first order',
        type: 'percentage',
        value: 20,
        startDate: twoMonthsAgo,
        endDate: nextYear,
        minOrderAmount: 1000, // $10 minimum
        maxUsagePerCustomer: 1,
        maxTotalUsage: 200,
        applicableDepts: JSON.stringify([]),
        isActive: true,
      },
    ];

    // Clear existing discounts (optional - comment out to keep existing)
    console.log('🗑️  Clearing existing discount rules...');
    await prisma.discountRule.deleteMany({});
    console.log('✅ Cleared existing discount rules\n');

    // Create all discounts
    console.log('📝 Creating new discount rules...');
    const created = await Promise.all(
      discounts.map((discount) =>
        prisma.discountRule.create({
          data: {
            code: discount.code,
            name: discount.name,
            description: discount.description,
            type: discount.type,
            value: discount.value,
            startDate: discount.startDate,
            endDate: discount.endDate,
            minOrderAmount: discount.minOrderAmount,
            maxUsagePerCustomer: discount.maxUsagePerCustomer,
            maxTotalUsage: discount.maxTotalUsage,
            currentUsage: 0,
            applicableDepts: discount.applicableDepts,
            isActive: discount.isActive,
          },
        })
      )
    );

    console.log(`✅ Created ${created.length} discount rules\n`);

    // Print summary
    console.log('📊 Discount Summary:');
    console.log('─'.repeat(60));
    
    const activeDiscounts = created.filter(d => d.isActive && new Date() >= (d.startDate || new Date()));
    const upcomingDiscounts = created.filter(d => d.isActive && (d.startDate || new Date()) > new Date());
    const inactiveDiscounts = created.filter(d => !d.isActive);

    console.log(`Currently Active:    ${activeDiscounts.length}`);
    console.log(`Upcoming:            ${upcomingDiscounts.length}`);
    console.log(`Inactive/Expired:    ${inactiveDiscounts.length}`);
    console.log('─'.repeat(60));

    console.log('\n🎯 Sample Codes for Testing:');
    const activeCodes = activeDiscounts.slice(0, 5);
    activeCodes.forEach((discount) => {
      const depts = JSON.parse(discount.applicableDepts);
      const deptStr = depts.length > 0 ? ` (${depts.join(', ')})` : ' (all departments)';
      console.log(`  • ${discount.code.padEnd(15)} - ${discount.name}${deptStr}`);
    });

    console.log('\n✨ Discount seeding complete!');
  } catch (error) {
    console.error('❌ Error seeding discounts:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedDiscounts();

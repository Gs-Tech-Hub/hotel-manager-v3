#!/usr/bin/env node

/**
 * Export Database from Prisma Accelerate
 * 
 * This script exports all data from Prisma Accelerate into a JSON file
 * that can be imported into local PostgreSQL.
 * 
 * Usage:
 *   npm run export:accelerate
 */

import * as fs from 'fs';
import * as path from 'path'; 
import { prisma } from '@/lib/auth/prisma';

const OUTPUT_DIR = path.join(process.cwd(), 'migration-dumps');

// Ensure output directory exists
function ensureOutputDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✓ Created output directory: ${dir}`);
  }
}

interface ExportData {
  timestamp: string;
  tables: Record<string, any[]>;
  stats: Record<string, number>;
}

async function exportDataFromAccelerate(): Promise<ExportData> {
  console.log('\n🚀 Starting export from Prisma Accelerate...\n');

  const exportData: ExportData = {
    timestamp: new Date().toISOString(),
    tables: {},
    stats: {}
  };

  try {
    // ALL 103 models from schema.prisma - exported in dependency order
    const tablesToExport = [
      // RBAC & Auth (no dependencies)
      'Permission',
      'Role',
      'AdminUser',
      'AdminRole',
      'AdminPermission',
      'ApiToken',
      'TransferToken',
      
      // RBAC relationships
      'RolePermission',
      'UserPermission',
      'TokenPermission',
      'ApiTokenPermission',
      'TransferTokenPermission',
      
      // Base entities
      'Department',
      'DepartmentSection',
      'InventoryType',
      'FoodType',
      'DrinkType',
      'PaymentType',
      'GameType',
      'RoomType',
      'MenuCategory',
      'MembershipPlan',
      
      // Inventory
      'InventoryItem',
      'InventoryMovement',
      'DepartmentInventory',
      'InventoryReservation',
      'ServiceInventory',
      
      // Food & Drinks
      'FoodItem',
      'Drink',
      
      // Orders & Payments
      'OrderHeader',
      'OrderLine',
      'OrderDepartment',
      'OrderDiscount',
      'OrderPayment',
      'OrderFulfillment',
      'OrderExtra',
      'Extra',
      'DepartmentExtra',
      'DiscountRule',
      'Order',
      'Payment',
      'PaymentDetail',
      
      // Users & Roles (unified)
      'User',
      'UserRole',
      'UserPermission',
      
      // Facilities
      'Room',
      'Amenity',
      'Bed',
      'FloorPlan',
      'Terminal',
      'Terminal',
      
      // Customers & Booking
      'Customer',
      'Booking',
      'BookingItem',
      'CheckIn',
      
      // Departments & Services
      'Restaurant',
      'BarAndClub',
      'ServiceInventory',
      'ServiceUsageSession',
      'HotelService',
      
      // Transfers
      'DepartmentTransfer',
      'DepartmentTransferItem',
      
      // Entertainment
      'Game',
      'GameSession',
      'GymAndSport',
      'GymAndSportSession',
      'GymMembership',
      'SportMembership',
      'PluginUsersPermissionsUser',
      
      // Employees
      'EmployeeOrder',
      'EmployeeRecord',
      'EmployeeSummary',
      'EmploymentData',
      'EmployeeLeave',
      'EmployeeCharge',
      'EmployeeTermination',
      'SalaryPayment',
      
      // Projects & Expenses
      'Project',
      'Expense',
      'Vendor',
      'ProductCount',
      'Schedule',
      
      // CMS & Settings
      'Article',
      'Author',
      'Category',
      'Slider',
      'Carousel',
      'About',
      'Service',
      'Global',
      'OrganisationInfo',
      'ExchangeRate',
      'SpecialInfo',
      'TaxSettings',
      
      // Facilities Management
      'Guest',
      'Unit',
      'Reservation',
      'PricingOverride',
      'CleaningRoutine',
      'CleaningTask',
      'CleaningLog',
      'MaintenanceRequest',
      'MaintenanceLog',
      'UnitStatusHistory',
      
      // Other
      'PromoCoupon',
      'JobApplication',
      'AdminAuditLog'
    ];

    let totalRecords = 0;

    for (const table of tablesToExport) {
      try {
        console.log(`📦 Exporting ${table}...`);
        
        // Access model using lowercase key
        const modelKey = table.charAt(0).toLowerCase() + table.slice(1);
        const model = (prisma as any)[modelKey];
        
        if (!model || typeof model.findMany !== 'function') {
          console.warn(`   ⚠️  Model not found: ${table}`);
          continue;
        }
        
        const records = await model.findMany();
        
        exportData.tables[table] = records;
        exportData.stats[table] = records.length;
        totalRecords += records.length;
        
        console.log(`   ✓ ${records.length} records`);
      } catch (error: any) {
        console.warn(`   ⚠️  Failed to export ${table}: ${error.message}`);
      }
    }

    console.log(`\n✓ Export complete!`);
    console.log(`   Total records: ${totalRecords}`);
    console.log(`   Tables exported: ${Object.keys(exportData.tables).length}\n`);

    return exportData;
  } catch (error) {
    console.error('❌ Export failed:', error);
    throw error;
  }
}

async function saveExportFile(data: ExportData): Promise<string> {
  ensureOutputDir(OUTPUT_DIR);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `accelerate-export-${timestamp}.json`;
  const filepath = path.join(OUTPUT_DIR, filename);

  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`✓ Export saved to: ${filepath}`);
  console.log(`  File size: ${(fs.statSync(filepath).size / 1024 / 1024).toFixed(2)} MB`);

  return filepath;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Prisma Accelerate Database Export');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    const exportData = await exportDataFromAccelerate();
    await saveExportFile(exportData);

    console.log('\n✅ Export completed successfully!');
    console.log('\n📌 Next steps:');
    console.log('   1. Switch DATABASE_URL to local PostgreSQL in .env.local');
    console.log('   2. Run: npm run seed:core (to create schema)');
    console.log('   3. Run: npm run import:accelerate (to import this data)\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();

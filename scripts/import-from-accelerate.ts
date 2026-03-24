#!/usr/bin/env node

/**
 * Import Database from Exported JSON
 * 
 * This script imports data from an exported JSON file into the local database.
 * 
 * Usage:
 *   npm run import:accelerate -- <export-file>
 */

import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '@/lib/auth/prisma';
 
interface ExportData {
  timestamp: string;
  tables: Record<string, any[]>;
  stats: Record<string, number>;
}

async function findLatestExportFile(): Promise<string> {
  const dumpDir = path.join(process.cwd(), 'migration-dumps');
  
  if (!fs.existsSync(dumpDir)) {
    throw new Error(`Migration dumps directory not found: ${dumpDir}`);
  }

  const files = fs.readdirSync(dumpDir)
    .filter(f => f.startsWith('accelerate-export-') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) {
    throw new Error('No export files found in migration-dumps directory');
  }

  return path.join(dumpDir, files[0]);
}

async function clearTables(): Promise<void> {
  console.log('\n⚠️  Clearing existing data...\n');

  // Clear in reverse dependency order (children before parents)
  const tablesToClear = [
    'AdminAuditLog',
    'JobApplication',
    'PromoCoupon',
    'UnitStatusHistory',
    'MaintenanceLog',
    'MaintenanceRequest',
    'CleaningLog',
    'CleaningTask',
    'CleaningRoutine',
    'PricingOverride',
    'Reservation',
    'Unit',
    'Guest',
    'GameSession',
    'GameType',
    'TaxSettings',
    'SpecialInfo',
    'ExchangeRate',
    'OrganisationInfo',
    'Global',
    'Service',
    'About',
    'Carousel',
    'Slider',
    'Category',
    'Author',
    'Article',
    'Schedule',
    'ProductCount',
    'Vendor',
    'Expense',
    'Project',
    'SalaryPayment',
    'EmployeeTermination',
    'EmployeeCharge',
    'EmployeeLeave',
    'EmploymentData',
    'EmployeeSummary',
    'EmployeeRecord',
    'EmployeeOrder',
    'PluginUsersPermissionsUser',
    'SportMembership',
    'GymMembership',
    'GymAndSportSession',
    'GymAndSport',
    'GameSession',
    'Game',
    'DepartmentTransferItem',
    'DepartmentTransfer',
    'HotelService',
    'ServiceUsageSession',
    'ServiceInventory',
    'BarAndClub',
    'Restaurant',
    'CheckIn',
    'BookingItem',
    'Booking',
    'Customer',
    'FloorPlan',
    'Bed',
    'Amenity',
    'Room',
    'OrderExtra',
    'Extra',
    'OrderFulfillment',
    'OrderPayment',
    'OrderDepartment',
    'OrderDiscount',
    'OrderLine',
    'OrderHeader',
    'PaymentDetail',
    'Payment',
    'Order',
    'DepartmentExtra',
    'DiscountRule',
    'InventoryReservation',
    'DepartmentInventory',
    'InventoryMovement',
    'InventoryItem',
    'Drink',
    'FoodItem',
    'MenuCategory',
    'DrinkType',
    'FoodType',
    'MembershipPlan',
    'GameType',
    'RoomType',
    'PaymentType',
    'Terminal',
    'ServiceInventory',
    'DepartmentSection',
    'Department',
    'TransferTokenPermission',
    'TransferToken',
    'ApiTokenPermission',
    'ApiToken',
    'UserPermission',
    'UserRole',
    'User',
    'AdminPermission',
    'AdminRole',
    'AdminUser',
    'TokenPermission',
    'RolePermission',
    'Role',
    'Permission'
  ];

  for (const tableName of tablesToClear) {
    try {
      // Convert PascalCase to camelCase: AdminUser -> adminUser
      const modelKey = tableName.charAt(0).toLowerCase() + tableName.slice(1);
      const model = (prisma as any)[modelKey];
      
      if (!model || !model.deleteMany) continue;
      
      const result = await model.deleteMany({});
      if (result.count > 0) {
        console.log(`   ✓ Cleared ${tableName}: ${result.count} records`);
      }
    } catch (error: any) {
      // Silently skip tables that don't exist or can't be cleared
      if (!error.message.includes('Unknown model')) {
        console.warn(`   ⚠️  Could not clear ${tableName}: ${error.message}`);
      }
    }
  }

  console.log('');
}

async function importData(exportPath: string, shouldClear: boolean = true): Promise<void> {
  console.log(`\n📂 Loading export file: ${exportPath}`);

  if (!fs.existsSync(exportPath)) {
    throw new Error(`Export file not found: ${exportPath}`);
  }

  const fileContent = fs.readFileSync(exportPath, 'utf-8');
  const exportData: ExportData = JSON.parse(fileContent);

  console.log(`⏰ Export timestamp: ${exportData.timestamp}`);
  console.log(`📊 Tables to import: ${Object.keys(exportData.tables).length}\n`);

  if (shouldClear) {
    await clearTables();
  }

  const importOrder = [
    // ========== PHASE 1: RBAC & AUTH (no dependencies) ==========
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
    
    // ========== PHASE 2: LOOKUP TABLES (no dependencies) ==========
    'InventoryType',
    'FoodType',
    'DrinkType',
    'PaymentType',
    'GameType',
    'RoomType',
    'MenuCategory',
    'MembershipPlan',
    
    // ========== PHASE 3: ORGANIZATIONAL (Terminal before DepartmentSection) ==========
    'Department',
    'Terminal',
    'DepartmentSection',
    
    // ========== PHASE 4: USER TABLE (for employee relations) ==========
    'PluginUsersPermissionsUser',
    'User',
    'UserRole',
    
    // ========== PHASE 5: FACILITIES (no external deps) ==========
    'Room',
    'Amenity',
    'Bed',
    'FloorPlan',
    'Unit',
    
    // ========== PHASE 6: INVENTORY (InventoryItem before movements) ==========
    'InventoryItem',
    'InventoryMovement',
    'DepartmentInventory',
    'InventoryReservation',
    
    // ========== PHASE 7: SERVICES (ServiceInventory for ServiceUsageSession) ==========
    'ServiceInventory',
    'HotelService',
    
    // ========== PHASE 8: FOOD & DRINKS (FoodItem/Drink depend on types + Restaurant/Bar) ==========
    'FoodItem',
    'Drink',
    
    // ========== PHASE 9: CUSTOMER (core entity) ==========
    'Customer',
    'PaymentDetail',
    
    // ========== PHASE 10: PAYMENTS (Payment before Booking and Order) ==========
    'Payment',
    
    // ========== PHASE 11: RESTAURANTS & BARS (before Booking) ==========
    'Restaurant',
    'BarAndClub',
    
    // ========== PHASE 12: BOOKINGS (depends on Customer, Unit, Payment, Restaurant, BarAndClub) ==========
    'Booking',
    'BookingItem',
    'CheckIn',
    
    // ========== PHASE 13: GAMES & ENTERTAINMENT ==========
    'Game',
    'GymAndSport',
    'GymAndSportSession',
    'GymMembership',
    'SportMembership',
    
    // ========== PHASE 14: DISCOUNTS (before Order system) ==========
    'DiscountRule',
    
    // ========== PHASE 15: ORDER SYSTEM (OrderHeader must come before GameSession) ==========
    'OrderHeader',
    'OrderLine',
    'OrderDepartment',
    'OrderDiscount',
    'OrderPayment',
    'OrderFulfillment',
    'Extra',
    'OrderExtra',
    'DepartmentExtra',
    'Order',
    
    // ========== PHASE 16: SERVICE SESSIONS (depends on ServiceInventory, Customer, Order) ==========
    'ServiceUsageSession',
    
    // ========== PHASE 17: GAME SESSIONS (depends on OrderHeader) ==========
    'GameSession',
    
    // ========== PHASE 18: TRANSFERS (Department transfers) ==========
    'DepartmentTransfer',
    'DepartmentTransferItem',
    
    // ========== PHASE 19: EMPLOYEE RECORDS (PluginUsersPermissionsUser already imported) ==========
    'EmployeeOrder',
    'EmployeeRecord',
    'EmployeeSummary',
    'EmploymentData',
    'EmployeeLeave',
    'EmployeeCharge',
    'EmployeeTermination',
    'SalaryPayment',
    
    // ========== PHASE 20: PROJECTS & EXPENSES ==========
    'Project',
    'Expense',
    'Vendor',
    'ProductCount',
    'Schedule',
    
    // ========== PHASE 21: CMS & METADATA ==========
    'Author',
    'Category',
    'Article',
    'Slider',
    'Carousel',
    'About',
    'Service',
    'Global',
    'OrganisationInfo',
    'ExchangeRate',
    'SpecialInfo',
    'TaxSettings',
    
    // ========== PHASE 22: FACILITIES MANAGEMENT ==========
    'Guest',
    'Reservation',
    'PricingOverride',
    'CleaningRoutine',
    'CleaningTask',
    'CleaningLog',
    'MaintenanceRequest',
    'MaintenanceLog',
    'UnitStatusHistory',
    
    // ========== PHASE 23: MISCELLANEOUS ==========
    'PromoCoupon',
    'JobApplication',
    'AdminAuditLog'
  ];

  let importedRecords = 0;
  let skippedRecords = 0;

  for (const tableName of importOrder) {
    if (!exportData.tables[tableName]) {
      continue;
    }

    const records = exportData.tables[tableName];
    if (records.length === 0) {
      console.log(`📦 ${tableName}: 0 records (skipped)`);
      continue;
    }

    try {
      console.log(`📦 Importing ${tableName}... (${records.length} records)`);

      // Convert PascalCase to camelCase: AdminUser -> adminUser
      const modelKey = tableName.charAt(0).toLowerCase() + tableName.slice(1);
      const model = (prisma as any)[modelKey];
      
      if (!model || typeof model.create !== 'function') {
        console.warn(`   ⚠️  Model not found or not accessible: ${tableName}`);
        continue;
      }
      
      let successCount = 0;
      let errorCount = 0;
      
      for (const record of records) {
        try {
          await model.create({ data: record });
          successCount++;
        } catch (error: any) {
          // Skip if duplicate or constraint violation
          if (error.code === 'P2002' || error.code === 'P2003') {
            skippedRecords++;
            errorCount++;
            continue;
          }
          throw error;
        }
      }

      importedRecords += successCount;
      console.log(`   ✓ Imported ${successCount} records${errorCount > 0 ? ` (${errorCount} duplicates skipped)` : ''}`);
    } catch (error: any) {
      console.error(`   ❌ Failed to import ${tableName}: ${error.message}`);
      throw error;
    }
  }

  console.log(`\n✅ Import completed!`);
  console.log(`   Total records imported: ${importedRecords}`);
  if (skippedRecords > 0) {
    console.log(`   Records skipped (duplicates): ${skippedRecords}`);
  }
  console.log('');
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Database Import from Accelerate Export');
  console.log('═══════════════════════════════════════════════════════');

  try {
    const exportPath = process.argv[2] || await findLatestExportFile();
    const shouldClear = !process.argv.includes('--no-clear');
    
    if (shouldClear) {
      console.log('\n⚠️  WARNING: This will CLEAR all existing data');
      console.log('   Use --no-clear flag to preserve existing data');
    }
    console.log('   Ensure you are connected to the LOCAL database first!\n');
    
    await importData(exportPath, shouldClear);

    console.log('✅ Import completed successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();

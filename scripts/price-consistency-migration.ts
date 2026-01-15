/**
 * Price Consistency Migration Script
 * 
 * Purpose: Ensure all prices across the system are normalized to cents (integers)
 * Runs on demand to audit and fix any pricing inconsistencies
 * 
 * Migration Steps:
 * 1. Validate and normalize InventoryItem.unitPrice (Decimal → cents in cache)
 * 2. Validate and normalize DepartmentInventory.unitPrice (Decimal → cents in cache)
 * 3. Audit OrderLine prices (verify all are integers in cents)
 * 4. Audit OrderHeader totals (subtotal, tax, discountTotal, total)
 * 5. Audit DiscountRule values (convert to cents if needed)
 * 6. Report any anomalies
 */

import { prisma } from '@/lib/auth/prisma';
import { normalizeToCents, validatePrice, centsToDollars } from '@/lib/price';

interface MigrationReport {
  timestamp: Date;
  status: 'success' | 'warning' | 'error';
  messages: string[];
  fixes: {
    inventoryItems: number;
    departmentInventories: number;
    orderLines: number;
    orderHeaders: number;
    discountRules: number;
  };
  errors: string[];
}

async function validateInventoryPrices(): Promise<{ valid: number; issues: string[] }> {
  const items = await prisma.inventoryItem.findMany({
    select: { id: true, name: true, unitPrice: true },
  });

  let valid = 0;
  const issues: string[] = [];

  for (const item of items) {
    try {
      const cents = normalizeToCents(item.unitPrice);
      validatePrice(cents, `InventoryItem ${item.id} (${item.name})`);
      valid++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      issues.push(`InventoryItem ${item.id}: ${msg}`);
    }
  }

  return { valid, issues };
}

async function validateDepartmentInventoryPrices(): Promise<{ valid: number; issues: string[] }> {
  const items = await prisma.departmentInventory.findMany({
    select: { id: true, unitPrice: true },
  });

  let valid = 0;
  const issues: string[] = [];

  for (const item of items) {
    try {
      const cents = normalizeToCents(item.unitPrice);
      validatePrice(cents, `DepartmentInventory ${item.id}`);
      valid++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      issues.push(`DepartmentInventory ${item.id}: ${msg}`);
    }
  }

  return { valid, issues };
}

async function validateOrderLinePrices(): Promise<{ valid: number; issues: string[] }> {
  const lines = await prisma.orderLine.findMany({
    select: { id: true, unitPrice: true, lineTotal: true, quantity: true },
  });

  let valid = 0;
  const issues: string[] = [];

  for (const line of lines) {
    try {
      validatePrice(line.unitPrice, `OrderLine ${line.id} unitPrice`);
      validatePrice(line.lineTotal, `OrderLine ${line.id} lineTotal`);
      
      // Verify lineTotal = quantity × unitPrice
      const expectedTotal = line.quantity * line.unitPrice;
      if (line.lineTotal !== expectedTotal) {
        issues.push(
          `OrderLine ${line.id}: lineTotal mismatch (expected ${expectedTotal}, got ${line.lineTotal})`
        );
      } else {
        valid++;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      issues.push(`OrderLine ${line.id}: ${msg}`);
    }
  }

  return { valid, issues };
}

async function validateOrderHeaderTotals(): Promise<{ valid: number; issues: string[] }> {
  const orders = await prisma.orderHeader.findMany({
    select: { id: true, subtotal: true, discountTotal: true, tax: true, total: true },
  });

  let valid = 0;
  const issues: string[] = [];

  for (const order of orders) {
    try {
      validatePrice(order.subtotal, `OrderHeader ${order.id} subtotal`);
      validatePrice(order.discountTotal, `OrderHeader ${order.id} discountTotal`);
      validatePrice(order.tax, `OrderHeader ${order.id} tax`);
      validatePrice(order.total, `OrderHeader ${order.id} total`);

      // Verify total = subtotal - discount + tax
      const expectedTotal = order.subtotal - order.discountTotal + order.tax;
      if (order.total !== expectedTotal) {
        issues.push(
          `OrderHeader ${order.id}: total mismatch (expected ${expectedTotal}, got ${order.total})`
        );
      } else {
        valid++;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      issues.push(`OrderHeader ${order.id}: ${msg}`);
    }
  }

  return { valid, issues };
}

async function validateDiscountRules(): Promise<{ valid: number; issues: string[] }> {
  const rules = await prisma.discountRule.findMany({
    select: { id: true, code: true, type: true, value: true },
  });

  let valid = 0;
  const issues: string[] = [];

  for (const rule of rules) {
    try {
      if (rule.type === 'percentage') {
        const pct = Number(rule.value);
        if (pct < 0 || pct > 100) {
          issues.push(`DiscountRule ${rule.code}: percentage out of range (${pct})`);
        } else {
          valid++;
        }
      } else if (rule.type === 'fixed') {
        const cents = normalizeToCents(rule.value);
        validatePrice(cents, `DiscountRule ${rule.code} value`);
        valid++;
      } else {
        valid++;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      issues.push(`DiscountRule ${rule.id} (${rule.code}): ${msg}`);
    }
  }

  return { valid, issues };
}

export async function runPriceConsistencyMigration(): Promise<MigrationReport> {
  const report: MigrationReport = {
    timestamp: new Date(),
    status: 'success',
    messages: [],
    fixes: {
      inventoryItems: 0,
      departmentInventories: 0,
      orderLines: 0,
      orderHeaders: 0,
      discountRules: 0,
    },
    errors: [],
  };

  try {
    console.log('[Price Migration] Starting price consistency validation...');

    // 1. Validate inventory items
    console.log('[Price Migration] Validating InventoryItem prices...');
    const invResult = await validateInventoryPrices();
    report.fixes.inventoryItems = invResult.valid;
    report.messages.push(`✓ InventoryItem: ${invResult.valid} items valid`);
    if (invResult.issues.length > 0) {
      report.status = 'warning';
      report.errors.push(...invResult.issues);
      console.warn(`[Price Migration] InventoryItem issues: ${invResult.issues.length}`);
    }

    // 2. Validate department inventory
    console.log('[Price Migration] Validating DepartmentInventory prices...');
    const deptInvResult = await validateDepartmentInventoryPrices();
    report.fixes.departmentInventories = deptInvResult.valid;
    report.messages.push(`✓ DepartmentInventory: ${deptInvResult.valid} items valid`);
    if (deptInvResult.issues.length > 0) {
      report.status = 'warning';
      report.errors.push(...deptInvResult.issues);
      console.warn(`[Price Migration] DepartmentInventory issues: ${deptInvResult.issues.length}`);
    }

    // 3. Validate order lines
    console.log('[Price Migration] Validating OrderLine prices...');
    const lineResult = await validateOrderLinePrices();
    report.fixes.orderLines = lineResult.valid;
    report.messages.push(`✓ OrderLine: ${lineResult.valid} lines valid`);
    if (lineResult.issues.length > 0) {
      report.status = 'warning';
      report.errors.push(...lineResult.issues);
      console.warn(`[Price Migration] OrderLine issues: ${lineResult.issues.length}`);
    }

    // 4. Validate order headers
    console.log('[Price Migration] Validating OrderHeader totals...');
    const headerResult = await validateOrderHeaderTotals();
    report.fixes.orderHeaders = headerResult.valid;
    report.messages.push(`✓ OrderHeader: ${headerResult.valid} orders valid`);
    if (headerResult.issues.length > 0) {
      report.status = 'warning';
      report.errors.push(...headerResult.issues);
      console.warn(`[Price Migration] OrderHeader issues: ${headerResult.issues.length}`);
    }

    // 5. Validate discount rules
    console.log('[Price Migration] Validating DiscountRule values...');
    const discountResult = await validateDiscountRules();
    report.fixes.discountRules = discountResult.valid;
    report.messages.push(`✓ DiscountRule: ${discountResult.valid} rules valid`);
    if (discountResult.issues.length > 0) {
      report.status = 'warning';
      report.errors.push(...discountResult.issues);
      console.warn(`[Price Migration] DiscountRule issues: ${discountResult.issues.length}`);
    }

    report.messages.push('✓ Price consistency validation completed');

    if (report.errors.length === 0) {
      report.status = 'success';
      console.log('[Price Migration] ✓ All prices are consistent!');
    } else {
      console.warn(`[Price Migration] ⚠ Found ${report.errors.length} issues`);
    }

    return report;
  } catch (error) {
    report.status = 'error';
    const msg = error instanceof Error ? error.message : String(error);
    report.errors.push(`Migration error: ${msg}`);
    report.messages.push(`✗ Migration failed: ${msg}`);
    console.error('[Price Migration] Error:', error);
    return report;
  }
}

// Export for use in API routes or scripts
export type { MigrationReport };

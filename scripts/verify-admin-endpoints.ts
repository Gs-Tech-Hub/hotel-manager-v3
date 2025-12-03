#!/usr/bin/env node

/**
 * Verification script to test admin dashboard endpoints
 * Run with: npx ts-node scripts/verify-admin-endpoints.ts
 */

import { prisma } from '@/lib/prisma';

async function testDepartmentsAPI() {
  console.log('\n✓ Testing Departments API...');
  try {
    const depts = await prisma.department.findMany({ take: 3 });
    console.log(`  Found ${depts.length} departments`);
    if (depts.length > 0) {
      console.log(`  Sample: ${depts[0].name} (${depts[0].code})`);
    }
    return true;
  } catch (err) {
    console.error('  ✗ Failed:', err);
    return false;
  }
}

async function testInventoryAPI() {
  console.log('\n✓ Testing Inventory API...');
  try {
    const items = await prisma.inventoryItem.findMany({ take: 3 });
    console.log(`  Found ${items.length} inventory items`);
    if (items.length > 0) {
      console.log(`  Sample: ${items[0].name} (SKU: ${items[0].sku})`);
    }
    return true;
  } catch (err) {
    console.error('  ✗ Failed:', err);
    return false;
  }
}

async function testDiscountsAPI() {
  console.log('\n✓ Testing Discounts API...');
  try {
    const discounts = await prisma.discountRule.findMany({ take: 3 });
    console.log(`  Found ${discounts.length} discount rules`);
    if (discounts.length > 0) {
      console.log(`  Sample: ${discounts[0].name} (${discounts[0].code})`);
    }
    return true;
  } catch (err) {
    console.error('  ✗ Failed:', err);
    return false;
  }
}

async function testDepartmentSectionsAPI() {
  console.log('\n✓ Testing Department Sections API...');
  try {
    const sections = await prisma.departmentSection.findMany({ take: 3 });
    console.log(`  Found ${sections.length} department sections`);
    if (sections.length > 0) {
      console.log(`  Sample: ${sections[0].name}`);
    }
    return true;
  } catch (err) {
    console.error('  ✗ Failed:', err);
    return false;
  }
}

async function testEmployeesAPI() {
  console.log('\n✓ Testing Employees API...');
  try {
    const employees = await prisma.pluginUsersPermissionsUser.findMany({ take: 3 });
    console.log(`  Found ${employees.length} employees`);
    if (employees.length > 0) {
      console.log(`  Sample: ${employees[0].username} (${employees[0].email})`);
    }
    return true;
  } catch (err) {
    console.error('  ✗ Failed:', err);
    return false;
  }
}

async function testPermissions() {
  console.log('\n✓ Testing Admin Permissions...');
  try {
    const requiredPerms = [
      'departments.create',
      'departments.delete',
      'department_sections.create',
      'department_sections.delete',
      'inventory_items.create',
      'inventory_items.delete',
      'discounts.create',
      'discounts.delete',
      'employees.create',
      'employees.delete',
    ];

    const adminRole = await prisma.role.findFirst({
      where: { name: { contains: 'admin' } },
      include: { rolePermissions: { include: { permission: true } } },
    });

    if (!adminRole) {
      console.error('  ✗ Admin role not found');
      return false;
    }

    const permsSet = new Set(
      adminRole.rolePermissions.map((rp) => `${rp.permission.action}.${rp.permission.subject}`)
    );
    const missing = requiredPerms.filter((p) => !permsSet.has(p));

    if (missing.length === 0) {
      console.log(`  ✓ All ${requiredPerms.length} permissions present`);
      return true;
    } else {
      console.warn(`  ✗ Missing permissions: ${missing.join(', ')}`);
      return false;
    }
  } catch (err) {
    console.error('  ✗ Failed:', err);
    return false;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Admin Dashboard Endpoint Verification');
  console.log('═══════════════════════════════════════════════════════');

  const results = await Promise.all([
    testDepartmentsAPI(),
    testInventoryAPI(),
    testDiscountsAPI(),
    testDepartmentSectionsAPI(),
    testEmployeesAPI(),
    testPermissions(),
  ]);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  Summary: ${results.filter(Boolean).length}/${results.length} tests passed`);
  console.log('═══════════════════════════════════════════════════════\n');

  if (results.every(Boolean)) {
    console.log('✅ All systems operational! Dashboard is ready to use.');
  } else {
    console.log('⚠️  Some issues detected. Please review above.');
  }
}

main().catch(console.error).finally(() => process.exit(0));

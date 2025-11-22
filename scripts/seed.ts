import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { seedDepartments } from './populate-departments';
import { seedInventoryFromMenu } from './seed-inventory-from-menu';

const prisma = new PrismaClient();

// Small helper to retry transient Prisma errors (fetch failures, transient network)
async function withRetries<T>(fn: () => Promise<T>, attempts = 3, delayMs = 200) {
  let lastErr: any = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      // If it's a known transient code, wait and retry. Otherwise bubble up.
      const transientCodes = ['P5010', 'P2028', 'P6005'];
      const code = err?.code;
      if (!transientCodes.includes(code) && i === attempts - 1) throw err;
      // short backoff
      await new Promise((res) => setTimeout(res, delayMs * Math.pow(2, i)));
    }
  }
  throw lastErr;
}

// Upsert a role by code
async function upsertRole(code: string, name: string, description?: string) {
  const existing = await withRetries(() => prisma.adminRole.findUnique({ where: { code } }));
  if (existing) return existing;
  return withRetries(() => prisma.adminRole.create({ data: { code, name, description } }));
}

// Upsert a permission for a role (idempotent)
async function upsertPermission(roleId: string, action: string, subject: string | null = '*') {
  // Try to find an identical permission (with retries for transient fetch failures)
  const existing = await withRetries(() => prisma.adminPermission.findFirst({ where: { roleId, action, subject } }));
  if (existing) return existing;
  return withRetries(() => prisma.adminPermission.create({ data: { roleId, action, subject, actionParameters: {}, conditions: [], properties: {} } as any }));
}

async function ensureAdminUser(email = process.env.SEED_ADMIN_EMAIL || 'admin@hotel.test', password = process.env.SEED_ADMIN_PASSWORD || 'admin123') {
  // Note: this project does not include a password hashing utility in dependencies by default.
  // For demo/dev seeding we store the password as plain text. If your auth layer expects hashed passwords,
  // update this function to hash the password before creating the user (e.g., using bcrypt).

  const existing = await withRetries(() => prisma.adminUser.findUnique({ where: { email } }));
  if (existing) {
    // Ensure active and username exists (do not change password on re-seed)
    await withRetries(() => prisma.adminUser.update({ where: { email }, data: { isActive: true, username: existing.username || 'admin' } }));
    const found = await withRetries(() => prisma.adminUser.findUnique({ where: { email } }));
    if (!found) throw new Error('Failed to load existing admin user after update');
    return found;
  }
  const hashed = await bcrypt.hash(password, 10);
  return withRetries(() => prisma.adminUser.create({ data: { email, username: 'admin', password: hashed, isActive: true } }));
}

async function seedRolesAndAdmin() {
  console.log('Seeding roles and admin user...');

  const roles = [
    { code: 'admin', name: 'Administrator', description: 'Full system administrator' },
    { code: 'manager', name: 'Manager', description: 'Manager with elevated permissions' },
    { code: 'staff', name: 'Staff', description: 'General staff user' },
  ];

  const roleMap: Record<string, any> = {};
  for (const r of roles) {
    const role = await upsertRole(r.code, r.name, r.description);
    roleMap[r.code] = role;
  }

  // Give admin role a broad permission
  if (roleMap.admin) {
    await upsertPermission(roleMap.admin.id, 'manage', '*');
  }

  // Ensure admin user exists and is assigned the admin role
  const adminUser = await ensureAdminUser();
  if (!adminUser) throw new Error('Failed to create or find admin user');

  // Manager default permissions
  if (roleMap.manager) {
    const managerPerms: Array<[string, string]> = [
      ['manage', 'Order'],
      ['manage', 'Department'],
      ['manage', 'Restaurant'],
      ['manage', 'Drink'],
      ['read', 'AdminUser'],
    ];
    for (const [action, subject] of managerPerms) await upsertPermission(roleMap.manager.id, action, subject);
  }

  // Staff default permissions
  if (roleMap.staff) {
    const staffPerms: Array<[string, string]> = [
      ['read', 'Order'],
      ['create', 'Order'],
      ['update', 'Order'],
    ];
    for (const [action, subject] of staffPerms) await upsertPermission(roleMap.staff.id, action, subject);
  }

  // Assign role if missing
  const adminHasRole = await prisma.adminUser.findFirst({ where: { id: adminUser.id, roles: { some: { id: roleMap.admin.id } } } });
  if (!adminHasRole) {
    await prisma.adminUser.update({ where: { id: adminUser.id }, data: { roles: { connect: { id: roleMap.admin.id } } } });
  }

  console.log(`Admin user ready: ${adminUser.email}`);
}

// Remove previously seeded demo/test data (destructive). Controlled by SEED_CLEAN env var.
async function cleanPreviousSeeds() {
  console.log('Cleaning previous demo seeds...');
  // We'll remove demo orders, order lines, payments, demo food/drink items and sample restaurants/bars
  // Delete in order to respect foreign key constraints
  try {
    // Non-transactional, stepwise cleanup to avoid long-running transaction timeouts
    // Find demo customer
    const demoCustomer = await prisma.customer.findUnique({ where: { email: 'demo@hotel.test' } });
    if (demoCustomer) {
      const headers = await prisma.orderHeader.findMany({ where: { customerId: demoCustomer.id } });
      const headerIds = headers.map((h) => h.id);
      if (headerIds.length > 0) {
        await prisma.orderPayment.deleteMany({ where: { orderHeaderId: { in: headerIds } } });
        await prisma.orderDepartment.deleteMany({ where: { orderHeaderId: { in: headerIds } } });
        await prisma.orderLine.deleteMany({ where: { orderHeaderId: { in: headerIds } } });
        await prisma.orderHeader.deleteMany({ where: { id: { in: headerIds } } });
      }
    }

    // Remove demo drinks and food items by names used in seed
    await prisma.drink.deleteMany({ where: { name: { in: ['Coca Cola', 'Orange Juice', 'Mineral Water'] } } });
    await prisma.foodItem.deleteMany({ where: { name: { in: ['Margherita Pizza', 'Caesar Salad', 'Grilled Chicken'] } } });

    // Remove demo types and categories created by seed (best-effort)
    await prisma.menuCategory.deleteMany({ where: { categoryName: 'Starters' } });
    await prisma.foodType.deleteMany({ where: { typeName: 'main' } });
    await prisma.drinkType.deleteMany({ where: { typeName: 'soft' } });

    // Remove sample restaurants and bars if present (by sample names)
    await prisma.restaurant.deleteMany({ where: { name: { in: ['The Grand Dining', 'Seaside Grill'] } } });
    await prisma.barAndClub.deleteMany({ where: { name: { in: ['Main Hotel Bar', 'Poolside Bar'] } } });

    // Remove demo customer
    await prisma.customer.deleteMany({ where: { email: 'demo@hotel.test' } });

    // Remove per-entity departments (e.g., codes like 'restaurant:<id>:main' and 'bar:<id>:main')
    try {
      const perEntityDepts = await prisma.department.findMany({ where: { OR: [ { code: { startsWith: 'restaurant:' } }, { code: { startsWith: 'bar:' } } ] } });
      const perEntityIds = perEntityDepts.map(d => d.id);
      if (perEntityIds.length > 0) {
        // delete related orderDepartments, terminals, inventories and transfers referencing these departments
        await prisma.orderDepartment.deleteMany({ where: { departmentId: { in: perEntityIds } } });
        await prisma.terminal.deleteMany({ where: { departmentId: { in: perEntityIds } } });
        // department inventories
        await prisma.departmentInventory.deleteMany({ where: { departmentId: { in: perEntityIds } } });
        // department transfers referencing these depts
        await prisma.departmentTransfer.deleteMany({ where: { OR: [ { fromDepartmentId: { in: perEntityIds } }, { toDepartmentId: { in: perEntityIds } } ] } });
        // finally delete the departments
        await prisma.department.deleteMany({ where: { id: { in: perEntityIds } } });
      }
    } catch (err) {
      console.warn('Failed to remove per-entity departments (continuing):', err);
    }

    console.log('Cleaning complete.');
  } catch (err) {
    console.warn('Cleaning failed (continuing):', err);
  }
}

async function runDemoSeeds() {
  console.log('Running demo seed...');

  // Create a demo customer
  const customer = await prisma.customer.upsert({
    where: { email: 'demo@hotel.test' },
    update: {},
    create: {
      firstName: 'Demo',
      lastName: 'Customer',
      email: 'demo@hotel.test',
      phone: '0000000000',
    },
  });

  // Ensure a payment type exists
  const paymentType = await prisma.paymentType.upsert({
    where: { type: 'cash' },
    update: {},
    create: { type: 'cash', description: 'Cash payment' },
  });

  // Food types & categories
  const foodType = await prisma.foodType.upsert({
    where: { typeName: 'main' },
    update: {},
    create: { typeName: 'main', description: 'Main courses' },
  });

  let menuCategory = await prisma.menuCategory.findFirst({ where: { categoryName: 'Starters' } });
  if (!menuCategory) {
    menuCategory = await prisma.menuCategory.create({ data: { categoryName: 'Starters', description: 'Appetizers and starters' } });
  }

  // Create demo food items
  const foodItems = [
    { name: 'Margherita Pizza', price: 1200 },
    { name: 'Caesar Salad', price: 800 },
    { name: 'Grilled Chicken', price: 1500 },
  ];

  // Use createMany with skipDuplicates to add demo food items
  try {
    await prisma.foodItem.createMany({
      skipDuplicates: true,
      data: foodItems.map((f) => ({
        name: f.name,
        // Keep price as integer cents as in other seeds
        price: (f.price / 100).toFixed(2),
        description: `${f.name} - demo item`,
        availability: true,
        foodTypeId: foodType.id,
        menuCategoryId: menuCategory.id,
      })),
    });
  } catch (err) {
    console.warn('createMany foodItem skipped or failed, continuing...', err);
  }

  // Drink types
  const drinkType = await prisma.drinkType.upsert({ where: { typeName: 'soft' }, update: {}, create: { typeName: 'soft', description: 'Soft drinks' } });

  // Create demo drinks
  const drinks = [
    { name: 'Coca Cola', price: 300 },
    { name: 'Orange Juice', price: 350 },
    { name: 'Mineral Water', price: 150 },
  ];

  try {
    await prisma.drink.createMany({ skipDuplicates: true, data: drinks.map((d) => ({ name: d.name, price: d.price, description: `${d.name} - demo item`, availability: true, drinkTypeId: drinkType.id, quantity: 100 })) });
  } catch (err) {
    console.warn('createMany drink skipped or failed, continuing...', err);
  }

  // Create a simple order linked to demo customer (best-effort — some DBs may have schema differences)
      try {
        const orderHeaderExisting = await prisma.orderHeader.findFirst({ where: { customerId: customer.id } });
        if (!orderHeaderExisting) {
          // Prefer canonical restaurant codes; avoid creating legacy 'REST' department
          let department = await prisma.department.findFirst({ where: { code: 'restaurant:main' } });
          if (!department) department = await prisma.department.findFirst({ where: { code: 'restaurant' } });
          if (!department) {
            // Last resort: create canonical 'restaurant' department (do not create 'REST')
            department = await prisma.department.create({ data: { code: 'restaurant', name: 'Restaurant', description: 'Restaurant department' } });
          }

      // Pick a food and a drink if available
      const pizza = await prisma.foodItem.findFirst({ where: { name: 'Margherita Pizza' } });
      const cola = await prisma.drink.findFirst({ where: { name: 'Coca Cola' } });

      const orderNumber = `DEMO-${Date.now()}`;

      const header = await prisma.orderHeader.create({ data: { orderNumber, customerId: customer.id, departmentCode: department.code, status: 'pending', subtotal: 0, discountTotal: 0, tax: 0, total: 0 } });

      // Create lines
      const linesData: any[] = [];
      if (pizza) {
        linesData.push({ orderHeaderId: header.id, departmentCode: department.code, productId: pizza.id, productType: 'food', productName: pizza.name, quantity: 1, unitPrice: Math.round(Number((pizza as any).price) * 100) || 1200, unitDiscount: 0, lineTotal: Math.round(Number((pizza as any).price) * 100) || 1200 });
      }
      if (cola) {
        linesData.push({ orderHeaderId: header.id, departmentCode: department.code, productId: cola.id, productType: 'drink', productName: cola.name, quantity: 2, unitPrice: cola.price || 300, unitDiscount: 0, lineTotal: (cola.price || 300) * 2 });
      }

      // Create lines (non-transactional to avoid interactive transaction timeouts)
      let subtotal = 0;
      let lineNumber = 1;
      for (const ld of linesData) {
        if (ld.lineNumber == null) ld.lineNumber = lineNumber++;
        await prisma.orderLine.create({ data: ld });
        subtotal += ld.lineTotal;
      }

      // Link department
      try {
        await prisma.orderDepartment.create({ data: { orderHeaderId: header.id, departmentId: department.id, status: 'pending' } });
      } catch (err) {
        console.warn('Failed to create orderDepartment (continuing):', err);
      }

      // Create a payment record
      try {
        await prisma.orderPayment.create({ data: { orderHeaderId: header.id, amount: subtotal, paymentMethod: 'cash', paymentStatus: 'completed', paymentTypeId: paymentType.id } });
      } catch (err) {
        console.warn('Failed to create orderPayment (continuing):', err);
      }

      // Update header totals
      try {
        await prisma.orderHeader.update({ where: { id: header.id }, data: { subtotal, total: subtotal } });
      } catch (err) {
        console.warn('Failed to update orderHeader totals (continuing):', err);
      }
    }
  } catch (err: any) {
    console.warn('Skipping full OrderHeader seed due to schema mismatch or DB error:', err?.message || err);
  }

  console.log('Demo seeds complete.');
}

async function main() {
  try {
    // 1) create roles and admin
    await seedRolesAndAdmin();

    // If requested, clean previous demo seeds
    if (process.env.SEED_CLEAN === 'true') {
      await cleanPreviousSeeds();
    }

    // 2) create canonical departments (delegated to populate-departments)
    try {
      // Default to not creating per-entity departments unless explicitly requested.
      // This prevents development/demo code from creating many per-entity sections in production.
      const perEntity = process.env.PER_ENTITY === 'true' || process.env.SEED_PER_ENTITY === 'true';
      const allowSampleEntities = process.env.SEED_ALLOW_SAMPLE === 'true'; // must be explicitly set to allow sample entity creation
      await seedDepartments({ perEntity, allowSampleEntities });
    } catch (err) {
      console.warn('populate-departments failed (continuing):', err);
    }

    // 3) run demo seeds (food, drinks, example order)
    await runDemoSeeds();

    // 4) Optionally sync inventory from menu -> inventory items & department inventory
    if (process.env.SEED_SYNC_MENU_INVENTORY === 'true') {
      try {
        console.log('Syncing inventory from menu (SEED_SYNC_MENU_INVENTORY=true)')
        await seedInventoryFromMenu()
      } catch (err) {
        console.warn('seed-inventory-from-menu failed (continuing):', err)
      }
    }

    console.log('All seeds completed successfully.');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

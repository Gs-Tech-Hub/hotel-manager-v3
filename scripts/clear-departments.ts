import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Safely remove all Department rows and related data so seeds can recreate canonical departments.
 * This targets departments and their dependent records only — it does not drop the whole database.
 * Run with: npx tsx scripts/clear-departments.ts
 */
async function main() {
  console.log('Starting departments cleanup...');

  try {
    // Find all departments
    const depts = await prisma.department.findMany();
    const deptIds = depts.map((d) => d.id);

    if (deptIds.length === 0) {
      console.log('No departments found, nothing to do.');
      return;
    }

    console.log(`Found ${deptIds.length} departments — removing dependent records first`);

    // Delete department transfers items and transfers referencing these departments
    await prisma.departmentTransferItem.deleteMany({ where: { transferId: { in: [] } } }).catch(() => {}); // noop - keep schema safe

    // Delete orderDepartments that reference these departments
    await prisma.orderDepartment.deleteMany({ where: { departmentId: { in: deptIds } } });

    // Delete terminals bound to these departments
    await prisma.terminal.deleteMany({ where: { departmentId: { in: deptIds } } });

    // Delete department inventories
    await prisma.departmentInventory.deleteMany({ where: { departmentId: { in: deptIds } } });

    // Delete transfers that reference these departments
    await prisma.departmentTransfer.deleteMany({ where: { OR: [ { fromDepartmentId: { in: deptIds } }, { toDepartmentId: { in: deptIds } } ] } });

    // Finally delete departments
    const del = await prisma.department.deleteMany({ where: { id: { in: deptIds } } });
    console.log(`Deleted ${del.count} departments`);
  } catch (err) {
    console.error('Departments cleanup failed:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();

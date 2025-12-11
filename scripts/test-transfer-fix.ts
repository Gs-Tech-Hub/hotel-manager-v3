import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testTransferFix() {
  try {
    console.log('=== TESTING TRANSFER FIX ===\n');

    // Get restaurant department
    const restaurant = await prisma.department.findFirst({ where: { code: 'restaurant' } });
    if (!restaurant) {
      console.error('Restaurant department not found');
      process.exit(1);
    }

    // Get outdoor restaurant section
    const outdoorSection = await prisma.departmentSection.findFirst({
      where: { departmentId: restaurant.id, name: { contains: 'Outdoor' } }
    });
    if (!outdoorSection) {
      console.error('Outdoor section not found');
      process.exit(1);
    }

    // Get caesar salad
    const salad = await prisma.inventoryItem.findFirst({
      where: { name: { contains: 'Caesar', mode: 'insensitive' } }
    });
    if (!salad) {
      console.error('Salad not found');
      process.exit(1);
    }

    console.log(`From: ${restaurant.name} (general - no section)`);
    console.log(`To: ${restaurant.name} → ${outdoorSection.name}`);
    console.log(`✓ Test Item: ${salad.name}`);

    // Get current inventory
    let sourceBefore = await prisma.departmentInventory.findFirst({
      where: {
        departmentId: restaurant.id,
        inventoryItemId: salad.id,
        sectionId: null,
      },
    });

    const destBefore = await prisma.departmentInventory.findFirst({
      where: {
        departmentId: restaurant.id,
        inventoryItemId: salad.id,
        sectionId: outdoorSection.id,
      },
    });

    let sourceQtyBefore = sourceBefore?.quantity ?? 0;
    const destQtyBefore = destBefore?.quantity ?? 0;

    console.log(`✓ Source (general) quantity before: ${sourceQtyBefore}`);
    console.log(`✓ Destination (outdoor) quantity before: ${destQtyBefore}`);

    // Ensure source has stock
    if (sourceQtyBefore < 10) {
      console.log(`\n→ Setting source to 50 for testing...`);
      const exists = await prisma.departmentInventory.findFirst({
        where: {
          departmentId: restaurant.id,
          inventoryItemId: salad.id,
          sectionId: null,
        },
      });

      if (exists) {
        await prisma.departmentInventory.update({
          where: { id: exists.id },
          data: { quantity: 50 },
        });
      } else {
        await prisma.departmentInventory.create({
          data: {
            departmentId: restaurant.id,
            inventoryItemId: salad.id,
            sectionId: null,
            quantity: 50,
            unitPrice: 12,
          },
        });
      }
      
      // Remeasure after setting source
      sourceBefore = await prisma.departmentInventory.findFirst({
        where: {
          departmentId: restaurant.id,
          inventoryItemId: salad.id,
          sectionId: null,
        },
      });
      sourceQtyBefore = sourceBefore?.quantity ?? 0;
      console.log(`✓ Source (general) quantity after setup: ${sourceQtyBefore}`);
    }

    console.log('\n→ Creating transfer request...');
    // The transfer notes need toDepartmentCode in format: "DEPARTMENT_CODE:SECTION_ID_OR_SLUG"
    const toCode = `${restaurant.code}:${outdoorSection.id}`;
    
    const transfer = await prisma.departmentTransfer.create({
      data: {
        fromDepartmentId: restaurant.id,
        toDepartmentId: restaurant.id, // Same department, different section
        notes: JSON.stringify({ 
          toDepartmentCode: toCode
        }),
      },
    });

    await prisma.departmentTransferItem.create({
      data: {
        transferId: transfer.id,
        productId: salad.id,
        productType: 'inventoryItem',
        quantity: 10,
      },
    });

    console.log(`Transfer created: ${transfer.id}`);
    console.log(`To code: ${toCode}`);
    console.log(`Status: ${transfer.status}`);

    console.log('\n→ Approving transfer through TransferService...');
    
    // Import and use the actual TransferService
    const { TransferService } = await import('../src/services/transfer.service');
    const transferService = new TransferService();
    
    const approveResult = await transferService.approveTransfer(transfer.id);
    console.log(`Approval result: ${approveResult.message}`);

    // Check results
    const sourceAfter = await prisma.departmentInventory.findFirst({
      where: {
        departmentId: restaurant.id,
        inventoryItemId: salad.id,
        sectionId: null,
      },
    });

    const destAfter = await prisma.departmentInventory.findFirst({
      where: {
        departmentId: restaurant.id,
        inventoryItemId: salad.id,
        sectionId: outdoorSection.id,
      },
    });

    const sourceQtyAfter = sourceAfter?.quantity ?? 0;
    const destQtyAfter = destAfter?.quantity ?? 0;

    console.log(`\n✓ Source (general) quantity after: ${sourceQtyAfter}`);
    console.log(`✓ Destination (outdoor) quantity after: ${destQtyAfter}`);

    console.log('\n=== VERIFICATION ===');
    console.log(`Source (general): ${sourceQtyBefore} → ${sourceQtyAfter} (change: ${sourceQtyAfter - sourceQtyBefore})`);
    console.log(`Destination (outdoor): ${destQtyBefore} → ${destQtyAfter} (change: ${destQtyAfter - destQtyBefore})`);

    const sourceOk = sourceQtyAfter === sourceQtyBefore - 10;
    const destOk = destQtyAfter === destQtyBefore + 10;

    console.log(`\n✓ Source decremented by 10: ${sourceOk ? 'PASS' : 'FAIL'}`);
    console.log(`✓ Destination incremented by 10: ${destOk ? 'PASS' : 'FAIL'}`);

    if (sourceOk && destOk) {
      console.log('\n✅ TRANSFER FIX WORKS! Caesar Salad successfully transferred!\n');
    } else {
      console.log('\n❌ TRANSFER FIX FAILED!\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testTransferFix();

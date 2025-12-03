import { prisma } from '@/lib/auth/prisma';

type Actor = { userId?: string; userType?: string } | undefined;

export async function listInventoryItems({ page = 1, limit = 50 } = {}) {
  const skip = (page - 1) * limit;

  const [rows, total] = await Promise.all([
    prisma.inventoryItem.findMany({
      skip,
      take: limit,
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.inventoryItem.count({ where: { isActive: true } }),
  ]);

  return { rows, total };
}

export async function createInventoryItem(
  data: { name: string; sku: string; price: string | number; description?: string; itemType?: string },
  actor?: Actor
) {
  const { name, sku, price, description, itemType } = data;
  if (!name || !sku) throw new Error('Missing required fields: name, sku');

  const existing = await prisma.inventoryItem.findUnique({ where: { sku } });
  if (existing) throw new Error('Inventory item with this SKU already exists');

  return await prisma.$transaction(async (tx) => {
    // For simplicity, use a default inventory type or create one
    let inventoryTypeId = (await tx.inventoryType.findFirst({ where: { typeName: 'General' } }))?.id;
    if (!inventoryTypeId) {
      const defaultType = await tx.inventoryType.create({ data: { typeName: 'General' } });
      inventoryTypeId = defaultType.id;
    }

    const item = await tx.inventoryItem.create({
      data: {
        name,
        sku,
        unitPrice: Number(price),
        description,
        itemType,
        category: itemType || 'General',
        inventoryTypeId,
        isActive: true,
      },
    });

    await tx.adminAuditLog.create({
      data: {
        actorId: actor?.userId || null,
        actorType: actor?.userType || 'unknown',
        action: 'create',
        subject: 'inventory_items',
        subjectId: item.id,
        details: { name, sku },
      },
    });

    return item;
  });
}

export async function deleteInventoryItem(id: string, actor?: Actor) {
  if (!id) throw new Error('Missing inventory item id');

  return await prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.update({
      where: { id },
      data: { isActive: false },
    });

    await tx.adminAuditLog.create({
      data: {
        actorId: actor?.userId || null,
        actorType: actor?.userType || 'unknown',
        action: 'delete',
        subject: 'inventory_items',
        subjectId: id,
        details: { message: 'soft-deactivated' },
      },
    });

    return item;
  });
}

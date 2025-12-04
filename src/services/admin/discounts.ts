import { prisma } from '@/lib/auth/prisma';

type Actor = { userId?: string; userType?: string } | undefined;

export async function listDiscounts({ page = 1, limit = 50 } = {}) {
  const skip = (page - 1) * limit;

  const [rows, total] = await Promise.all([
    prisma.discountRule.findMany({
      skip,
      take: limit,
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.discountRule.count({ where: { isActive: true } }),
  ]);

  return { rows, total };
}

export async function createDiscount(
  data: { name: string; percent: number; description?: string; code?: string },
  actor?: Actor
) {
  const { name, percent, description, code } = data;
  if (!name || percent === undefined) throw new Error('Missing required fields: name, percent');

  return await prisma.$transaction(
    async (tx) => {
      const discount = await tx.discountRule.create({
        data: {
          name,
          code: code || `DISC-${Date.now()}`,
          value: percent,
          type: 'percentage',
          description,
          isActive: true,
        },
      });

      await tx.adminAuditLog.create({
        data: {
          actorId: actor?.userId || null,
          actorType: actor?.userType || 'unknown',
          action: 'create',
          subject: 'discounts',
          subjectId: discount.id,
          details: { name, percent },
        },
      });

      return discount;
    },
    { timeout: 10000 } // Increase timeout to 10 seconds
  );
}

export async function deleteDiscount(id: string, actor?: Actor) {
  if (!id) throw new Error('Missing discount id');

  return await prisma.$transaction(
    async (tx) => {
      const discount = await tx.discountRule.update({
        where: { id },
        data: { isActive: false },
      });

      await tx.adminAuditLog.create({
        data: {
          actorId: actor?.userId || null,
          actorType: actor?.userType || 'unknown',
          action: 'delete',
          subject: 'discounts',
          subjectId: id,
          details: { message: 'soft-deactivated' },
        },
      });

      return discount;
    },
    { timeout: 10000 } // Increase timeout to 10 seconds
  );
}

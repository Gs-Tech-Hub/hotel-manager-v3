import { prisma } from '@/lib/auth/prisma';

type Actor = { userId?: string; userType?: string } | undefined;

export async function listSections({ page = 1, limit = 50 } = {}) {
  const skip = (page - 1) * limit;

  const [rows, total] = await Promise.all([
    prisma.departmentSection.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.departmentSection.count(),
  ]);

  return { rows, total };
}

export async function createSection(data: { name: string; departmentId: string; slug?: string; metadata?: any }, actor?: Actor) {
  const { name, departmentId, slug, metadata } = data;
  if (!name || !departmentId) throw new Error('Missing required fields: name, departmentId');

  return await prisma.$transaction(async (tx) => {
    const section = await tx.departmentSection.create({ data: { name, departmentId, slug, metadata: metadata || {}, isActive: true } });

    await tx.adminAuditLog.create({
      data: {
        actorId: actor?.userId || null,
        actorType: actor?.userType || 'unknown',
        action: 'create',
        subject: 'department_sections',
        subjectId: section.id,
        details: { name, departmentId },
      },
    });

    return section;
  });
}

export async function deleteSection(id: string, actor?: Actor) {
  if (!id) throw new Error('Missing section id');

  return await prisma.$transaction(async (tx) => {
    const section = await tx.departmentSection.delete({ where: { id } });

    await tx.adminAuditLog.create({ data: { actorId: actor?.userId || null, actorType: actor?.userType || 'unknown', action: 'delete', subject: 'department_sections', subjectId: id, details: { message: 'deleted' } } });

    return section;
  });
}

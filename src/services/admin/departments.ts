import { prisma } from '@/lib/auth/prisma';

type Actor = { userId?: string; userType?: string } | undefined;

export async function listDepartments({ page = 1, limit = 50 } = {}) {
  const skip = (page - 1) * limit;

  const [rows, total] = await Promise.all([
    prisma.department.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.department.count(),
  ]);

  return { rows, total };
}

export async function createDepartment(data: {
  code: string;
  name: string;
  description?: string | null;
  type?: string | null;
  icon?: string | null;
  image?: string | null;
  metadata?: any;
}, actor?: Actor) {
  const { code, name, description, type, icon, image, metadata } = data;

  if (!code || !name) throw new Error('Missing required fields: code, name');

  // ensure uniqueness
  const existing = await prisma.department.findUnique({ where: { code } });
  if (existing) {
    const err: any = new Error('Department with this code already exists');
    err.code = 'P2025';
    throw err;
  }

  return await prisma.$transaction(async (tx) => {
    const dept = await tx.department.create({
      data: {
        code,
        name,
        description,
        type,
        icon,
        image,
        metadata: metadata || {},
        isActive: true,
      },
    });

    // Audit log
    await tx.adminAuditLog.create({
      data: {
        actorId: actor?.userId || null,
        actorType: actor?.userType || 'unknown',
        action: 'create',
        subject: 'departments',
        subjectId: dept.id,
        details: { code, name },
      },
    });

    return dept;
  });
}

export async function deleteDepartment(id: string, actor?: Actor) {
  if (!id) throw new Error('Missing department id');

  return await prisma.$transaction(async (tx) => {
    // Soft deactivate
    const dept = await tx.department.update({ where: { id }, data: { isActive: false } });

    await tx.adminAuditLog.create({
      data: {
        actorId: actor?.userId || null,
        actorType: actor?.userType || 'unknown',
        action: 'delete',
        subject: 'departments',
        subjectId: id,
        details: { message: 'soft-deactivated' },
      },
    });

    return dept;
  });
}

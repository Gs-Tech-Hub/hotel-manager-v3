import { prisma } from '@/lib/auth/prisma';

type Actor = { userId?: string; userType?: string } | undefined;

export async function listEmployees({ page = 1, limit = 50 } = {}) {
  const skip = (page - 1) * limit;

  const [rows, total] = await Promise.all([
    prisma.pluginUsersPermissionsUser.findMany({
      skip,
      take: limit,
      where: { blocked: false },
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, firstname: true, lastname: true, blocked: true, createdAt: true },
    }),
    prisma.pluginUsersPermissionsUser.count({ where: { blocked: false } }),
  ]);

  return { rows, total };
}

export async function createEmployee(
  data: { name: string; email: string; role?: string },
  actor?: Actor
) {
  const { name, email, role } = data;
  if (!name || !email) throw new Error('Missing required fields: name, email');

  const existing = await prisma.pluginUsersPermissionsUser.findUnique({ where: { email } });
  if (existing) throw new Error('Employee with this email already exists');

  return await prisma.$transaction(
    async (tx) => {
      const employee = await tx.pluginUsersPermissionsUser.create({
        data: {
          email,
          firstname: name,
          username: email.split('@')[0],
          password: 'temp-password', // Should be hashed in production; consider email-based invitation instead
          blocked: false,
        },
      });

      // Optionally assign default role if provided
      if (role) {
        const roleObj = await tx.role.findUnique({ where: { code: role } });
        if (roleObj) {
          await tx.userRole.create({
            data: {
              userId: employee.id,
              userType: 'employee',
              roleId: roleObj.id,
              grantedAt: new Date(),
              grantedBy: actor?.userId || 'system',
            },
          });
        }
      }

      await tx.adminAuditLog.create({
        data: {
          actorId: actor?.userId || null,
          actorType: actor?.userType || 'unknown',
          action: 'create',
          subject: 'employees',
          subjectId: employee.id,
          details: { name, email },
        },
      });

      return employee;
    },
    { timeout: 10000 } // Increase timeout to 10 seconds
  );
}

export async function deleteEmployee(id: string, actor?: Actor) {
  if (!id) throw new Error('Missing employee id');

  return await prisma.$transaction(
    async (tx) => {
      const employee = await tx.pluginUsersPermissionsUser.update({
        where: { id },
        data: { blocked: true },
      });

      await tx.adminAuditLog.create({
        data: {
          actorId: actor?.userId || null,
          actorType: actor?.userType || 'unknown',
          action: 'delete',
          subject: 'employees',
          subjectId: id,
          details: { message: 'blocked' },
        },
      });

      return employee;
    },
    { timeout: 10000 } // Increase timeout to 10 seconds
  );
}

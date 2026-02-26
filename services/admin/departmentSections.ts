import { prisma } from '@/lib/auth/prisma';

type Actor = { userId?: string; userType?: string } | undefined;

/**
 * List all active department sections
 * @param page - Page number (1-indexed)
 * @param limit - Items per page (max 200)
 * @param departmentId - Optional filter by department ID
 * @returns Array of sections and total count
 */
export async function listSections({ 
  page = 1, 
  limit = 50, 
  departmentId 
}: { 
  page?: number; 
  limit?: number; 
  departmentId?: string 
} = {}) {
  const skip = (page - 1) * limit;

  const whereClause: any = { isActive: true };
  if (departmentId) {
    whereClause.departmentId = departmentId;
  }

  const [rows, total] = await Promise.all([
    prisma.departmentSection.findMany({
      skip,
      take: limit,
      where: whereClause,
      select: {
        id: true,
        name: true,
        slug: true,
        departmentId: true,
        metadata: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.departmentSection.count({ where: whereClause }),
  ]);

  return { rows, total };
}

/**
 * Create a new department section
 * @param data - Section data (name, departmentId, optional slug, metadata, hasTerminal)
 * @param actor - User performing the action (for audit logging)
 * @returns Created section
 * @throws Error if required fields missing or department not found
 */
export async function createSection(
  data: { name: string; departmentId: string; slug?: string; metadata?: any; hasTerminal?: boolean }, 
  actor?: Actor
) {
  const { name, departmentId, slug, metadata, hasTerminal = false } = data;
  
  if (!name || !name.trim()) {
    throw new Error('Missing required field: name');
  }
  if (!departmentId || !departmentId.trim()) {
    throw new Error('Missing required field: departmentId');
  }

  // Validate that department exists
  const department = await prisma.department.findUnique({
    where: { id: departmentId },
  });
  if (!department) {
    throw new Error('Department not found');
  }

  // If this department is a games department, ensure section metadata marks it
  const baseMetadata = metadata && typeof metadata === 'object' ? { ...metadata } : {};
  if (department.type === 'games') {
    // mark section as games-scoped so UI and services can detect it
    baseMetadata.sectionType = baseMetadata.sectionType || 'games';
    baseMetadata.module = baseMetadata.module || 'games';
  }

  return await prisma.$transaction(
    async (tx) => {
      const section = await tx.departmentSection.create({
        data: {
          name: name.trim(),
          departmentId,
          slug: slug?.trim() || null,
          metadata: baseMetadata,
          isActive: true,
          hasTerminal,
        },
      });

      // If hasTerminal is true, create a terminal for this section
      let terminal = null;
      if (hasTerminal) {
        const terminalSlug = `${department.code}-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
        terminal = await tx.terminal.create({
          data: {
            name: `${name} Terminal`,
            slug: terminalSlug,
            description: `Sales terminal for ${department.name} - ${name}`,
            departmentId,
            type: 'sales',
            status: 'offline',
            sectionIds: JSON.stringify([section.id]),
          },
        });

        // Link terminal to section
        await tx.departmentSection.update({
          where: { id: section.id },
          data: { terminalId: terminal.id },
        });
      }

      await tx.adminAuditLog.create({
        data: {
          actorId: actor?.userId || null,
          actorType: actor?.userType || 'unknown',
          action: 'create',
          subject: 'department_sections',
          subjectId: section.id,
          details: { name, departmentId, slug: section.slug, metadata: baseMetadata, hasTerminal, terminalId: terminal?.id || null },
        },
      });

      return { ...section, terminal };
    },
    { timeout: 10000 }
  );
}

/**
 * Delete a department section (soft delete)
 * @param id - Section ID to delete
 * @param actor - User performing the action (for audit logging)
 * @returns Deleted section
 * @throws Error if section not found
 */
export async function deleteSection(id: string, actor?: Actor) {
  if (!id || !id.trim()) {
    throw new Error('Missing section id');
  }

  // Verify section exists before deleting
  const existingSection = await prisma.departmentSection.findUnique({
    where: { id: id.trim() },
  });
  if (!existingSection) {
    throw new Error('Section not found');
  }

  return await prisma.$transaction(
    async (tx) => {
      // Soft delete: set isActive to false instead of hard delete
      const section = await tx.departmentSection.update({
        where: { id: id.trim() },
        data: { isActive: false },
      });

      await tx.adminAuditLog.create({
        data: {
          actorId: actor?.userId || null,
          actorType: actor?.userType || 'unknown',
          action: 'delete',
          subject: 'department_sections',
          subjectId: id,
          details: { message: 'soft-deleted (isActive: false)', name: existingSection.name },
        },
      });

      return section;
    },
    { timeout: 10000 }
  );
}

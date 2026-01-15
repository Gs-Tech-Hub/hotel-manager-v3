import { prisma } from '@/lib/auth/prisma';
import { DepartmentExtra } from '@prisma/client';
import { errorResponse, ErrorCodes } from '@/lib/api-response';

/**
 * Department-level extras management service
 * Handles allocation, tracking, and transfers of extras between departments/sections
 */
export class DepartmentExtrasService {
  /**
   * Get all extras for a department (optionally filtered by section)
   */
  static async getDepartmentExtras(
    departmentId: string,
    sectionId?: string
  ) {
    try {
      const where: any = { departmentId };
      if (sectionId) {
        where.sectionId = sectionId;
      }

      const extras = await prisma.departmentExtra.findMany({
        where,
        include: {
          extra: true,
          section: true,
          department: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      return extras;
    } catch (error) {
      console.error('Error fetching department extras:', error);
      throw error;
    }
  }

  /**
   * Allocate extras to a department
   */
  static async allocateExtraToDepartment(
    departmentId: string,
    extraId: string,
    quantity: number,
    sectionId?: string | null
  ): Promise<DepartmentExtra> {
    try {
      // Normalize sectionId to null if not provided
      const normalizedSectionId = sectionId || null;

      // Check if allocation already exists
      const existing = await prisma.departmentExtra.findUnique({
        where: {
          departmentId_sectionId_extraId: {
            departmentId,
            sectionId: normalizedSectionId as string | null,
            extraId,
          } as any,
        },
      });

      if (existing) {
        // Update existing allocation
        return await prisma.departmentExtra.update({
          where: { id: existing.id },
          data: {
            quantity: existing.quantity + quantity,
          },
          include: {
            extra: true,
            section: true,
          },
        });
      }

      // Create new allocation
      return await prisma.departmentExtra.create({
        data: {
          departmentId,
          extraId,
          sectionId: normalizedSectionId,
          quantity,
        },
        include: {
          extra: true,
          section: true,
        },
      });
    } catch (error) {
      console.error('Error allocating extra to department:', error);
      throw error;
    }
  }

  /**
   * Transfer extras between sections within same department
   */
  static async transferExtrasBetweenSections(
    departmentId: string,
    extraId: string,
    sourceSectionId: string,
    destinationSectionId: string,
    quantity: number
  ) {
    try {
      // Get source allocation
      const source = await prisma.departmentExtra.findUnique({
        where: {
          departmentId_sectionId_extraId: {
            departmentId,
            sectionId: sourceSectionId,
            extraId,
          } as any,
        },
      });

      if (!source) {
        throw new Error('Source allocation not found');
      }

      if (source.quantity < quantity) {
        throw new Error('Insufficient quantity in source section');
      }

      // Reduce from source
      await prisma.departmentExtra.update({
        where: { id: source.id },
        data: {
          quantity: source.quantity - quantity,
        },
      });

      // Add to destination
      const destination = await prisma.departmentExtra.findUnique({
        where: {
          departmentId_sectionId_extraId: {
            departmentId,
            sectionId: destinationSectionId,
            extraId,
          } as any,
        },
      });

      if (destination) {
        // Update existing
        return await prisma.departmentExtra.update({
          where: { id: destination.id },
          data: {
            quantity: destination.quantity + quantity,
          },
          include: {
            extra: true,
            section: true,
          },
        });
      } else {
        // Create new
        return await prisma.departmentExtra.create({
          data: {
            departmentId,
            extraId,
            sectionId: destinationSectionId,
            quantity,
          },
          include: {
            extra: true,
            section: true,
          },
        });
      }
    } catch (error) {
      console.error('Error transferring extras between sections:', error);
      throw error;
    }
  }

  /**
   * Deduct extras when used in an order
   */
  static async deductExtraUsage(
    departmentId: string,
    sectionId: string,
    extraId: string,
    quantity: number
  ) {
    try {
      const allocation = await prisma.departmentExtra.findUnique({
        where: {
          departmentId_sectionId_extraId: {
            departmentId,
            sectionId,
            extraId,
          } as any,
        },
      });

      if (!allocation) {
        throw new Error('Extra allocation not found');
      }

      if (allocation.quantity < quantity) {
        throw new Error('Insufficient quantity');
      }

      return await prisma.departmentExtra.update({
        where: { id: allocation.id },
        data: {
          quantity: allocation.quantity - quantity,
        },
        include: {
          extra: true,
        },
      });
    } catch (error) {
      console.error('Error deducting extra usage:', error);
      throw error;
    }
  }

  /**
   * Get extras availability summary for a section
   */
  static async getSectionExtrasSummary(sectionId: string) {
    try {
      const extras = await prisma.departmentExtra.findMany({
        where: { sectionId },
        include: {
          extra: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      return {
        total: extras.length,
        availableExtras: extras.filter((d) => d.quantity > 0),
        lowStock: extras.filter((d) => d.quantity > 0 && d.quantity <= 5),
        outOfStock: extras.filter((d) => d.quantity <= 0),
      };
    } catch (error) {
      console.error('Error fetching section extras summary:', error);
      throw error;
    }
  }

  /**
   * Get all extras not yet allocated to a department
   */
  static async getUnallocatedExtras(departmentId: string) {
    try {
      const allocated = await prisma.departmentExtra.findMany({
        where: { departmentId },
        select: { extraId: true },
      });

      const allocatedIds = allocated.map((d) => d.extraId);

      const unallocated = await prisma.extra.findMany({
        where: {
          isActive: true,
          id: {
            notIn: allocatedIds,
          },
        },
        orderBy: { name: 'asc' },
      });

      return unallocated;
    } catch (error) {
      console.error('Error fetching unallocated extras:', error);
      throw error;
    }
  }

  /**
   * Reconcile department extras (similar to inventory reconciliation)
   */
  static async reconcileDepartmentExtras(departmentId: string) {
    try {
      const result = {
        fixed: [] as string[],
        deleted: [] as string[],
        warnings: [] as string[],
      };

      // Check for orphaned allocations
      const allocations = await prisma.departmentExtra.findMany({
        where: { departmentId },
        include: { extra: true, section: true },
      });

      for (const allocation of allocations) {
        // Check if extra still exists
        if (!allocation.extra) {
          await prisma.departmentExtra.delete({ where: { id: allocation.id } });
          result.deleted.push(
            `Deleted orphaned allocation: Extra ${allocation.extraId}`
          );
        }

        // Check if section still exists (if scoped)
        if (allocation.sectionId && !allocation.section) {
          await prisma.departmentExtra.delete({ where: { id: allocation.id } });
          result.deleted.push(
            `Deleted section-scoped allocation with missing section: ${allocation.id}`
          );
        }
      }

      return result;
    } catch (error) {
      console.error('Error reconciling department extras:', error);
      throw error;
    }
  }
}

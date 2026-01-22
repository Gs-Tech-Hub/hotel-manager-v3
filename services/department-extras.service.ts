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

      // Get the extra to check if it's tracked
      const extra = await prisma.extra.findUnique({ where: { id: extraId } });
      if (!extra) {
        throw new Error('Extra not found');
      }

      // For non-tracked extras, always use quantity: 1
      const allocatedQuantity = extra.trackInventory ? quantity : 1;

      console.log('[allocateExtraToDepartment] Input:', {
        departmentId,
        extraId,
        quantity,
        sectionId: normalizedSectionId,
        isTracked: extra.trackInventory,
        finalQuantity: allocatedQuantity,
      });

      // Check if allocation already exists
      // Note: Prisma doesn't support null values in composite unique keys with findUnique()
      // So we use findFirst() instead when sectionId could be null
      const existing = await prisma.departmentExtra.findFirst({
        where: {
          departmentId,
          extraId,
          sectionId: normalizedSectionId,
        },
      });

      console.log('[allocateExtraToDepartment] Existing allocation found:', !!existing);

      if (existing) {
        // Update existing allocation
        console.log('[allocateExtraToDepartment] Updating existing allocation:', existing.id);
        return await prisma.departmentExtra.update({
          where: { id: existing.id },
          data: {
            quantity: extra.trackInventory ? (existing.quantity + allocatedQuantity) : 1,
          },
          include: {
            extra: true,
            section: true,
          },
        });
      }

      // Create new allocation
      console.log('[allocateExtraToDepartment] Creating new allocation');
      return await prisma.departmentExtra.create({
        data: {
          departmentId,
          extraId,
          sectionId: normalizedSectionId,
          quantity: allocatedQuantity,
        },
        include: {
          extra: true,
          section: true,
        },
      });
    } catch (error) {
      console.error('[allocateExtraToDepartment] Error:', error);
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
   * If the extra is inventory-tracked, also deducts from DepartmentInventory
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
        include: {
          extra: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!allocation) {
        throw new Error('Extra allocation not found');
      }

      if (allocation.quantity < quantity) {
        throw new Error('Insufficient quantity');
      }

      // Update the extra allocation
      const updated = await prisma.departmentExtra.update({
        where: { id: allocation.id },
        data: {
          quantity: allocation.quantity - quantity,
        },
        include: {
          extra: true,
        },
      });

      // If this extra is inventory-tracked, also deduct from DepartmentInventory
      if (allocation.extra.trackInventory && allocation.extra.productId) {
        const deptInventory = await prisma.departmentInventory.findUnique({
          where: {
            departmentId_sectionId_inventoryItemId: {
              departmentId,
              sectionId: sectionId || null,
              inventoryItemId: allocation.extra.productId,
            } as any,
          },
        });

        if (deptInventory) {
          await prisma.departmentInventory.update({
            where: { id: deptInventory.id },
            data: {
              quantity: Math.max(0, deptInventory.quantity - quantity),
            },
          });
        }
      }

      return updated;
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

  /**
   * Allocate an inventory item as an extra to a department
   * This method:
   * 1. Creates an extra from the inventory item with inventory tracking
   * 2. Allocates it to the department (and optionally section)
   * 3. Syncs the inventory quantity to DepartmentExtra
   *
   * This maintains the same pattern as inventory: item → department allocation → section transfer
   */
  static async allocateInventoryItemAsExtra(
    departmentId: string,
    inventoryItemId: string,
    unit: string,
    priceOverride?: number,
    sectionId?: string | null
  ) {
    try {
      // Get inventory item
      const inventoryItem = await prisma.inventoryItem.findUnique({
        where: { id: inventoryItemId },
        include: { departmentInventories: { where: { departmentId } } },
      });

      if (!inventoryItem) {
        throw new Error('Inventory item not found');
      }

      // Check if already converted to extra in this department
      const existingExtra = await prisma.extra.findFirst({
        where: {
          productId: inventoryItemId,
          departmentExtras: {
            some: { departmentId },
          },
        },
      });

      if (existingExtra) {
        throw new Error(
          'This inventory item is already converted to an extra in this department'
        );
      }

      // Create extra with inventory tracking
      const price = priceOverride || Math.round(inventoryItem.unitPrice.toNumber() * 100);

      const extra = await prisma.extra.create({
        data: {
          name: inventoryItem.name,
          description: inventoryItem.description,
          unit,
          price,
          productId: inventoryItemId,
          trackInventory: true,
          isActive: inventoryItem.isActive,
        },
      });

      // Get current inventory quantity for this department
      const deptInventory = inventoryItem.departmentInventories[0];
      const quantity = deptInventory?.quantity || 0;

      // Allocate to department with same quantity
      const allocation = await prisma.departmentExtra.create({
        data: {
          departmentId,
          extraId: extra.id,
          sectionId: sectionId || null,
          quantity,
        },
        include: {
          extra: true,
          section: true,
        },
      });

      return allocation;
    } catch (error) {
      console.error('Error allocating inventory item as extra:', error);
      throw error;
    }
  }

  /**
   * Transfer extras from parent department to section (or between sections)
   * Similar to inventory transfers
   */
  static async transferExtra(
    departmentId: string,
    extraId: string,
    sourceSectionId: string | null,
    destinationSectionId: string | null,
    quantity: number
  ) {
    try {
      // Get source allocation
      const sourceWhere: any = {
        departmentId,
        extraId,
        sectionId: sourceSectionId,
      };

      const source = await prisma.departmentExtra.findFirst({
        where: sourceWhere,
      });

      if (!source) {
        throw new Error(`Source allocation not found for extra transfer`);
      }

      if (source.quantity < quantity) {
        throw new Error(
          `Insufficient quantity. Available: ${source.quantity}, Requested: ${quantity}`
        );
      }

      // Reduce from source
      const updatedSource = await prisma.departmentExtra.update({
        where: { id: source.id },
        data: {
          quantity: source.quantity - quantity,
        },
      });

      // Add to destination
      const destWhere: any = {
        departmentId,
        extraId,
        sectionId: destinationSectionId,
      };

      const destination = await prisma.departmentExtra.findFirst({
        where: destWhere,
      });

      let result;
      if (destination) {
        // Update existing
        result = await prisma.departmentExtra.update({
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
        result = await prisma.departmentExtra.create({
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

      // TODO: Log extras transfers to a dedicated audit log table when created
      // For now, transfers are tracked via direct DepartmentExtra updates

      return result;
    } catch (error) {
      console.error('[transferExtra] Error:', error);
      throw error;
    }
  }
}


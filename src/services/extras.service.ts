/**
 * Extras Service
 * Manages supplementary items for restaurant orders
 * Extras are items with units (portions, containers, etc.) specifically for restaurant terminals
 * 
 * PRICE CONSISTENCY:
 * - All prices stored as integers in cents
 * - Calculations use cents throughout
 */

import { BaseService } from './base.service';
import { prisma } from '@/lib/auth/prisma';
import { normalizeError } from '@/lib/errors';
import { 
  normalizeToCents, 
  validatePrice
} from '@/lib/price';
import { errorResponse, ErrorCodes } from '@/lib/api-response';

export class ExtrasService extends BaseService<any> {
  constructor() {
    super('extra');
  }

  /**
   * Create a new extra (global registry)
   * Extras are created globally, then allocated to departments, then transferred to sections
   * This mirrors the inventory item flow
   * 
   * AUTHORIZATION:
   * - Requires authenticated user context
   * - Role check (admin/manager) enforced at API route level
   */
  async createExtra(data: {
    name: string;
    description?: string;
    unit: string; // e.g., "portion", "container", "piece", "pump"
    price: number; // In cents
    productId?: string; // Optional: link to inventory item for tracking
    trackInventory?: boolean; // If true and productId set, deducts inventory
    isActive?: boolean;
  }) {
    try {
      // Validate price
      const normalizedPrice = normalizeToCents(data.price);
      validatePrice(normalizedPrice, 'Extra price');

      // If productId provided, verify inventory item exists
      if (data.productId) {
        const product = await prisma.inventoryItem.findUnique({
          where: { id: data.productId }
        });
        if (!product) {
          return errorResponse(ErrorCodes.NOT_FOUND, 'Inventory item not found');
        }
      }

      // Create extra at global level (no department/section assignment yet)
      const extra = await prisma.extra.create({
        data: {
          name: data.name,
          description: data.description || null,
          unit: data.unit,
          price: normalizedPrice,
          productId: data.productId || null,
          trackInventory: data.trackInventory ?? false,
          isActive: data.isActive ?? true,
        },
        include: {
          product: true,
          departmentExtras: true
        }
      });

      return extra;
    } catch (error) {
      throw normalizeError(error);
    }
  }

  /**
   * Create extra from existing inventory item (global registry)
   * After creation, use DepartmentExtrasService to allocate to departments
   * 
   * AUTHORIZATION:
   * - Requires authenticated user context
   */
  async createExtraFromProduct(data: {
    productId: string;
    unit: string; // Can override product unit
    priceOverride?: number; // If not set, uses product price
    trackInventory?: boolean;
  }) {
    try {
      const product = await prisma.inventoryItem.findUnique({
        where: { id: data.productId }
      });
      if (!product) {
        return errorResponse(ErrorCodes.NOT_FOUND, 'Inventory item not found');
      }

      // Use provided price or calculate from product unitPrice
      const price = data.priceOverride 
        ? normalizeToCents(data.priceOverride)
        : Math.round(parseFloat(product.unitPrice.toString()) * 100);

      return this.createExtra({
        name: product.name,
        description: product.description || undefined,
        unit: data.unit,
        price,
        productId: product.id,
        trackInventory: data.trackInventory ?? true, // Default to tracking when from product
        isActive: product.isActive
      });
    } catch (error) {
      throw normalizeError(error);
    }
  }

  /**
   * Get all active extras (global registry)
   * Extras are not filtered by department/section here - use DepartmentExtrasService for that
   */
  async getAllExtras(includeInactive = false) {
    try {
      const extras = await prisma.extra.findMany({
        where: includeInactive ? {} : { isActive: true },
        include: {
          product: true,
          departmentExtras: {
            include: {
              department: true,
              section: true
            }
          }
        },
        orderBy: { name: 'asc' }
      });

      return extras;
    } catch (error) {
      throw normalizeError(error);
    }
  }

  /**
   * Get single extra by ID
   */
  async getExtra(extraId: string) {
    try {
      const extra = await prisma.extra.findUnique({
        where: { id: extraId },
        include: {
          departmentSection: true,
          product: true
        }
      });

      if (!extra) {
        return errorResponse(ErrorCodes.NOT_FOUND, 'Extra not found');
      }

      return extra;
    } catch (error) {
      throw normalizeError(error);
    }
  }

  /**
   * Update an extra
   */
  async updateExtra(extraId: string, data: Partial<{
    name: string;
    description: string;
    unit: string;
    price: number;
    departmentSectionId: string;
    isActive: boolean;
  }>) {
    try {
      // Validate extra exists
      const extra = await prisma.extra.findUnique({ where: { id: extraId } });
      if (!extra) {
        return errorResponse(ErrorCodes.NOT_FOUND, 'Extra not found');
      }

      // Validate price if provided
      if (data.price !== undefined) {
        const normalizedPrice = normalizeToCents(data.price);
        validatePrice(normalizedPrice, 'Extra price');
        data.price = normalizedPrice;
      }

      // Validate departmentSectionId if provided
      if (data.departmentSectionId) {
        const section = await prisma.departmentSection.findUnique({
          where: { id: data.departmentSectionId }
        });
        if (!section) {
          return errorResponse(ErrorCodes.NOT_FOUND, 'Department section not found');
        }
      }

      const updated = await prisma.extra.update({
        where: { id: extraId },
        data,
        include: {
          departmentSection: true,
          product: true
        }
      });

      return updated;
    } catch (error) {
      throw normalizeError(error);
    }
  }

  /**
   * Delete an extra (soft delete via isActive)
   */
  async deleteExtra(extraId: string) {
    try {
      const extra = await prisma.extra.findUnique({ where: { id: extraId } });
      if (!extra) {
        return errorResponse(ErrorCodes.NOT_FOUND, 'Extra not found');
      }

      const updated = await prisma.extra.update({
        where: { id: extraId },
        data: { isActive: false },
        include: {
          departmentSection: true,
          product: true
        }
      });

      return updated;
    } catch (error) {
      throw normalizeError(error);
    }
  }

  /**
   * Add extras to an order line
   * Handles inventory deduction for tracked extras
   * Returns the created OrderExtra records
   */
  async addExtrasToOrderLine(data: {
    orderHeaderId: string;
    orderLineId: string;
    extras: Array<{
      extraId: string;
      quantity: number;
    }>;
  }) {
    try {
      // Validate order header exists
      const orderHeader = await prisma.orderHeader.findUnique({
        where: { id: data.orderHeaderId }
      });
      if (!orderHeader) {
        return errorResponse(ErrorCodes.NOT_FOUND, 'Order not found');
      }

      // Validate order line exists and belongs to this order
      const orderLine = await prisma.orderLine.findFirst({
        where: {
          id: data.orderLineId,
          orderHeaderId: data.orderHeaderId
        }
      });
      if (!orderLine) {
        return errorResponse(ErrorCodes.NOT_FOUND, 'Order line not found');
      }

      // Create order extras
      const orderExtras = await Promise.all(
        data.extras.map(async (extra) => {
          // Get extra details for pricing and inventory tracking
          const extraRecord = await prisma.extra.findUnique({
            where: { id: extra.extraId },
            include: { product: true }
          });
          if (!extraRecord) {
            throw new Error(`Extra ${extra.extraId} not found`);
          }

          const lineTotal = extra.quantity * extraRecord.price;

          // If extra is linked to inventory and tracking enabled, deduct from inventory
          if (extraRecord.productId && extraRecord.trackInventory && extraRecord.product) {
            // Check if sufficient inventory available
            if (extraRecord.product.quantity < extra.quantity) {
              throw new Error(
                `Insufficient inventory for ${extraRecord.name}. Available: ${extraRecord.product.quantity}, Requested: ${extra.quantity}`
              );
            }

            // Deduct from inventory
            await prisma.inventoryItem.update({
              where: { id: extraRecord.productId },
              data: {
                quantity: {
                  decrement: extra.quantity
                }
              }
            });

            // Log the movement
            await prisma.inventoryMovement.create({
              data: {
                inventoryItemId: extraRecord.productId,
                movementType: 'out',
                quantity: -extra.quantity,
                reason: `Extra added to order ${data.orderHeaderId}`,
                reference: data.orderHeaderId
              }
            });
          }

          return prisma.orderExtra.create({
            data: {
              orderHeaderId: data.orderHeaderId,
              orderLineId: data.orderLineId,
              extraId: extra.extraId,
              quantity: extra.quantity,
              unitPrice: extraRecord.price,
              lineTotal,
              status: 'pending'
            },
            include: {
              extra: {
                select: {
                  id: true,
                  name: true,
                  unit: true,
                  price: true
                }
              }
            }
          });
        })
      );

      return orderExtras;
    } catch (error) {
      throw normalizeError(error);
    }
  }

  /**
   * Get extras for an order
   */
  async getOrderExtras(orderHeaderId: string) {
    try {
      const extras = await prisma.orderExtra.findMany({
        where: { orderHeaderId },
        include: {
          extra: {
            select: {
              id: true,
              name: true,
              unit: true,
              price: true
            }
          },
          orderLine: {
            select: {
              id: true,
              productName: true,
              quantity: true
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      });

      return extras;
    } catch (error) {
      throw normalizeError(error);
    }
  }

  /**
   * Get extras for a specific order line
   */
  async getLineExtras(orderLineId: string) {
    try {
      const extras = await prisma.orderExtra.findMany({
        where: { orderLineId },
        include: {
          extra: {
            select: {
              id: true,
              name: true,
              unit: true,
              price: true
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      });

      return extras;
    } catch (error) {
      throw normalizeError(error);
    }
  }

  /**
   * Update order extra status
   */
  async updateOrderExtraStatus(orderExtraId: string, status: string) {
    try {
      const validStatuses = ['pending', 'processing', 'fulfilled', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return errorResponse(ErrorCodes.INVALID_INPUT, `Invalid status: ${status}`);
      }

      const orderExtra = await prisma.orderExtra.findUnique({
        where: { id: orderExtraId }
      });
      if (!orderExtra) {
        return errorResponse(ErrorCodes.NOT_FOUND, 'Order extra not found');
      }

      const updated = await prisma.orderExtra.update({
        where: { id: orderExtraId },
        data: { status },
        include: {
          extra: {
            select: {
              id: true,
              name: true,
              unit: true
            }
          }
        }
      });

      return updated;
    } catch (error) {
      throw normalizeError(error);
    }
  }

  /**
   * Calculate total cost of extras for an order
   */
  async calculateExtrasTotal(orderHeaderId: string): Promise<number> {
    try {
      const result = await prisma.orderExtra.aggregate({
        where: { 
          orderHeaderId,
          status: { not: 'cancelled' }
        },
        _sum: { lineTotal: true }
      });

      return result._sum.lineTotal || 0;
    } catch (error) {
      throw normalizeError(error);
    }
  }

  /**
   * Get extras usage statistics
   */
  async getExtrasStats(departmentSectionId?: string) {
    try {
      // Total extras sold
      const totalSold = await prisma.orderExtra.aggregate({
        where: {
          status: 'fulfilled',
          extra: departmentSectionId ? { departmentSectionId } : undefined
        },
        _count: { id: true },
        _sum: { quantity: true, lineTotal: true }
      });

      // Most popular extras
      const popularExtras = await prisma.orderExtra.groupBy({
        by: ['extraId'],
        where: {
          status: 'fulfilled',
          extra: departmentSectionId ? { departmentSectionId } : undefined
        },
        _sum: { quantity: true, lineTotal: true },
        _count: { id: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10
      });

      // Get extra details for popular items
      const popularWithDetails = await Promise.all(
        popularExtras.map(async (item: any) => {
          const extra = await prisma.extra.findUnique({
            where: { id: item.extraId }
          });
          return {
            extra,
            totalQuantity: item._sum.quantity || 0,
            totalRevenue: item._sum.lineTotal || 0,
            orderCount: item._count.id
          };
        })
      );

      return {
        totalSold: totalSold._count.id,
        totalQuantity: totalSold._sum.quantity || 0,
        totalRevenue: totalSold._sum.lineTotal || 0,
        popularExtras: popularWithDetails
      };
    } catch (error) {
      throw normalizeError(error);
    }
  }
}

export const extrasService = new ExtrasService();

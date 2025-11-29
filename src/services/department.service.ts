/**
 * Department Service
 * Handles department routing, fulfillment tracking, and department-specific operations
 */

import { BaseService } from './base.service';
import { IDepartment } from '../types/entities';
import { inventoryItemService } from './inventory.service';
import { prisma } from '../lib/prisma';
import { UserContext, requireRole } from '@/lib/authorization';
import { errorResponse, ErrorCodes } from '@/lib/api-response';

export class DepartmentService extends BaseService<IDepartment> {
  constructor() {
    super('department');
  }

  /**
   * Initialize departments (seed data)
   */
  async initializeDepartments() {
    try {
      const departments = [
        { code: 'HOTEL_BOOKING', name: 'Hotel Bookings', description: 'Room reservations and check-in/check-out' },
        { code: 'RESTAURANT', name: 'Restaurant', description: 'Food items and menu management' },
        { code: 'BAR_CLUB', name: 'Bar & Club', description: 'Drinks and beverages' },
        { code: 'GYM_MEMBERSHIP', name: 'Gym Membership', description: 'Gym memberships and sessions' },
        { code: 'SPORT_MEMBERSHIP', name: 'Sport Membership', description: 'Sport/fitness memberships' },
        { code: 'HOTEL_SERVICE', name: 'Hotel Services', description: 'Laundry, room service, amenities, spa' },
        { code: 'GAMES_ENTERTAINMENT', name: 'Games & Entertainment', description: 'Game credits and entertainment packages' },
        { code: 'EMPLOYEE_ORDER', name: 'Employee Orders', description: 'Employee purchases with discounts and debt tracking' },
      ];

      for (const dept of departments) {
        await (prisma as any).department.upsert({
          where: { code: dept.code },
          update: {},
          create: dept,
        });
      }

      return { success: true, message: 'Departments initialized' };
    } catch (error) {
      console.error('Error initializing departments:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to initialize departments');
    }
  }

  /**
   * Get all departments
   */
  async getAllDepartments() {
    try {
      const departments = await (prisma as any).department.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });

      return departments;
    } catch (error) {
      console.error('Error fetching departments:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch departments');
    }
  }

  /**
   * Get department by code
   */
  async getDepartmentByCode(code: string) {
    try {
      const department = await (prisma as any).department.findUnique({ where: { code } });

      if (!department) {
        return errorResponse(ErrorCodes.NOT_FOUND, 'Department not found');
      }

      return department;
    } catch (error) {
      console.error('Error fetching department:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch department');
    }
  }

  /**
   * Get orders by department
   */
  async getOrdersByDepartment(departmentCode: string, filters?: {
    status?: string;
    page?: number;
    limit?: number;
  }, ctx?: UserContext) {
    try {
      const forbidden = requireRole(ctx, ['admin', 'manager', 'staff']);
      if (forbidden) return forbidden;

      const page = filters?.page || 1;
      const limit = filters?.limit || 20;
      const skip = (page - 1) * limit;

      const department = await (prisma as any).department.findUnique({ where: { code: departmentCode } });
      if (!department) {
        return errorResponse(ErrorCodes.NOT_FOUND, 'Department not found');
      }

      const where: any = {
        orderDepartments: {
          some: { departmentId: department.id },
        },
      };

      if (filters?.status) {
        where.orderDepartments = {
          some: {
            departmentId: department.id,
            status: filters.status,
          },
        };
      }

      const [orders, total] = await Promise.all([
        (prisma as any).orderHeader.findMany({
          where,
          include: {
            customer: true,
            lines: { where: { departmentCode } },
            departments: true,
            fulfillments: true,
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        (prisma as any).orderHeader.count({ where }),
      ]);

      return {
        items: orders,
        meta: { page, limit, total, pages: Math.ceil(total / limit) },
      };
    } catch (error) {
      console.error('Error fetching department orders:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch department orders');
    }
  }

  /**
   * Update department fulfillment status
   */
  async updateDepartmentFulfillment(orderId: string, departmentCode: string, newStatus: string, ctx?: UserContext) {
    try {
      const forbidden = requireRole(ctx, ['admin', 'manager', 'staff']);
      if (forbidden) return forbidden;

      // Get department
      const department = await (prisma as any).department.findUnique({ where: { code: departmentCode } });
      if (!department) {
        return errorResponse(ErrorCodes.NOT_FOUND, 'Department not found');
      }

      // Update OrderDepartment status
      const orderDept = await (prisma as any).orderDepartment.update({
        where: {
          orderHeaderId_departmentId: {
            orderHeaderId: orderId,
            departmentId: department.id,
          },
        },
        data: { status: newStatus },
      });

      // Check if all departments fulfilled
      const allDepts = await (prisma as any).orderDepartment.findMany({ where: { orderHeaderId: orderId } });
      const allFulfilled = allDepts.every((d: any) => d.status === 'fulfilled' || d.status === 'completed');

      if (allFulfilled && newStatus === 'fulfilled') {
        await (prisma as any).orderHeader.update({
          where: { id: orderId },
          data: { status: 'fulfilled' },
        });
      }

      return orderDept;
    } catch (error) {
      console.error('Error updating department fulfillment:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to update fulfillment status');
    }
  }

  /**
   * Get department fulfillment stats
   */
  async getDepartmentStats(departmentCode: string, ctx?: UserContext) {
    try {
      const forbidden = requireRole(ctx, ['admin', 'manager']);
      if (forbidden) return forbidden;

      const department = await (prisma as any).department.findUnique({ where: { code: departmentCode } });
      if (!department) {
        return errorResponse(ErrorCodes.NOT_FOUND, 'Department not found');
      }

      const [pendingOrders, processingOrders, fulfilledOrders, completedOrders] = await Promise.all([
        (prisma as any).orderDepartment.count({
          where: { departmentId: department.id, status: 'pending' },
        }),
        (prisma as any).orderDepartment.count({
          where: { departmentId: department.id, status: 'processing' },
        }),
        (prisma as any).orderDepartment.count({
          where: { departmentId: department.id, status: 'fulfilled' },
        }),
        (prisma as any).orderDepartment.count({
          where: { departmentId: department.id, status: 'completed' },
        }),
      ]);

      return {
        department: department.name,
        pendingOrders,
        processingOrders,
        fulfilledOrders,
        completedOrders,
        totalOrders: pendingOrders + processingOrders + fulfilledOrders + completedOrders,
      };
    } catch (error) {
      console.error('Error fetching department stats:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch department statistics');
    }
  }

  /**
   * Recalculate and write section-level statistics into department.metadata
   * If a transaction client (`tx`) is provided, operations run on that client.
   */
  async recalculateSectionStats(departmentCode: string, tx?: any) {
    try {
      const client = tx || prisma;

      // Basic aggregates scoped to this department section (by departmentCode)
      // Count DISTINCT orders that have lines for this department section
      const [totalOrderIds, pendingLineIds, processingLineIds, fulfilledLineIds] = await Promise.all([
        client.orderLine.findMany({
          where: { departmentCode },
          distinct: ['orderHeaderId'],
          select: { orderHeaderId: true },
        }),
        client.orderLine.count({ where: { departmentCode, status: 'pending' } }),
        client.orderLine.count({ where: { departmentCode, status: 'processing' } }),
        client.orderLine.count({ where: { departmentCode, status: 'fulfilled' } }),
      ]);

      const totalOrders = totalOrderIds.length;
      const pendingOrders = pendingLineIds;
      const processingOrders = processingLineIds;
      const fulfilledOrders = fulfilledLineIds;

      const totalUnitsRes: any = await client.orderLine.aggregate({ _sum: { quantity: true }, where: { departmentCode } });
      const fulfilledUnitsRes: any = await client.orderLine.aggregate({ _sum: { quantity: true }, where: { departmentCode, status: 'fulfilled' } });
      const amountRes: any = await client.orderLine.aggregate({ _sum: { lineTotal: true }, where: { departmentCode, status: { in: ['fulfilled', 'completed'] } } });

      const totalUnits = totalUnitsRes._sum.quantity || 0;
      const fulfilledUnits = fulfilledUnitsRes._sum.quantity || 0;
      const totalAmount = amountRes._sum.lineTotal || 0;

      const stats = {
        totalOrders,
        pendingOrders,
        processingOrders,
        fulfilledOrders,
        totalUnits,
        fulfilledUnits,
        totalAmount,
        fulfillmentRate: totalUnits > 0 ? Math.round((fulfilledUnits / totalUnits) * 100) : 0,
        updatedAt: new Date(),
      };

      // Find department row by code and merge metadata
      const dept = await client.department.findUnique({ where: { code: departmentCode } });
      if (!dept) return stats;

      const existingMeta = (dept.metadata as any) || {};
      // Write stats into both `sectionStats` (section-aware key) and `stats` (legacy key)
      const merged = { ...existingMeta, sectionStats: stats, stats };

      await client.department.update({ where: { id: dept.id }, data: { metadata: merged } });

      return stats;
    } catch (error) {
      try { const logger = await import('@/lib/logger'); logger.error(error, { context: 'recalculateSectionStats' }); } catch {}
      console.error('Error recalculating section stats:', error);
      return null;
    }
  }

  /**
   * Get pending items for department
   * Used for kitchen display, bar display, etc.
   */
  async getDepartmentPendingItems(departmentCode: string, ctx?: UserContext) {
    try {
      const forbidden = requireRole(ctx, ['admin', 'manager', 'staff']);
      if (forbidden) return forbidden;

      const items = await (prisma as any).orderLine.findMany({
        where: {
          departmentCode,
          status: { in: ['pending', 'processing'] },
          orderHeader: { status: { not: 'cancelled' } },
        },
        include: {
          orderHeader: { include: { customer: true } },
          fulfillments: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      return items;
    } catch (error) {
      console.error('Error fetching pending items:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch pending items');
    }
  }

  /**
   * Mark line item as in progress for department
   */
  async markItemInProgress(orderLineId: string, departmentCode: string, ctx?: UserContext) {
    try {
      const forbidden = requireRole(ctx, ['admin', 'manager', 'staff']);
      if (forbidden) return forbidden;

      const line = await (prisma as any).orderLine.update({
        where: { id: orderLineId },
        data: { status: 'processing' },
      });

      // Create fulfillment record
      await (prisma as any).orderFulfillment.create({
        data: {
          orderHeaderId: line.orderHeaderId,
          orderLineId: orderLineId,
          status: 'in_progress',
          fulfilledQuantity: 0,
        },
      });

      return line;
    } catch (error) {
      console.error('Error marking item in progress:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to mark item in progress');
    }
  }

  /**
   * Complete fulfillment for line item
   */
  async completeLineItemFulfillment(orderLineId: string, quantity: number, ctx?: UserContext) {
    try {
      const forbidden = requireRole(ctx, ['admin', 'manager', 'staff']);
      if (forbidden) return forbidden;

      const line = await (prisma as any).orderLine.findUnique({ where: { id: orderLineId } });
      if (!line) {
        return errorResponse(ErrorCodes.NOT_FOUND, 'Order line not found');
      }

      // Update line status
      const updatedLine = await (prisma as any).orderLine.update({
        where: { id: orderLineId },
        data: { status: 'fulfilled' },
      });

      // Update fulfillment record
      await (prisma as any).orderFulfillment.updateMany({
        where: { orderLineId, status: 'in_progress' },
        data: {
          status: 'fulfilled',
          fulfilledQuantity: quantity,
          fulfilledAt: new Date(),
        },
      });

      // Check if order is fully fulfilled
      const allLines = await (prisma as any).orderLine.findMany({
        where: { orderHeaderId: line.orderHeaderId },
      });

      const allFulfilled = allLines.every((l: any) => l.status === 'fulfilled' || l.status === 'cancelled');
      if (allFulfilled) {
        await (prisma as any).orderHeader.update({
          where: { id: line.orderHeaderId },
          data: { status: 'fulfilled' },
        });
      }

      // Recalculate section stats for this line's department
      try {
        if (line.departmentCode) await this.recalculateSectionStats(line.departmentCode as string);
      } catch (e) {
        try { const logger = await import('@/lib/logger'); logger.error(e, { context: 'recalculateSectionStats.completeLineItem' }); } catch {}
      }

      return updatedLine;
    } catch (error) {
      console.error('Error completing fulfillment:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to complete fulfillment');
    }
  }

  /**
   * Get department inventory for RESTAURANT and BAR_CLUB
   */
  async getDepartmentInventory(departmentCode: string) {
    try {
      if (!['RESTAURANT', 'BAR_CLUB'].includes(departmentCode)) {
        return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Department does not have inventory tracking');
      }

      const items = await prisma.inventoryItem.findMany({
        where: {
          category: departmentCode === 'RESTAURANT' ? 'food' : 'drink',
        },
        include: {
          reservations: {
            where: {
              status: 'reserved',
              orderHeader: { status: { not: 'cancelled' } },
            },
          },
        } as any,
      });

      return items;
    } catch (error) {
      console.error('Error fetching department inventory:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch inventory');
    }
  }

  /**
   * Get department menu derived from inventory items
   * Returns menu-like items { id, inventoryId, name, price, type, available }
   */
  async getDepartmentMenu(departmentCode: string) {
    try {
      // Resolve department row if possible to determine its logical type
      let category: string | null = null
      try {
        const dept = await (prisma as any).department.findUnique({ where: { code: departmentCode } })
        if (dept) {
          // Prefer department.type values (e.g., 'restaurants', 'bars')
          const t = (dept.type || '').toString().toLowerCase()
          if (t.includes('restaurant') || t.includes('restaurants')) category = 'food'
          else if (t.includes('bar') || t.includes('bars')) category = 'drink'
        }
      } catch (e) {
        // ignore, we'll fallback to direct string mapping
      }

      // Fallback mapping for legacy department codes
      if (!category) {
        const up = (departmentCode || '').toString().toUpperCase()
        if (up === 'RESTAURANT' || up === 'RESTAURANT_DEPT') category = 'food'
        else if (up === 'BAR_CLUB' || up === 'BAR' || up === 'BAR_AND_CLUBS') category = 'drink'
      }

      if (!category) {
        return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Department does not expose a menu')
      }

      // Use inventory service to fetch items by category
      const items = await inventoryItemService.getByCategory(category)

      // Map inventory items to menu shape
      const menu = items.map((it: any) => ({
        id: `menu-${it.id}`,
        inventoryId: it.id,
        name: it.name,
        price: typeof it.unitPrice === 'object' && typeof it.unitPrice.toNumber === 'function' ? it.unitPrice.toNumber() : Number(it.unitPrice),
        type: category,
        available: it.quantity > 0,
      }));

      return menu;
    } catch (error) {
      console.error('Error building department menu:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch department menu');
    }
  }
}

export const departmentService = new DepartmentService();

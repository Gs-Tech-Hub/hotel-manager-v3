/**
 * Department Service
 * Handles department routing, fulfillment tracking, and department-specific operations
 * 
 * PRICE CONSISTENCY:
 * - Stats track totalAmount in cents (from lineTotal INT field)
 * - Department summary prices are always in cents
 * - Currency conversions handled by price utilities
 */

import { BaseService } from './base.service';
import { IDepartment } from '@/types/entities';
import { inventoryItemService } from './inventory.service';
import { prisma } from '@/lib/auth/prisma';
import { UserContext, requireRole } from '@/lib/auth/authorization';
import { errorResponse, ErrorCodes } from '@/lib/api-response';
import { validatePrice } from '@/lib/price';
import { buildDateFilter, getTodayDate } from '@/lib/date-filter';

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
   * Recalculate stats for a section (scoped by departmentSectionId)
   * Updates the section's metadata with stats, and parent's with aggregated rollup
   * @param departmentCode - Department code
   * @param sectionId - Optional section ID (if provided, calculates for section; else for department)
   * @param fromDate - Optional start date (YYYY-MM-DD format); defaults to today
   * @param toDate - Optional end date (YYYY-MM-DD format); defaults to today
   * @param tx - Optional transaction client
   */
  async recalculateSectionStats(departmentCode: string, sectionId?: string, fromDate?: string, toDate?: string, tx?: any) {
    try {
      const client = tx || prisma;

      // Use provided dates or default to today
      const defaultDate = getTodayDate();
      const dateFrom = fromDate || defaultDate;
      const dateTo = toDate || defaultDate;
      const dateFilter = buildDateFilter(dateFrom, dateTo);

      // If sectionId provided, calculate stats for that specific section
      // Otherwise, calculate for department level (for backward compatibility)
      const baseWhere: any = { 
        departmentCode, 
        orderHeader: {
          ...dateFilter,
          // Exclude cancelled and refunded orders from stats
          status: { notIn: ['cancelled', 'refunded'] }
        }
      };
      if (sectionId) {
        baseWhere.departmentSectionId = sectionId;
      }

      // ============ UNPAID ORDERS (paymentStatus = 'unpaid') ============
      const unpaidWhere = {
        ...baseWhere,
        orderHeader: {
          ...baseWhere.orderHeader,
          paymentStatus: 'unpaid'
        }
      };

      const unpaidTotalOrderIds = await client.orderLine.findMany({
        where: { ...unpaidWhere, status: { notIn: ['cancelled', 'refunded'] } },
        distinct: ['orderHeaderId'],
        select: { orderHeaderId: true },
      });
      
      const unpaidPendingCount = await client.orderLine.count({ where: { ...unpaidWhere, status: 'pending' } });
      const unpaidProcessingCount = await client.orderLine.count({ where: { ...unpaidWhere, status: 'processing' } });
      const unpaidFulfilledCount = await client.orderLine.count({ where: { ...unpaidWhere, status: 'fulfilled' } });

      const unpaidTotalUnitsRes: any = await client.orderLine.aggregate({ 
        _sum: { quantity: true }, 
        where: { ...unpaidWhere, status: { notIn: ['cancelled', 'refunded'] } } 
      });
      const unpaidFulfilledUnitsRes: any = await client.orderLine.aggregate({ 
        _sum: { quantity: true }, 
        where: { ...unpaidWhere, status: 'fulfilled' } 
      });
      const unpaidAmountRes: any = await client.orderLine.aggregate({ 
        _sum: { lineTotal: true }, 
        where: { ...unpaidWhere, status: { notIn: ['cancelled', 'refunded'] } } 
      });

      const unpaidStats = {
        totalOrders: unpaidTotalOrderIds.length,
        pendingOrders: unpaidPendingCount,
        processingOrders: unpaidProcessingCount,
        fulfilledOrders: unpaidFulfilledCount,
        totalUnits: unpaidTotalUnitsRes._sum.quantity || 0,
        fulfilledUnits: unpaidFulfilledUnitsRes._sum.quantity || 0,
        totalAmount: unpaidAmountRes._sum.lineTotal || 0, // Total amount for unpaid orders
        fulfillmentRate: (unpaidTotalUnitsRes._sum.quantity || 0) > 0 
          ? Math.round(((unpaidFulfilledUnitsRes._sum.quantity || 0) / (unpaidTotalUnitsRes._sum.quantity || 0)) * 100) 
          : 0,
        updatedAt: new Date(),
      };

      validatePrice(unpaidStats.totalAmount, `${sectionId ? 'sectionStats.unpaid' : 'deptStats.unpaid'} totalAmount for ${departmentCode}`);

      // ============ PAID ORDERS (paymentStatus = 'paid' OR 'partial') ============
      const paidWhere = {
        ...baseWhere,
        orderHeader: {
          ...baseWhere.orderHeader,
          paymentStatus: { in: ['paid', 'partial'] }
        }
      };

      const paidTotalOrderIds = await client.orderLine.findMany({
        where: { ...paidWhere, status: { notIn: ['cancelled', 'refunded'] } },
        distinct: ['orderHeaderId'],
        select: { orderHeaderId: true },
      });

      const paidPendingCount = await client.orderLine.count({ where: { ...paidWhere, status: 'pending' } });
      const paidProcessingCount = await client.orderLine.count({ where: { ...paidWhere, status: 'processing' } });
      const paidFulfilledCount = await client.orderLine.count({ where: { ...paidWhere, status: 'fulfilled' } });

      const paidTotalUnitsRes: any = await client.orderLine.aggregate({ 
        _sum: { quantity: true }, 
        where: { ...paidWhere, status: { notIn: ['cancelled', 'refunded'] } } 
      });
      const paidFulfilledUnitsRes: any = await client.orderLine.aggregate({ 
        _sum: { quantity: true }, 
        where: { ...paidWhere, status: 'fulfilled' } 
      });
      const paidAmountRes: any = await client.orderLine.aggregate({ 
        _sum: { lineTotal: true }, 
        where: { ...paidWhere, status: { notIn: ['cancelled', 'refunded'] } } 
      });

      const paidStats = {
        totalOrders: paidTotalOrderIds.length,
        pendingOrders: paidPendingCount,
        processingOrders: paidProcessingCount,
        fulfilledOrders: paidFulfilledCount,
        totalUnits: paidTotalUnitsRes._sum.quantity || 0,
        fulfilledUnits: paidFulfilledUnitsRes._sum.quantity || 0,
        totalAmount: paidAmountRes._sum.lineTotal || 0, // Total amount for paid orders
        amountFulfilled: paidFulfilledUnitsRes._sum.quantity || 0, // Fulfilled units in paid orders
        fulfillmentRate: (paidTotalUnitsRes._sum.quantity || 0) > 0 
          ? Math.round(((paidFulfilledUnitsRes._sum.quantity || 0) / (paidTotalUnitsRes._sum.quantity || 0)) * 100) 
          : 0,
        updatedAt: new Date(),
      };

      validatePrice(paidStats.totalAmount, `${sectionId ? 'sectionStats.paid' : 'deptStats.paid'} totalAmount for ${departmentCode}`);

      const stats = {
        unpaid: unpaidStats,
        paid: paidStats,
        updatedAt: new Date(),
      };

      // Log aggregated data for verification
      console.log(`[recalculateSectionStats] ${sectionId ? `Section ${sectionId}` : `Department ${departmentCode}`} Stats:`, {
        unpaid: {
          totalOrders: unpaidStats.totalOrders,
          pendingOrders: unpaidStats.pendingOrders,
          processingOrders: unpaidStats.processingOrders,
          fulfilledOrders: unpaidStats.fulfilledOrders,
          totalUnits: unpaidStats.totalUnits,
          fulfilledUnits: unpaidStats.fulfilledUnits,
          totalAmount: unpaidStats.totalAmount,
          fulfillmentRate: unpaidStats.fulfillmentRate,
        },
        paid: {
          totalOrders: paidStats.totalOrders,
          pendingOrders: paidStats.pendingOrders,
          processingOrders: paidStats.processingOrders,
          fulfilledOrders: paidStats.fulfilledOrders,
          totalUnits: paidStats.totalUnits,
          fulfilledUnits: paidStats.fulfilledUnits,
          totalAmount: paidStats.totalAmount,
          fulfillmentRate: paidStats.fulfillmentRate,
        },
        aggregated: {
          totalOrders: unpaidStats.totalOrders + paidStats.totalOrders,
          totalPending: unpaidStats.pendingOrders + paidStats.pendingOrders,
          totalProcessing: unpaidStats.processingOrders + paidStats.processingOrders,
          totalFulfilled: unpaidStats.fulfilledOrders + paidStats.fulfilledOrders,
          totalUnits: unpaidStats.totalUnits + paidStats.totalUnits,
          totalFulfilledUnits: unpaidStats.fulfilledUnits + paidStats.fulfilledUnits,
          totalAmount: unpaidStats.totalAmount + paidStats.totalAmount,
        },
      });

      // If sectionId provided, update the SECTION's metadata
      if (sectionId) {
        const section = await client.departmentSection.findUnique({ where: { id: sectionId } });
        if (!section) return stats;

        const existingMeta = (section.metadata as any) || {};
        // Write stats into section's sectionStats key
        const merged = { ...existingMeta, sectionStats: stats };

        await client.departmentSection.update({ where: { id: sectionId }, data: { metadata: merged } });
      } else {
        // If no sectionId, update parent department's stats (for backward compatibility)
        const dept = await client.department.findUnique({ where: { code: departmentCode } });
        if (!dept) return stats;

        const existingMeta = (dept.metadata as any) || {};
        // Write stats into both `sectionStats` and `stats` for backward compatibility
        const merged = { ...existingMeta, sectionStats: stats, stats };

        await client.department.update({ where: { id: dept.id }, data: { metadata: merged } });
      }

      return stats;
    } catch (error) {
      try { const logger = await import('@/lib/logger'); logger.error(error, { context: 'recalculateSectionStats' }); } catch {}
      console.error('Error recalculating section stats:', error);
      return null;
    }
  }

  /**
   * Roll up section stats into parent department metadata
   * Called after transactions to keep parent totals current
   */
  async rollupParentStats(departmentCode: string, tx?: any) {
    try {
      const client = tx || prisma;

      // Extract parent code from section code (e.g., "restaurant:main" -> "restaurant")
      const parentCode = departmentCode.split(':')[0];
      if (!parentCode || parentCode === departmentCode) {
        // This is already a parent; no rollup needed
        return;
      }

      // Get parent department
      const parent = await client.department.findUnique({ where: { code: parentCode } });
      if (!parent) return;

      // Find all section departments for this parent
      const prefix = `${parentCode}:`;
      const sections = await client.department.findMany({
        where: { code: { startsWith: prefix }, isActive: true },
        select: { id: true, code: true, metadata: true },
      });

      if (!sections || sections.length === 0) return;

      // Collect stats from each section
      const sectionStatsList: any[] = [];
      for (const s of sections) {
        const meta = (s.metadata || {}) as any;
        const stats = meta?.sectionStats || meta?.stats;
        if (stats) sectionStatsList.push({ code: s.code, id: s.id, stats });
      }

      // Sum stats across sections, separating unpaid and paid
      const unpaidRollup = {
        totalOrders: 0,
        pendingOrders: 0,
        processingOrders: 0,
        fulfilledOrders: 0,
        totalUnits: 0,
        fulfilledUnits: 0,
        totalAmount: 0,
      };

      const paidRollup = {
        totalOrders: 0,
        pendingOrders: 0,
        processingOrders: 0,
        fulfilledOrders: 0,
        totalUnits: 0,
        fulfilledUnits: 0,
        totalAmount: 0,
      };

      for (const s of sectionStatsList) {
        const st = s.stats as any;
        
        // Aggregate unpaid stats
        if (st.unpaid) {
          const u = st.unpaid;
          unpaidRollup.totalOrders += Number(u.totalOrders || 0);
          unpaidRollup.pendingOrders += Number(u.pendingOrders || 0);
          unpaidRollup.processingOrders += Number(u.processingOrders || 0);
          unpaidRollup.fulfilledOrders += Number(u.fulfilledOrders || 0);
          unpaidRollup.totalUnits += Number(u.totalUnits || 0);
          unpaidRollup.fulfilledUnits += Number(u.fulfilledUnits || 0);
          unpaidRollup.totalAmount += Number(u.totalAmount || 0);
        }

        // Aggregate paid stats
        if (st.paid) {
          const p = st.paid;
          paidRollup.totalOrders += Number(p.totalOrders || 0);
          paidRollup.pendingOrders += Number(p.pendingOrders || 0);
          paidRollup.processingOrders += Number(p.processingOrders || 0);
          paidRollup.fulfilledOrders += Number(p.fulfilledOrders || 0);
          paidRollup.totalUnits += Number(p.totalUnits || 0);
          paidRollup.fulfilledUnits += Number(p.fulfilledUnits || 0);
          paidRollup.totalAmount += Number(p.totalAmount || 0);
        }

        // Backward compatibility: if old format stats exist
        if (st.totalOrders !== undefined && !st.unpaid && !st.paid) {
          // Assume old format is paid stats
          paidRollup.totalOrders += Number(st.totalOrders || 0);
          paidRollup.pendingOrders += Number(st.pendingOrders || 0);
          paidRollup.processingOrders += Number(st.processingOrders || 0);
          paidRollup.fulfilledOrders += Number(st.fulfilledOrders || 0);
          paidRollup.totalUnits += Number(st.totalUnits || 0);
          paidRollup.fulfilledUnits += Number(st.fulfilledUnits || 0);
          paidRollup.totalAmount += Number(st.totalAmount || st.amount || 0);
        }
      }

      const unpaidFulfillmentRate = unpaidRollup.totalUnits > 0 ? Math.round((unpaidRollup.fulfilledUnits / unpaidRollup.totalUnits) * 100) : 0;
      const paidFulfillmentRate = paidRollup.totalUnits > 0 ? Math.round((paidRollup.fulfilledUnits / paidRollup.totalUnits) * 100) : 0;

      const unpaidParentStats = {
        ...unpaidRollup,
        fulfillmentRate: unpaidFulfillmentRate,
        updatedAt: new Date(),
      };

      const paidParentStats = {
        ...paidRollup,
        fulfillmentRate: paidFulfillmentRate,
        updatedAt: new Date(),
      };

      // Log rollup results for verification
      console.log(`[rollupParentStats] Department ${departmentCode} Rollup:`, {
        sectionCount: sectionStatsList.length,
        unpaidRollup: {
          totalOrders: unpaidRollup.totalOrders,
          pendingOrders: unpaidRollup.pendingOrders,
          processingOrders: unpaidRollup.processingOrders,
          fulfilledOrders: unpaidRollup.fulfilledOrders,
          totalUnits: unpaidRollup.totalUnits,
          fulfilledUnits: unpaidRollup.fulfilledUnits,
          totalAmount: unpaidRollup.totalAmount,
          fulfillmentRate: unpaidFulfillmentRate,
        },
        paidRollup: {
          totalOrders: paidRollup.totalOrders,
          pendingOrders: paidRollup.pendingOrders,
          processingOrders: paidRollup.processingOrders,
          fulfilledOrders: paidRollup.fulfilledOrders,
          totalUnits: paidRollup.totalUnits,
          fulfilledUnits: paidRollup.fulfilledUnits,
          totalAmount: paidRollup.totalAmount,
          fulfillmentRate: paidFulfillmentRate,
        },
        combined: {
          totalOrders: unpaidRollup.totalOrders + paidRollup.totalOrders,
          totalPending: unpaidRollup.pendingOrders + paidRollup.pendingOrders,
          totalProcessing: unpaidRollup.processingOrders + paidRollup.processingOrders,
          totalFulfilled: unpaidRollup.fulfilledOrders + paidRollup.fulfilledOrders,
          totalUnits: unpaidRollup.totalUnits + paidRollup.totalUnits,
          totalFulfilledUnits: unpaidRollup.fulfilledUnits + paidRollup.fulfilledUnits,
          totalAmount: unpaidRollup.totalAmount + paidRollup.totalAmount,
        },
      });

      // Merge into parent metadata with split stats
      const existingMeta = (parent.metadata as any) || {};
      const merged = { 
        ...existingMeta, 
        stats: {
          unpaid: unpaidParentStats,
          paid: paidParentStats,
          updatedAt: new Date(),
        },
        sectionRollups: sectionStatsList 
      };
      await client.department.update({ where: { id: parent.id }, data: { metadata: merged } });
    } catch (error) {
      try { const logger = await import('@/lib/logger'); logger.error(error, { context: 'rollupParentStats' }); } catch {}
      console.error('Error rolling up parent stats:', error);
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
   * Returns menu-like items { id, inventoryId, name, price, type, available, quantity }
   * Uses inventory quantities directly (global stock)
   */
  async getDepartmentMenu(departmentCode: string) {
    try {
      // Handle section codes (format: PARENT:section) by extracting parent code
      const lookupCode = departmentCode.includes(':') ? departmentCode.split(':')[0] : departmentCode;
      
      // Resolve department to get its logical type
      let category: string | null = null
      try {
        const dept = await (prisma as any).department.findUnique({ where: { code: lookupCode } })
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
        const up = (lookupCode || '').toString().toUpperCase()
        if (up === 'RESTAURANT' || up === 'RESTAURANT_DEPT') category = 'food'
        else if (up === 'BAR_CLUB' || up === 'BAR' || up === 'BAR_AND_CLUBS') category = 'drink'
      }

      if (!category) {
        return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Department does not expose a menu')
      }

      // If this is a section code, validate the section exists before trying to fetch menu
      if (departmentCode.includes(':')) {
        // Pre-validate section exists
        const parts = departmentCode.split(':');
        const parentCode = parts[0];
        const sectionSlugOrId = parts.slice(1).join(':');
        
        const parentDept = await (prisma as any).department.findUnique({ 
          where: { code: parentCode } 
        });
        
        if (!parentDept) {
          return errorResponse(ErrorCodes.NOT_FOUND, `Parent department '${parentCode}' not found`);
        }
        
        const section = await (prisma as any).departmentSection.findFirst({
          where: {
            departmentId: parentDept.id,
            isActive: true,
            OR: [
              { slug: sectionSlugOrId },
              { id: sectionSlugOrId }
            ]
          }
        });
        
        if (!section) {
          return errorResponse(ErrorCodes.NOT_FOUND, `Section '${sectionSlugOrId}' not found or is inactive`);
        }
        
        // Section exists, fetch its menu
        const items = await this.getSectionMenuItems(departmentCode, category);
        return items;
      }

      // Use inventory service to fetch items by category (parent department level)
      const items = await inventoryItemService.getByCategory(category)

      // Map inventory items to menu shape with quantities
      const menu = items.map((it: any) => {
        // Use the global inventory quantity
        const quantity = Number(it.quantity || 0)
        
        // Convert unitPrice (major units) to cents (minor units)
        const priceInCents = Math.round((typeof it.unitPrice === 'object' && typeof it.unitPrice.toNumber === 'function' ? it.unitPrice.toNumber() : Number(it.unitPrice)) * 100)

        return {
          id: it.id, // Use the actual inventory item ID (no prefix)
          name: it.name,
          price: priceInCents, // Return price in cents (minor units)
          type: category,
          available: quantity > 0,
          quantity: quantity,
        }
      })

      return menu;
    } catch (error) {
      console.error('Error building department menu:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch department menu');
    }
  }

  private async getSectionMenuItems(sectionCode: string, category: string) {
    try {
      // Validate section code format
      if (!sectionCode || !sectionCode.includes(':')) {
        return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Invalid section code format');
      }

      const parts = sectionCode.split(':');
      const parentCode = parts[0];
      const sectionSlugOrId = parts.slice(1).join(':');

      if (!parentCode || !sectionSlugOrId) {
        return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Invalid section code format');
      }

      // Find the parent department
      const parentDept = await (prisma as any).department.findUnique({ 
        where: { code: parentCode } 
      });
      if (!parentDept) {
        return errorResponse(ErrorCodes.NOT_FOUND, 'Parent department not found');
      }

      // Find the section - must exist and be active
      const section = await (prisma as any).departmentSection.findFirst({
        where: {
          departmentId: parentDept.id,
          isActive: true,
          OR: [
            { slug: sectionSlugOrId },
            { id: sectionSlugOrId }
          ]
        }
      });

      if (!section) {
        return errorResponse(ErrorCodes.NOT_FOUND, `Section '${sectionSlugOrId}' not found or is inactive`);
      }

      // Get section-specific inventory
      const inventories = await (prisma as any).departmentInventory.findMany({
        where: {
          sectionId: section.id,
          inventoryItem: {
            category: category
          }
        },
        include: {
          inventoryItem: true
        }
      });

      // Map inventory items to menu shape
      // NOTE: Extras are NOT included in the POS menu. They are only available
      // when adding items to an existing order via the OrderExtrasDialog.
      // This separation ensures extras don't clutter the POS checkout flow.
      const menu = inventories.map((inv: any) => {
        const quantity = Number(inv.quantity || 0);
        const priceInCents = Math.round((typeof inv.inventoryItem.unitPrice === 'object' && typeof inv.inventoryItem.unitPrice.toNumber === 'function' ? inv.inventoryItem.unitPrice.toNumber() : Number(inv.inventoryItem.unitPrice)) * 100);

        return {
          id: inv.inventoryItemId,
          name: inv.inventoryItem.name,
          price: priceInCents,
          type: category,
          available: quantity > 0,
          quantity: quantity,
          itemType: 'inventory' as const,
        };
      });

      return menu;
    } catch (error) {
      console.error('Error building section menu:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch section menu');
    }
  }
}

export const departmentService = new DepartmentService();

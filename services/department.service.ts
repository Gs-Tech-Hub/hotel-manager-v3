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

      // Get unique orders with lines in the specified section/department
      // We need to aggregate by ORDER TOTAL (which includes extras, tax, discounts)
      // not by individual line items
      const orderIds = await client.orderLine.findMany({
        where: {
          departmentCode,
          ...(sectionId && { departmentSectionId: sectionId })
        },
        distinct: ['orderHeaderId'],
        select: { orderHeaderId: true }
      });

      // Fetch full orders with their totals, extras, and payment info
      const orders = await client.orderHeader.findMany({
        where: {
          id: { in: orderIds.map((o: any) => o.orderHeaderId) },
          ...dateFilter,
          status: { notIn: ['cancelled', 'refunded'] }
        },
        include: {
          payments: true,
          extras: true,
          lines: {
            where: sectionId ? { departmentSectionId: sectionId } : undefined
          }
        }
      });

      console.log(`[recalculateSectionStats] ${sectionId ? `Section ${sectionId}` : `Department ${departmentCode}`} - Found ${orders.length} orders`);

      // Calculate stats from ORDER TOTALS (which include extras, tax, discounts)
      let unpaidStats = {
        totalOrders: 0,
        pendingOrders: 0,
        processingOrders: 0,
        fulfilledOrders: 0,
        totalUnits: 0,
        fulfilledUnits: 0,
        totalAmount: 0,
        fulfillmentRate: 0,
        updatedAt: new Date(),
      };

      let paidStats = {
        totalOrders: 0,
        pendingOrders: 0,
        processingOrders: 0,
        fulfilledOrders: 0,
        totalUnits: 0,
        fulfilledUnits: 0,
        totalAmount: 0,
        amountFulfilled: 0,
        fulfillmentRate: 0,
        updatedAt: new Date(),
      };

      // Separate tracker for aggregated (full order totals regardless of payment)
      let aggregatedTotalAmount = 0;

      for (const order of orders) {
        const totalPaid = order.payments.reduce((sum: number, p: any) => sum + p.amount, 0);
        const isPaid = totalPaid >= order.total;
        const isUnpaid = totalPaid === 0;
        const isPartial = !isPaid && !isUnpaid; // 0 < paid < total
        const sectionLines = order.lines || [];
        const totalUnits = sectionLines.reduce((sum: number, line: any) => sum + line.quantity, 0);
        const fulfilledUnits = sectionLines.filter((line: any) => line.status === 'fulfilled')
          .reduce((sum: number, line: any) => sum + line.quantity, 0);
        
        const extrasTotal = order.extras?.reduce((sum: number, e: any) => sum + (e.lineTotal || 0), 0) || 0;

        console.log(`  [Order ${order.id}] total=${order.total}, paid=${totalPaid}, status=${order.status}, isPaid=${isPaid}, isUnpaid=${isUnpaid}, isPartial=${isPartial}, units=${totalUnits}, extras=${order.extras?.length || 0} (totalExtras=${extrasTotal})`);

        if (isPartial) {
          // Split partial payment: paid portion to paidStats, owed portion to unpaidStats
          const paidAmount = totalPaid;
          const owedAmount = order.total - totalPaid;
          console.log(`    → PARTIAL: +${paidAmount} to PAID, +${owedAmount} to UNPAID (split from total ${order.total})`);
          
          // Add paid portion to paid stats
          paidStats.totalAmount += paidAmount;
          if (order.status === 'fulfilled') paidStats.amountFulfilled += paidAmount;
          
          // Add owed portion to unpaid stats
          unpaidStats.totalAmount += owedAmount;
          
          // For order counts: count the order in both paid and unpaid (since it's split)
          paidStats.totalOrders += 1;
          unpaidStats.totalOrders += 1;
          
          // For fulfillment: distribute units based on payment portion (or could assign all to unpaid if preferred)
          // Here we assign all to unpaid since it's the remaining work
          unpaidStats.totalUnits += totalUnits;
          unpaidStats.fulfilledUnits += fulfilledUnits;
          
          // Status tracking: count in both
          if (order.status === 'pending') {
            paidStats.pendingOrders += 1;
            unpaidStats.pendingOrders += 1;
          }
          if (order.status === 'processing') {
            paidStats.processingOrders += 1;
            unpaidStats.processingOrders += 1;
          }
          if (order.status === 'fulfilled') {
            paidStats.fulfilledOrders += 1;
            unpaidStats.fulfilledOrders += 1;
          }
        } else if (isUnpaid) {
          // Completely unpaid: full order total goes to unpaid
          console.log(`    → Adding to UNPAID: +${order.total} (completely unpaid)`);
          unpaidStats.totalOrders += 1;
          unpaidStats.totalAmount += order.total;
          unpaidStats.totalUnits += totalUnits;
          unpaidStats.fulfilledUnits += fulfilledUnits;
          if (order.status === 'pending') unpaidStats.pendingOrders += 1;
          if (order.status === 'processing') unpaidStats.processingOrders += 1;
          if (order.status === 'fulfilled') unpaidStats.fulfilledOrders += 1;
        } else if (isPaid) {
          console.log(`    → Adding to PAID: +${order.total} (base + extras breakdown: ${order.total - extrasTotal} + ${extrasTotal})`);
          paidStats.totalOrders += 1;
          paidStats.totalAmount += order.total;
          paidStats.totalUnits += totalUnits;
          paidStats.fulfilledUnits += fulfilledUnits;
          if (order.status === 'fulfilled') paidStats.amountFulfilled += order.total;
          if (order.status === 'pending') paidStats.pendingOrders += 1;
          if (order.status === 'processing') paidStats.processingOrders += 1;
          if (order.status === 'fulfilled') paidStats.fulfilledOrders += 1;
        }

        // Always add full order total to aggregated (regardless of payment status)
        aggregatedTotalAmount += order.total;
      }

      // Calculate fulfillment rates
      unpaidStats.fulfillmentRate = unpaidStats.totalUnits > 0 
        ? Math.round((unpaidStats.fulfilledUnits / unpaidStats.totalUnits) * 100)
        : 0;
      paidStats.fulfillmentRate = paidStats.totalUnits > 0 
        ? Math.round((paidStats.fulfilledUnits / paidStats.totalUnits) * 100)
        : 0;

      console.log(`[recalculateSectionStats] FINAL AGGREGATION:`);
      console.log(`  Unpaid: orders=${unpaidStats.totalOrders}, amount=${unpaidStats.totalAmount}, units=${unpaidStats.totalUnits}`);
      console.log(`  Paid: orders=${paidStats.totalOrders}, amount=${paidStats.totalAmount}, units=${paidStats.totalUnits}`);
      console.log(`  Total: amount=${aggregatedTotalAmount}, units=${unpaidStats.totalUnits + paidStats.totalUnits}`);

      validatePrice(unpaidStats.totalAmount, `${sectionId ? 'sectionStats.unpaid' : 'deptStats.unpaid'} totalAmount for ${departmentCode}`);
      validatePrice(paidStats.totalAmount, `${sectionId ? 'sectionStats.paid' : 'deptStats.paid'} totalAmount for ${departmentCode}`);

      const stats = {
        unpaid: unpaidStats,
        paid: paidStats,
        aggregated: {
          totalOrders: unpaidStats.totalOrders + paidStats.totalOrders,
          totalPending: unpaidStats.pendingOrders + paidStats.pendingOrders,
          totalProcessing: unpaidStats.processingOrders + paidStats.processingOrders,
          totalFulfilled: unpaidStats.fulfilledOrders + paidStats.fulfilledOrders,
          totalUnits: unpaidStats.totalUnits + paidStats.totalUnits,
          totalFulfilledUnits: unpaidStats.fulfilledUnits + paidStats.fulfilledUnits,
          totalAmount: aggregatedTotalAmount,
        },
        updatedAt: new Date(),
      };

      // Log aggregated data for verification - showing COMPLETE stats including extras
      console.log(`[recalculateSectionStats] ${sectionId ? `Section ${sectionId}` : `Department ${departmentCode}`} Stats (INCLUDING EXTRAS):`, {
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
          totalAmount: aggregatedTotalAmount,
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

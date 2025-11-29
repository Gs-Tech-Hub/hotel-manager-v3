/**
 * Enhanced Order Service
 * Comprehensive order management with multi-department support, discounts, and inventory
 */

import { BaseService } from './base.service';
import type { IOrderHeader } from '../types/entities';
import { prisma } from '../lib/prisma';
import { normalizeError } from '@/lib/errors';
import { normalizeToCents } from '@/lib/price';
import { UserContext, requireRoleOrOwner, requireRole } from '@/lib/authorization';
import { errorResponse, ErrorCodes } from '@/lib/api-response';

export class OrderService extends BaseService<IOrderHeader> {
  constructor() {
    super('orderHeader');
  }

  /**
   * Create comprehensive order with validation
   * Handles: inventory allocation, discount application, department routing
   */
  async createOrder(data: {
    customerId: string;
    items: Array<{
      productId: string;
      productType: string;
      productName: string;
      departmentCode: string;
      quantity: number;
      unitPrice: number;
    }>;
    discounts?: string[]; // Promo codes/rule IDs
    notes?: string;
  }, _ctx?: UserContext) {
    try {
      // Validate customer exists
      const customer = await prisma.customer.findUnique({ where: { id: data.customerId } });
      if (!customer) {
        return errorResponse(ErrorCodes.NOT_FOUND, 'Customer not found');
      }

      // Generate unique order number
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // Calculate subtotal and validate inventory (unit prices normalized to cents)
      let subtotal = 0;
      const departments = new Set<string>();

      for (const item of data.items) {
        const normalizedUnit = normalizeToCents(item.unitPrice)
        // attach normalized value back for later use
        ;(item as any)._normalizedUnitPrice = normalizedUnit
        subtotal += item.quantity * normalizedUnit
        departments.add(item.departmentCode);

        // Check inventory availability (for inventory-based departments)
        if (['RESTAURANT', 'BAR_CLUB'].includes(item.departmentCode)) {
          const inventory = await prisma.inventoryItem.findUnique({ where: { id: item.productId } });
          if (!inventory || inventory.quantity < item.quantity) {
            return errorResponse(ErrorCodes.VALIDATION_ERROR, `Insufficient inventory for ${item.productName}`);
          }
        }
      }

      // Create order header first (keep this operation minimal and fast)
      const header = await prisma.orderHeader.create({
        data: {
          orderNumber,
          customerId: data.customerId,
          subtotal,
          discountTotal: 0,
          tax: 0,
          total: subtotal,
          status: 'pending',
          notes: data.notes,
        },
      });

      // Pre-fetch department ids for routing
      const deptCodes = Array.from(departments);
      const deptMap: Record<string, string> = {};
      if (deptCodes.length) {
        const deptRecords = await prisma.department.findMany({ where: { code: { in: deptCodes } } });
        for (const d of deptRecords) {
          deptMap[d.code] = (d as any).id;
        }
      }

      // Helper: chunk array into batches
      const chunk = (arr: any[], size = 50) => {
        const out: any[][] = []
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
        return out
      }

      // Prepare order lines and reservation rows
      const linesData = data.items.map((item: any, idx: number) => ({
        lineNumber: idx + 1,
        orderHeaderId: header.id,
        departmentCode: item.departmentCode,
        productId: item.productId,
        productType: item.productType,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: (item as any)._normalizedUnitPrice ?? normalizeToCents(item.unitPrice),
        unitDiscount: 0,
        lineTotal: item.quantity * ((item as any)._normalizedUnitPrice ?? normalizeToCents(item.unitPrice)),
        status: 'pending',
      }));

      const reservationRows = data.items
        .filter((it: any) => ['RESTAURANT', 'BAR_CLUB'].includes(it.departmentCode))
        .map((it: any) => ({
          inventoryItemId: it.productId,
          orderHeaderId: header.id,
          quantity: it.quantity,
          status: 'reserved',
        }));

      const orderDepartmentRows: any[] = [];
      for (const code of deptCodes) {
        const deptId = deptMap[code];
        if (deptId) orderDepartmentRows.push({ orderHeaderId: header.id, departmentId: deptId, status: 'pending' });
      }

      // Insert lines/reservations/departments in chunks to avoid long-running single queries
      const lineBatches = chunk(linesData, 100)
      for (const b of lineBatches) {
        if (b.length) await prisma.orderLine.createMany({ data: b })
      }

      const resBatches = chunk(reservationRows, 100)
      for (const b of resBatches) {
        if (b.length) await prisma.inventoryReservation.createMany({ data: b })
      }

      const deptBatches = chunk(orderDepartmentRows, 50)
      for (const b of deptBatches) {
        if (b.length) await prisma.orderDepartment.createMany({ data: b })
      }

      const order = header

      // If discounts were provided at creation time, attempt to apply them now
      if (data.discounts && Array.isArray(data.discounts) && data.discounts.length > 0) {
        // Loop through codes and attempt to create OrderDiscounts (reuse same validations as applyDiscount)
        let accumulatedDiscount = 0
        for (const code of data.discounts) {
          if (!code) continue
          const rule = await prisma.discountRule.findUnique({ where: { code } })
          if (!rule) {
            // rollback created order? For now, return validation error so client can correct
            return errorResponse(ErrorCodes.VALIDATION_ERROR, `Discount code not found: ${code}`)
          }

          if (!rule.isActive) {
            return errorResponse(ErrorCodes.VALIDATION_ERROR, `Discount code inactive: ${code}`)
          }

          if (rule.minOrderAmount && subtotal < rule.minOrderAmount) {
            return errorResponse(ErrorCodes.VALIDATION_ERROR, `Minimum order amount of ${rule.minOrderAmount} required for discount ${code}`)
          }

          // Calculate discount amount according to rule
          let discountAmount = 0
          if (rule.type === 'percentage') {
            discountAmount = Math.round(subtotal * (Number(rule.value) / 100))
          } else {
            // fixed amount is stored in rule.value as Decimal (dollars); convert to cents
            discountAmount = normalizeToCents(Number(rule.value))
          }

          // Prevent discount exceeding subtotal
          if (accumulatedDiscount + discountAmount > subtotal) {
            return errorResponse(ErrorCodes.VALIDATION_ERROR, `Discounts exceed subtotal for code: ${code}`)
          }

          // Persist order discount
          await prisma.orderDiscount.create({
            data: {
              orderHeaderId: header.id,
              discountRuleId: rule.id,
              discountType: rule.type as any,
              discountCode: rule.code,
              discountAmount,
            },
          })

          accumulatedDiscount += discountAmount
        }

        // Update order totals to account for applied discounts
        const updated = await prisma.orderHeader.update({
          where: { id: header.id },
          data: {
            discountTotal: accumulatedDiscount,
            total: Math.max(0, subtotal - accumulatedDiscount + 0),
          },
        })

        return updated
      }

      return order;
    } catch (error: unknown) {
      // Log raw error and stack to help diagnose failures during order creation
      try {
        // write structured error to log file
        const logger = await import('@/lib/logger')
        logger.error(error, { context: 'createOrder' })
      } catch (logErr) {
        try { console.error('Error creating order (raw):', error); if (error instanceof Error) console.error(error.stack) } catch {}
      }

      const e = normalizeError(error);
      try { const logger = await import('@/lib/logger'); logger.error(e, { context: 'createOrder.normalized' }) } catch {}
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to create order');
    }
  }

  /**
   * Apply discount to order (handles multiple discount types)
   * Discount is added to existing order totals
   */
  async applyDiscount(orderId: string, discountData: {
    discountCode: string;
    discountType: 'percentage' | 'fixed' | 'employee' | 'bulk';
    discountAmount?: number; // For fixed discounts or manual entry
  }, ctx?: UserContext) {
    try {
      const forbidden = requireRole(ctx, ['admin', 'manager', 'staff']);
      if (forbidden) return forbidden;

      // Get order
      const order = await (prisma as any).orderHeader.findUnique({
        where: { id: orderId },
        include: { lines: true, discounts: true },
      });

      if (!order) {
        return errorResponse(ErrorCodes.NOT_FOUND, 'Order not found');
      }

      // Validate discount code exists (if applicable)
      let discountAmount = discountData.discountAmount || 0;

      if (discountData.discountType === 'percentage' || discountData.discountType === 'bulk') {
        const rule = await (prisma as any).discountRule.findUnique({ where: { code: discountData.discountCode } });
        if (!rule) {
          return errorResponse(ErrorCodes.NOT_FOUND, 'Discount code not found');
        }

        if (!rule.isActive) {
          return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Discount code is inactive');
        }

        // Check usage limits
        if (rule.maxUsagePerCustomer) {
          const usageCount = await (prisma as any).orderDiscount.count({
            where: {
              discountRuleId: rule.id,
              orderHeader: { customerId: order.customerId },
            },
          });
          if (usageCount >= rule.maxUsagePerCustomer) {
            return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Discount code usage limit exceeded');
          }
        }

        // Check minimum order amount
        if (rule.minOrderAmount && order.subtotal < rule.minOrderAmount) {
          return errorResponse(ErrorCodes.VALIDATION_ERROR, `Minimum order amount of ${rule.minOrderAmount} required`);
        }

        // Calculate discount amount
        if (rule.type === 'percentage') {
          discountAmount = Math.round(order.subtotal * (Number(rule.value) / 100));
        } else {
          // fixed amount in rule.value is Decimal (dollars); convert to cents
          discountAmount = normalizeToCents(Number(rule.value));
        }
      }

      // Validate discount won't result in negative total
      const allCurrentDiscounts = await (prisma as any).orderDiscount.findMany({ where: { orderHeaderId: orderId } });
      const currentTotalDiscount = allCurrentDiscounts.reduce((sum: number, d: any) => sum + d.discountAmount, 0);
      const proposedTotalDiscount = currentTotalDiscount + discountAmount;

      if (proposedTotalDiscount > order.subtotal) {
        return errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          `Total discount (${proposedTotalDiscount}) cannot exceed subtotal (${order.subtotal})`
        );
      }

      // Create OrderDiscount record
      const discount = await (prisma as any).orderDiscount.create({
        data: {
          orderHeaderId: orderId,
          discountRuleId: discountData.discountType === 'percentage' || discountData.discountType === 'bulk'
            ? (await (prisma as any).discountRule.findUnique({ where: { code: discountData.discountCode } }))?.id
            : undefined,
          discountType: discountData.discountType,
          discountCode: discountData.discountCode,
          discountAmount,
        },
      });

      // Update order totals - DISCOUNT IS NOW ACCOUNTED FOR
      const updatedOrder = await (prisma as any).orderHeader.update({
        where: { id: orderId },
        data: {
          discountTotal: proposedTotalDiscount,
          total: Math.max(0, order.subtotal - proposedTotalDiscount + order.tax),
        },
      });

      return { discount, updatedOrder };
    } catch (error: unknown) {
      const e = normalizeError(error);
      console.error('Error applying discount:', e);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to apply discount');
    }
  }

  /**
   * Add line item to existing order
   */
  async addLineItem(orderId: string, item: {
    productId: string;
    productType: string;
    productName: string;
    departmentCode: string;
    quantity: number;
    unitPrice: number;
  }, ctx?: UserContext) {
    try {
      const forbidden = requireRole(ctx, ['admin', 'manager', 'staff']);
      if (forbidden) return forbidden;

      const order = await (prisma as any).orderHeader.findUnique({
        where: { id: orderId },
        include: { lines: true },
      });

      if (!order) {
        return errorResponse(ErrorCodes.NOT_FOUND, 'Order not found');
      }

      if (order.status !== 'pending') {
        return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Cannot add items to non-pending order');
      }

      // Get next line number
  const maxLineNumber = Math.max(...order.lines.map((l: any) => l.lineNumber), 0);
      const lineNumber = maxLineNumber + 1;

  const lineItem = await prisma.$transaction(async (tx: any) => {
        // Create line item
        const line = await tx.orderLine.create({
          data: {
            lineNumber,
            orderHeaderId: orderId,
            departmentCode: item.departmentCode,
            productId: item.productId,
            productType: item.productType,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.quantity * item.unitPrice,
            status: 'pending',
          },
        });

        // Reserve inventory if applicable
        if (['RESTAURANT', 'BAR_CLUB'].includes(item.departmentCode)) {
          await tx.inventoryReservation.create({
            data: {
              inventoryItemId: item.productId,
              orderHeaderId: orderId,
              quantity: item.quantity,
              status: 'reserved',
            },
          });
        }

        // Add department if new
        const dept = await tx.department.findUnique({ where: { code: item.departmentCode } });
        if (dept) {
          await tx.orderDepartment.upsert({
            where: { orderHeaderId_departmentId: { orderHeaderId: orderId, departmentId: dept.id } },
            update: {},
            create: {
              orderHeaderId: orderId,
              departmentId: dept.id,
              status: 'pending',
            },
          });
        }

        return line;
      });

      // Update order subtotal
      const allLines = await (prisma as any).orderLine.findMany({ where: { orderHeaderId: orderId } });
  const newSubtotal = allLines.reduce((sum: number, l: any) => sum + l.lineTotal, 0);

      await (prisma as any).orderHeader.update({
        where: { id: orderId },
        data: { subtotal: newSubtotal, total: newSubtotal - order.discountTotal + order.tax },
      });

      return lineItem;
    } catch (error) {
      console.error('Error adding line item:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to add line item');
    }
  }

  /**
   * Remove line item from order
   */
  async removeLineItem(orderId: string, lineItemId: string, ctx?: UserContext) {
    try {
      const forbidden = requireRole(ctx, ['admin', 'manager', 'staff']);
      if (forbidden) return forbidden;

      const order = await (prisma as any).orderHeader.findUnique({ where: { id: orderId } });
      if (!order) {
        return errorResponse(ErrorCodes.NOT_FOUND, 'Order not found');
      }

      if (order.status !== 'pending') {
        return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Cannot remove items from non-pending order');
      }

  await prisma.$transaction(async (tx: any) => {
        // Delete line item
        await tx.orderLine.delete({ where: { id: lineItemId } });

        // Release inventory reservations
        await tx.inventoryReservation.deleteMany({
          where: { orderHeaderId: orderId },
        });
      });

      // Update order totals
      const allLines = await (prisma as any).orderLine.findMany({ where: { orderHeaderId: orderId } });
  const newSubtotal = allLines.reduce((sum: number, l: any) => sum + l.lineTotal, 0);

      await (prisma as any).orderHeader.update({
        where: { id: orderId },
        data: { subtotal: newSubtotal, total: newSubtotal - order.discountTotal + order.tax },
      });

      return { success: true, message: 'Line item removed' };
    } catch (error) {
      console.error('Error removing line item:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to remove line item');
    }
  }

  /**
   * Record payment for order (supports multiple payments)
   */
  async recordPayment(orderId: string, paymentData: {
    amount: number;
    paymentMethod: string;
    paymentTypeId?: string;
    transactionReference?: string;
  }, ctx?: UserContext) {
    try {
      const forbidden = requireRole(ctx, ['admin', 'manager', 'staff']);
      if (forbidden) return forbidden;

      const order = await (prisma as any).orderHeader.findUnique({
        where: { id: orderId },
        include: { payments: true },
      });

      if (!order) {
        return errorResponse(ErrorCodes.NOT_FOUND, 'Order not found');
      }

      // Normalize incoming amount to cents to keep DB consistent
  const amount = normalizeToCents(paymentData.amount);

      // Check if payment exceeds order total
  const totalPaid = order.payments.reduce((sum: number, p: any) => sum + p.amount, 0);
      if (totalPaid + amount > order.total) {
        return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Payment amount exceeds order total');
      }

      const payment = await (prisma as any).orderPayment.create({
        data: {
          orderHeaderId: orderId,
          amount,
          paymentMethod: paymentData.paymentMethod,
          paymentStatus: 'completed',
          paymentTypeId: paymentData.paymentTypeId,
          transactionReference: paymentData.transactionReference,
          processedAt: new Date(),
        },
      });

      // Update order status if fully paid
      const allPayments = await (prisma as any).orderPayment.findMany({ where: { orderHeaderId: orderId } });
  const totalPayments = allPayments.reduce((sum: number, p: any) => sum + p.amount, 0);

      if (totalPayments >= order.total) {
        // Fully paid: move to processing and consume reserved inventory for inventory-based departments
        await prisma.$transaction(async (tx: any) => {
          // Update order status and sync department rows atomically
          await tx.orderHeader.update({ where: { id: orderId }, data: { status: 'processing' } });
          await tx.orderDepartment.updateMany({ where: { orderHeaderId: orderId }, data: { status: 'processing' } });

          // Find order lines that require inventory consumption
          const lines = await tx.orderLine.findMany({ where: { orderHeaderId: orderId } });

          const movementRows: any[] = [];

          for (const line of lines) {
            if (['RESTAURANT', 'BAR_CLUB'].includes(line.departmentCode)) {
              // find department
              const dept = await tx.department.findUnique({ where: { code: line.departmentCode } });
              if (!dept) {
                throw new Error(`Department not found for code ${line.departmentCode}`);
              }

              // attempt to decrement department inventory (must have sufficient quantity)
              const res = await tx.departmentInventory.updateMany({
                where: { departmentId: dept.id, inventoryItemId: line.productId, quantity: { gte: line.quantity } },
                data: { quantity: { decrement: line.quantity } },
              });

              if (res.count === 0) {
                throw new Error(`Insufficient inventory for product ${line.productId} in department ${dept.code}`);
              }

              movementRows.push({ movementType: 'out', quantity: line.quantity, reason: 'sale', reference: orderId, inventoryItemId: line.productId });
            }
          }

          // create inventory movement records
          if (movementRows.length) {
            await tx.inventoryMovement.createMany({ data: movementRows });
          }

          // mark reservations as consumed
          await tx.inventoryReservation.updateMany({ where: { orderHeaderId: orderId, status: 'reserved' }, data: { status: 'consumed', consumedAt: new Date() } });
        });
      }

      return payment;
    } catch (error) {
      console.error('Error recording payment:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to record payment');
    }
  }

  /**
   * Get order with all related data
   */
  async getOrderById(id: string, ctx?: UserContext) {
    try {
      const order = await (prisma as any).orderHeader.findUnique({
        where: { id },
        include: {
          customer: true,
          lines: true,
          departments: { include: { department: true } },
          discounts: { include: { discountRule: true } },
          payments: { include: { paymentType: true } },
          fulfillments: true,
          reservations: true,
        },
      });

      if (!order) {
        return errorResponse(ErrorCodes.NOT_FOUND, 'Order not found');
      }

      // Check authorization (customer views own, staff views all)
      const forbidden = requireRoleOrOwner(ctx, order.customerId, ['admin', 'manager', 'staff']);
      if (forbidden) return forbidden;

      return order;
    } catch (error) {
      console.error('Error fetching order:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch order');
    }
  }

  /**
   * List orders with filtering
   */
  async listOrders(filters: {
    customerId?: string;
    status?: string;
    departmentCode?: string;
    page?: number;
    limit?: number;
  }, ctx?: UserContext) {
    try {
      const forbidden = requireRole(ctx, ['admin', 'manager', 'staff']);
      if (forbidden) return forbidden;

      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const skip = (page - 1) * limit;

      const where: any = {};
      if (filters.customerId) where.customerId = filters.customerId;
      if (filters.status) where.status = filters.status;
      if (filters.departmentCode) where.departmentCode = filters.departmentCode;

      const [orders, total] = await Promise.all([
        (prisma as any).orderHeader.findMany({
          where,
          include: { customer: true, lines: true, payments: true },
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
      console.error('Error listing orders:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to list orders');
    }
  }

  /**
   * Update order status
   */
  async updateOrderStatus(id: string, newStatus: string, ctx?: UserContext) {
    try {
      const forbidden = requireRole(ctx, ['admin', 'manager']);
      if (forbidden) return forbidden;

      // Ensure header and related orderDepartment rows are updated atomically
      const result = await prisma.$transaction(async (tx: any) => {
        const updated = await tx.orderHeader.update({ where: { id }, data: { status: newStatus } });
        await tx.orderDepartment.updateMany({ where: { orderHeaderId: id }, data: { status: newStatus } });
        return updated;
      });

      return result;
    } catch (error) {
      console.error('Error updating order status:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to update order status');
    }
  }

  /**
   * Cancel order and release reservations
   */
  async cancelOrder(id: string, reason?: string, ctx?: UserContext) {
    try {
      const forbidden = requireRole(ctx, ['admin', 'manager']);
      if (forbidden) return forbidden;

      const order = await (prisma as any).orderHeader.findUnique({ where: { id } });
      if (!order) {
        return errorResponse(ErrorCodes.NOT_FOUND, 'Order not found');
      }

  await prisma.$transaction(async (tx: any) => {
        // Mark order as cancelled and propagate to department rows
        await tx.orderHeader.update({
          where: { id },
          data: { status: 'cancelled' },
        });
        await tx.orderDepartment.updateMany({ where: { orderHeaderId: id }, data: { status: 'cancelled' } });

        // Release inventory reservations
        await tx.inventoryReservation.updateMany({
          where: { orderHeaderId: id, status: 'reserved' },
          data: { status: 'released', releasedAt: new Date() },
        });

        // Mark fulfillments as cancelled
        await tx.orderFulfillment.updateMany({
          where: { orderHeaderId: id, status: { not: 'fulfilled' } },
          data: { status: 'cancelled' },
        });
      });

      return { success: true, message: 'Order cancelled and reservations released' };
    } catch (error) {
      console.error('Error cancelling order:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to cancel order');
    }
  }

  /**
   * Get order statistics
   */
  async getOrderStats(ctx?: UserContext) {
    try {
      const forbidden = requireRole(ctx, ['admin', 'manager']);
      if (forbidden) return forbidden;

      const [totalOrders, activeOrders, completedOrders, cancelledOrders, totalRevenue] = await Promise.all([
        (prisma as any).orderHeader.count(),
        (prisma as any).orderHeader.count({ where: { status: { in: ['pending', 'processing'] } } }),
        (prisma as any).orderHeader.count({ where: { status: 'completed' } }),
        (prisma as any).orderHeader.count({ where: { status: 'cancelled' } }),
        (prisma as any).orderHeader.aggregate({
          _sum: { total: true },
          where: { status: 'completed' },
        }),
      ]);

      return {
        totalOrders,
        activeOrders,
        completedOrders,
        cancelledOrders,
        totalRevenue: totalRevenue._sum.total || 0,
      };
    } catch (error) {
      console.error('Error fetching order stats:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch order stats');
    }
  }
}

export const orderService = new OrderService();

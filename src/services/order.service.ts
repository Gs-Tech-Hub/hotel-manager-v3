/**
 * Enhanced Order Service
 * Comprehensive order management with multi-department support, discounts, and inventory
 */

import { BaseService } from './base.service';
import { IOrderHeader, IOrderLine, IOrderDiscount, IOrderPayment } from '../types/entities';
import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { normalizeError } from '@/lib/errors';
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
  }, ctx?: UserContext) {
    try {
      // Validate customer exists
      const customer = await prisma.customer.findUnique({ where: { id: data.customerId } });
      if (!customer) {
        return errorResponse(ErrorCodes.NOT_FOUND, 'Customer not found');
      }

      // Generate unique order number
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // Calculate subtotal and validate inventory
      let subtotal = 0;
      const departments = new Set<string>();

      for (const item of data.items) {
        subtotal += item.quantity * item.unitPrice;
        departments.add(item.departmentCode);

        // Check inventory availability (for inventory-based departments)
        if (['RESTAURANT', 'BAR_CLUB'].includes(item.departmentCode)) {
          const inventory = await prisma.inventoryItem.findUnique({ where: { id: item.productId } });
          if (!inventory || inventory.quantity < item.quantity) {
            return errorResponse(ErrorCodes.VALIDATION_ERROR, `Insufficient inventory for ${item.productName}`);
          }
        }
      }

      // Create order within transaction
  const order = await prisma.$transaction(async (tx: any) => {
        // 1. Create OrderHeader
        const header = await tx.orderHeader.create({
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

        // 2. Create OrderLines
        const lines: any[] = [];
        for (let i = 0; i < data.items.length; i++) {
          const item = data.items[i];
          const line = await tx.orderLine.create({
            data: {
              lineNumber: i + 1,
              orderHeaderId: header.id,
              departmentCode: item.departmentCode,
              productId: item.productId,
              productType: item.productType,
              productName: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              unitDiscount: 0,
              lineTotal: item.quantity * item.unitPrice,
              status: 'pending',
            },
          });
          lines.push(line);

          // 3. Reserve inventory for inventory-based departments
          if (['RESTAURANT', 'BAR_CLUB'].includes(item.departmentCode)) {
            await tx.inventoryReservation.create({
              data: {
                inventoryItemId: item.productId,
                orderHeaderId: header.id,
                quantity: item.quantity,
                status: 'reserved',
              },
            });
          }
        }

        // 4. Create OrderDepartments for routing
        for (const dept of departments) {
          const department = await tx.department.findUnique({ where: { code: dept } });
          if (department) {
            await tx.orderDepartment.create({
              data: {
                orderHeaderId: header.id,
                departmentId: department.id,
                status: 'pending',
              },
            });
          }
        }

        return header;
      });

      return order;
    } catch (error: unknown) {
      const e = normalizeError(error);
      console.error('Error creating order:', e);
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
          discountAmount = Number(rule.value);
        }
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
      const allDiscounts = await (prisma as any).orderDiscount.findMany({ where: { orderHeaderId: orderId } });
      const totalDiscount = allDiscounts.reduce((sum: number, d: any) => sum + d.discountAmount, 0);

      const updatedOrder = await (prisma as any).orderHeader.update({
        where: { id: orderId },
        data: {
          discountTotal: totalDiscount,
          total: order.subtotal - totalDiscount + order.tax,
        },
      });      return { discount, updatedOrder };
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

      // Check if payment exceeds order total
  const totalPaid = order.payments.reduce((sum: number, p: any) => sum + p.amount, 0);
      if (totalPaid + paymentData.amount > order.total) {
        return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Payment amount exceeds order total');
      }

      const payment = await (prisma as any).orderPayment.create({
        data: {
          orderHeaderId: orderId,
          amount: paymentData.amount,
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
        await (prisma as any).orderHeader.update({
          where: { id: orderId },
          data: { status: 'processing' },
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

      const order = await (prisma as any).orderHeader.update({
        where: { id },
        data: { status: newStatus },
      });

      return order;
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
        // Mark order as cancelled
        await tx.orderHeader.update({
          where: { id },
          data: { status: 'cancelled' },
        });

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

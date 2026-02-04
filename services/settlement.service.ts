/**
 * Settlement Service
 * Handles deferred order payment settlement, reconciliation, and reporting
 */

import { BaseService } from './base.service';
import { prisma } from '@/lib/auth/prisma';
import { normalizeToCents } from '@/lib/price';

export class SettlementService extends BaseService<any> {
  constructor() {
    super('orderPayment');
  }

  /**
   * Get all pending/open orders for a terminal or department
   */
  async getOpenOrders(filters?: {
    departmentCode?: string;
    customerId?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = { status: 'pending' };

    if (filters?.departmentCode) {
      where.departments = {
        some: {
          department: {
            code: filters.departmentCode,
          },
        },
      };
    }

    if (filters?.customerId) {
      where.customerId = filters.customerId;
    }

    const orders = await prisma.orderHeader.findMany({
      where,
      include: {
        customer: true,
        lines: true,
        payments: true,
        departments: {
          include: {
            department: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 50,
      skip: filters?.offset || 0,
    });

    return orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      customerName: `${order.customer.firstName} ${order.customer.lastName}`,
      total: order.total,
      totalPaid: order.payments
        .filter((p) => p.paymentStatus === 'completed')
        .reduce((sum, p) => sum + p.amount, 0),
      amountDue:
        order.total -
        order.payments
          .filter((p) => p.paymentStatus === 'completed')
          .reduce((sum, p) => sum + p.amount, 0),
      createdAt: order.createdAt,
      itemCount: order.lines.length,
      status: order.status,
    }));
  }

  /**
   * Record payment for a deferred order
   * CRITICAL: Section metadata updates MUST succeed; payment fails if any section update fails
   * Order status only moves to "processing" if BOTH payment AND section updates succeed
   */
  async recordPayment(orderId: string, payment: {
    amount: number;
    paymentMethod: string;
    transactionReference?: string;
    notes?: string;
  }) {
    try {
      // Fetch order with all related data including lines for section mapping
      const order = await prisma.orderHeader.findUnique({
        where: { id: orderId },
        include: {
          payments: true,
          customer: true,
          lines: true,
        },
      });

      if (!order) {
        throw new Error('Order not found');
      }

      if (order.status !== 'pending') {
        throw new Error(`Cannot record payment on ${order.status} order`);
      }

      // Calculate current payment state
      const totalPaid = order.payments
        .filter((p) => p.paymentStatus === 'completed')
        .reduce((sum, p) => sum + p.amount, 0);

      const amountDue = order.total - totalPaid;

      // Validate payment amount
      if (payment.amount > amountDue) {
        throw new Error(`Payment exceeds amount due: ${payment.amount} > ${amountDue}`);
      }

      // Map order lines to sections; FAIL if any line lacks section assignment
      const deptSectionsMap = new Map<string, Set<string>>();
      for (const line of order.lines) {
        if (!line.departmentCode) {
          throw new Error(`Order line ${line.id} missing department assignment`);
        }
        if (!line.departmentSectionId) {
          throw new Error(`Payment cannot be processed: order line ${line.id} in ${line.departmentCode} lacks section assignment`);
        }

        if (!deptSectionsMap.has(line.departmentCode)) {
          deptSectionsMap.set(line.departmentCode, new Set());
        }
        deptSectionsMap.get(line.departmentCode)?.add(line.departmentSectionId);
      }

      // Find or create payment type
      let paymentType = await prisma.paymentType.findUnique({
        where: { type: payment.paymentMethod.toLowerCase() },
      });

      if (!paymentType) {
        paymentType = await prisma.paymentType.create({
          data: {
            type: payment.paymentMethod.toLowerCase(),
            description: `Payment method: ${payment.paymentMethod}`,
          },
        });
      }

      // Record the payment in transaction; ensure section updates succeed
      const result = await prisma.$transaction(async (tx: any) => {
        // Record the payment
        const newPayment = await tx.orderPayment.create({
          data: {
            orderHeaderId: orderId,
            amount: payment.amount,
            paymentMethod: payment.paymentMethod,
            paymentTypeId: paymentType.id,
            paymentStatus: 'completed',
            transactionReference: payment.transactionReference,
            processedAt: new Date(),
          },
        });

        // Check if order is now fully paid
        const newTotalPaid = totalPaid + payment.amount;
        const newAmountDue = order.total - newTotalPaid;

        // Update section metadata for all sections involved; FAIL if any fails
        for (const [deptCode, sectionIds] of deptSectionsMap.entries()) {
          for (const sectionId of sectionIds) {
            const section = await tx.departmentSection.findUnique({ where: { id: sectionId } });
            if (!section) {
              throw new Error(`Section ${sectionId} not found in department ${deptCode}`);
            }

            const existingMeta = (section.metadata as any) || {};
            const lastTransactionData = {
              orderId: orderId,
              paymentId: newPayment.id,
              amount: payment.amount,
              paymentMethod: payment.paymentMethod,
              at: new Date(),
            };

            const mergedMeta = {
              ...existingMeta,
              lastTransaction: lastTransactionData,
            };

            // Update section metadata; failure here fails entire transaction
            await tx.departmentSection.update({
              where: { id: sectionId },
              data: { metadata: mergedMeta },
            });
          }
        }

        // Only update order status to processing if FULLY PAID and sections updated successfully
        if (newAmountDue <= 0) {
          await tx.orderHeader.update({
            where: { id: orderId },
            data: { 
              status: 'processing',
              paymentStatus: 'paid',
            },
          });
          // Update department order statuses too
          await tx.orderDepartment.updateMany({
            where: { orderHeaderId: orderId },
            data: { status: 'processing' },
          });
        } else {
          // Partial payment: update order payment status but keep as pending
          await tx.orderHeader.update({
            where: { id: orderId },
            data: { paymentStatus: 'partial' },
          });
        }

        return {
          paymentId: newPayment.id,
          newTotalPaid,
          newAmountDue: Math.max(0, newAmountDue),
          isFullyPaid: newAmountDue <= 0,
        };
      }, { maxWait: 15000, timeout: 15000 });

      return {
        paymentId: result.paymentId,
        orderId,
        orderNumber: order.orderNumber,
        paymentAmount: payment.amount,
        totalPaid: result.newTotalPaid,
        amountDue: result.newAmountDue,
        isFullyPaid: result.isFullyPaid,
        customer: `${order.customer.firstName} ${order.customer.lastName}`,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get settlement summary for a department/terminal
   */
  async getSettlementSummary(departmentCode?: string) {
    const where: any = { status: 'pending' };

    if (departmentCode) {
      where.departments = {
        some: {
          department: {
            code: departmentCode,
          },
        },
      };
    }

    const orders = await prisma.orderHeader.findMany({
      where,
      include: {
        payments: true,
      },
    });

    const totalOrders = orders.length;
    const totalAmount = orders.reduce((sum, o) => sum + o.total, 0);
    const totalPaid = orders.reduce((sum, o) => {
      const paid = o.payments
        .filter((p) => p.paymentStatus === 'completed')
        .reduce((s, p) => s + p.amount, 0);
      return sum + paid;
    }, 0);
    const totalDue = totalAmount - totalPaid;

    // Categorize by age
    const now = Date.now();
    const age24h = orders.filter((o) => now - o.createdAt.getTime() > 24 * 60 * 60 * 1000).length;
    const age7d = orders.filter((o) => now - o.createdAt.getTime() > 7 * 24 * 60 * 60 * 1000).length;

    return {
      totalOrders,
      totalAmount,
      totalPaid,
      totalDue,
      averageOrderValue: totalOrders > 0 ? Math.round(totalAmount / totalOrders) : 0,
      overdue24h: age24h,
      overdue7d: age7d,
    };
  }

  /**
   * Batch settle multiple orders (e.g., end-of-day settlement)
   */
  async batchSettle(payments: Array<{
    orderId: string;
    amount: number;
    paymentMethod: string;
    transactionReference?: string;
  }>) {
    const results: any[] = [];
    const errors: any[] = [];

    for (const payment of payments) {
      try {
        const result = await this.recordPayment(payment.orderId, payment);
        results.push(result);
      } catch (error) {
        errors.push({
          orderId: payment.orderId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      successful: results.length,
      failed: errors.length,
      results,
      errors,
      summary: {
        totalProcessed: payments.length,
        totalAmountSettled: results.reduce((sum, r) => sum + r.paymentAmount, 0),
      },
    };
  }

  /**
   * Get outstanding balance for a customer
   */
  async getCustomerBalance(customerId: string) {
    const orders = await prisma.orderHeader.findMany({
      where: {
        customerId,
        status: 'pending',
      },
      include: {
        payments: true,
      },
    });

    const balance = orders.reduce((sum, order) => {
      const paid = order.payments
        .filter((p) => p.paymentStatus === 'completed')
        .reduce((s, p) => s + p.amount, 0);
      return sum + (order.total - paid);
    }, 0);

    return {
      customerId,
      totalOutstanding: balance,
      orderCount: orders.length,
      orders: orders.map((o) => ({
        orderNumber: o.orderNumber,
        total: o.total,
        paid: o.payments
          .filter((p) => p.paymentStatus === 'completed')
          .reduce((s, p) => s + p.amount, 0),
      })),
    };
  }

  /**
   * Get daily settlement report
   */
  async getDailySettlementReport(date?: Date) {
    const reportDate = date || new Date();
    reportDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(reportDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const orders = await prisma.orderHeader.findMany({
      where: {
        createdAt: {
          gte: reportDate,
          lt: nextDay,
        },
      },
      include: {
        payments: true,
        lines: true,
      },
    });

    const pending = orders.filter((o) => o.status === 'pending');
    const completed = orders.filter((o) => o.status === 'completed' || o.status === 'processing');

    const pendingAmount = pending.reduce((sum, o) => {
      const paid = o.payments
        .filter((p) => p.paymentStatus === 'completed')
        .reduce((s, p) => s + p.amount, 0);
      return sum + (o.total - paid);
    }, 0);

    const completedAmount = completed.reduce((sum, o) => sum + o.total, 0);

    return {
      reportDate: reportDate.toISOString().split('T')[0],
      totalOrders: orders.length,
      pendingOrders: pending.length,
      completedOrders: completed.length,
      totalRevenue: orders.reduce((sum, o) => sum + o.total, 0),
      pendingSettlement: pendingAmount,
      settledAmount: completedAmount,
      itemsServed: orders.reduce((sum, o) => sum + o.lines.length, 0),
    };
  }
}

/**
 * Unified Payment Service
 * 
 * Single source of truth for FINANCIAL payment handling across the system.
 * Responsible for: payment record creation, payment status updates, finance-related stats.
 * NOT responsible for: order status, inventory, section metadata, fulfillment state.
 * 
 * ARCHITECTURAL BOUNDARY:
 * PaymentService (this module):
 *   ✅ Create payment records
 *   ✅ Update payment status (unpaid → partial → paid)
 *   ✅ Track total amounts paid (finance stats only)
 *   ✅ Record transaction references
 * 
 * Fulfillment Pipeline (separate):
 *   ✅ Update order status (pending → processing → completed)
 *   ✅ Consume inventory when payment made
 *   ✅ Update department/section metadata & stats
 *   ✅ Handle order completion
 * 
 * PAYMENT FLOW:
 * - Payment request validated (amount, permissions)
 * - PaymentType resolved (find or create)
 * - OrderPayment record created (FAST 5-second transaction)
 * - Payment status calculated (unpaid → partial → paid)
 * - Finance-related metadata updated (totalPaidAmount, lastPaymentAt)
 * - Return payment record
 * 
 * PRICE CONSISTENCY:
 * - All amounts stored as integers in cents
 * - Input amounts normalized via normalizeToCents()
 * - Database fields: amount (INT in cents)
 */

import { BaseService } from './base.service';
import { IPayment } from '@/types/entities';
import { prisma } from '@/lib/auth/prisma';
import { normalizeToCents, validatePrice } from '@/lib/price';
import { errorResponse, ErrorCodes } from '@/lib/api-response';

/**
 * Payment request interface for unified payment recording
 */
export interface PaymentRequest {
  amount: number;                    // In cents or decimal
  paymentMethod: string;             // cash, card, bank_transfer, mobile_payment
  paymentTypeId?: string;
  transactionReference?: string;
  context?: {
    userId?: string;
    departmentCode?: string;
    sectionIds?: string[];
    consumeInventory?: boolean;  // For order payments
    notes?: string;
  };
}

/**
 * Unified payment result
 */
export interface PaymentResult {
  paymentId: string;
  entityId: string;
  entityType: 'order' | 'booking' | 'expense';
  amount: number;                    // In cents
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  totalPaid: number;
  amountDue: number;
  isFullyPaid: boolean;
  transactionData?: any;
}

export class PaymentService extends BaseService<IPayment> {
  constructor() {
    super('orderPayment');
  }

  // ==================== CORE PAYMENT METHODS ====================

  /**
   * Record payment for an order
   * FINANCIAL ONLY: Creates payment record and updates payment status
   * 
   * NOTE: Order status transitions, inventory consumption, and stats recalculation
   * are handled by the fulfillment pipeline, NOT by this payment service.
   * This keeps payment transactions fast and prevents timeout issues.
   */
  async recordOrderPayment(
    orderId: string,
    paymentRequest: PaymentRequest
  ): Promise<PaymentResult | any> {
    try {
      const amount = normalizeToCents(paymentRequest.amount);
      validatePrice(amount, 'payment amount');

      // Fetch order with minimal relations (payments only)
      const order = await (prisma as any).orderHeader.findUnique({
        where: { id: orderId },
        include: { payments: true },
      });

      if (!order) {
        return errorResponse(ErrorCodes.NOT_FOUND, 'Order not found');
      }

      // Prevent payment on already fully paid orders
      if (order.paymentStatus === 'paid') {
        return errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          'Order is already fully paid. No additional payments allowed.'
        );
      }

      // Calculate current payment state
      const totalPaid = order.payments.reduce((sum: number, p: any) => sum + p.amount, 0);
      if (totalPaid + amount > order.total) {
        return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Payment amount exceeds order total');
      }

      // Ensure payment type exists
      const paymentType = await this.ensurePaymentType(paymentRequest.paymentMethod);

      // ==================== FAST FINANCIAL TRANSACTION ====================
      // ONLY: Create payment record + update payment status
      // Order status & inventory are handled by fulfillment pipeline
      const payment = await prisma.$transaction(
        async (tx: any) => {
          // Create payment record
          const newPayment = await tx.orderPayment.create({
            data: {
              orderHeaderId: orderId,
              amount,
              paymentMethod: paymentRequest.paymentMethod,
              paymentStatus: 'completed',
              paymentTypeId: paymentType.id,
              transactionReference: paymentRequest.transactionReference,
              processedAt: new Date(),
            },
          });

          // Calculate new payment state
          const newTotalPaid = totalPaid + amount;

          // Determine payment status
          let paymentStatus = 'unpaid';
          if (newTotalPaid >= order.total) {
            paymentStatus = 'paid';
          } else if (newTotalPaid > 0) {
            paymentStatus = 'partial';
          }

          // Update ONLY payment status on OrderHeader
          // Order status (pending → processing) is handled by fulfillment pipeline
          if (paymentStatus !== order.paymentStatus) {
            await tx.orderHeader.update({
              where: { id: orderId },
              data: { paymentStatus },
            });
          }

          return newPayment;
        },
        { maxWait: 5000, timeout: 5000 } // Fast timeout - only financial operations
      );

      return payment;
    } catch (error) {
      console.error('Error recording order payment:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to record payment');
    }
  }

  /**
   * Record payment for a deferred (pending) order
   * FINANCIAL ONLY: Creates payment record, updates payment status, and section finance stats
   * 
   * Updates section metadata with:
   * - totalPaidAmount: Cumulative amount paid towards this order
   * - amountOwed: Remaining amount still owed (includes any extras added)
   * - lastPaymentAt: When the most recent payment was made
   * - lastPaymentMethod: How the most recent payment was made
   * 
   * This ensures sections track current financial state even when extras are added mid-order
   */
  async recordDeferredOrderPayment(
    orderId: string,
    paymentRequest: PaymentRequest
  ): Promise<PaymentResult | any> {
    try {
      const amount = normalizeToCents(paymentRequest.amount);
      validatePrice(amount, 'payment amount');

      // Fetch order with all needed relations
      const order = await (prisma as any).orderHeader.findUnique({
        where: { id: orderId },
        include: { 
          payments: true,
          lines: { include: { departmentSection: true } }
        },
      });

      if (!order) {
        return errorResponse(ErrorCodes.NOT_FOUND, 'Order not found');
      }

      // Prevent payment on already fully paid orders
      if (order.paymentStatus === 'paid') {
        return errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          'Order is already fully paid. No additional payments allowed.'
        );
      }

      // Calculate current payment state
      const totalPaid = order.payments.reduce((sum: number, p: any) => sum + p.amount, 0);
      if (totalPaid + amount > order.total) {
        return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Payment amount exceeds order total');
      }

      // Get affected section IDs for metadata updates
      const affectedSectionIds = new Set<string>();
      for (const line of order.lines || []) {
        if (line.departmentSectionId) {
          affectedSectionIds.add(line.departmentSectionId);
        }
      }

      // Ensure payment type exists
      const paymentType = await this.ensurePaymentType(paymentRequest.paymentMethod);

      // ==================== FAST FINANCIAL TRANSACTION ====================
      // ONLY: Create payment record + update payment status + section finance stats
      const payment = await prisma.$transaction(
        async (tx: any) => {
          // Create payment record
          const newPayment = await tx.orderPayment.create({
            data: {
              orderHeaderId: orderId,
              amount,
              paymentMethod: paymentRequest.paymentMethod,
              paymentStatus: 'completed',
              paymentTypeId: paymentType.id,
              transactionReference: paymentRequest.transactionReference,
              processedAt: new Date(),
            },
          });

          // Calculate new payment state
          const newTotalPaid = totalPaid + amount;
          const amountOwed = order.total - newTotalPaid;

          // Determine payment status
          let paymentStatus = 'unpaid';
          if (amountOwed <= 0) {
            paymentStatus = 'paid';
          } else if (newTotalPaid > 0) {
            paymentStatus = 'partial';
          }

          // Update ONLY payment status on OrderHeader
          if (paymentStatus !== order.paymentStatus) {
            await tx.orderHeader.update({
              where: { id: orderId },
              data: { paymentStatus },
            });
          }

          // Update section metadata by RECALCULATING from ALL orders in section
          // This ensures section stats include extras added to any order
          for (const sectionId of affectedSectionIds) {
            const section = await tx.departmentSection.findUnique({
              where: { id: sectionId },
            });

            if (section) {
              // Get ALL orders that have lines in this section
              const sectionOrders = await tx.orderHeader.findMany({
                where: {
                  lines: {
                    some: { departmentSectionId: sectionId }
                  }
                },
                include: {
                  payments: true,
                  lines: { where: { departmentSectionId: sectionId } }
                }
              });

              // Calculate section-wide totals (including all extras)
              let sectionTotalAmount = 0;
              let sectionPaidAmount = 0;
              let sectionOwedAmount = 0;

              for (const order of sectionOrders) {
                sectionTotalAmount += order.total;
                const orderPaid = order.payments.reduce((sum: number, p: any) => sum + p.amount, 0);
                sectionPaidAmount += orderPaid;
                sectionOwedAmount += Math.max(0, order.total - orderPaid);
              }

              const existingMeta = (section.metadata as any) || {};

              await tx.departmentSection.update({
                where: { id: sectionId },
                data: {
                  metadata: {
                    ...existingMeta,
                    sectionStats: {
                      paid: {
                        totalAmount: sectionPaidAmount,
                        updatedAt: new Date(),
                      },
                      unpaid: {
                        totalAmount: sectionOwedAmount,
                        updatedAt: new Date(),
                      },
                      updatedAt: new Date(),
                    },
                    lastPaymentAt: new Date(),
                    lastPaymentMethod: paymentRequest.paymentMethod,
                  },
                },
              });
            }
          }

          return newPayment;
        },
        { maxWait: 5000, timeout: 5000 } // Fast timeout - only financial operations
      );

      return payment;
    } catch (error) {
      console.error('Error recording deferred payment:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to record payment');
    }
  }

  // ==================== HELPER METHODS ====================

  /**
   * Find or create payment type
   */
  async ensurePaymentType(paymentMethod: string): Promise<any> {
    const type = paymentMethod.toLowerCase();
    
    let paymentType = await prisma.paymentType.findUnique({
      where: { type },
    });

    if (!paymentType) {
      paymentType = await prisma.paymentType.create({
        data: {
          type,
          description: `Payment method: ${paymentMethod}`,
        },
      });
    }

    return paymentType;
  }

  /**
   * Calculate payment status from amounts
   */
  calculatePaymentStatus(totalPaid: number, totalAmount: number): 'unpaid' | 'partial' | 'paid' {
    if (totalPaid >= totalAmount) return 'paid';
    if (totalPaid > 0) return 'partial';
    return 'unpaid';
  }

  /**
   * Get all payments for an order
   */
  async getOrderPayments(orderId: string): Promise<any[]> {
    return prisma.orderPayment.findMany({
      where: { orderHeaderId: orderId },
      include: { paymentType: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ==================== LEGACY METHODS (DEPRECATED) ====================

  /**
   * Get payment by transaction ID (legacy)
   */
  async getByTransactionID(transactionID: string): Promise<IPayment | null> {
    try {
      const row = await prisma.payment.findUnique({
        where: { transactionID },
        include: { paymentDetails: true },
      });

      if (!row) return null;
      return {
        id: row.id,
        transactionID: row.transactionID,
        paymentMethod: row.paymentMethod,
        paymentStatus: row.paymentStatus as any,
        totalPrice: row.totalPrice,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    } catch (error) {
      console.error('Error fetching payment:', error);
      return null;
    }
  }

  /**
   * Get payments by status (legacy)
   */
  async getPaymentsByStatus(status: string): Promise<IPayment[]> {
    try {
      const rows = await prisma.payment.findMany({
        where: { paymentStatus: status },
        orderBy: { createdAt: 'desc' },
      });

      return rows.map((r: any) => ({
        id: r.id,
        transactionID: r.transactionID,
        paymentMethod: r.paymentMethod,
        paymentStatus: r.paymentStatus,
        totalPrice: r.totalPrice,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));
    } catch (error) {
      console.error('Error fetching payments by status:', error);
      return [];
    }
  }

  /**
   * Get payment stats (legacy)
   */
  async getPaymentStats(): Promise<{
    totalPayments: number;
    pendingAmount: number;
    completedAmount: number;
    failedAmount: number;
  } | null> {
    try {
      const stats = await prisma.payment.groupBy({
        by: ['paymentStatus'],
        _sum: { totalPrice: true },
        _count: true,
      });

      const summary: {
        totalPayments: number;
        pendingAmount: number;
        completedAmount: number;
        failedAmount: number;
      } = {
        totalPayments: 0,
        pendingAmount: 0,
        completedAmount: 0,
        failedAmount: 0,
      };

      stats.forEach((stat: any) => {
        summary.totalPayments += stat._count;
        if (stat.paymentStatus === 'pending') {
          summary.pendingAmount = stat._sum.totalPrice || 0;
        } else if (stat.paymentStatus === 'completed') {
          summary.completedAmount = stat._sum.totalPrice || 0;
        } else if (stat.paymentStatus === 'failed') {
          summary.failedAmount = stat._sum.totalPrice || 0;
        }
      });

      return summary;
    } catch (error) {
      console.error('Error fetching payment stats:', error);
      return null;
    }
  }
}

export const paymentService = new PaymentService();

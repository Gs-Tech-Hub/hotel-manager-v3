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
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response';

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
    const startTime = Date.now();
    const timeline: { [key: string]: number } = {};

    try {
      timeline.start = 0;
      console.log(`[Payment] recordOrderPayment START for order ${orderId}`);

      const amount = normalizeToCents(paymentRequest.amount);
      validatePrice(amount, 'payment amount');
      timeline.validatePrice = Date.now() - startTime;

      // Fetch order with minimal relations (payments only)
      const order = await (prisma as any).orderHeader.findUnique({
        where: { id: orderId },
        include: { payments: true, lines: { include: { departmentSection: true } } },
      });
      timeline.fetchOrder = Date.now() - startTime;
      console.log(`[Payment] Fetched order in ${timeline.fetchOrder}ms`);

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

      // Get affected section IDs for metadata updates BEFORE transaction
      const affectedSectionIds = new Set<string>();
      for (const line of order.lines || []) {
        if (line.departmentSectionId) {
          affectedSectionIds.add(line.departmentSectionId);
        }
      }

      // Ensure payment type exists BEFORE transaction (cache it)
      console.log(`[Payment] Ensuring payment type for method: ${paymentRequest.paymentMethod}`);
      const ensureTypeStart = Date.now();
      const paymentType = await this.ensurePaymentType(paymentRequest.paymentMethod);
      timeline.ensurePaymentType = Date.now() - ensureTypeStart;
      console.log(`[Payment] ensurePaymentType took ${timeline.ensurePaymentType}ms`);

      // ==================== TRANSACTION: CREATE PAYMENT + UPDATE STATUS ====================
      console.log(`[Payment] STARTING TRANSACTION for order ${orderId}, maxWait=10000, timeout=10000`);
      const txStartTime = Date.now();
      
      // Re-fetch current payment state INSIDE transaction to avoid race conditions
      const payment = await prisma.$transaction(
        async (tx: any) => {
          const txInnerStart = Date.now();
          console.log(`[Payment-TX] Transaction callback started (${Date.now() - txStartTime}ms after tx call)`);

          // Re-fetch current order state within transaction (gets latest committed data)
          const currentOrder = await tx.orderHeader.findUnique({
            where: { id: orderId },
            include: { payments: true },
          });
          console.log(`[Payment-TX] Re-fetched order in ${Date.now() - txInnerStart}ms`);

          if (!currentOrder) {
            throw new Error('Order not found in transaction');
          }

          // Validate payment amount against current state
          const currentTotalPaid = currentOrder.payments.reduce((sum: number, p: any) => sum + p.amount, 0);
          if (currentTotalPaid + amount > currentOrder.total) {
            throw new Error('Payment amount exceeds order total');
          }

          // Create payment record
          const createPaymentStart = Date.now();
          console.log(`[Payment-TX] Creating payment record...`);
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
          console.log(`[Payment-TX] Payment created in ${Date.now() - createPaymentStart}ms`);

          // Calculate new payment state based on CURRENT state
          const newTotalPaid = currentTotalPaid + amount;

          // Determine payment status
          let paymentStatus = 'unpaid';
          if (newTotalPaid >= currentOrder.total) {
            paymentStatus = 'paid';
          } else if (newTotalPaid > 0) {
            paymentStatus = 'partial';
          }

          console.log(`[Payment-TX] Updating order status from ${currentOrder.paymentStatus} to ${paymentStatus}`);

          // ALWAYS update if status changed
          if (paymentStatus !== currentOrder.paymentStatus) {
            const updateStart = Date.now();
            await tx.orderHeader.update({
              where: { id: orderId },
              data: { paymentStatus },
            });
            console.log(`[Payment-TX] Order updated in ${Date.now() - updateStart}ms`);
          }

          console.log(`[Payment-TX] Total transaction time: ${Date.now() - txInnerStart}ms`);
          return { newPayment, paymentStatus };
        },
        { maxWait: 10000, timeout: 10000 } // Increased to handle queue delays
      );
      timeline.transaction = Date.now() - startTime;
      console.log(`[Payment] Transaction completed in ${timeline.transaction}ms`);

      // Extract payment from transaction result
      const paymentResult = payment.newPayment;

      // ==================== ASYNC SECTION METADATA UPDATE ====================
      console.log(`[Payment] Starting async section updates for ${affectedSectionIds.size} sections`);
      if (affectedSectionIds.size > 0) {
        // Fire-and-forget: Start all section updates concurrently
        Promise.all(
          Array.from(affectedSectionIds).map((sectionId) =>
            this.updateSectionMetadataAsync(sectionId, paymentRequest.paymentMethod)
          )
        ).catch((err) => {
          console.error('Error in concurrent section metadata updates:', err);
        });
      }

      const totalTime = Date.now() - startTime;
      console.log(`[Payment] recordOrderPayment COMPLETE (${totalTime}ms total) - Timeline:`, timeline);

      return successResponse(paymentResult);
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`[Payment] recordOrderPayment FAILED after ${totalTime}ms:`, error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, error instanceof Error ? error.message : 'Failed to record payment');
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
    const startTime = Date.now();
    const timeline: { [key: string]: number } = {};

    try {
      console.log(`[Deferred Payment] START for order ${orderId}, amount=${paymentRequest.amount}, method=${paymentRequest.paymentMethod}`);
      
      const amount = normalizeToCents(paymentRequest.amount);
      validatePrice(amount, 'payment amount');
      timeline.validatePrice = Date.now() - startTime;

      // Fetch order with all needed relations - fresh from DB
      const order = await (prisma as any).orderHeader.findUnique({
        where: { id: orderId },
        include: { 
          payments: true,
          lines: { include: { departmentSection: true } }
        },
      });
      timeline.fetchOrder = Date.now() - startTime;
      console.log(`[Deferred Payment] Fetched order in ${timeline.fetchOrder}ms`);

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

      // Get affected section IDs for metadata updates

      const affectedSectionIds = new Set<string>();
      for (const line of order.lines || []) {
        if (line.departmentSectionId) {
          affectedSectionIds.add(line.departmentSectionId);
        }
      }

      // Ensure payment type exists BEFORE transaction
      console.log(`[Deferred Payment] Ensuring payment type for method: ${paymentRequest.paymentMethod}`);
      const ensureTypeStart = Date.now();
      const paymentType = await this.ensurePaymentType(paymentRequest.paymentMethod);
      timeline.ensurePaymentType = Date.now() - ensureTypeStart;
      console.log(`[Deferred Payment] ensurePaymentType took ${timeline.ensurePaymentType}ms`);

      // ==================== TRANSACTION: CREATE PAYMENT + UPDATE STATUS ====================
      console.log(`[Deferred Payment] STARTING TRANSACTION for order ${orderId}, maxWait=10000, timeout=10000`);
      const txStartTime = Date.now();
      
      // Re-fetch current payment state INSIDE transaction to avoid race conditions
      const payment = await prisma.$transaction(
        async (tx: any) => {
          const txInnerStart = Date.now();
          console.log(`[Deferred-TX] Transaction callback started (${Date.now() - txStartTime}ms after tx call)`);

          // Re-fetch current order state within transaction (gets latest committed data)
          const currentOrder = await tx.orderHeader.findUnique({
            where: { id: orderId },
            include: { payments: true },
          });
          console.log(`[Deferred-TX] Re-fetched order in ${Date.now() - txInnerStart}ms`);

          if (!currentOrder) {
            throw new Error('Order not found in transaction');
          }

          // Validate payment amount against current state
          const currentTotalPaid = currentOrder.payments.reduce((sum: number, p: any) => sum + p.amount, 0);
          if (currentTotalPaid + amount > currentOrder.total) {
            throw new Error('Payment amount exceeds order total');
          }

          // Create payment record
          const createPaymentStart = Date.now();
          console.log(`[Deferred-TX] Creating payment record...`);
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
          console.log(`[Deferred-TX] Payment created in ${Date.now() - createPaymentStart}ms`);

          // Calculate new payment state based on CURRENT state
          const newTotalPaid = currentTotalPaid + amount;
          const amountOwed = currentOrder.total - newTotalPaid;

          // Determine payment status
          let paymentStatus = 'unpaid';
          if (amountOwed <= 0) {
            paymentStatus = 'paid';
          } else if (newTotalPaid > 0) {
            paymentStatus = 'partial';
          }

          // ALWAYS update if status changed
          if (paymentStatus !== currentOrder.paymentStatus) {
            const updateStart = Date.now();
            await tx.orderHeader.update({
              where: { id: orderId },
              data: { paymentStatus },
            });
            console.log(`[Deferred-TX] Order updated in ${Date.now() - updateStart}ms`);
          }

          console.log(`[Deferred-TX] Total transaction time: ${Date.now() - txInnerStart}ms`);
          return { newPayment, paymentStatus };
        },
        { maxWait: 10000, timeout: 10000 } // Increased maxWait to handle queue delays
      );
      timeline.transaction = Date.now() - startTime;
      console.log(`[Deferred Payment] Transaction completed in ${timeline.transaction}ms`);

      // Extract payment from transaction result
      const paymentResult = payment.newPayment;

      // ==================== ASYNC SECTION METADATA UPDATE ====================
      console.log(`[Deferred Payment] Starting async section updates for ${affectedSectionIds.size} sections`);
      if (affectedSectionIds.size > 0) {
        // Fire-and-forget: Start all section updates concurrently
        Promise.all(
          Array.from(affectedSectionIds).map((sectionId) =>
            this.updateSectionMetadataAsync(sectionId, paymentRequest.paymentMethod)
          )
        ).catch((err) => {
          console.error('Error in concurrent section metadata updates:', err);
        });
      }

      const totalTime = Date.now() - startTime;
      console.log(`[Deferred Payment] COMPLETE (${totalTime}ms total) - Timeline:`, timeline);

      return successResponse(paymentResult);
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`[Deferred Payment] FAILED after ${totalTime}ms:`, error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, error instanceof Error ? error.message : 'Failed to record payment');
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

  /**
   * Update section metadata asynchronously and independently
   * Runs in parallel with other sections, completely separate from payment transaction
   * @param sectionId - The section ID to update
   * @param paymentMethod - Payment method used for the last payment
   */
  private async updateSectionMetadataAsync(
    sectionId: string,
    paymentMethod: string
  ): Promise<void> {
    try {
      const section = await prisma.departmentSection.findUnique({
        where: { id: sectionId },
      });

      if (!section) return;

      // Get ALL orders that have lines in this section
      const sectionOrders = await prisma.orderHeader.findMany({
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

      await prisma.departmentSection.update({
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
            lastPaymentMethod: paymentMethod,
          },
        },
      });
    } catch (err) {
      console.error(`Error updating metadata for section ${sectionId}:`, err);
      // Fail silently - metadata updates shouldn't block payment
    }
  }
}

export const paymentService = new PaymentService();

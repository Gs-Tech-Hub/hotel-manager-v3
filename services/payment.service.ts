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

      // Calculate section-level payment allocations
      const sectionAllocations = this.calculateSectionPaymentAllocations(order, amount);
      console.log(`[Payment] Section allocations:`, sectionAllocations);

      // ==================== ASYNC SECTION METADATA UPDATE ====================
      console.log(`[Payment] Starting async section updates for ${affectedSectionIds.size} sections`);
      if (affectedSectionIds.size > 0) {
        // Fire-and-forget: Start all section updates concurrently with allocation data
        Promise.all(
          Array.from(affectedSectionIds).map((sectionId) => {
            const sectionAllocation = sectionAllocations.find(sa => sa.sectionId === sectionId);
            return this.updateSectionMetadataAsync(
              sectionId,
              paymentRequest.paymentMethod,
              sectionAllocation,
              order
            );
          })
        ).catch((err) => {
          console.error('Error in concurrent section metadata updates:', err);
        });

        // CRITICAL: Also recalculate section stats to reflect in dashboards
        // This ensures payment-triggered changes appear in order tables and section stats
        console.log(`[Payment] Starting section stats recalculation for ${affectedSectionIds.size} sections`);
        Promise.all(
          Array.from(affectedSectionIds).map(async (sectionId) => {
            try {
              const section = await prisma.departmentSection.findUnique({
                where: { id: sectionId },
                include: { department: true },
              });
              if (section?.department?.code) {
                const { departmentService } = await import('./department.service');
                await Promise.all([
                  departmentService.recalculateSectionStats(section.department.code, sectionId),
                  departmentService.rollupParentStats(section.department.code),
                ]);
                console.log(`[Payment] Stats recalculated for section ${sectionId}`);
              }
            } catch (e) {
              console.error(`[Payment] Error recalculating stats for section ${sectionId}:`, e);
              // Don't fail payment - stats can be recalculated later
            }
          })
        ).catch((err) => {
          console.error('[Payment] Error in concurrent section stats recalculation:', err);
        });
      }

      // ==================== ASYNC SERVICE SALES COUNT UPDATE ====================
      // Task 2: When payment received, update service sales count from fulfillment records
      if (payment.paymentStatus === 'paid') {
        console.log(`[Payment] Order ${orderId} is now PAID - updating service sales counts`);
        try {
          const { serviceSalesService } = await import('./service-sales.service');
          // Fire-and-forget: Update service sales count based on fulfillments
          serviceSalesService.updateServiceSalesCountAfterPayment(orderId).catch((err) => {
            console.error(`[Payment] Error updating service sales count for order ${orderId}:`, err);
          });
        } catch (e) {
          console.error('[Payment] Error triggering service sales count update:', e);
          // Don't fail payment - this is non-critical
        }
      }

      const totalTime = Date.now() - startTime;
      console.log(`[Payment] recordOrderPayment COMPLETE (${totalTime}ms total) - Timeline:`, timeline);

      return successResponse({
        ...paymentResult,
        sectionAllocations,
      });
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

      // Calculate section-level payment allocations
      const sectionAllocations = this.calculateSectionPaymentAllocations(order, amount);
      console.log(`[Deferred Payment] Section allocations:`, sectionAllocations);

      // ==================== ASYNC SECTION METADATA UPDATE ====================
      console.log(`[Deferred Payment] Starting async section updates for ${affectedSectionIds.size} sections`);
      if (affectedSectionIds.size > 0) {
        // Fire-and-forget: Start all section updates concurrently with allocation data
        Promise.all(
          Array.from(affectedSectionIds).map((sectionId) => {
            const sectionAllocation = sectionAllocations.find(sa => sa.sectionId === sectionId);
            return this.updateSectionMetadataAsync(
              sectionId,
              paymentRequest.paymentMethod,
              sectionAllocation,
              order
            );
          })
        ).catch((err) => {
          console.error('Error in concurrent section metadata updates:', err);
        });

        // CRITICAL: Also recalculate section stats to reflect in dashboards
        // This ensures payment-triggered changes appear in order tables and section stats
        console.log(`[Deferred Payment] Starting section stats recalculation for ${affectedSectionIds.size} sections`);
        Promise.all(
          Array.from(affectedSectionIds).map(async (sectionId) => {
            try {
              const section = await prisma.departmentSection.findUnique({
                where: { id: sectionId },
                include: { department: true },
              });
              if (section?.department?.code) {
                const { departmentService } = await import('./department.service');
                await Promise.all([
                  departmentService.recalculateSectionStats(section.department.code, sectionId),
                  departmentService.rollupParentStats(section.department.code),
                ]);
                console.log(`[Deferred Payment] Stats recalculated for section ${sectionId}`);
              }
            } catch (e) {
              console.error(`[Deferred Payment] Error recalculating stats for section ${sectionId}:`, e);
              // Don't fail payment - stats can be recalculated later
            }
          })
        ).catch((err) => {
          console.error('[Deferred Payment] Error in concurrent section stats recalculation:', err);
        });
      }

      // ==================== ASYNC SERVICE SALES COUNT UPDATE ====================
      // Task 2: When payment received, update service sales count from fulfillment records
      if (payment.paymentStatus === 'paid') {
        console.log(`[Deferred Payment] Order ${orderId} is now PAID - updating service sales counts`);
        try {
          const { serviceSalesService } = await import('./service-sales.service');
          // Fire-and-forget: Update service sales count based on fulfillments
          serviceSalesService.updateServiceSalesCountAfterPayment(orderId).catch((err) => {
            console.error(`[Deferred Payment] Error updating service sales count for order ${orderId}:`, err);
          });
        } catch (e) {
          console.error('[Deferred Payment] Error triggering service sales count update:', e);
          // Don't fail payment - this is non-critical
        }
      }

      const totalTime = Date.now() - startTime;
      console.log(`[Deferred Payment] COMPLETE (${totalTime}ms total) - Timeline:`, timeline);

      return successResponse({
        ...paymentResult,
        sectionAllocations,
      });
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
    paymentMethod: string,
    sectionAllocation?: any,
    order?: any
  ): Promise<void> {
    try {
      const section = await prisma.departmentSection.findUnique({
        where: { id: sectionId },
      });

      if (!section) return;

      // Get ALL orders that have lines in this section (fresh data)
      const sectionOrders = await prisma.orderHeader.findMany({
        where: {
          lines: {
            some: { departmentSectionId: sectionId }
          }
        },
        include: {
          payments: true,
          discounts: true,
          lines: { where: { departmentSectionId: sectionId } }
        }
      });

      // Calculate section-wide totals WITH itemized breakdown
      let sectionItemCount = 0;
      let sectionSubtotalBeforeDiscount = 0;
      let sectionDiscountAmount = 0;
      let sectionTaxAmount = 0;
      let sectionTotalAmount = 0;
      let sectionPaidAmount = 0;
      let sectionOwedAmount = 0;

      for (const orderData of sectionOrders) {
        // Count items in section
        const linesInSection = orderData.lines || [];
        sectionItemCount += linesInSection.reduce((sum: number, line: any) => sum + (line.quantity || 0), 0);
        
        // Calculate section's line total BEFORE discount
        const sectionLineTotal = linesInSection.reduce((sum: number, line: any) => sum + (line.lineTotal || 0), 0);
        sectionSubtotalBeforeDiscount += sectionLineTotal;
        
        // Calculate order's total line amount across ALL lines (not just this section)
        const orderTotalLineAmount = orderData.lines?.reduce((sum: number, l: any) => sum + (l.lineTotal || 0), 0) || 0;
        
        // Allocate order's discount PROPORTIONALLY to this section's items
        let sectionDiscountShare = 0;
        if (orderTotalLineAmount > 0 && orderData.discountTotal) {
          sectionDiscountShare = Math.round(
            (sectionLineTotal / orderTotalLineAmount) * orderData.discountTotal
          );
          sectionDiscountAmount += sectionDiscountShare;
        }
        
        // Allocate order's tax PROPORTIONALLY to this section's items
        let sectionTaxShare = 0;
        if (orderTotalLineAmount > 0 && orderData.tax) {
          sectionTaxShare = Math.round(
            (sectionLineTotal / orderTotalLineAmount) * orderData.tax
          );
          sectionTaxAmount += sectionTaxShare;
        }
        
        // Calculate section's FINAL total: lineTotal - discount + tax (NOT using full order.total)
        const sectionFinalTotal = Math.max(0, sectionLineTotal - sectionDiscountShare + sectionTaxShare);
        sectionTotalAmount += sectionFinalTotal;
        
        // Allocate payment PROPORTIONALLY based on section's portion of the order
        const orderPaidTotal = orderData.payments.reduce((sum: number, p: any) => sum + p.amount, 0);
        let sectionPaidShare = 0;
        
        if (orderTotalLineAmount > 0) {
          // Payment allocation: proportional to section's final (discounted, taxed) amount
          sectionPaidShare = Math.round(
            (sectionFinalTotal / orderData.total) * orderPaidTotal
          );
        }
        sectionPaidAmount += sectionPaidShare;
        
        // Owed amount = section total - section paid
        const sectionOwedShare = Math.max(0, sectionFinalTotal - sectionPaidShare);
        sectionOwedAmount += sectionOwedShare;
      }

      const existingMeta = (section.metadata as any) || {};
      const existingStats = existingMeta.sectionStats || {};
      const existingPaymentHistory = existingStats.paymentHistory || [];

      // Add current transaction to payment history (if allocation provided)
      let updatedPaymentHistory = [...existingPaymentHistory];
      if (sectionAllocation && order) {
        updatedPaymentHistory.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          itemsInSection: sectionAllocation.lineTotal > 0 ? (order.lines || []).filter((l: any) => l.departmentSectionId === sectionId).reduce((s: number, l: any) => s + (l.quantity || 0), 0) : 0,
          lineTotal: sectionAllocation.lineTotal,
          discountAllocated: sectionAllocation.discountAllocated,
          taxAllocated: sectionAllocation.taxAllocated || 0,
          finalAmount: sectionAllocation.finalAmount,
          paymentAllocated: sectionAllocation.paymentAllocated,
          paymentStatus: sectionAllocation.paymentStatus,
          paymentMethod,
          timestamp: new Date(),
        });
        // Keep last 100 transactions
        if (updatedPaymentHistory.length > 100) {
          updatedPaymentHistory = updatedPaymentHistory.slice(-100);
        }
      }

      await prisma.departmentSection.update({
        where: { id: sectionId },
        data: {
          metadata: {
            ...existingMeta,
            sectionStats: {
              itemCount: sectionItemCount,
              subtotalBeforeDiscount: sectionSubtotalBeforeDiscount,
              discountTotal: sectionDiscountAmount,
              taxTotal: sectionTaxAmount,
              paid: {
                totalAmount: sectionPaidAmount,
                updatedAt: new Date(),
              },
              unpaid: {
                totalAmount: sectionOwedAmount,
                updatedAt: new Date(),
              },
              paymentHistory: updatedPaymentHistory,
              updatedAt: new Date(),
            },
            lastPaymentAt: new Date(),
            lastPaymentMethod: paymentMethod,
          },
        },
      });

      console.log(`[Section Metadata] Updated section ${sectionId}:`, {
        itemCount: sectionItemCount,
        subtotal: sectionSubtotalBeforeDiscount,
        discount: sectionDiscountAmount,
        tax: sectionTaxAmount,
        paid: sectionPaidAmount,
        owed: sectionOwedAmount,
      });
    } catch (err) {
      console.error(`Error updating metadata for section ${sectionId}:`, err);
      // Fail silently - metadata updates shouldn't block payment
    }
  }

  /**
   * Calculate how a payment is allocated across sections
   * For orders with items from multiple sections, this breaks down
   * how much of the payment belongs to each section (proportional to their line totals)
   * 
   * IMPORTANT: Tax is allocated to sections proportionally to their discounted line totals
   * so that section stats properly reflect the collected amounts including tax
   */
  private calculateSectionPaymentAllocations(order: any, paymentAmount: number) {
    const sectionAllocations: {
      sectionId: string;
      sectionCode?: string;
      sectionName?: string;
      lineTotal: number;
      discountAllocated: number;
      taxAllocated: number;
      finalAmount: number;
      paymentAllocated: number;
      paymentStatus: string;
    }[] = [];

    // Group lines by section
    const sectionTotals = new Map<string, { lineTotal: number; sectionCode?: string; sectionName?: string }>();
    let totalOrderLineAmount = 0;

    for (const line of order.lines || []) {
      const sectionId = line.departmentSectionId || 'unassigned';
      const lineTotal = line.lineTotal || 0;
      totalOrderLineAmount += lineTotal;

      if (!sectionTotals.has(sectionId)) {
        sectionTotals.set(sectionId, {
          lineTotal: 0,
          sectionCode: line.departmentSection?.slug,
          sectionName: line.departmentSection?.name,
        });
      }
      const st = sectionTotals.get(sectionId)!;
      st.lineTotal += lineTotal;
    }

    // Calculate discount and tax allocation per section (proportional to each section's line total)
    // This ensures equal distribution of discounts and tax across departments based on their contribution
    const totalDiscount = order.discountTotal || 0;
    const totalTax = order.tax || 0;
    let discountAllocatedSoFar = 0;
    let taxAllocatedSoFar = 0;
    let paymentAllocatedSoFar = 0;
    let sectionIndex = 0;
    const sectionIds = Array.from(sectionTotals.keys());

    // Pre-calculate total final amount (including tax) for payment allocation
    let totalFinalAmount = 0;
    const sectionDiscounts = new Map<string, number>();
    const sectionTaxes = new Map<string, number>();
    
    for (const sectionId of sectionIds) {
      const st = sectionTotals.get(sectionId)!;
      const sectionDiscount = totalOrderLineAmount > 0
        ? Math.round((st.lineTotal / totalOrderLineAmount) * totalDiscount)
        : 0;
      sectionDiscounts.set(sectionId, sectionDiscount);
      
      // Allocate tax proportionally to pre-discount amount
      const sectionTax = totalOrderLineAmount > 0
        ? Math.round((st.lineTotal / totalOrderLineAmount) * totalTax)
        : 0;
      sectionTaxes.set(sectionId, sectionTax);
      
      totalFinalAmount += Math.max(0, st.lineTotal - sectionDiscount + sectionTax);
    }

    for (const sectionId of sectionIds) {
      const st = sectionTotals.get(sectionId)!;
      const isLastSection = sectionIndex === sectionIds.length - 1;

      // Get pre-calculated discount and tax for this section
      let sectionDiscount = sectionDiscounts.get(sectionId) || 0;
      let sectionTax = sectionTaxes.get(sectionId) || 0;
      
      // Adjust last section to account for rounding errors
      if (isLastSection) {
        sectionDiscount = totalDiscount - discountAllocatedSoFar;
        sectionTax = totalTax - taxAllocatedSoFar;
      }
      
      discountAllocatedSoFar += sectionDiscount;
      taxAllocatedSoFar += sectionTax;

      // Calculate final amount for this section (after discount, plus tax)
      const finalAmount = Math.max(0, st.lineTotal - sectionDiscount + sectionTax);

      // Allocate payment proportionally to final (discounted + tax) amounts
      let sectionAllocation = 0;
      
      if (isLastSection) {
        // Last section gets remainder to avoid rounding errors
        sectionAllocation = paymentAmount - paymentAllocatedSoFar;
      } else if (totalFinalAmount > 0) {
        sectionAllocation = Math.round(
          (finalAmount / totalFinalAmount) * paymentAmount
        );
      }
      
      paymentAllocatedSoFar += sectionAllocation;

      // Determine payment status for this section (compare against final amount including tax)
      let paymentStatus = 'unpaid';
      if (sectionAllocation >= finalAmount) {
        paymentStatus = 'paid';
      } else if (sectionAllocation > 0) {
        paymentStatus = 'partial';
      }

      sectionAllocations.push({
        sectionId,
        sectionCode: st.sectionCode,
        sectionName: st.sectionName,
        lineTotal: st.lineTotal,
        discountAllocated: sectionDiscount,
        taxAllocated: sectionTax,
        finalAmount,
        paymentAllocated: sectionAllocation,
        paymentStatus,
      });

      sectionIndex++;
    }

    return sectionAllocations;
  }
}

export const paymentService = new PaymentService();

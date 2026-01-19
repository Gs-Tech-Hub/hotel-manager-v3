/**
 * Payment Service
 * Handles all payment-related operations
 */

import { BaseService } from './base.service';
import { IPayment } from '@/types/entities';
import { prisma } from '@/lib/auth/prisma';

export class PaymentService extends BaseService<IPayment> {
  constructor() {
    super('payment');
  }

  private mapPayment(p: any): IPayment {
    return {
      id: p.id,
      transactionID: p.transactionID,
      paymentMethod: p.paymentMethod,
      paymentStatus: (p.paymentStatus as any) as 'pending' | 'completed' | 'failed',
      totalPrice: p.totalPrice,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  /**
   * Get payment by transaction ID
   */
  async getByTransactionID(transactionID: string): Promise<IPayment | null> {
    try {
      const row = await prisma.payment.findUnique({
        where: { transactionID },
        include: { paymentDetails: true },
      });

      if (!row) return null;
      return this.mapPayment(row as any);
    } catch (error) {
      console.error('Error fetching payment:', error);
      return null;
    }
  }

  /**
   * Get payments by status
   */
  async getPaymentsByStatus(status: string): Promise<IPayment[]> {
    try {
      const rows = await prisma.payment.findMany({
        where: { paymentStatus: status },
        orderBy: { createdAt: 'desc' },
      });

      return rows.map((r: any) => this.mapPayment(r));
    } catch (error) {
      console.error('Error fetching payments by status:', error);
      return [];
    }
  }

  /**
   * Calculate payment statistics
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
   * Process a payment
   */
  async processPayment(
    paymentData: Record<string, any>
  ): Promise<IPayment | null> {
    try {
      const row = await prisma.payment.create({
        // casting to any to allow flexible incoming paymentData shapes
        data: paymentData as any,
      });

      return this.mapPayment(row as any);
    } catch (error) {
      console.error('Error processing payment:', error);
      return null;
    }
  }

  /**
   * Complete a payment
   */
  async completePayment(paymentId: string): Promise<IPayment | null> {
    try {
      const row = await prisma.payment.update({
        where: { id: paymentId },
        data: { paymentStatus: 'completed' },
      });

      return this.mapPayment(row as any);
    } catch (error) {
      console.error('Error completing payment:', error);
      return null;
    }
  }

  /**
   * Fail a payment
   */
  async failPayment(paymentId: string): Promise<IPayment | null> {
    try {
      const row = await prisma.payment.update({
        where: { id: paymentId },
        data: { paymentStatus: 'failed' },
      });

      return this.mapPayment(row as any);
    } catch (error) {
      console.error('Error failing payment:', error);
      return null;
    }
  }
}

export const paymentService = new PaymentService();

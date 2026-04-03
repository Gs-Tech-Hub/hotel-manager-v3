/**
 * Service Sales Tracking
 * 
 * Updates service sales count when orders are paid.
 * Uses fulfillment count (OrderFulfillment records) to track services sold.
 * No schema changes - stores count in service metadata.
 */

import { prisma } from '@/lib/auth/prisma';

interface ServiceSalesCount {
  serviceId: string;
  serviceName: string;
  totalFulfilled: number;
  totalRevenue: number;
}

export class ServiceSalesService {
  /**
   * Update service sales count after payment received
   * Called when order payment status changes to 'paid' or 'partial'
   * 
   * Aggregates fulfilled quantity from OrderFulfillment records for services
   * in this order and updates the service's metadata with cumulative count
   */
  async updateServiceSalesCountAfterPayment(orderId: string) {
    try {
      // Fetch order with all service lines and fulfillments
      const order = await prisma.orderHeader.findUnique({
        where: { id: orderId },
        include: {
          lines: {
            where: { productType: 'service' },
            include: {
              fulfillments: {
                where: { status: 'fulfilled' }
              }
            }
          },
          payments: true
        }
      });

      if (!order || !order.lines || order.lines.length === 0) {
        console.log(`[ServiceSales] No service lines found for order ${orderId}`);
        return;
      }

      // Check if order is paid
      const totalPaid = order.payments?.reduce((sum: number, p: any) => sum + Number(p.amount ?? 0), 0) || 0;
      const isPaid = totalPaid >= order.total && order.total > 0;

      if (!isPaid) {
        console.log(`[ServiceSales] Order ${orderId} not fully paid yet (paid: ${totalPaid}, total: ${order.total})`);
        return;
      }

      // Group services by productId and sum fulfilled quantities
      const serviceCountMap = new Map<string, ServiceSalesCount>();

      for (const line of order.lines) {
        const key = line.productId;
        
        // Calculate fulfilled quantity from fulfillments for this line
        const fulfilledQty = line.fulfillments?.reduce(
          (sum: number, f: any) => sum + (f.fulfilledQuantity || 0), 
          0
        ) || 0;

        const existing = serviceCountMap.get(key) || {
          serviceId: line.productId,
          serviceName: line.productName,
          totalFulfilled: 0,
          totalRevenue: 0
        };

        existing.totalFulfilled += fulfilledQty;
        existing.totalRevenue += line.lineTotal || 0;
        
        serviceCountMap.set(key, existing);
      }

      // Update each service's metadata with sales count
      const updates = Array.from(serviceCountMap.values()).map(async (serviceCount) => {
        try {
          // Fetch current service metadata
          const service = await prisma.serviceInventory.findUnique({
            where: { id: serviceCount.serviceId }
          });

          if (!service) {
            console.warn(`[ServiceSales] Service ${serviceCount.serviceId} not found`);
            return;
          }

          // Parse existing metadata or create new
          const metadata = (service.metadata as any) || {};
          
          // Update sales count (append or increment)
          if (!metadata.salesCount) {
            metadata.salesCount = serviceCount.totalFulfilled;
          } else {
            metadata.salesCount += serviceCount.totalFulfilled;
          }

          // Track revenue
          if (!metadata.totalRevenue) {
            metadata.totalRevenue = serviceCount.totalRevenue;
          } else {
            metadata.totalRevenue += serviceCount.totalRevenue;
          }

          // Record last paid at timestamp
          metadata.lastPaidAt = new Date().toISOString();

          // Update service with new metadata
          await prisma.serviceInventory.update({
            where: { id: serviceCount.serviceId },
            data: { metadata }
          });

          console.log(`[ServiceSales] Updated service ${serviceCount.serviceName}: +${serviceCount.totalFulfilled} sold (total: ${metadata.salesCount})`);
        } catch (err) {
          console.error(`[ServiceSales] Failed to update service ${serviceCount.serviceId}:`, err);
        }
      });

      await Promise.all(updates);
      
    } catch (error) {
      console.error('[ServiceSales] Error updating service sales count:', error);
      // Don't throw - this is async and should not block payment completion
    }
  }

  /**
   * Get service sales statistics from fulfillment count
   * Same logic as stats endpoint but used for internal tracking
   */
  async getServiceSalesStats(serviceId: string) {
    try {
      // Query all fulfilled service lines for this service
      const serviceLines = await prisma.orderLine.findMany({
        where: {
          productId: serviceId,
          productType: 'service'
        },
        include: {
          fulfillments: {
            where: { status: 'fulfilled' }
          },
          orderHeader: {
            include: { payments: true }
          }
        }
      });

      if (serviceLines.length === 0) {
        return {
          serviceId,
          totalOrdered: 0,
          totalFulfilled: 0,
          totalRevenue: 0
        };
      }

      let totalOrdered = 0;
      let totalFulfilled = 0;
      let totalRevenue = 0;

      for (const line of serviceLines) {
        totalOrdered += line.quantity;
        totalRevenue += line.lineTotal || 0;

        // Count fulfilled from fulfillments
        const fulfilledQty = line.fulfillments?.reduce(
          (sum: number, f: any) => sum + (f.fulfilledQuantity || 0),
          0
        ) || 0;
        totalFulfilled += fulfilledQty;
      }

      return {
        serviceId,
        totalOrdered,
        totalFulfilled,
        totalRevenue
      };
    } catch (error) {
      console.error('[ServiceSales] Error calculating service stats:', error);
      return null;
    }
  }

  /**
   * Recalculate all service sales counts from scratch
   * Use when reconciling data
   */
  async reconcileAllServiceCounts() {
    try {
      const services = await prisma.serviceInventory.findMany();
      
      for (const service of services) {
        const stats = await this.getServiceSalesStats(service.id);
        
        if (stats) {
          const metadata = (service.metadata as any) || {};
          metadata.salesCount = stats.totalFulfilled;
          metadata.totalRevenue = stats.totalRevenue;
          metadata.reconciliedAt = new Date().toISOString();

          await prisma.serviceInventory.update({
            where: { id: service.id },
            data: { metadata }
          });

          console.log(`[ServiceSales] Reconciled ${service.name}: ${stats.totalFulfilled} sold (revenue: ${stats.totalRevenue})`);
        }
      }
    } catch (error) {
      console.error('[ServiceSales] Error reconciling service counts:', error);
    }
  }
}

export const serviceSalesService = new ServiceSalesService();

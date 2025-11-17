/**
 * Customer Service
 * Handles all customer-related operations
 */

import { BaseService } from './base.service';
import { ICustomer } from '../types/entities';
import { prisma } from '../lib/prisma';

// Helper mapper: convert Prisma results to ICustomer domain type
function mapCustomer(c: any): ICustomer {
  if (!c) return c;
  return {
    id: c.id,
    email: c.email,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    firstName: c.firstName,
    lastName: c.lastName,
    phone: c.phone,
    nationality: c.nationality ?? undefined,
    street: c.street ?? undefined,
    city: c.city ?? undefined,
    state: c.state ?? undefined,
    zip: c.zip ?? undefined,
  };
}

function mapCustomers(arr: any[] | null): ICustomer[] {
  if (!arr) return [];
  return arr.map(mapCustomer);
}

export class CustomerService extends BaseService<ICustomer> {
  constructor() {
    super('customer');
  }

  /**
   * Get customer by email
   */
  async getByEmail(email: string): Promise<ICustomer | null> {
    try {
      const c = await prisma.customer.findUnique({
        where: { email },
      });
      return mapCustomer(c as any) as ICustomer | null;
    } catch (error) {
      console.error('Error fetching customer by email:', error);
      return null;
    }
  }

  /**
   * Get customer with all related data
   */
  async getCustomerProfile(customerId: string): Promise<any | null> {
    try {
      return await prisma.customer.findUnique({
        where: { id: customerId },
        include: {
          bookings: { take: 10, orderBy: { createdAt: 'desc' } },
          orders: { take: 10, orderBy: { createdAt: 'desc' } },
          games: true,
          gymMemberships: true,
          sportMemberships: true,
        },
      });
    } catch (error) {
      console.error('Error fetching customer profile:', error);
      return null;
    }
  }

  /**
   * Search customers
   */
  async searchCustomers(query: string): Promise<ICustomer[]> {
    try {
      const rows = await prisma.customer.findMany({
        where: {
          OR: [
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: 20,
      });
      return mapCustomers(rows);
    } catch (error) {
      console.error('Error searching customers:', error);
      return [];
    }
  }

  /**
   * Get customer statistics
   */
  async getCustomerStats(): Promise<{
    totalCustomers: number;
    totalBookings: number;
    totalSpent: number;
  } | null> {
    try {
      const [totalCustomers, totalBookings, totalSpent] = await Promise.all([
        prisma.customer.count(),
        prisma.booking.count(),
        prisma.booking.aggregate({
          _sum: { totalPrice: true },
        }),
      ]);

      return {
        totalCustomers,
        totalBookings,
        totalSpent: totalSpent._sum.totalPrice || 0,
      };
    } catch (error) {
      console.error('Error fetching customer stats:', error);
      return null;
    }
  }
}

export const customerService = new CustomerService();

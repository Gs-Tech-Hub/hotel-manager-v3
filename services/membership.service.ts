/**
 * Gym & Membership Service
 * Handles gym, sports memberships and sessions
 */

import { BaseService } from './base.service';
import { IGymMembership, ISportMembership, IMembershipPlan } from '@/types/entities';
import { prisma } from '@/lib/auth/prisma';

export class GymMembershipService extends BaseService<IGymMembership> {
  constructor() {
    super('gymMembership');
  }

  private mapGym(m: any): IGymMembership {
    return {
      ...m,
      emergencyContact: m.emergencyContact ?? undefined,
      profilePhoto: m.profilePhoto ?? undefined,
    };
  }

  /**
   * Get active memberships
   */
  async getActiveMemberships(): Promise<IGymMembership[]> {
    try {
      const today = new Date();
      const rows = await prisma.gymMembership.findMany({
        where: {
          isActive: true,
          expiryDate: { gte: today },
        },
        include: { customer: true, membershipPlans: true },
      });

      return rows.map((r: any) => this.mapGym(r));
    } catch (error) {
      console.error('Error fetching active gym memberships:', error);
      return [];
    }
  }

  /**
   * Get expired memberships
   */
  async getExpiredMemberships(): Promise<IGymMembership[]> {
    try {
      const today = new Date();
      const rows = await prisma.gymMembership.findMany({
        where: {
          expiryDate: { lt: today },
        },
        include: { customer: true },
      });

      return rows.map((r: any) => this.mapGym(r));
    } catch (error) {
      console.error('Error fetching expired gym memberships:', error);
      return [];
    }
  }

  /**
   * Get membership by customer
   */
  async getCustomerMemberships(customerId: string): Promise<IGymMembership[]> {
    try {
      const rows = await prisma.gymMembership.findMany({
        where: { customerId },
        include: { membershipPlans: true, checkIns: true },
      });

      return rows.map((r: any) => this.mapGym(r));
    } catch (error) {
      console.error('Error fetching customer gym memberships:', error);
      return [];
    }
  }

  /**
   * Renew membership
   */
  async renewMembership(
    membershipId: string,
    months: number
  ): Promise<IGymMembership | null> {
    try {
      const membership = await prisma.gymMembership.findUnique({
        where: { id: membershipId },
      });

      if (!membership) return null;

      const newExpiryDate = new Date(membership.expiryDate);
      newExpiryDate.setMonth(newExpiryDate.getMonth() + months);

      const updated = await prisma.gymMembership.update({
        where: { id: membershipId },
        data: {
          expiryDate: newExpiryDate,
          isActive: true,
        },
      });

      return this.mapGym(updated);
    } catch (error) {
      console.error('Error renewing gym membership:', error);
      return null;
    }
  }

  /**
   * Get membership statistics
   */
  async getMembershipStats(): Promise<{
    totalMemberships: number;
    activeMemberships: number;
    expiredMemberships: number;
    expiringsoon: number;
  } | null> {
    try {
      const today = new Date();
      const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

      const [total, active, expired, expiringS] = await Promise.all([
        prisma.gymMembership.count(),
        prisma.gymMembership.count({
          where: { isActive: true, expiryDate: { gte: today } },
        }),
        prisma.gymMembership.count({
          where: { expiryDate: { lt: today } },
        }),
        prisma.gymMembership.count({
          where: {
            expiryDate: { gte: today, lte: thirtyDaysFromNow },
          },
        }),
      ]);

      return {
        totalMemberships: total,
        activeMemberships: active,
        expiredMemberships: expired,
        expiringsoon: expiringS,
      };
    } catch (error) {
      console.error('Error fetching gym membership stats:', error);
      return null;
    }
  }
}

export class SportMembershipService extends BaseService<ISportMembership> {
  constructor() {
    super('sportMembership');
  }

  private mapSport(s: any): ISportMembership {
    return {
      ...s,
      emergencyContact: s.emergencyContact ?? undefined,
    };
  }

  /**
   * Get active memberships
   */
  async getActiveMemberships(): Promise<ISportMembership[]> {
    try {
      const today = new Date();
      const rows = await prisma.sportMembership.findMany({
        where: {
          isActive: true,
          expiryDate: { gte: today },
        },
        include: { customer: true },
      });

      return rows.map((r: any) => this.mapSport(r));
    } catch (error) {
      console.error('Error fetching active sport memberships:', error);
      return [];
    }
  }

  /**
   * Get membership by customer
   */
  async getCustomerMemberships(customerId: string): Promise<ISportMembership[]> {
    try {
      const rows = await prisma.sportMembership.findMany({
        where: { customerId },
        include: { checkIns: true },
      });

      return rows.map((r: any) => this.mapSport(r));
    } catch (error) {
      console.error('Error fetching customer sport memberships:', error);
      return [];
    }
  }
}

export class MembershipPlanService extends BaseService<IMembershipPlan> {
  constructor() {
    super('membershipPlan');
  }

  private mapPlan(p: any): IMembershipPlan {
    return {
      ...p,
      description: p.description ?? undefined,
      maxCheckinsPerMonth: p.maxCheckinsPerMonth ?? undefined,
      discountAmount: p.discountAmount ?? undefined,
      accessToClasses: p.accessToClasses ?? undefined,
    };
  }

  /**
   * Get active plans
   */
  async getActivePlans(): Promise<IMembershipPlan[]> {
    try {
      const rows = await prisma.membershipPlan.findMany({
        where: { isActive: true },
        orderBy: { price: 'asc' },
      });

      return rows.map((r: any) => this.mapPlan(r));
    } catch (error) {
      console.error('Error fetching active membership plans:', error);
      return [];
    }
  }

  /**
   * Get plans by price range
   */
  async getPlansByPrice(minPrice: number, maxPrice: number): Promise<IMembershipPlan[]> {
    try {
      const rows = await prisma.membershipPlan.findMany({
        where: {
          price: { gte: minPrice, lte: maxPrice },
          isActive: true,
        },
      });

      return rows.map((r: any) => this.mapPlan(r));
    } catch (error) {
      console.error('Error fetching membership plans by price:', error);
      return [];
    }
  }

  /**
   * Get most popular plans
   */
  async getPopularPlans(limit: number = 5): Promise<IMembershipPlan[]> {
    try {
      const rows = await prisma.membershipPlan.findMany({
        where: { isActive: true },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });

      return rows.map((r: any) => this.mapPlan(r));
    } catch (error) {
      console.error('Error fetching popular plans:', error);
      return [];
    }
  }
}

export const gymMembershipService = new GymMembershipService();
export const sportMembershipService = new SportMembershipService();
export const membershipPlanService = new MembershipPlanService();

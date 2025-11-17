/**
 * Discount Service
 * Handles discount rules, validation, and application
 */

import { BaseService } from './base.service';
import { IDiscountRule } from '../types/entities';
import { prisma } from '../lib/prisma';
import { UserContext, requireRole } from '@/lib/authorization';
import { errorResponse, ErrorCodes } from '@/lib/api-response';

export class DiscountService extends BaseService<IDiscountRule> {
  constructor() {
    super('discountRule');
  }

  /**
   * Create discount rule
   */
  async createDiscountRule(data: {
    code: string;
    name: string;
    description?: string;
    type: 'percentage' | 'fixed' | 'tiered';
    value: number;
    maxUsagePerCustomer?: number;
    maxTotalUsage?: number;
    minOrderAmount?: number;
    applicableDepts?: string[];
    startDate?: Date;
    endDate?: Date;
  }, ctx?: UserContext) {
    try {
      const forbidden = requireRole(ctx, ['admin']);
      if (forbidden) return forbidden;

      // Check code uniqueness
      const existing = await (prisma as any).discountRule.findUnique({ where: { code: data.code } });
      if (existing) {
        return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Discount code already exists');
      }

      const rule = await (prisma as any).discountRule.create({
        data: {
          code: data.code,
          name: data.name,
          description: data.description,
          type: data.type,
          value: data.value,
          maxUsagePerCustomer: data.maxUsagePerCustomer,
          maxTotalUsage: data.maxTotalUsage,
          currentUsage: 0,
          minOrderAmount: data.minOrderAmount,
          applicableDepts: JSON.stringify(data.applicableDepts || []),
          startDate: data.startDate,
          endDate: data.endDate,
          isActive: true,
        },
      });

      return rule;
    } catch (error) {
      console.error('Error creating discount rule:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to create discount rule');
    }
  }

  /**
   * Validate discount code
   * Checks: existence, activation, time window, usage limits, order amount
   */
  async validateDiscountCode(code: string, orderTotal: number, customerId: string) {
    try {
      const rule = await (prisma as any).discountRule.findUnique({ where: { code } });

      if (!rule) {
        return { valid: false, error: 'Discount code not found' };
      }

      if (!rule.isActive) {
        return { valid: false, error: 'Discount code is inactive' };
      }

      // Check time window
      const now = new Date();
      if (rule.startDate && now < rule.startDate) {
        return { valid: false, error: 'Discount code not yet active' };
      }
      if (rule.endDate && now > rule.endDate) {
        return { valid: false, error: 'Discount code has expired' };
      }

      // Check total usage limit
      if (rule.maxTotalUsage && rule.currentUsage >= rule.maxTotalUsage) {
        return { valid: false, error: 'Discount code usage limit exceeded' };
      }

      // Check per-customer usage limit
      if (rule.maxUsagePerCustomer) {
        const customerUsage = await (prisma as any).orderDiscount.count({
          where: {
            discountRuleId: rule.id,
            orderHeader: { customerId },
          },
        });
        if (customerUsage >= rule.maxUsagePerCustomer) {
          return { valid: false, error: 'You have reached the usage limit for this discount code' };
        }
      }

      // Check minimum order amount
      if (rule.minOrderAmount && orderTotal < rule.minOrderAmount) {
        return { valid: false, error: `Minimum order amount of ${rule.minOrderAmount} required` };
      }

      return { valid: true, rule };
    } catch (error) {
      console.error('Error validating discount code:', error);
      return { valid: false, error: 'Validation failed' };
    }
  }

  /**
   * Apply employee discount
   * Fixed percentage discount for employees
   */
  async getEmployeeDiscount(employeeId: string): Promise<{ discountPercentage: number } | ReturnType<typeof errorResponse>> {
    try {
      const employee = await prisma.pluginUsersPermissionsUser.findUnique({
        where: { id: employeeId },
      });

      if (!employee) {
        return errorResponse(ErrorCodes.NOT_FOUND, 'Employee not found');
      }

      // Default employee discount: 15%
      // Could be enhanced with employee tier/role system
      return { discountPercentage: 15 };
    } catch (error) {
      console.error('Error getting employee discount:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to get employee discount');
    }
  }

  /**
   * Calculate discount amount based on rule
   */
  async calculateDiscountAmount(rule: IDiscountRule, orderTotal: number): Promise<number> {
    try {
      if (rule.type === 'percentage') {
        return Math.round(orderTotal * (Number(rule.value) / 100));
      } else if (rule.type === 'fixed') {
        return Math.min(Number(rule.value), orderTotal); // Don't exceed order total
      } else if (rule.type === 'tiered') {
        // Tiered discount: higher order amount = higher discount percentage
        // value is the base percentage
        return Math.round(orderTotal * (Number(rule.value) / 100));
      }
      return 0;
    } catch (error) {
      console.error('Error calculating discount:', error);
      return 0;
    }
  }

  /**
   * Get active discount rules
   */
  async getActiveRules(ctx?: UserContext) {
    try {
      const forbidden = requireRole(ctx, ['admin', 'manager']);
      if (forbidden) return forbidden;

      const now = new Date();

      const rules = await (prisma as any).discountRule.findMany({
        where: {
          isActive: true,
          startDate: { lte: now },
          OR: [{ endDate: { gte: now } }, { endDate: null }],
        },
        orderBy: { createdAt: 'desc' },
      });

      return rules;
    } catch (error) {
      console.error('Error fetching active rules:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch discount rules');
    }
  }

  /**
   * List all discount rules
   */
  async listRules(filters?: {
    isActive?: boolean;
    type?: string;
    page?: number;
    limit?: number;
  }, ctx?: UserContext) {
    try {
      const forbidden = requireRole(ctx, ['admin']);
      if (forbidden) return forbidden;

      const page = filters?.page || 1;
      const limit = filters?.limit || 20;
      const skip = (page - 1) * limit;

      const where: any = {};
      if (filters?.isActive !== undefined) where.isActive = filters.isActive;
      if (filters?.type) where.type = filters.type;

      const [rules, total] = await Promise.all([
        (prisma as any).discountRule.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        (prisma as any).discountRule.count({ where }),
      ]);

      return {
        items: rules,
        meta: { page, limit, total, pages: Math.ceil(total / limit) },
      };
    } catch (error) {
      console.error('Error listing rules:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to list discount rules');
    }
  }

  /**
   * Update discount rule
   */
  async updateRule(id: string, data: Partial<IDiscountRule>, ctx?: UserContext) {
    try {
      const forbidden = requireRole(ctx, ['admin']);
      if (forbidden) return forbidden;

      const rule = await (prisma as any).discountRule.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description,
          type: data.type as any,
          value: data.value as any,
          maxUsagePerCustomer: data.maxUsagePerCustomer,
          maxTotalUsage: data.maxTotalUsage,
          minOrderAmount: data.minOrderAmount,
          startDate: data.startDate,
          endDate: data.endDate,
          isActive: data.isActive,
        },
      });

      return rule;
    } catch (error) {
      console.error('Error updating rule:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to update discount rule');
    }
  }

  /**
   * Deactivate discount rule
   */
  async deactivateRule(id: string, ctx?: UserContext) {
    try {
      const forbidden = requireRole(ctx, ['admin']);
      if (forbidden) return forbidden;

      const rule = await (prisma as any).discountRule.update({
        where: { id },
        data: { isActive: false },
      });

      return rule;
    } catch (error) {
      console.error('Error deactivating rule:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to deactivate discount rule');
    }
  }

  /**
   * Get discount statistics
   */
  async getDiscountStats(ctx?: UserContext) {
    try {
      const forbidden = requireRole(ctx, ['admin', 'manager']);
      if (forbidden) return forbidden;

      const [totalRules, activeRules, totalDiscountsApplied, totalDiscountAmount] = await Promise.all([
        (prisma as any).discountRule.count(),
        (prisma as any).discountRule.count({ where: { isActive: true } }),
        (prisma as any).orderDiscount.count(),
        (prisma as any).orderDiscount.aggregate({
          _sum: { discountAmount: true },
        }),
      ]);

      return {
        totalRules,
        activeRules,
        totalDiscountsApplied,
        totalDiscountAmount: totalDiscountAmount._sum.discountAmount || 0,
      };
    } catch (error) {
      console.error('Error fetching discount stats:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch discount statistics');
    }
  }
}

export const discountService = new DiscountService();

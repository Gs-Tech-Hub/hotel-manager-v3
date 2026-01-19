/**
 * Employee Service
 * Handles employee records, orders, and summaries
 */

import { BaseService } from './base.service';
import { IEmployeeOrder, IEmployeeRecord, IEmployeeSummary } from '@/types/entities';
import { prisma } from '@/lib/auth/prisma';

export class EmployeeOrderService extends BaseService<IEmployeeOrder> {
  constructor() {
    super('employeeOrder');
  }

  private mapOrder(o: any): IEmployeeOrder {
    return {
      id: o.id,
      dateIssued: o.dateIssued,
      total: o.total,
      discountAmount: o.discountAmount,
      amountPaid: o.amountPaid,
      userId: o.userId,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    };
  }

  /**
   * Get orders by employee
   */
  async getEmployeeOrders(userId: string): Promise<IEmployeeOrder[]> {
    try {
      const rows = await prisma.employeeOrder.findMany({
        where: { userId },
        include: { user: true },
        orderBy: { createdAt: 'desc' },
      });

      return rows.map((r: any) => this.mapOrder(r));
    } catch (error) {
      console.error('Error fetching employee orders:', error);
      return [];
    }
  }

  /**
   * Get orders by date range
   */
  async getOrdersByDateRange(startDate: Date, endDate: Date): Promise<IEmployeeOrder[]> {
    try {
      const rows = await prisma.employeeOrder.findMany({
        where: {
          dateIssued: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: { user: true },
      });

      return rows.map((r: any) => this.mapOrder(r));
    } catch (error) {
      console.error('Error fetching orders by date range:', error);
      return [];
    }
  }

  /**
   * Get employee order statistics
   */
  async getOrderStats(): Promise<{
    totalOrders: number;
    totalAmount: number;
    averageDiscount: number;
  } | null> {
    try {
      const stats = await prisma.employeeOrder.aggregate({
        _sum: { total: true, discountAmount: true },
        _count: true,
        _avg: { discountAmount: true },
      });

      return {
        totalOrders: stats._count || 0,
        totalAmount: stats._sum.total || 0,
        averageDiscount: stats._avg.discountAmount || 0,
      };
    } catch (error) {
      console.error('Error fetching order stats:', error);
      return null;
    }
  }
}

export class EmployeeRecordService extends BaseService<IEmployeeRecord> {
  constructor() {
    super('employeeRecord');
  }

  // Mapper to normalize Prisma nulls -> undefined for domain types
  private mapRecord(record: any): IEmployeeRecord {
    return {
      ...record,
      description: record.description ?? undefined,
    };
  }

  /**
   * Get records by employee
   */
  async getEmployeeRecords(userId: string): Promise<IEmployeeRecord[]> {
    try {
      const records = await prisma.employeeRecord.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
      });

      return records.map((r: any) => this.mapRecord(r));
    } catch (error) {
      console.error('Error fetching employee records:', error);
      return [];
    }
  }

  /**
   * Get records in date range
   */
  async getRecordsByDateRange(startDate: Date, endDate: Date): Promise<IEmployeeRecord[]> {
    try {
      const records = await prisma.employeeRecord.findMany({
        where: {
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: { user: true },
      });

      return records.map((r: any) => this.mapRecord(r));
    } catch (error) {
      console.error('Error fetching records by date range:', error);
      return [];
    }
  }

  /**
   * Get total debts and fines for an employee
   */
  async getEmployeeDebtsSummary(userId: string): Promise<{
    totalDebts: number;
    totalFines: number;
    totalShortage: number;
    totalAdvance: number;
  } | null> {
    try {
      const records = await prisma.employeeRecord.aggregate({
        _sum: { debts: true, fines: true, shortage: true, salaryAdvance: true },
        where: { userId },
      });

      return {
        totalDebts: records._sum.debts || 0,
        totalFines: records._sum.fines || 0,
        totalShortage: records._sum.shortage || 0,
        totalAdvance: records._sum.salaryAdvance || 0,
      };
    } catch (error) {
      console.error('Error fetching employee debts summary:', error);
      return null;
    }
  }
}

export class EmployeeSummaryService extends BaseService<IEmployeeSummary> {
  constructor() {
    super('employeeSummary');
  }

  private mapSummary(s: any): IEmployeeSummary {
    return {
      ...s,
      position: s.position ?? undefined,
      employmentDate: s.employmentDate ?? undefined,
    };
  }

  /**
   * Get employee summary
   */
  async getEmployeeSummary(userId: string): Promise<IEmployeeSummary | null> {
    try {
      const s = await prisma.employeeSummary.findUnique({
        where: { userId },
        include: { user: true },
      });

      return s ? this.mapSummary(s) : null;
    } catch (error) {
      console.error('Error fetching employee summary:', error);
      return null;
    }
  }

  /**
   * Get employees by position
   */
  async getEmployeesByPosition(position: string): Promise<IEmployeeSummary[]> {
    try {
      const rows = await prisma.employeeSummary.findMany({
        where: { position },
        include: { user: true },
      });

      return rows.map((r: any) => this.mapSummary(r));
    } catch (error) {
      console.error('Error fetching employees by position:', error);
      return [];
    }
  }

  /**
   * Update salary advanced status
   */
  async updateSalaryAdvancedStatus(
    summaryId: string,
    status: 'pending' | 'approved' | 'rejected' | 'settled'
  ): Promise<IEmployeeSummary | null> {
    try {
      const updated = await prisma.employeeSummary.update({
        where: { id: summaryId },
        data: { salaryAdvancedStatus: status },
      });

      return this.mapSummary(updated);
    } catch (error) {
      console.error('Error updating salary advanced status:', error);
      return null;
    }
  }

  /**
   * Get pending salary advances
   */
  async getPendingSalaryAdvances(): Promise<IEmployeeSummary[]> {
    try {
      const rows = await prisma.employeeSummary.findMany({
        where: { salaryAdvancedStatus: 'pending' },
        include: { user: true },
      });

      return rows.map((r: any) => this.mapSummary(r));
    } catch (error) {
      console.error('Error fetching pending salary advances:', error);
      return [];
    }
  }

  /**
   * Get employee summary statistics
   */
  async getEmployeeStats(): Promise<{
    totalEmployees: number;
    averageSalary: number;
    totalDebt: number;
    totalFines: number;
  } | null> {
    try {
      const stats = await prisma.employeeSummary.aggregate({
        _count: true,
        _avg: { salary: true },
        _sum: { debtShortage: true, finesDebits: true },
      });

      return {
        totalEmployees: stats._count || 0,
        averageSalary: stats._avg.salary || 0,
        totalDebt: Number(stats._sum.debtShortage) || 0,
        totalFines: Number(stats._sum.finesDebits) || 0,
      };
    } catch (error) {
      console.error('Error fetching employee stats:', error);
      return null;
    }
  }
}

export const employeeOrderService = new EmployeeOrderService();
export const employeeRecordService = new EmployeeRecordService();
export const employeeSummaryService = new EmployeeSummaryService();

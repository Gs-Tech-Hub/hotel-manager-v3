/**
 * Tax Report API
 * Provides comprehensive tax collection analytics
 * 
 * GET /api/analytics/tax?startDate=2024-01-01&endDate=2024-12-31
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { checkPermission, type PermissionContext } from '@/lib/auth/rbac';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';
import { buildDateFilter } from '@/lib/date-filter';

export async function GET(request: NextRequest) {
  try {
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'Not authenticated'),
        { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    const userWithRoles = await loadUserWithRoles(ctx.userId);
    if (!userWithRoles) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    const permCtx: PermissionContext = {
      userId: ctx.userId,
      userType: (userWithRoles.isAdmin ? 'admin' : hasAnyRole(userWithRoles, ['admin', 'manager', 'staff']) ? 'employee' : 'other') as 'admin' | 'employee' | 'other',
    };

    const canViewReports = await checkPermission(permCtx, 'reports.read', 'reports');
    if (!canViewReports) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const dateFilter = buildDateFilter(startDate, endDate);

    // Fetch tax-related data
    const payments = await prisma.payment.findMany({
      where: {
        createdAt: dateFilter,
      },
    });

    const taxSettings = await prisma.taxSettings.findFirst();

    // Calculate tax breakdown
    const taxByType = new Map<string, { amount: number; taxable: number; rate: number }>();
    const taxByPaymentMethod = new Map<string, { count: number; amount: number; taxAmount: number }>();
    const dailyTax = new Map<string, { collected: number; baseAmount: number }>();

    payments.forEach((payment: any) => {
      const date = new Date(payment.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
      const paymentMethod = payment.paymentMethod || 'Unknown';
      const taxAmount = 0;

      // By payment method
      if (!taxByPaymentMethod.has(paymentMethod)) {
        taxByPaymentMethod.set(paymentMethod, { count: 0, amount: 0, taxAmount: 0 });
      }
      const methodData = taxByPaymentMethod.get(paymentMethod)!;
      methodData.count += 1;
      methodData.amount += payment.totalPrice || 0;
      methodData.taxAmount += taxAmount;

      // Daily tax
      if (!dailyTax.has(date)) {
        dailyTax.set(date, { collected: 0, baseAmount: 0 });
      }
      const dayData = dailyTax.get(date)!;
      dayData.collected += taxAmount;
      dayData.baseAmount += payment.totalPrice || 0;
    });

    // Aggregate summary
    const totalTaxCollected = payments.reduce((sum: number, p: any) => sum + 0, 0);
    const totalTaxableAmount = Math.round((payments.reduce((sum: number, p: any) => sum + (p.totalPrice || 0), 0)) * 100);
    const effectiveTaxRate = totalTaxableAmount > 0 ? (totalTaxCollected / totalTaxableAmount) * 100 : 0;

    const report = {
      summary: {
        totalTaxCollected,
        totalTaxableAmount,
        effectiveTaxRate: totalTaxableAmount > 0 ? parseFloat(((totalTaxCollected / totalTaxableAmount) * 100).toFixed(2)) : 0,
        paymentCount: payments.length,
        averageTaxPerPayment: payments.length > 0 ? Math.round(totalTaxCollected / payments.length) : 0,
      },
      byPaymentMethod: Array.from(taxByPaymentMethod.entries()).map(([method, data]) => ({
        method,
        count: data.count,
        amount: Math.round(data.amount * 100),
        taxAmount: data.taxAmount,
        effectiveRate: data.amount > 0 ? parseFloat(((data.taxAmount / (data.amount * 100)) * 100).toFixed(2)) : 0,
      })),
      dailyTax: Array.from(dailyTax.entries()).map(([date, data]) => ({
        date,
        collected: data.collected,
        baseAmount: Math.round(data.baseAmount * 100),
        rate: data.baseAmount > 0 ? parseFloat(((data.collected / (data.baseAmount * 100)) * 100).toFixed(2)) : 0,
      })),
      taxSettings: taxSettings ? {
        taxRate: taxSettings.taxRate,
        isEnabled: taxSettings.enabled,
      } : null,
      paymentDetails: payments
        .map((p: any) => ({
          id: p.id,
          amount: Math.round((p.totalPrice || 0) * 100),
          taxAmount: 0,
          method: p.paymentMethod,
          createdAt: p.createdAt,
        }))
        .slice(0, 100), // Limit to last 100 for performance
    };

    return NextResponse.json(
      successResponse({ data: report }),
      { status: 200 }
    );

  } catch (error) {
    console.error('Tax report error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to generate tax report'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

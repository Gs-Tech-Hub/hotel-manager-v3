/**
 * Service Statistics API
 * GET /api/departments/[code]/services/stats
 * 
 * Returns sales statistics for services in a department
 * Queries OrderLine records where productType='service'
 * Calculates total sold, revenue, fulfillment stats by date range
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';
import { extractUserContext } from '@/lib/user-context';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const ctx = await extractUserContext(request);
    
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED),
        { status: 401 }
      );
    }

    const { code } = await params;
    const fromDate = request.nextUrl.searchParams.get('fromDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const toDate = request.nextUrl.searchParams.get('toDate') || new Date().toISOString();

    // Support section-style codes: "parent:section"
    const decodedCode = decodeURIComponent(code);
    const isSectionCode = decodedCode.includes(':');
    const [parentCode, sectionIdPart] = isSectionCode ? decodedCode.split(':') : [decodedCode, undefined];

    // Verify department exists
    const department = await prisma.department.findFirst({ where: { code: parentCode } });
    if (!department) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Department not found'),
        { status: 404 }
      );
    }

    // Convert date strings to Date objects
    const startDate = new Date(fromDate);
    const endDate = new Date(toDate);
    endDate.setHours(23, 59, 59, 999);

    const dateFilter = {
      gte: startDate,
      lte: endDate,
    };

    // Query all service lines in this department/section created within date range
    const serviceLines = await prisma.orderLine.findMany({
      where: {
        productType: 'service',
        createdAt: dateFilter,
        departmentCode: parentCode,
        ...(isSectionCode && sectionIdPart ? { departmentSectionId: sectionIdPart } : {}),
      },
      include: {
        orderHeader: {
          include: {
            payments: true,
            fulfillments: {
              where: { orderLineId: { not: undefined } },
            },
          },
        },
      },
    });

    // Group by service and calculate stats
    const serviceStats = new Map<
      string,
      {
        serviceId: string;
        serviceName: string;
        totalOrdered: number;
        totalFulfilled: number;
        totalRevenue: number;
        paidRevenue: number;
      }
    >();

    for (const line of serviceLines) {
      const key = line.productId;
      const existing = serviceStats.get(key) || {
        serviceId: line.productId,
        serviceName: line.productName,
        totalOrdered: 0,
        totalFulfilled: 0,
        totalRevenue: 0,
        paidRevenue: 0,
      };

      existing.totalOrdered += line.quantity;

      // Count fulfilled quantity from fulfillments for this line
      const fulfilledQty = line.orderHeader.fulfillments
        ?.filter((f: any) => f.orderLineId === line.id && f.status === 'fulfilled')
        ?.reduce((sum: number, f: any) => sum + (f.fulfilledQuantity || 0), 0) || 0;
      existing.totalFulfilled += fulfilledQty;

      // Add line total to revenue
      existing.totalRevenue += line.lineTotal || 0;

      // Check if order is paid
      const orderTotal = line.orderHeader.total || 0;
      let totalPaid = 0;
      if (line.orderHeader.payments && line.orderHeader.payments.length > 0) {
        totalPaid = line.orderHeader.payments.reduce((sum: number, p: any) => sum + Number(p.total ?? 0), 0);
      }
      const isPaid = totalPaid >= orderTotal && orderTotal > 0;

      if (isPaid) {
        existing.paidRevenue += line.lineTotal || 0;
      }

      serviceStats.set(key, existing);
    }

    // Convert to array and sort by revenue (descending)
    const stats = Array.from(serviceStats.values()).sort(
      (a, b) => b.totalRevenue - a.totalRevenue
    );

    // Calculate aggregate stats
    const aggregateStats = {
      totalServices: stats.length,
      totalServicesSold: stats.reduce((sum, s) => sum + s.totalOrdered, 0),
      totalServicesFulfilled: stats.reduce((sum, s) => sum + s.totalFulfilled, 0),
      totalRevenue: stats.reduce((sum, s) => sum + s.totalRevenue, 0),
      paidRevenue: stats.reduce((sum, s) => sum + s.paidRevenue, 0),
      fulfillmentRate:
        stats.reduce((sum, s) => sum + s.totalOrdered, 0) > 0
          ? Math.round(
              (stats.reduce((sum, s) => sum + s.totalFulfilled, 0) /
                stats.reduce((sum, s) => sum + s.totalOrdered, 0)) *
                100
            )
          : 0,
    };

    return NextResponse.json(
      successResponse({
        data: {
          stats: aggregateStats,
          services: stats,
          dateRange: { from: startDate, to: endDate },
        },
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching service stats:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch service statistics'),
      { status: 500 }
    );
  }
}

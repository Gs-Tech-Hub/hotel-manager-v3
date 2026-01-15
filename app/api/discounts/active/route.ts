import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'Not authenticated'),
        { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    const now = new Date();
    const rules = await (prisma as any).discountRule.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      orderBy: { startDate: 'desc' },
    });

    const rulesWithDepts = rules.map((rule: any) => ({
      ...rule,
      applicableDepts: JSON.parse(rule.applicableDepts || '[]'),
    }));

    return NextResponse.json(successResponse(rulesWithDepts));
  } catch (error) {
    console.error('GET /api/discounts/active error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch active discounts'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}


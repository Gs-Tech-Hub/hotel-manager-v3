/**
 * Tax Settings API
 * GET /api/settings/tax - Retrieve current tax settings
 * PUT /api/settings/tax - Update tax settings (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    let taxSettings = null;
    try {
      taxSettings = await (prisma as any).taxSettings.findFirst();
    } catch (err) {
      // Table might not exist yet - log and return defaults
      console.warn('TaxSettings table not found, returning defaults:', err);
    }
    
    // Return default settings if none exist or table doesn't exist
    const settings = taxSettings || {
      id: 'default',
      enabled: true,
      taxRate: 10,
      appliedToSubtotal: true,
    };

    return NextResponse.json(
      successResponse({ data: { settings } }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching tax settings:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch tax settings'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Extract user context
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'Not authenticated'),
        { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    // Check admin role
    const userWithRoles = await loadUserWithRoles(ctx.userId);
    if (!userWithRoles || !hasAnyRole(userWithRoles, ['admin'])) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Only admins can update tax settings'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Parse request body
    const body = await request.json();
    const { enabled, taxRate } = body;

    // Validate input
    if (typeof enabled !== 'boolean' && enabled !== undefined) {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, 'enabled must be a boolean'),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    if (taxRate !== undefined && (typeof taxRate !== 'number' || taxRate < 0 || taxRate > 100)) {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, 'taxRate must be a number between 0 and 100'),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Find or create tax settings
    let taxSettings = null;
    try {
      taxSettings = await (prisma as any).taxSettings.findFirst();
    } catch (err) {
      // Table might not exist yet - log and continue
      console.warn('TaxSettings table query failed (may not exist):', err);
    }

    if (!taxSettings) {
      try {
        // Create default settings if none exist
        taxSettings = await (prisma as any).taxSettings.create({
          data: {
            enabled: enabled !== undefined ? enabled : true,
            taxRate: taxRate !== undefined ? taxRate : 10,
            appliedToSubtotal: true,
            updatedBy: ctx.userId,
          },
        });
      } catch (err) {
        // Table creation failed - might not exist in DB
        console.error('Failed to create tax settings (table may not exist):', err);
        return NextResponse.json(
          errorResponse(
            ErrorCodes.INTERNAL_ERROR, 
            'Tax settings table not found. Please run database migrations: npx prisma migrate dev'
          ),
          { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
        );
      }
    } else {
      try {
        // Update existing settings
        taxSettings = await (prisma as any).taxSettings.update({
          where: { id: taxSettings.id },
          data: {
            ...(enabled !== undefined && { enabled }),
            ...(taxRate !== undefined && { taxRate }),
            updatedBy: ctx.userId,
          },
        });
      } catch (err) {
        console.error('Failed to update tax settings:', err);
        return NextResponse.json(
          errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to update tax settings'),
          { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
        );
      }
    }

    return NextResponse.json(
      successResponse({ data: { settings: taxSettings }, message: 'Tax settings updated successfully' }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating tax settings:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to update tax settings'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

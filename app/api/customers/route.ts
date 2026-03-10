/**
 * GET /api/customers
 * Get all customers with pagination (excludes auto-created guest customers)
 * 
 * Query Parameters:
 * - page: number (default: 1)
 * - limit: number (default: 10)
 * - search: string
 * - includeGuests: boolean (default: false) - include auto-created guest customers
 */

import { NextRequest } from 'next/server';
import { customerService } from '@/services/customer.service';
import { sendSuccess, sendError, getQueryParams } from '@/lib/api-handler';
import { ErrorCodes } from '@/lib/api-response';
import { validateGuestCreation } from '@/src/lib/booking-validation';
import { prisma } from '@/lib/auth/prisma';

export async function GET(req: NextRequest) {
  try {
    const { page, limit, search } = getQueryParams(req);
    const includeGuests = req.nextUrl.searchParams.get('includeGuests') === 'true';

    let response;

    if (search) {
      const customers = await prisma.customer.findMany({
        where: {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      response = {
        items: customers,
        meta: {
          total: customers.length,
          pages: 1,
        },
      };
    } else {
      const pageNum = Math.max(1, page || 1);
      const pageSize = Math.min(100, Math.max(1, limit || 10));
      const skip = (pageNum - 1) * pageSize;

      const [customers, total] = await Promise.all([
        prisma.customer.findMany({
          orderBy: { createdAt: 'desc' },
          skip,
          take: pageSize,
        }),
        prisma.customer.count(),
      ]);

      response = {
        items: customers,
        meta: {
          page: pageNum,
          limit: pageSize,
          total,
          pages: Math.ceil(total / pageSize),
        },
      };
    }

    if ('error' in response) {
      const err = response as any;
      return sendError(
        err.error?.code || ErrorCodes.INTERNAL_ERROR,
        err.error?.message || 'Failed to fetch customers'
      );
    }

    // Filter out auto-created guest customers (those with guest+{timestamp}@local emails)
    // unless includeGuests is explicitly true. Real customers can have any names.
    if (!includeGuests && 'items' in response && Array.isArray(response.items)) {
      (response as any).items = (response as any).items.filter(
        (c: any) => !c.email?.match(/^guest\+\d+@local$/i)
      );
    }

    return sendSuccess(response, 'Customers fetched successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch customers';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}

/**
 * POST /api/customers
 * Create a new customer with validation
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate using Zod schema
    const validation = validateGuestCreation(body);
    if (!validation.valid) {
      return sendError(
        ErrorCodes.VALIDATION_ERROR,
        JSON.stringify(validation.errors)
      );
    }

    const validatedData = validation.data!;

    // Check if customer already exists by email
    const existingCustomer = await customerService.getByEmail(validatedData.email);
    if (existingCustomer) {
      return sendError(
        ErrorCodes.RESOURCE_ALREADY_EXISTS,
        'Customer with this email already exists'
      );
    }

    const customer = await customerService.create(validatedData);

    if (!customer) {
      return sendError(
        ErrorCodes.INTERNAL_ERROR,
        'Failed to create customer'
      );
    }

    return sendSuccess(customer, 'Customer created successfully', 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create customer';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}


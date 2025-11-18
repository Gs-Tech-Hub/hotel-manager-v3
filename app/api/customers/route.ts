/**
 * GET /api/customers
 * Get all customers with pagination
 * 
 * Query Parameters:
 * - page: number (default: 1)
 * - limit: number (default: 10)
 * - search: string
 */

import { NextRequest } from 'next/server';
import { customerService } from '@/services/customer.service';
import { sendSuccess, sendError, getQueryParams } from '@/lib/api-handler';
import { ErrorCodes } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const { page, limit, search } = getQueryParams(req);

    let response;

    if (search) {
      const customers = await customerService.searchCustomers(search);
      response = {
        items: customers,
        meta: {
          total: customers.length,
          pages: 1,
        },
      };
    } else {
      response = await customerService.findAll({
        page,
        limit,
      });
    }

    if ('error' in response) {
      return sendError(
        response.error.code,
        response.error.message
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
 * Create a new customer
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate required fields
    if (!body.firstName || !body.lastName || !body.email) {
      return sendError(
        ErrorCodes.VALIDATION_ERROR,
        'Missing required fields: firstName, lastName, email'
      );
    }

    // Check if customer already exists
    const existingCustomer = await customerService.getByEmail(body.email);
    if (existingCustomer) {
      return sendError(
        ErrorCodes.RESOURCE_ALREADY_EXISTS,
        'Customer with this email already exists'
      );
    }

    const customer = await customerService.create(body);

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

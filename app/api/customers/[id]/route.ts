/**
 * GET /api/customers/[id]
 * Get customer profile
 * 
 * PUT /api/customers/[id]
 * Update customer
 * 
 * DELETE /api/customers/[id]
 * Delete customer
 */

import { NextRequest } from 'next/server';
import { customerService } from '@/services/customer.service';
import { sendSuccess, sendError } from '@/lib/api-handler';
import { ErrorCodes } from '@/lib/api-response';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const customer = await customerService.getCustomerProfile(id);

    if (!customer) {
      return sendError(
        ErrorCodes.NOT_FOUND,
        'Customer not found'
      );
    }

    return sendSuccess(customer, 'Customer profile retrieved');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch customer';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const customer = await customerService.update(id, body);

    if (!customer) {
      return sendError(
        ErrorCodes.NOT_FOUND,
        'Customer not found'
      );
    }

    return sendSuccess(customer, 'Customer updated successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update customer';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const success = await customerService.delete(id);

    if (!success) {
      return sendError(
        ErrorCodes.NOT_FOUND,
        'Customer not found'
      );
    }

    return sendSuccess(null, 'Customer deleted successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete customer';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}

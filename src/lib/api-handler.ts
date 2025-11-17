/**
 * API Request Handler Wrapper
 * Provides consistent error handling and response formatting for all API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse, ErrorCodes, getStatusCode, StatusCodes } from '@/lib/api-response';
import uuidv4 from '@/lib/uuid';

export interface ApiHandlerOptions {
  requireAuth?: boolean;
  methods?: string[];
}

/**
 * Wrapper for API route handlers
 * Provides consistent error handling and response formatting
 */
export function apiHandler(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options: ApiHandlerOptions = {}
) {
  return async (req: NextRequest) => {
    try {
  const requestId = uuidv4();
      const method = req.method;

      // Check method if specified
      if (options.methods && !options.methods.includes(method)) {
        return NextResponse.json(
          errorResponse(
            ErrorCodes.INVALID_INPUT,
            `Method ${method} not allowed`
          ),
          { status: StatusCodes.BAD_REQUEST }
        );
      }

      // Add request ID to headers for tracking
      const headers = new Headers(req.headers);
      headers.set('x-request-id', requestId);

      // Call the actual handler
      return await handler(req);
    } catch (error) {
      console.error('API Error:', error);

      const errorMessage =
        error instanceof Error ? error.message : 'An unexpected error occurred';

      return NextResponse.json(
        errorResponse(
          ErrorCodes.INTERNAL_ERROR,
          errorMessage
        ),
        { status: StatusCodes.INTERNAL_ERROR }
      );
    }
  };
}

/**
 * Send success response
 */
export function sendSuccess<T>(
  data: T,
  message?: string,
  status: number = StatusCodes.OK
) {
  return NextResponse.json(successResponse(data, message), { status });
}

/**
 * Send error response
 */
export function sendError(
  code: string,
  message: string,
  details?: Record<string, any>,
  status?: number
) {
  const statusCode = status || getStatusCode(code);
  return NextResponse.json(
    errorResponse(code, message, details),
    { status: statusCode }
  );
}

/**
 * Validate request body
 */
export async function validateBody<T>(
  req: NextRequest,
  schema?: (data: any) => Promise<T> | T
): Promise<{ data: T; error: null } | { data: null; error: NextResponse }> {
  try {
    const body = await req.json();

    if (schema) {
      const validatedData = await schema(body);
      return { data: validatedData, error: null };
    }

    return { data: body as T, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request body';
    return {
      data: null,
      error: sendError(ErrorCodes.INVALID_INPUT, message),
    };
  }
}

/**
 * Extract query parameters
 */
export function getQueryParams(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  return {
    page: parseInt(searchParams.get('page') || '1'),
    limit: parseInt(searchParams.get('limit') || '10'),
    search: searchParams.get('search'),
    sort: searchParams.get('sort'),
    status: searchParams.get('status'),
  };
}

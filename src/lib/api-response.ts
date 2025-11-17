/**
 * API Response & Error Utilities
 * Consistent response formatting and error handling
 */

import { ApiResponse, ApiError, ApiResult } from '../types/api';

/**
 * Create a successful API response
 */
export function successResponse<T>(
  data: T,
  message?: string
): ApiResponse<T> {
  return {
    success: true,
    data,
    ...(message && { message }),
  };
}

/**
 * Create an error API response
 */
export function errorResponse(
  code: string,
  message: string,
  details?: Record<string, any>
): ApiError {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
    },
  };
}

/**
 * Common error codes
 */
export const ErrorCodes = {
  NOT_FOUND: 'NOT_FOUND',
  INVALID_INPUT: 'INVALID_INPUT',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
} as const;

/**
 * HTTP Status Code Mapping
 */
export const StatusCodes = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
} as const;

/**
 * Get HTTP status code from error code
 */
export function getStatusCode(errorCode: string): number {
  switch (errorCode) {
    case ErrorCodes.NOT_FOUND:
      return StatusCodes.NOT_FOUND;
    case ErrorCodes.INVALID_INPUT:
    case ErrorCodes.VALIDATION_ERROR:
      return StatusCodes.BAD_REQUEST;
    case ErrorCodes.UNAUTHORIZED:
      return StatusCodes.UNAUTHORIZED;
    case ErrorCodes.FORBIDDEN:
      return StatusCodes.FORBIDDEN;
    case ErrorCodes.CONFLICT:
    case ErrorCodes.RESOURCE_ALREADY_EXISTS:
      return StatusCodes.CONFLICT;
    case ErrorCodes.INTERNAL_ERROR:
    default:
      return StatusCodes.INTERNAL_ERROR;
  }
}

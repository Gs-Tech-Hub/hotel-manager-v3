import { NextResponse } from 'next/server';

/**
 * Standard API Response Utilities
 * Provides consistent response formatting across all API endpoints
 */

export enum ErrorCodes {
  SUCCESS = 'SUCCESS',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  BAD_REQUEST = 'BAD_REQUEST',
  CONFLICT = 'CONFLICT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  OPERATION_FAILED = 'OPERATION_FAILED',
  UNPROCESSABLE_ENTITY = 'UNPROCESSABLE_ENTITY',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
}

export enum StatusCodes {
  SUCCESS = 200,
  CREATED = 201,
  ACCEPTED = 202,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  UNPROCESSABLE_ENTITY = 422,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_ERROR = 500,
  SERVICE_UNAVAILABLE = 503,
}

export interface ApiResponse<T = null> {
  success: boolean;
  code: string;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
  timestamp: string;
}

/**
 * Success Response Format
 */
export function successResponse<T = any>(options: {
  data?: T;
  message?: string;
}): ApiResponse<T> {
  return {
    success: true,
    code: ErrorCodes.SUCCESS,
    message: options.message || 'Request successful',
    data: options.data,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Error Response Format
 */
export function errorResponse(
  code: string = ErrorCodes.INTERNAL_ERROR,
  message: string = 'An error occurred',
  errors?: Record<string, string[]>
): ApiResponse {
  return {
    success: false,
    code,
    message,
    errors,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get HTTP Status Code from Error Code
 */
export function getStatusCode(errorCode: string): number {
  const codeToStatus: Record<string, number> = {
    [ErrorCodes.SUCCESS]: StatusCodes.SUCCESS,
    [ErrorCodes.UNAUTHORIZED]: StatusCodes.UNAUTHORIZED,
    [ErrorCodes.FORBIDDEN]: StatusCodes.FORBIDDEN,
    [ErrorCodes.NOT_FOUND]: StatusCodes.NOT_FOUND,
    [ErrorCodes.BAD_REQUEST]: StatusCodes.BAD_REQUEST,
    [ErrorCodes.CONFLICT]: StatusCodes.CONFLICT,
    [ErrorCodes.VALIDATION_ERROR]: StatusCodes.BAD_REQUEST,
    [ErrorCodes.INVALID_INPUT]: StatusCodes.BAD_REQUEST,
    [ErrorCodes.RESOURCE_NOT_FOUND]: StatusCodes.NOT_FOUND,
    [ErrorCodes.DUPLICATE_ENTRY]: StatusCodes.CONFLICT,
    [ErrorCodes.RESOURCE_ALREADY_EXISTS]: StatusCodes.CONFLICT,
    [ErrorCodes.INSUFFICIENT_FUNDS]: StatusCodes.BAD_REQUEST,
    [ErrorCodes.OPERATION_FAILED]: StatusCodes.INTERNAL_ERROR,
    [ErrorCodes.UNPROCESSABLE_ENTITY]: StatusCodes.UNPROCESSABLE_ENTITY,
    [ErrorCodes.TOO_MANY_REQUESTS]: StatusCodes.TOO_MANY_REQUESTS,
    [ErrorCodes.INTERNAL_ERROR]: StatusCodes.INTERNAL_ERROR,
  };

  return codeToStatus[errorCode] || StatusCodes.INTERNAL_ERROR;
}

/**
 * Create JSON Response
 */
export function jsonResponse<T = null>(
  body: ApiResponse<T>,
  statusCode: number = StatusCodes.SUCCESS
): NextResponse {
  return NextResponse.json(body, { status: statusCode });
}

/**
 * Send Success Response
 */
export function sendSuccess<T = null>(
  data?: T,
  message: string = 'Request successful',
  statusCode: number = StatusCodes.SUCCESS
): NextResponse {
  return jsonResponse(successResponse({ data, message }), statusCode);
}

/**
 * Send Error Response
 */
export function sendError(
  code: string = ErrorCodes.INTERNAL_ERROR,
  message: string = 'An error occurred',
  statusCode?: number,
  errors?: Record<string, string[]>
): NextResponse {
  const responseStatusCode = statusCode || getStatusCode(code);
  return jsonResponse(errorResponse(code, message, errors), responseStatusCode);
}

/**
 * Base API Response Types
 * Consistent response structures for all API endpoints
 */

// Success Response
export interface ApiResponse<T = any> {
  success: true;
  data: T;
  message?: string;
}

// Error Response
export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

export type ApiResult<T = any> = ApiResponse<T> | ApiError;

// Pagination
export interface PaginationParams {
  page?: number;
  limit?: number;
  skip?: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginationMeta;
}

// Filter & Sort
export interface FilterOptions {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value: any;
}

export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

export interface QueryParams extends PaginationParams {
  filters?: FilterOptions[];
  sort?: SortOptions[];
  include?: string[];
}

// API Request/Response metadata
export interface ApiRequestContext {
  userId?: string;
  userRole?: string;
  timestamp: Date;
  requestId: string;
}

export interface ApiMetadata {
  timestamp: Date;
  version: string;
}

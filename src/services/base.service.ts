/**
 * Base Service Class
 * Provides common CRUD operations and error handling for all services
 */

import { prisma } from '../lib/prisma';
import { PaginationParams, PaginatedResponse, QueryParams } from '../types/api';
import { errorResponse, ErrorCodes, StatusCodes } from '../lib/api-response';

export class BaseService<T> {
  protected modelName: string;

  constructor(modelName: string) {
    this.modelName = modelName;
  }

  /**
   * Helper to safely access Prisma model by name
   */
  protected getModel() {
    return (prisma as any)[this.modelName];
  }

  /**
   * Find all records with pagination and filtering
   */
  async findAll(
    params: QueryParams = {}
  ): Promise<PaginatedResponse<T> | ReturnType<typeof errorResponse>> {
    try {
      const { page = 1, limit = 10, skip = 0, filters = [], sort = [] } =
        params;
      const pageNum = Math.max(1, page);
      const pageSize = Math.min(100, Math.max(1, limit));
      const skipNum = skip || (pageNum - 1) * pageSize;

      // Build where clause from filters
      const where: Record<string, any> = {};
      for (const filter of filters) {
        const { field, operator, value } = filter;
        switch (operator) {
          case 'eq':
            where[field] = value;
            break;
          case 'ne':
            where[field] = { not: value };
            break;
          case 'gt':
            where[field] = { gt: value };
            break;
          case 'gte':
            where[field] = { gte: value };
            break;
          case 'lt':
            where[field] = { lt: value };
            break;
          case 'lte':
            where[field] = { lte: value };
            break;
          case 'in':
            where[field] = { in: Array.isArray(value) ? value : [value] };
            break;
          case 'contains':
            where[field] = { contains: value, mode: 'insensitive' };
            break;
        }
      }

      // Build order by from sort
      const orderBy: Record<string, any>[] = [];
      for (const sortOption of sort) {
        orderBy.push({ [sortOption.field]: sortOption.direction });
      }

      // Execute queries
      const [items, total] = await Promise.all([
        this.getModel().findMany({
          where,
          orderBy: orderBy.length > 0 ? orderBy : undefined,
          skip: skipNum,
          take: pageSize,
        }),
        this.getModel().count({ where }),
      ]);

      return {
        items: items as T[],
        meta: {
          page: pageNum,
          limit: pageSize,
          total,
          pages: Math.ceil(total / pageSize),
        },
      };
    } catch (error) {
      console.error(`Error fetching ${this.modelName}:`, error);
      return errorResponse(
        ErrorCodes.INTERNAL_ERROR,
        `Failed to fetch ${this.modelName}`
      );
    }
  }

  /**
   * Find a single record by ID
   */
  async findById(id: string): Promise<T | null> {
    try {
      return await this.getModel().findUnique({
        where: { id },
      });
    } catch (error) {
      console.error(
        `Error finding ${this.modelName} with ID ${id}:`,
        error
      );
      return null;
    }
  }

  /**
   * Find the first record matching a condition
   */
  async findOne(where: Record<string, any>): Promise<T | null> {
    try {
      return await this.getModel().findFirst({ where });
    } catch (error) {
      console.error(`Error finding ${this.modelName}:`, error);
      return null;
    }
  }

  /**
   * Create a new record
   */
  async create(data: Record<string, any>): Promise<T | null> {
    try {
      return await this.getModel().create({ data });
    } catch (error) {
      console.error(`Error creating ${this.modelName}:`, error);
      return null;
    }
  }

  /**
   * Update a record by ID
   */
  async update(
    id: string,
    data: Record<string, any>
  ): Promise<T | null> {
    try {
      return await this.getModel().update({
        where: { id },
        data,
      });
    } catch (error) {
      console.error(
        `Error updating ${this.modelName} with ID ${id}:`,
        error
      );
      return null;
    }
  }

  /**
   * Delete a record by ID
   */
  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.getModel().delete({
        where: { id },
      });
      return !!result;
    } catch (error) {
      console.error(
        `Error deleting ${this.modelName} with ID ${id}:`,
        error
      );
      return false;
    }
  }

  /**
   * Delete multiple records
   */
  async deleteMany(where: Record<string, any>): Promise<number> {
    try {
      const result = await this.getModel().deleteMany({
        where,
      });
      return result.count;
    } catch (error) {
      console.error(`Error deleting ${this.modelName} records:`, error);
      return 0;
    }
  }

  /**
   * Count records
   */
  async count(where?: Record<string, any>): Promise<number> {
    try {
      return await this.getModel().count({
        where: where || undefined,
      });
    } catch (error) {
      console.error(`Error counting ${this.modelName}:`, error);
      return 0;
    }
  }

  /**
   * Check if a record exists
   */
  async exists(where: Record<string, any>): Promise<boolean> {
    try {
      const result = await this.getModel().findFirst({
        where,
        select: { id: true },
      });
      return !!result;
    } catch (error) {
      console.error(`Error checking ${this.modelName} existence:`, error);
      return false;
    }
  }
}

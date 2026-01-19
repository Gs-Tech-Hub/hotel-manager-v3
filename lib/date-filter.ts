/**
 * Date Filtering Utilities
 * Handles timezone-aware date filtering for database queries
 * 
 * Problem: new Date("2025-12-26") parses as UTC midnight, causing timezone mismatches
 * Solution: Parse dates in local timezone to match createdAt timestamps in database
 */

/**
 * Parse a date string (YYYY-MM-DD) to Date at start of day in local timezone
 * @param dateStr - Date string in format YYYY-MM-DD
 * @returns Date object at 00:00:00 in local timezone
 */
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) throw new Error('dateStr is required');
  const [year, month, day] = dateStr.split('-').map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    throw new Error(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD`);
  }
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/**
 * Get end of day for a date string in local timezone
 * @param dateStr - Date string in format YYYY-MM-DD
 * @returns Date object at 23:59:59.999 in local timezone
 */
export function getEndOfLocalDay(dateStr: string): Date {
  if (!dateStr) throw new Error('dateStr is required');
  const [year, month, day] = dateStr.split('-').map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    throw new Error(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD`);
  }
  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

/**
 * Get today's date in YYYY-MM-DD format
 * @returns Today's date as string in format YYYY-MM-DD
 */
export function getTodayDate(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

/**
 * Build a Prisma date filter for createdAt field
 * @param fromDate - Start date (YYYY-MM-DD) or null
 * @param toDate - End date (YYYY-MM-DD) or null
 * @returns Object to spread into Prisma where clause, or empty object
 */
export function buildDateFilter(fromDate?: string | null, toDate?: string | null): Record<string, any> {
  if (!fromDate && !toDate) {
    return {};
  }

  const filter: any = {};

  if (fromDate && toDate) {
    // Both dates provided: include entire range
    filter.createdAt = {
      gte: parseLocalDate(fromDate),
      lte: getEndOfLocalDay(toDate),
    };
  } else if (fromDate) {
    // Only from date: from that date onwards
    filter.createdAt = { gte: parseLocalDate(fromDate) };
  } else if (toDate) {
    // Only to date: up to end of that date
    filter.createdAt = { lte: getEndOfLocalDay(toDate) };
  }

  return filter;
}

/**
 * Build a Prisma date filter with OR condition
 * Useful when filtering across multiple date fields
 * @param fromDate - Start date (YYYY-MM-DD) or null
 * @param toDate - End date (YYYY-MM-DD) or null
 * @returns Object with OR condition for multiple date fields, or empty object
 */
export function buildMultiFieldDateFilter(
  fromDate?: string | null,
  toDate?: string | null,
  dateFields: string[] = ['createdAt']
): Record<string, any> {
  if (!fromDate && !toDate) {
    return {};
  }

  if (dateFields.length === 0) {
    dateFields = ['createdAt'];
  }

  const conditions = dateFields.map((field) => {
    const fieldFilter: any = {};

    if (fromDate && toDate) {
      fieldFilter[field] = {
        gte: parseLocalDate(fromDate),
        lte: getEndOfLocalDay(toDate),
      };
    } else if (fromDate) {
      fieldFilter[field] = { gte: parseLocalDate(fromDate) };
    } else if (toDate) {
      fieldFilter[field] = { lte: getEndOfLocalDay(toDate) };
    }

    return fieldFilter;
  });

  return conditions.length === 1 ? conditions[0] : { OR: conditions };
}

/**
 * Check if a date string represents today
 * @param dateStr - Date string in format YYYY-MM-DD
 * @returns true if dateStr is today's date
 */
export function isToday(dateStr: string): boolean {
  return dateStr === getTodayDate();
}

/**
 * Format a Date object to YYYY-MM-DD string
 * @param date - Date object to format
 * @returns Date string in format YYYY-MM-DD
 */
export function formatDateToString(date: Date): string {
  return date.toISOString().split('T')[0];
}

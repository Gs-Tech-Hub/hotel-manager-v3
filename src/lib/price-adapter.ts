/**
 * PRICE ADAPTER - Universal Handler for Pre/Post Migration
 * 
 * Purpose: Handle both Decimal (pre-migration) and Int (post-migration) prices
 * 
 * Pre-migration state: InventoryItem.unitPrice is Decimal("4.50") → JSON string "4.50"
 * Post-migration state: InventoryItem.unitPrice is Int → 450
 * 
 * This adapter accepts both and returns normalized Int (minor units)
 * 
 * Usage:
 *   const priceCents = adaptPrice(item.unitPrice, 'InventoryItem.unitPrice');
 *   // Always returns Int, never Decimal or string
 */

import { normalizeToCents, prismaDecimalToCents } from './price';
import { getMinorUnit } from './currency';

// ==================== PRICE ADAPTATION ====================

/**
 * Convert any price format to Int (minor units)
 * Handles: Decimal objects, strings, floats, ints
 * 
 * Examples:
 * - adaptPrice(450) → 450 (already int)
 * - adaptPrice(4.5) → 450 (float → cents)
 * - adaptPrice("4.50") → 450 (string → cents)
 * - adaptPrice({toNumber: () => 4.5}) → 450 (Decimal object)
 * - adaptPrice(null) → 0 (null → zero)
 * 
 * @param value - Price value in any format
 * @param context - Field name for error messages
 * @returns {number} Price in minor units (Int)
 * @throws {Error} If value is negative or impossibly large
 */
export function adaptPrice(value: any, context: string = 'price'): number {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return 0;
  }

  // Case 1: Already an Int (post-migration)
  if (typeof value === 'number') {
    // Validate range: 0 to 10 billion (cents) = $0 to $100,000,000
    // Anything outside this range is likely an error
    if (Number.isInteger(value) && value >= 0 && value < 10_000_000_000) {
      return value;
    }

    // If it's a float, it got through somehow - normalize it
    if (Number.isFinite(value)) {
      return normalizeToCents(value);
    }

    // Invalid number
    throw new Error(
      `[${context}] Invalid numeric price: ${value}. Must be finite integer in range [0, 10B].`
    );
  }

  // Case 2: Decimal object from Prisma (pre-migration)
  if (typeof value === 'object' && value !== null) {
    if (typeof value.toNumber === 'function') {
      // Prisma Decimal object
      return prismaDecimalToCents(value);
    }

    if (typeof value.toString === 'function') {
      // Try converting object's string representation
      return normalizeToCents(value.toString());
    }
  }

  // Case 3: String (pre-migration API response or manual entry)
  if (typeof value === 'string') {
    return normalizeToCents(value);
  }

  // Unsupported type
  throw new Error(
    `[${context}] Unsupported price type: ${typeof value}. Value: ${JSON.stringify(value)}`
  );
}

/**
 * Validate that price is Int and return it
 * Used for API response validation to ensure type safety
 * 
 * Throws if:
 * - Value is not an integer (e.g., 450.5)
 * - Value is negative (prices can't be negative)
 * - Value is unreasonably large (> 10B cents = $100M)
 * 
 * @param value - Price to validate
 * @param fieldName - Field name for error messages
 * @returns {number} Validated price in minor units
 * @throws {Error} If validation fails
 */
export function validateAndReturnMinorUnits(
  value: any,
  fieldName: string = 'price'
): number {
  const adapted = adaptPrice(value, fieldName);

  // Check it's an integer
  if (!Number.isInteger(adapted)) {
    throw new Error(
      `[${fieldName}] Price must be an integer (minor units). Got: ${adapted} (${typeof adapted}). ` +
      `This indicates a calculation error or missing normalization.`
    );
  }

  // Check it's non-negative
  if (adapted < 0) {
    throw new Error(
      `[${fieldName}] Price cannot be negative. Got: ${adapted}. ` +
      `Check discount/refund calculations.`
    );
  }

  // Check it's not impossibly large
  if (adapted >= 10_000_000_000) {
    throw new Error(
      `[${fieldName}] Price is unreasonably large: ${adapted} cents (>${(adapted / 100).toLocaleString()} dollars). ` +
      `Check if decimal/int conversion happened twice.`
    );
  }

  return adapted;
}

// ==================== PRICE BATCHING ====================

/**
 * Validate a batch of prices at once
 * Useful for validating entire orders or carts
 * 
 * @param prices - Array of prices to validate
 * @param context - Batch context name for errors
 * @returns {number[]} Array of validated prices in minor units
 */
export function validateBatchPrices(
  prices: any[],
  context: string = 'price_batch'
): number[] {
  if (!Array.isArray(prices)) {
    throw new Error(`[${context}] Expected array, got ${typeof prices}`);
  }

  return prices.map((price, index) =>
    validateAndReturnMinorUnits(price, `${context}[${index}]`)
  );
}

/**
 * Calculate total from prices, ensuring type safety
 * 
 * @param prices - Prices to sum
 * @param context - Context for error messages
 * @returns {number} Total in minor units
 */
export function sumPrices(prices: any[], context: string = 'price_sum'): number {
  const validated = validateBatchPrices(prices, context);
  return validated.reduce((sum, price) => sum + price, 0);
}

// ==================== PRICE OBJECTS ====================

/**
 * Adapt all price fields in an object
 * Used for service responses that contain multiple prices
 * 
 * Example:
 * adaptPriceObject({
 *   unitPrice: "4.50",
 *   subtotal: 900,
 *   tax: 90
 * }, 'order')
 * 
 * Returns:
 * {
 *   unitPrice: 450,
 *   subtotal: 900,
 *   tax: 90
 * }
 * 
 * @param obj - Object potentially containing prices
 * @param context - Context for error messages
 * @returns {any} Object with all prices adapted to Int
 */
export function adaptPriceObject(obj: any, context: string = 'object'): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item, i) => adaptPriceObject(item, `${context}[${i}]`));
  }

  const priceFieldPatterns = [
    'unitPrice',
    'price',
    'total',
    'subtotal',
    'tax',
    'amount',
    'amountPaid',
    'discountAmount',
    'discount',
    'lineTotal',
    'totalPrice',
    'basePrice',
    'cost',
    'sellingPrice',
    'amountSettled',
  ];

  const result: any = {};

  for (const [key, value] of Object.entries(obj)) {
    // Check if this looks like a price field
    const isPriceField = priceFieldPatterns.some(
      (pattern) => key.toLowerCase().includes(pattern.toLowerCase())
    );

    if (isPriceField && typeof value !== 'boolean') {
      // Adapt this field
      result[key] = adaptPrice(value, `${context}.${key}`);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Recursively adapt nested objects
      result[key] = adaptPriceObject(value, `${context}.${key}`);
    } else if (Array.isArray(value)) {
      // Recursively adapt array items
      result[key] = value.map((item, i) =>
        typeof item === 'object' ? adaptPriceObject(item, `${context}.${key}[${i}]`) : item
      );
    } else {
      // Non-price field, keep as-is
      result[key] = value;
    }
  }

  return result;
}

// ==================== CURRENCY + PRICE ====================

/**
 * Price with currency context - ensures consistency
 * 
 * @param priceValue - Price in minor units or any format
 * @param currency - Currency code (e.g., 'USD', 'EUR')
 * @param context - Context for errors
 * @returns {{amount: number, currency: string}} Validated price object
 */
export function priceWithCurrency(
  priceValue: any,
  currency: string = 'USD',
  context: string = 'price'
): { amount: number; currency: string } {
  const amount = validateAndReturnMinorUnits(priceValue, `${context}.amount`);

  if (!currency || typeof currency !== 'string') {
    throw new Error(`[${context}] Currency must be a non-empty string. Got: ${currency}`);
  }

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error(
      `[${context}] Currency must be 3-letter ISO code (e.g., USD, EUR). Got: ${currency}`
    );
  }

  return {
    amount,
    currency: currency.toUpperCase(),
  };
}

/**
 * Extract price and currency from object
 * Expects object with { amount/price/unitPrice, currency } fields
 * 
 * @param obj - Object containing price and currency
 * @param context - Context for errors
 * @returns {{amount: number, currency: string}} Validated price object
 */
export function extractPriceAndCurrency(
  obj: any,
  context: string = 'extract'
): { amount: number; currency: string } {
  if (!obj || typeof obj !== 'object') {
    throw new Error(`[${context}] Expected object, got ${typeof obj}`);
  }

  // Find price field
  const priceKey = ['amount', 'price', 'unitPrice', 'total', 'subtotal'].find(
    (k) => k in obj
  );

  if (!priceKey) {
    throw new Error(
      `[${context}] Object must contain one of: amount, price, unitPrice, total, subtotal. ` +
      `Got keys: ${Object.keys(obj).join(', ')}`
    );
  }

  const currency = obj.currency || 'USD';

  return priceWithCurrency(obj[priceKey], currency, `${context}.${priceKey}`);
}

// ==================== DEBUGGING ====================

/**
 * Get price info for debugging
 * Shows what format the price is in and what it converts to
 * 
 * @param value - Price value to debug
 * @returns {string} Debug information
 */
export function debugPrice(value: any): string {
  const lines: string[] = [];

  lines.push(`Input: ${JSON.stringify(value)}`);
  lines.push(`Type: ${typeof value}`);

  if (typeof value === 'object' && value !== null) {
    lines.push(`Constructor: ${value.constructor?.name || 'unknown'}`);
    if (typeof value.toNumber === 'function') {
      lines.push(`Has toNumber(): ${value.toNumber()}`);
    }
  }

  try {
    const adapted = adaptPrice(value);
    lines.push(`Adapted to: ${adapted} cents = $${(adapted / 100).toFixed(2)}`);
  } catch (e: any) {
    lines.push(`Adaptation failed: ${e.message}`);
  }

  return lines.join('\n');
}

export default {
  adaptPrice,
  validateAndReturnMinorUnits,
  validateBatchPrices,
  sumPrices,
  adaptPriceObject,
  priceWithCurrency,
  extractPriceAndCurrency,
  debugPrice,
};

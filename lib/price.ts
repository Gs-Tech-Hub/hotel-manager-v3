/**
 * PRICE & CURRENCY UTILITY MODULE
 * 
 * All prices are stored as integers in MINOR UNITS (cents, sens, etc.) to ensure:
 * - No floating point precision errors
 * - Consistent calculations across order chain
 * - Easy tax/discount calculations
 * - Accurate financial records
 * - Multi-currency support
 * 
 * Currency Handling:
 * - Use src/lib/currency.ts for currency-aware operations
 * - Prices stored in base currency (configurable, default USD)
 * - All minor unit calculations done here
 * - Currency conversion via exchangeRateManager
 * 
 * Normalized flow: User Input → Minor Units → Database → Display → Format
 * 
 * Price storage: ALL fields are INT (in minor units of base currency)
 * - InventoryItem.unitPrice → stored in minor units
 * - OrderLine.unitPrice → stored in minor units
 * - OrderLine.lineTotal → calculated and stored in minor units
 * - OrderHeader.subtotal/tax/discountTotal/total → stored in minor units
 * - DepartmentInventory.unitPrice → stored in minor units
 * - DepartmentSummary prices → stored in minor units
 */

import { getMinorUnit, currencyContextManager, getCurrencyConfig } from './currency';

// ==================== PRICE NORMALIZATION ====================

/**
 * Normalize any price value to minor units (integer)
 * Handles: strings, decimals, dollars, already-normalized minor units
 * Works with any currency's minor unit system
 * 
 * Rules:
 * - Non-integer decimals → multiply by minor unit (assume major: 4.5 → 450 minor units)
 * - Integer < 1000 → multiply by minor unit (assume major: 4 → 400 minor units)
 * - Integer ≥ 1000 → assume already in minor units (1000 → 1000 minor units)
 * - Invalid/null → returns 0
 * 
 * Examples (USD, minorUnit=100):
 * normalizeToCents(4.5)    → 450
 * normalizeToCents("4.50") → 450
 * normalizeToCents(450)    → 450
 * normalizeToCents(10000)  → 10000
 * 
 * Examples (JPY, minorUnit=1):
 * normalizeToMinorUnits(100)   → 10000 (if 100 is major, not minor)
 * normalizeToMinorUnits(10000) → 10000 (if 10000 is already minor)
 */
export function normalizeToCents(v: any, minorUnit?: number): number {
  const unit = minorUnit || getMinorUnit();
  const n = typeof v === 'string' ? parseFloat(v) : Number(v || 0);
  if (!isFinite(n)) return 0;
  
  // If price has fractional part, assume it's in major units and convert to minor units
  if (!Number.isInteger(n)) return Math.round(n * unit);
  
  // If integer but small (< 1000), treat as major units (e.g., 4 → 400 cents)
  if (Math.abs(n) < 1000) return Math.round(n * unit);
  
  // Otherwise assume already in minor units
  return Math.round(n);
}

/**
 * Alias for normalizeToCents (for clarity when not in USD)
 */
export function normalizeToMinorUnits(v: any, minorUnit?: number): number {
  return normalizeToCents(v, minorUnit);
}

/**
 * Safely parse price from database Decimal field
 * Prisma returns Decimal objects; converts to minor units
 */
export function prismaDecimalToCents(v: any, minorUnit?: number): number {
  if (!v) return 0
  // If it's a Decimal object with toNumber method
  if (typeof v === 'object' && typeof v.toNumber === 'function') {
    return normalizeToCents(v.toNumber(), minorUnit)
  }
  return normalizeToCents(v, minorUnit)
}

/**
 * Convert minor units to major units (float)
 * Used for display and external APIs
 * 
 * Examples (USD):
 * centsToDollars(450)   → 4.5
 * centsToDollars(10000) → 100
 */
export function centsToDollars(n: any, minorUnit?: number): number {
  const unit = minorUnit || getMinorUnit();
  const num = Number(n || 0)
  if (!isFinite(num)) return 0
  return num / unit
}

/**
 * Alias for currency-agnostic operations
 */
export function minorUnitsToMajor(n: any, minorUnit?: number): number {
  return centsToDollars(n, minorUnit)
}

/**
 * Calculate percentage of cents
 * percentage: 0-100
 * Returns: cents
 */
export function calculatePercentage(cents: number, percentage: number): number {
  if (percentage < 0 || percentage > 100) {
    console.warn(`Invalid percentage: ${percentage}, using 0`)
    percentage = 0
  }
  return Math.round(cents * (percentage / 100))
}

/**
 * Calculate discount amount
 * Supports: percentage (0-100) or fixed amount (in minor units)
 * minorUnit: optional, uses default currency if not specified
 */
export function calculateDiscount(subtotalCents: number, discountValue: number, discountType: 'percentage' | 'fixed', minorUnit?: number): number {
  if (discountType === 'percentage') {
    return calculatePercentage(subtotalCents, discountValue)
  }
  // Fixed discount: normalize value to minor units, then apply
  const normalizedDiscount = normalizeToCents(discountValue, minorUnit)
  return Math.min(Math.abs(normalizedDiscount), subtotalCents) // Cap discount at subtotal
}

/**
 * Calculate tax amount (percentage-based)
 * taxRate: 0-100 (e.g., 10 for 10%)
 * Returns: cents
 */
export function calculateTax(subtotalCents: number, taxRate: number = 10): number {
  if (taxRate < 0 || taxRate > 100) {
    console.warn(`Invalid tax rate: ${taxRate}, using 0`)
    taxRate = 0
  }
  return calculatePercentage(subtotalCents, taxRate)
}

/**
 * Calculate order total
 * total = subtotal - discounts + tax
 * All values in cents
 */
export function calculateTotal(subtotalCents: number, discountCents: number = 0, taxCents: number = 0): number {
  return Math.max(0, subtotalCents - discountCents + taxCents)
}

/**
 * Validate price is non-negative
 */
export function validatePrice(cents: number, fieldName: string = 'price'): void {
  if (cents < 0) {
    throw new Error(`${fieldName} cannot be negative: ${cents} cents`)
  }
  if (!Number.isInteger(cents)) {
    throw new Error(`${fieldName} must be integer (cents): ${cents}`)
  }
}

// ==================== FORMATTING & DISPLAY ====================

/**
 * Format cents to currency string with symbol
 * Examples: 450 USD → "$4.50", 450 NGN → "₦4.50", 0 → "₦0.00"
 * Uses Intl formatting to get locale-appropriate symbol for the currency
 */
export function formatCents(n: any, locale?: string, currency?: string): string {
  const useCurrency = currency || currencyContextManager.getDisplayCurrency() || DEFAULT_CURRENCY
  const useLocale = locale || getCurrencyConfig(useCurrency).locale || currencyContextManager.getLocale() || 'en-US'
  const dollars = centsToDollars(n, getMinorUnit(useCurrency))
  
  // Format with Intl to get symbol. Intl.NumberFormat returns formatted string with symbol
  // e.g., "$4.50" for USD or "₦4.50" for NGN depending on locale
  const formatted = new Intl.NumberFormat(useLocale, { 
    style: 'currency', 
    currency: useCurrency,
    minimumFractionDigits: getCurrencyConfig(useCurrency).decimals,
    maximumFractionDigits: getCurrencyConfig(useCurrency).decimals,
  }).format(dollars)
  
  return formatted
}

/**
 * Format cents to string with symbol (compact)
 * Examples: 1000 → "$10.00"
 */
export function formatPrice(cents: number): string {
  return formatCents(cents)
}

/**
 * Format cents as number string (for debugging)
 * Examples: 450 → "4.50", 1000 → "10.00"
 */
export function formatPriceAsDecimal(cents: number): string {
  const dollars = centsToDollars(cents)
  return dollars.toFixed(2)
}

/**
 * Format cents for database Decimal field
 * Returns: string representation of dollars
 */
export function centsToDecimal(cents: number): string {
  const dollars = centsToDollars(cents)
  return dollars.toFixed(2)
}

// ==================== CURRENCY HANDLING ====================

// Default currency: USD (3-letter code per ISO 4217)
export const DEFAULT_CURRENCY = 'USD'

// Supported currencies (extended in future for multi-currency support)
export const SUPPORTED_CURRENCIES = {
  USD: { code: 'USD', symbol: '$', decimals: 2, name: 'US Dollar' },
  EUR: { code: 'EUR', symbol: '€', decimals: 2, name: 'Euro' },
  GBP: { code: 'GBP', symbol: '£', decimals: 2, name: 'British Pound' },
  JPY: { code: 'JPY', symbol: '¥', decimals: 0, name: 'Japanese Yen' },
  CHF: { code: 'CHF', symbol: 'CHF', decimals: 2, name: 'Swiss Franc' },
}

export type CurrencyCode = keyof typeof SUPPORTED_CURRENCIES

/**
 * Get currency info
 */
export function getCurrencyInfo(code: string = DEFAULT_CURRENCY) {
  return SUPPORTED_CURRENCIES[code as CurrencyCode] || SUPPORTED_CURRENCIES.USD
}

/**
 * Format price with locale-aware currency
 * Useful for multi-currency support (future)
 */
export function formatInCurrency(cents: number, currencyCode: string = DEFAULT_CURRENCY, locale: string = 'en-US'): string {
  const info = getCurrencyInfo(currencyCode)
  const dollars = centsToDollars(cents)
  return new Intl.NumberFormat(locale, { style: 'currency', currency: info.code }).format(dollars)
}

// ==================== BATCH OPERATIONS ====================

/**
 * Sum array of price values (in cents)
 */
export function sumPrices(prices: number[]): number {
  return prices.reduce((sum, p) => {
    const centsValue = normalizeToCents(p)
    return sum + centsValue
  }, 0)
}

/**
 * Calculate average price
 */
export function averagePrice(prices: number[]): number {
  if (prices.length === 0) return 0
  return Math.round(sumPrices(prices) / prices.length)
}

/**
 * Compare two prices for equality (handle floating point errors)
 */
export function pricesEqual(a: number, b: number, toleranceCents: number = 1): boolean {
  const aCents = normalizeToCents(a)
  const bCents = normalizeToCents(b)
  return Math.abs(aCents - bCents) <= toleranceCents
}

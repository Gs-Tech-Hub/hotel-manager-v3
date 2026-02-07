/**
 * Centralized Formatters
 * Use these functions in ALL UI components for consistent pricing, dates, etc.
 */

import { formatCents, centsToDollars, normalizeToCents } from './price';
import { currencyContextManager } from './currency';

/**
 * Format any price value for display (unified across app)
 * Handles: cents, dollars, strings, decimals
 * Always displays with currency symbol and 2 decimals
 * 
 * Examples:
 * formatPrice(450) → "$4.50"
 * formatPrice(4.5) → "$4.50"
 * formatPrice("4.50") → "$4.50"
 * formatPrice(0) → "$0.00"
 */
export function formatPriceDisplay(value: any): string {
  const cents = normalizeToCents(value);
  return formatCents(cents);
}

/**
 * Format price as number without currency (for tables/compact display)
 * Examples: 450 → "4.50", 0 → "0.00"
 */
export function formatPriceNumeric(value: any): string {
  const cents = normalizeToCents(value);
  return centsToDollars(cents).toFixed(2);
}

/**
 * Format price for labels/inline display with currency
 * Alias for formatPriceDisplay
 */
export function formatCurrency(value: any): string {
  return formatPriceDisplay(value);
}

/**
 * Format order total for receipts/summaries
 * Large emphasis format
 */
export function formatOrderTotal(cents: number): string {
  return formatPriceDisplay(cents);
}

/**
 * Format line item price (unitPrice × quantity)
 */
export function formatLinePrice(unitPrice: any, quantity: number): string {
  const unitCents = normalizeToCents(unitPrice);
  const lineCents = unitCents * quantity;
  return formatPriceDisplay(lineCents);
}

/**
 * Format line item price with unit display (unitPrice × quantity)
 * Includes unit in the calculation line for clarity
 * Example: 5 bottles × $4.50/bottle = $22.50
 */
export function formatLinePriceWithUnit(unitPrice: any, quantity: number, unit: string): string {
  const unitCents = normalizeToCents(unitPrice);
  const lineCents = unitCents * quantity;
  const lineFormatted = formatPriceDisplay(lineCents);
  const unitPlural = quantity === 1 && unit.endsWith('s') ? unit.slice(0, -1) : unit;
  const quantityText = `${quantity} ${unitPlural}`;
  const pricePerUnit = formatPriceDisplay(unitCents);
  return `${quantityText} × ${pricePerUnit} = ${lineFormatted}`;
}

/**
 * Format discount amount for display
 */
export function formatDiscount(cents: number): string {
  return formatPriceDisplay(cents);
}

/**
 * Format tax amount for display
 */
export function formatTax(cents: number): string {
  return formatPriceDisplay(cents);
}

/**
 * Format inventory unit price for display
 */
export function formatInventoryPrice(cents: number): string {
  return formatPriceDisplay(cents);
}

/**
 * Format department summary price for display
 */
export function formatDepartmentPrice(cents: number): string {
  return formatPriceDisplay(cents);
}

/**
 * Format payment amount for display
 */
export function formatPaymentAmount(cents: number): string {
  return formatPriceDisplay(cents);
}

/**
 * Format price for table cells (compact)
 * Returns: "₦X.XX" format (currency symbol, no code fallback)
 * Always uses base currency symbol
 * 
 * @param cents - Amount in cents
 * @param baseCurrency - Optional currency code (if not provided, uses currencyContextManager)
 */
export function formatTablePrice(cents: number, className?: string, baseCurrency?: string): string {
  const currency = baseCurrency || currencyContextManager.getBaseCurrency() || 'USD';
  return formatCents(cents, undefined, currency);
}

/**
 * Format percentage for display
 * Examples: 10 → "10%", 5.5 → "5.5%"
 */
export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Format quantity + price for display
 * Examples: (1, 450) → "1 × $4.50", (3, 850) → "3 × $8.50"
 */
export function formatQuantityPrice(quantity: number, unitPrice: any): string {
  const formatted = formatPriceDisplay(unitPrice);
  return `${quantity} × ${formatted}`;
}

/**
 * Format quantity + unit + price for display
 * Includes the display unit in the calculation line
 * Examples: (5, "bottles", 450) → "5 bottles × $4.50", (1, "piece", 500) → "1 piece × $5.00"
 */
export function formatQuantityUnitPrice(quantity: number, unit: string, unitPrice: any): string {
  const priceFormatted = formatPriceDisplay(unitPrice);
  const quantityText = `${quantity} ${unit}${quantity === 1 || !unit.endsWith('s') ? '' : 's'}`;
  return `${quantityText} × ${priceFormatted}`;
}

/**
 * Format for receipt line (quantity, price, total)
 * Examples: "2 × $5.00 = $10.00"
 */
export function formatReceiptLine(quantity: number, unitPrice: any, lineTotal: any): string {
  const unitFormatted = formatPriceDisplay(unitPrice);
  const totalFormatted = formatPriceDisplay(lineTotal);
  return `${quantity} × ${unitFormatted} = ${totalFormatted}`;
}

/**
 * Format price range for display
 * Examples: (450, 1000) → "$4.50 - $10.00"
 */
export function formatPriceRange(minCents: number, maxCents: number): string {
  const min = formatPriceDisplay(minCents);
  const max = formatPriceDisplay(maxCents);
  return `${min} - ${max}`;
}

/**
 * Format large amounts (for dashboard totals, summaries)
 * Examples: 50000 → "$500.00"
 */
export function formatLargeAmount(cents: number): string {
  return formatPriceDisplay(cents);
}

/**
 * Format small amounts (for tips, adjustments)
 * Examples: 50 → "$0.50"
 */
export function formatSmallAmount(cents: number): string {
  return formatPriceDisplay(cents);
}

// Date formatters
/**
 * Format date for display
 * Examples: new Date() → "11/29/2025"
 */
export function formatDate(date: Date | string, locale: string = 'en-US'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(locale);
}

/**
 * Format date and time for display
 * Examples: new Date() → "11/29/2025, 2:30 PM"
 */
export function formatDateTime(date: Date | string, locale: string = 'en-US'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString(locale);
}

/**
 * Format time only for display
 * Examples: new Date() → "2:30 PM"
 */
export function formatTime(date: Date | string, locale: string = 'en-US'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString(locale);
}

/**
 * Format duration in human-readable form
 * Examples: 3600000 → "1h", 60000 → "1m", 5000 → "5s"
 */
export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Format unit (quantity) for display
 * Examples: 1 → "1 unit", 5 → "5 units"
 */
export function formatUnits(quantity: number, unit: string = 'unit'): string {
  return `${quantity} ${quantity === 1 ? unit : unit + 's'}`;
}

/**
 * Format status badge text
 * Maps status to display string
 */
export function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    pending: 'Pending',
    processing: 'Processing',
    fulfilled: 'Fulfilled',
    completed: 'Completed',
    cancelled: 'Cancelled',
    failed: 'Failed',
    active: 'Active',
    inactive: 'Inactive',
    reserved: 'Reserved',
    confirmed: 'Confirmed',
    released: 'Released',
    consumed: 'Consumed',
  };
  return statusMap[status] || status.charAt(0).toUpperCase() + status.slice(1);
}

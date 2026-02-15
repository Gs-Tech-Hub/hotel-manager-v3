/**
 * Pricing calculation helpers for service inventory
 * Handles both per-count and per-time pricing models
 */

export type PricingModel = 'per_count' | 'per_time';

export interface PricingInput {
  model: PricingModel;
  pricePerCount?: number;
  pricePerMinute?: number;
  count?: number;
  minutes?: number;
}

export interface PricingResult {
  subtotal: number;
  displayText: string;
}

/**
 * Calculate service cost based on pricing model
 * @param input - Pricing input with model and relevant values
 * @returns Calculated price and display text
 */
export function calculateServicePrice(input: PricingInput): PricingResult {
  const { model, pricePerCount, pricePerMinute, count = 0, minutes = 0 } = input;

  if (model === 'per_count') {
    if (!pricePerCount) throw new Error('pricePerCount required for per_count model');
    const subtotal = count * pricePerCount;
    return {
      subtotal: Math.round(subtotal * 100) / 100, // Round to 2 decimals
      displayText: `${count} × €${pricePerCount.toFixed(2)} = €${(subtotal).toFixed(2)}`
    };
  }

  if (model === 'per_time') {
    if (!pricePerMinute) throw new Error('pricePerMinute required for per_time model');
    const subtotal = minutes * pricePerMinute;
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      displayText: `${minutes}min × €${pricePerMinute.toFixed(2)} = €${(subtotal).toFixed(2)}`
    };
  }

  throw new Error(`Unknown pricing model: ${model}`);
}

/**
 * Calculate price for per-count services (games, activities)
 */
export function calculatePerCountPrice(count: number, pricePerCount: number): number {
  return Math.round(count * pricePerCount * 100) / 100;
}

/**
 * Calculate price for per-time services (pool, gym per hour/minute)
 */
export function calculatePerTimePrice(minutes: number, pricePerMinute: number): number {
  return Math.round(minutes * pricePerMinute * 100) / 100;
}

/**
 * Format price for display
 */
export function formatPrice(amount: number, currency: string = '€'): string {
  return `${currency}${amount.toFixed(2)}`;
}

/**
 * Calculate total with discount
 */
export function applyDiscount(
  amount: number,
  discountPercent: number
): number {
  const discounted = amount * (1 - discountPercent / 100);
  return Math.round(discounted * 100) / 100;
}

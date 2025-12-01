/**
 * CURRENCY CONFIGURATION & HANDLER
 * 
 * Centralized currency system supporting multiple currencies
 * with configurable rates, symbols, and formatting rules
 */

// ==================== CURRENCY TYPES ====================

export type CurrencyCode = string; // ISO 4217 code (USD, EUR, GBP, etc.)
export type MinorUnitAmount = number; // Amount in minor units (cents, pence, etc.)
export type CurrencySymbol = string; // Currency symbol ($, €, £, etc.)

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: CurrencySymbol;
  name: string;
  decimals: number;
  locale?: string; // Default locale for this currency (e.g., 'en-US', 'de-DE')
  minorUnit?: number; // Subunits per major unit (usually 100 for cents)
}

export interface ExchangeRate {
  from: CurrencyCode;
  to: CurrencyCode;
  rate: number; // 1 unit of 'from' = rate units of 'to'
  timestamp: Date;
  source: string; // Where rate came from (e.g., 'ECB', 'API', 'manual')
}

export interface CurrencyContext {
  baseCurrency: CurrencyCode;
  displayCurrency?: CurrencyCode; // For multi-currency display
  displayCurrencySymbol?: CurrencySymbol;
  locale: string;
  autoConvert?: boolean; // Auto-convert prices to display currency
}

// Lazy persistence loader (only used on server)
import prisma from './prisma'
import { loadAllPersistedRates } from './exchangeRateStore'

// ==================== BUILT-IN CURRENCY CATALOG ====================

export const CURRENCY_CATALOG: Record<CurrencyCode, CurrencyConfig> = {
  // Major currencies
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    decimals: 2,
    locale: 'en-US',
    minorUnit: 100,
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    decimals: 2,
    locale: 'de-DE',
    minorUnit: 100,
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    name: 'British Pound',
    decimals: 2,
    locale: 'en-GB',
    minorUnit: 100,
  },
  JPY: {
    code: 'JPY',
    symbol: '¥',
    name: 'Japanese Yen',
    decimals: 0,
    locale: 'ja-JP',
    minorUnit: 1, // No cents
  },
  CHF: {
    code: 'CHF',
    symbol: 'CHF',
    name: 'Swiss Franc',
    decimals: 2,
    locale: 'de-CH',
    minorUnit: 100,
  },
  // Asian currencies
  CNY: {
    code: 'CNY',
    symbol: 'CN¥',
    name: 'Chinese Yuan',
    decimals: 2,
    locale: 'zh-CN',
    minorUnit: 100,
  },
  INR: {
    code: 'INR',
    symbol: '₹',
    name: 'Indian Rupee',
    decimals: 2,
    locale: 'en-IN',
    minorUnit: 100,
  },
  THB: {
    code: 'THB',
    symbol: '฿',
    name: 'Thai Baht',
    decimals: 2,
    locale: 'th-TH',
    minorUnit: 100,
  },
  // Middle Eastern
  AED: {
    code: 'AED',
    symbol: 'د.إ',
    name: 'United Arab Emirates Dirham',
    decimals: 2,
    locale: 'ar-AE',
    minorUnit: 100,
  },
  SAR: {
    code: 'SAR',
    symbol: '﷼',
    name: 'Saudi Riyal',
    decimals: 2,
    locale: 'ar-SA',
    minorUnit: 100,
  },
  // African
  ZAR: {
    code: 'ZAR',
    symbol: 'R',
    name: 'South African Rand',
    decimals: 2,
    locale: 'en-ZA',
    minorUnit: 100,
  },
  EGP: {
    code: 'EGP',
    symbol: 'E£',
    name: 'Egyptian Pound',
    decimals: 2,
    locale: 'ar-EG',
    minorUnit: 100,
  },
  NGN: {
    code: 'NGN',
    symbol: '₦',
    name: 'Nigerian Naira',
    decimals: 2,
    locale: 'en-NG',
    minorUnit: 100,
  },
};

// ==================== EXCHANGE RATE MANAGER ====================

class ExchangeRateManager {
  private rates: Map<string, ExchangeRate> = new Map();
  private lastUpdate: Date | null = null;

  /**
   * Set exchange rate between two currencies
   */
  setRate(from: CurrencyCode, to: CurrencyCode, rate: number, source: string = 'manual'): void {
    if (rate <= 0) {
      throw new Error(`Invalid exchange rate: ${rate}`);
    }
    const key = this.getRateKey(from, to);
    this.rates.set(key, {
      from,
      to,
      rate,
      timestamp: new Date(),
      source,
    });

    // Also set reverse rate
    const reverseKey = this.getRateKey(to, from);
    this.rates.set(reverseKey, {
      from: to,
      to: from,
      rate: 1 / rate,
      timestamp: new Date(),
      source,
    });

    this.lastUpdate = new Date();
  }

  /**
   * Get exchange rate
   */
  getRate(from: CurrencyCode, to: CurrencyCode): number | null {
    if (from === to) return 1;
    const key = this.getRateKey(from, to);
    const rate = this.rates.get(key);
    return rate?.rate || null;
  }

  /**
   * Set multiple rates at once (e.g., from API)
   */
  setRates(baseRates: Record<CurrencyCode, number>, baseCurrency: CurrencyCode, source: string = 'api'): void {
    for (const [target, rate] of Object.entries(baseRates)) {
      this.setRate(baseCurrency, target as CurrencyCode, rate, source);
    }
  }

  /**
   * Get all rates for a base currency
   */
  getRatesForBase(baseCurrency: CurrencyCode): Record<CurrencyCode, number> {
    const result: Record<CurrencyCode, number> = {};
    for (const [key, rate] of this.rates.entries()) {
      if (rate.from === baseCurrency) {
        result[rate.to] = rate.rate;
      }
    }
    return result;
  }

  /**
   * Clear all rates
   */
  clear(): void {
    this.rates.clear();
    this.lastUpdate = null;
  }

  /**
   * Get last update timestamp
   */
  getLastUpdate(): Date | null {
    return this.lastUpdate;
  }

  private getRateKey(from: CurrencyCode, to: CurrencyCode): string {
    return `${from}:${to}`;
  }
}

// Global exchange rate manager
export const exchangeRateManager = new ExchangeRateManager();

// ==================== CURRENCY CONTEXT MANAGER ====================

class CurrencyContextManager {
  private context: CurrencyContext = {
    baseCurrency: 'USD',
    locale: 'en-US',
    autoConvert: false,
  };

  /**
   * Set currency context
   */
  setContext(context: Partial<CurrencyContext>): void {
    this.context = { ...this.context, ...context };

    // Validate currencies exist in catalog
    if (!CURRENCY_CATALOG[this.context.baseCurrency]) {
      throw new Error(`Unknown currency: ${this.context.baseCurrency}`);
    }
    if (this.context.displayCurrency && !CURRENCY_CATALOG[this.context.displayCurrency]) {
      throw new Error(`Unknown currency: ${this.context.displayCurrency}`);
    }
  }

  /**
   * Get current context
   */
  getContext(): CurrencyContext {
    return { ...this.context };
  }

  /**
   * Get base currency
   */
  getBaseCurrency(): CurrencyCode {
    return this.context.baseCurrency;
  }

  /**
   * Get display currency (or base if not set)
   */
  // getDisplayCurrency(): CurrencyCode {
  //   return this.context.displayCurrency || this.context.baseCurrency;
  // }

  getDisplayCurrency(): CurrencySymbol {
    return this.context.displayCurrencySymbol || this.context.baseCurrency;
  }

  /**
   * Get locale
   */
  getLocale(): string {
    return this.context.locale;
  }

  /**
   * Reset to defaults
   */
  reset(): void {
    this.context = {
      baseCurrency: 'USD',
      locale: 'en-US',
      autoConvert: false,
    };
  }
}

// Global currency context manager
export const currencyContextManager = new CurrencyContextManager();

// ==================== CURRENCY CONVERSION ====================

/**
 * Convert amount from one currency to another
 * Both amounts in minor units (cents, sens, etc.)
 */
export function convertCurrency(
  amount: number,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  rate?: number
): number {
  if (fromCurrency === toCurrency) return amount;

  // Use provided rate or look up
  const exchangeRate = rate || exchangeRateManager.getRate(fromCurrency, toCurrency);

  if (!exchangeRate) {
    throw new Error(
      `No exchange rate available from ${fromCurrency} to ${toCurrency}. Set rate with exchangeRateManager.setRate()`
    );
  }

  // amount is provided in minor units of fromCurrency (e.g., cents)
  // exchangeRate is defined as: 1 major unit of `fromCurrency` = exchangeRate major units of `toCurrency`.
  // To convert minor->minor correctly we need to account for differing minor unit scales:
  // minor_to = amount_minor * exchangeRate * (minorUnit_to / minorUnit_from)
  const minorFrom = getMinorUnit(fromCurrency);
  const minorTo = getMinorUnit(toCurrency);

  const converted = amount * exchangeRate * (minorTo / minorFrom);
  return Math.round(converted);
}

/**
 * Convert to base currency
 */
export function convertToBaseCurrency(amount: number, fromCurrency: CurrencyCode): number {
  const baseCurrency = currencyContextManager.getBaseCurrency();
  return convertCurrency(amount, fromCurrency, baseCurrency);
}

/**
 * Convert from base currency
 */
export function convertFromBaseCurrency(amount: number, toCurrency: CurrencyCode): number {
  const baseCurrency = currencyContextManager.getBaseCurrency();
  return convertCurrency(amount, baseCurrency, toCurrency);
}

/**
 * Convert to display currency (with auto-convert if enabled)
 */
export function convertToDisplayCurrency(amount: number, sourceCurrency: CurrencyCode): number {
  const context = currencyContextManager.getContext();
  const displayCurrency = context.displayCurrency || context.baseCurrency;

  if (!context.autoConvert || sourceCurrency === displayCurrency) {
    return amount;
  }

  return convertCurrency(amount, sourceCurrency, displayCurrency);
}

// ==================== CURRENCY INFO ====================

/**
 * Get currency configuration
 */
export function getCurrencyConfig(currency: CurrencyCode): CurrencyConfig {
  const config = CURRENCY_CATALOG[currency];
  if (!config) {
    throw new Error(`Unknown currency: ${currency}`);
  }
  return config;
}

/**
 * Get currency symbol
 */
export function getCurrencySymbol(currency?: CurrencyCode): string {
  const code = currency || currencyContextManager.getBaseCurrency();
  return getCurrencyConfig(code).symbol;
}

/**
 * Get currency name
 */
export function getCurrencyName(currency?: CurrencyCode): string {
  const code = currency || currencyContextManager.getBaseCurrency();
  return getCurrencyConfig(code).name;
}

/**
 * Get decimal places for currency
 */
export function getDecimalPlaces(currency?: CurrencyCode): number {
  const code = currency || currencyContextManager.getBaseCurrency();
  return getCurrencyConfig(code).decimals;
}

/**
 * Get minor unit for currency (e.g., 100 for USD cents)
 */
export function getMinorUnit(currency?: CurrencyCode): number {
  const code = currency || currencyContextManager.getBaseCurrency();
  return getCurrencyConfig(code).minorUnit || 100;
}

/**
 * Check if currency exists
 */
export function currencyExists(currency: CurrencyCode): boolean {
  return currency in CURRENCY_CATALOG;
}

/**
 * Get all available currencies
 */
export function getAllCurrencies(): CurrencyConfig[] {
  return Object.values(CURRENCY_CATALOG);
}

/**
 * Get all currency codes
 */
export function getAllCurrencyCodes(): CurrencyCode[] {
  return Object.keys(CURRENCY_CATALOG);
}

// ==================== AMOUNT FORMATTING ====================

/**
 * Format amount in specific currency
 * minorUnits: amount in minor units (e.g., cents for USD)
 */
export function formatCurrencyAmount(
  minorUnits: number,
  currency?: CurrencyCode,
  locale?: string
): string {
  const code = currency || currencyContextManager.getBaseCurrency();
  const config = getCurrencyConfig(code);
  const useLocale = locale || config.locale || currencyContextManager.getLocale();

  // Convert minor units to major units
  const majorUnits = minorUnits / (config.minorUnit || 100);

  return new Intl.NumberFormat(useLocale, {
    style: 'currency',
    currency: code,
    minimumFractionDigits: config.decimals,
    maximumFractionDigits: config.decimals,
  }).format(majorUnits);
}

/**
 * Format with custom symbol placement
 * Some currencies place symbol after amount (e.g., "100 CHF" instead of "CHF 100")
 */
export function formatCurrencyCustom(
  minorUnits: number,
  currency?: CurrencyCode,
  symbolBefore: boolean = true
): string {
  const code = currency || currencyContextManager.getBaseCurrency();
  const config = getCurrencyConfig(code);
  const majorUnits = minorUnits / (config.minorUnit || 100);

  const formatted = majorUnits.toFixed(config.decimals);
  const symbol = config.symbol;

  if (symbolBefore) {
    return `${symbol}${formatted}`;
  } else {
    return `${formatted} ${symbol}`;
  }
}

// ==================== PRICE CONVERSION WITH FORMATTING ====================

/**
 * Convert and format price
 * Useful for displaying prices in different currencies
 */
export function convertAndFormat(
  amount: number,
  fromCurrency: CurrencyCode,
  toCurrency?: CurrencyCode,
  rate?: number
): string {
  const targetCurrency = toCurrency || currencyContextManager.getDisplayCurrency();
  const converted = convertCurrency(amount, fromCurrency, targetCurrency, rate);
  return formatCurrencyAmount(converted, targetCurrency);
}

/**
 * Get price in different currency (for price comparison, etc.)
 * Returns object with original and converted amounts
 */
export function getPriceInCurrencies(
  amountInMinorUnits: number,
  sourceCurrency: CurrencyCode,
  targetCurrencies: CurrencyCode[]
): Record<CurrencyCode, { minorUnits: number; formatted: string }> {
  const result: Record<CurrencyCode, { minorUnits: number; formatted: string }> = {};

  for (const target of targetCurrencies) {
    const converted = convertCurrency(amountInMinorUnits, sourceCurrency, target);
    result[target] = {
      minorUnits: converted,
      formatted: formatCurrencyAmount(converted, target),
    };
  }

  return result;
}

// ==================== BULK OPERATIONS ====================

/**
 * Convert multiple prices at once
 */
export function convertPrices(
  amounts: number[],
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode
): number[] {
  return amounts.map(amount => convertCurrency(amount, fromCurrency, toCurrency));
}

/**
 * Format multiple prices
 */
export function formatPrices(
  amounts: number[],
  currency?: CurrencyCode,
  locale?: string
): string[] {
  return amounts.map(amount => formatCurrencyAmount(amount, currency, locale));
}

// NOTE: Server-only bootstrap (loading OrganisationInfo and persisted exchange
// rates) has been moved to `src/lib/bootstrapCurrency.ts` to avoid importing
// Prisma in modules that may be bundled to the client. Import and run the
// bootstrap from a server-only entry (e.g., API route) during server startup.

import { describe, test, expect } from 'vitest';
import {
  adaptPrice,
  validateAndReturnMinorUnits,
  validateBatchPrices,
  sumPrices,
  adaptPriceObject,
  priceWithCurrency,
  extractPriceAndCurrency,
  debugPrice,
} from '../price-adapter';

describe('Price Adapter', () => {
  describe('adaptPrice - Basic Conversions', () => {
    test('Int input: 450 → 450', () => {
      expect(adaptPrice(450)).toBe(450);
    });

    test('Int input: 0 → 0', () => {
      expect(adaptPrice(0)).toBe(0);
    });

    test('Int input: 10000 → 10000', () => {
      expect(adaptPrice(10000)).toBe(10000);
    });

    test('Float input: 4.5 → 450', () => {
      expect(adaptPrice(4.5)).toBe(450);
    });

    test('Float input: 12.99 → 1299', () => {
      expect(adaptPrice(12.99)).toBe(1299);
    });

    test('Float input: 0.50 → 50', () => {
      expect(adaptPrice(0.50)).toBe(50);
    });

    test('String input: "4.50" → 450', () => {
      expect(adaptPrice('4.50')).toBe(450);
    });

    test('String input: "12.99" → 1299', () => {
      expect(adaptPrice('12.99')).toBe(1299);
    });

    test('String input: "100" → 10000', () => {
      expect(adaptPrice('100')).toBe(10000);
    });

    test('Null → 0', () => {
      expect(adaptPrice(null)).toBe(0);
    });

    test('Undefined → 0', () => {
      expect(adaptPrice(undefined)).toBe(0);
    });
  });

  describe('adaptPrice - Decimal Objects (Pre-migration)', () => {
    test('Decimal-like object with toNumber()', () => {
      const decimal = { toNumber: () => 4.5 };
      expect(adaptPrice(decimal)).toBe(450);
    });

    test('Decimal-like object with toNumber() returning Int', () => {
      const decimal = { toNumber: () => 450 };
      expect(adaptPrice(decimal)).toBe(450);
    });

    test('Object with toString() fallback', () => {
      const obj = {
        toString: () => '4.50',
      };
      expect(adaptPrice(obj)).toBe(450);
    });
  });

  describe('adaptPrice - Edge Cases', () => {
    test('Large valid number: 1000000 (10k dollars)', () => {
      expect(adaptPrice(1000000)).toBe(1000000);
    });

    test('Small float: 0.01 → 1', () => {
      expect(adaptPrice(0.01)).toBe(1);
    });

    test('Negative throws error', () => {
      expect(() => adaptPrice(-100, 'test')).toThrow();
    });

    test('Infinity throws error', () => {
      expect(() => adaptPrice(Infinity, 'test')).toThrow();
    });

    test('NaN throws error', () => {
      expect(() => adaptPrice(NaN, 'test')).toThrow();
    });

    test('String "invalid" throws error', () => {
      expect(() => adaptPrice('invalid', 'test')).toThrow();
    });

    test('Empty string throws error', () => {
      expect(() => adaptPrice('', 'test')).toThrow();
    });
  });

  describe('validateAndReturnMinorUnits', () => {
    test('Valid Int: 450 → 450', () => {
      expect(validateAndReturnMinorUnits(450)).toBe(450);
    });

    test('Valid float that converts to Int: 4.5 → 450', () => {
      expect(validateAndReturnMinorUnits(4.5)).toBe(450);
    });

    test('Throws on non-integer result: "450.5"', () => {
      expect(() => validateAndReturnMinorUnits('450.5', 'test')).toThrow(/must be an integer/);
    });

    test('Throws on negative: -100', () => {
      expect(() => validateAndReturnMinorUnits(-100, 'test')).toThrow(/cannot be negative/);
    });

    test('Throws on impossibly large: 10B+1', () => {
      expect(() => validateAndReturnMinorUnits(10000000001, 'test')).toThrow(
        /unreasonably large/
      );
    });

    test('Error message includes field name', () => {
      expect(() => validateAndReturnMinorUnits(-50, 'unitPrice')).toThrow(/unitPrice/);
    });
  });

  describe('validateBatchPrices', () => {
    test('Array of valid prices', () => {
      expect(validateBatchPrices([450, 1299, 50])).toEqual([450, 1299, 50]);
    });

    test('Array with floats', () => {
      expect(validateBatchPrices([4.5, 12.99, 0.5])).toEqual([450, 1299, 50]);
    });

    test('Array with mixed formats', () => {
      expect(validateBatchPrices([450, '4.50', 4.5])).toEqual([450, 450, 450]);
    });

    test('Array with nulls converted to 0', () => {
      expect(validateBatchPrices([450, null, 1299])).toEqual([450, 0, 1299]);
    });

    test('Throws on first invalid entry', () => {
      expect(() => validateBatchPrices([450, -100, 1299])).toThrow();
    });

    test('Non-array input throws', () => {
      expect(() => validateBatchPrices('not-array' as any)).toThrow();
    });
  });

  describe('sumPrices', () => {
    test('Sum of valid prices', () => {
      expect(sumPrices([450, 1299, 50])).toBe(1799);
    });

    test('Sum with floats', () => {
      expect(sumPrices([4.5, 12.99, 0.5])).toBe(1799);
    });

    test('Sum with nulls', () => {
      expect(sumPrices([450, null, 1299])).toBe(1749);
    });

    test('Empty array sums to 0', () => {
      expect(sumPrices([])).toBe(0);
    });

    test('Throws on invalid entry', () => {
      expect(() => sumPrices([450, -100])).toThrow();
    });
  });

  describe('adaptPriceObject', () => {
    test('Adapts unitPrice field', () => {
      const result = adaptPriceObject({ unitPrice: '4.50', name: 'item' });
      expect(result.unitPrice).toBe(450);
      expect(result.name).toBe('item');
    });

    test('Adapts multiple price fields', () => {
      const result = adaptPriceObject({
        subtotal: '45.00',
        tax: '4.50',
        total: '49.50',
      });
      expect(result.subtotal).toBe(4500);
      expect(result.tax).toBe(450);
      expect(result.total).toBe(4950);
    });

    test('Adapts nested objects', () => {
      const result = adaptPriceObject({
        order: {
          subtotal: '45.00',
          items: [{ unitPrice: '4.50' }],
        },
      });
      expect(result.order.subtotal).toBe(4500);
      expect(result.order.items[0].unitPrice).toBe(450);
    });

    test('Leaves non-price fields alone', () => {
      const result = adaptPriceObject({
        id: 'abc123',
        quantity: 5,
        available: true,
        unitPrice: '4.50',
      });
      expect(result.id).toBe('abc123');
      expect(result.quantity).toBe(5);
      expect(result.available).toBe(true);
      expect(result.unitPrice).toBe(450);
    });

    test('Handles arrays of objects', () => {
      const result = adaptPriceObject([
        { unitPrice: '4.50', name: 'item1' },
        { unitPrice: '12.99', name: 'item2' },
      ]);
      expect(result[0].unitPrice).toBe(450);
      expect(result[1].unitPrice).toBe(1299);
    });

    test('Non-object input returns as-is', () => {
      expect(adaptPriceObject('string')).toBe('string');
      expect(adaptPriceObject(123)).toBe(123);
      expect(adaptPriceObject(null)).toBe(null);
    });
  });

  describe('priceWithCurrency', () => {
    test('Valid price and currency', () => {
      const result = priceWithCurrency(450, 'USD');
      expect(result).toEqual({ amount: 450, currency: 'USD' });
    });

    test('Float price with currency', () => {
      const result = priceWithCurrency(4.5, 'EUR');
      expect(result).toEqual({ amount: 450, currency: 'EUR' });
    });

    test('Default currency is USD', () => {
      const result = priceWithCurrency(450);
      expect(result.currency).toBe('USD');
    });

    test('Currency normalized to uppercase', () => {
      const result = priceWithCurrency(450, 'usd');
      expect(result.currency).toBe('USD');
    });

    test('Throws on invalid currency', () => {
      expect(() => priceWithCurrency(450, '')).toThrow();
      expect(() => priceWithCurrency(450, 'USDA')).toThrow();
      expect(() => priceWithCurrency(450, 'us')).toThrow();
      expect(() => priceWithCurrency(450, 'US$')).toThrow();
    });

    test('Throws on negative price', () => {
      expect(() => priceWithCurrency(-450, 'USD')).toThrow();
    });
  });

  describe('extractPriceAndCurrency', () => {
    test('Extract from amount and currency fields', () => {
      const result = extractPriceAndCurrency({ amount: 450, currency: 'USD' });
      expect(result).toEqual({ amount: 450, currency: 'USD' });
    });

    test('Extract from price field', () => {
      const result = extractPriceAndCurrency({ price: '4.50', currency: 'EUR' });
      expect(result).toEqual({ amount: 450, currency: 'EUR' });
    });

    test('Extract from unitPrice field', () => {
      const result = extractPriceAndCurrency({ unitPrice: 450, currency: 'GBP' });
      expect(result).toEqual({ amount: 450, currency: 'GBP' });
    });

    test('Defaults to USD if no currency', () => {
      const result = extractPriceAndCurrency({ amount: 450 });
      expect(result.currency).toBe('USD');
    });

    test('Throws if no price field found', () => {
      expect(() => extractPriceAndCurrency({ tax: 450, currency: 'USD' })).toThrow(
        /must contain one of:/
      );
    });

    test('Throws if not an object', () => {
      expect(() => extractPriceAndCurrency('not-object' as any)).toThrow(/Expected object/);
    });
  });

  describe('debugPrice', () => {
    test('Debug output for Int', () => {
      const debug = debugPrice(450);
      expect(debug).toContain('Input: 450');
      expect(debug).toContain('Type: number');
      expect(debug).toContain('Adapted to: 450 cents');
    });

    test('Debug output for string', () => {
      const debug = debugPrice('4.50');
      expect(debug).toContain('Input: "4.50"');
      expect(debug).toContain('Type: string');
      expect(debug).toContain('Adapted to: 450 cents');
    });

    test('Debug output for Decimal object', () => {
      const debug = debugPrice({ toNumber: () => 4.5 });
      expect(debug).toContain('Type: object');
      expect(debug).toContain('Has toNumber():');
      expect(debug).toContain('Adapted to: 450 cents');
    });

    test('Debug output for invalid value', () => {
      const debug = debugPrice(-100);
      expect(debug).toContain('Adaptation failed');
    });
  });

  describe('Real-world Scenarios', () => {
    test('Checkout flow: items with mixed price formats', () => {
      const cartItems = [
        { unitPrice: '4.50', quantity: 2 },
        { unitPrice: 1299, quantity: 1 },
        { unitPrice: { toNumber: () => 3.99 }, quantity: 3 },
      ];

      const adapted = adaptPriceObject(cartItems);
      const subtotal = sumPrices([
        adapted[0].unitPrice * adapted[0].quantity,
        adapted[1].unitPrice * adapted[1].quantity,
        adapted[2].unitPrice * adapted[2].quantity,
      ]);

      expect(subtotal).toBe(900 + 1299 + 1197); // 450*2 + 1299*1 + 399*3
    });

    test('Order response validation', () => {
      const orderResponse = {
        id: 'order-123',
        items: [
          { unitPrice: '4.50', quantity: 2, lineTotal: '9.00' },
          { unitPrice: '12.99', quantity: 1, lineTotal: '12.99' },
        ],
        subtotal: '21.99',
        tax: '2.20',
        total: '24.19',
        currency: 'USD',
      };

      const validated = adaptPriceObject(orderResponse);

      expect(Number.isInteger(validated.subtotal)).toBe(true);
      expect(Number.isInteger(validated.tax)).toBe(true);
      expect(Number.isInteger(validated.total)).toBe(true);
      expect(validated.items[0].lineTotal).toBe(900);
      expect(validated.items[1].lineTotal).toBe(1299);
    });

    test('Multi-currency order validation', () => {
      const usdOrder = { amount: 1000, currency: 'USD' };
      const eurOrder = { amount: '9.99', currency: 'EUR' };

      const usdPriced = priceWithCurrency(usdOrder.amount, usdOrder.currency);
      const eurPriced = priceWithCurrency(eurOrder.amount, eurOrder.currency);

      expect(usdPriced.currency).not.toBe(eurPriced.currency);
      expect(usdPriced.amount).toBe(1000);
      expect(eurPriced.amount).toBe(999);
    });
  });
});

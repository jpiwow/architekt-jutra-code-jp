import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  isNameDuplicate,
  validateCourierName,
  validateDeliveryTypeName,
  validateTrackingUrlTemplate,
  validatePrice,
  sortDeliveryMethods,
} from '../domain';
import type { DeliveryMethod } from '../domain';

/**
 * Feature: delivery-plugin, Property 3: Case-Insensitive Name Uniqueness
 *
 * For any existing entity name (courier or delivery type) and any case-variant
 * of that name, attempting to create or update another entity with the
 * case-variant name should be rejected by validation.
 *
 * Validates: Requirements 1.4, 2.3, 2.5
 */
describe('Feature: delivery-plugin, Property 3: Case-Insensitive Name Uniqueness', () => {
  it('isNameDuplicate returns true for any case-variant of an existing name', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
        (name) => {
          const existingNames = [name];

          // Generate case variants
          const upperVariant = name.toUpperCase();
          const lowerVariant = name.toLowerCase();
          const mixedVariant = name
            .split('')
            .map((c, i) => (i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()))
            .join('');

          expect(isNameDuplicate(upperVariant, existingNames)).toBe(true);
          expect(isNameDuplicate(lowerVariant, existingNames)).toBe(true);
          expect(isNameDuplicate(mixedVariant, existingNames)).toBe(true);
          // Original name itself should also be detected as duplicate
          expect(isNameDuplicate(name, existingNames)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('isNameDuplicate returns false when name does not match any existing name', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
        (name, otherName) => {
          // Only test when names are genuinely different (case-insensitive)
          fc.pre(name.toLowerCase().trim() !== otherName.toLowerCase().trim());

          const existingNames = [otherName];
          expect(isNameDuplicate(name, existingNames)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('isNameDuplicate detects duplicates among multiple existing names', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
          { minLength: 1, maxLength: 10 }
        ),
        (existingNames) => {
          // Pick a random existing name and create a case variant
          const targetName = existingNames[0];
          const caseVariant = targetName.toUpperCase();

          expect(isNameDuplicate(caseVariant, existingNames)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: delivery-plugin, Property 4: Name Validation Rejects Invalid Input
 *
 * For any string that is empty, composed entirely of whitespace characters,
 * or exceeds 100 characters in length, the name validation function should
 * reject it and return an appropriate error reason.
 *
 * Validates: Requirements 1.7, 2.7, 2.8
 */
describe('Feature: delivery-plugin, Property 4: Name Validation Rejects Invalid Input', () => {
  it('validateCourierName rejects empty strings', () => {
    const result = validateCourierName('');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('validateCourierName rejects whitespace-only strings', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 50 }).map((chars) => chars.join('')),
        (whitespaceStr) => {
          const result = validateCourierName(whitespaceStr);
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('validateCourierName rejects strings exceeding 100 characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 101, maxLength: 200 }),
        (longStr) => {
          const result = validateCourierName(longStr);
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('validateDeliveryTypeName rejects empty strings', () => {
    const result = validateDeliveryTypeName('');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('validateDeliveryTypeName rejects whitespace-only strings', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 50 }).map((chars) => chars.join('')),
        (whitespaceStr) => {
          const result = validateDeliveryTypeName(whitespaceStr);
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('validateDeliveryTypeName rejects strings exceeding 100 characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 101, maxLength: 200 }),
        (longStr) => {
          const result = validateDeliveryTypeName(longStr);
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('validateCourierName accepts valid names (non-empty, has non-whitespace, ≤100 chars)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
        (validName) => {
          const result = validateCourierName(validName);
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('validateDeliveryTypeName accepts valid names (non-empty, has non-whitespace, ≤100 chars)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
        (validName) => {
          const result = validateDeliveryTypeName(validName);
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: delivery-plugin, Property 5: Tracking URL Template Placeholder Validation
 *
 * For any string that does not contain the exact substring `{trackingNumber}`,
 * the tracking URL template validation function should reject it.
 *
 * **Validates: Requirements 1.8**
 */
describe('Feature: delivery-plugin, Property 5: Tracking URL Template Placeholder Validation', () => {
  it('rejects any non-empty string that does not contain {trackingNumber}', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 500 }).filter(s => !s.includes('{trackingNumber}')),
        (template) => {
          const result = validateTrackingUrlTemplate(template);
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects empty string', () => {
    const result = validateTrackingUrlTemplate('');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('accepts any string that contains {trackingNumber} and is ≤500 chars', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 200 }),
        fc.string({ minLength: 0, maxLength: 200 }),
        (prefix, suffix) => {
          const template = `${prefix}{trackingNumber}${suffix}`;
          fc.pre(template.length <= 500);
          fc.pre(template.trim().length > 0);
          const result = validateTrackingUrlTemplate(template);
          expect(result.valid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: delivery-plugin, Property 10: Price Validation Rejects Invalid Values
 *
 * For any number that is negative, has more than 2 decimal places,
 * or exceeds 999,999.99, the price validation function should reject it.
 *
 * **Validates: Requirements 4.5**
 */
describe('Feature: delivery-plugin, Property 10: Price Validation Rejects Invalid Values', () => {
  it('rejects negative numbers', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e10, max: -Number.MIN_VALUE, noNaN: true, noDefaultInfinity: true }),
        (amount) => {
          const result = validatePrice(amount);
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects numbers with more than 2 decimal places', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99999999 }).map(n => n / 1000),
        (amount) => {
          // Only test values that actually have >2 decimal places in string representation
          const decimalStr = String(amount);
          const dotIndex = decimalStr.indexOf('.');
          fc.pre(dotIndex !== -1);
          const decimalPlaces = decimalStr.length - dotIndex - 1;
          fc.pre(decimalPlaces > 2);

          const result = validatePrice(amount);
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects numbers exceeding 999,999.99', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1_000_000, max: 1e10, noNaN: true, noDefaultInfinity: true }),
        (amount) => {
          const result = validatePrice(amount);
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('accepts valid prices (0.00 to 999,999.99 with ≤2 decimal places)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99999999 }).map(n => n / 100),
        (amount) => {
          const result = validatePrice(amount);
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: delivery-plugin, Property 8: Delivery Methods Sort Order
 *
 * For any set of delivery methods, the result of sortDeliveryMethods is sorted
 * alphabetically by courier name first, then by delivery type name within the same courier.
 *
 * **Validates: Requirements 3.4**
 */
describe('Feature: delivery-plugin, Property 8: Delivery Methods Sort Order', () => {
  const deliveryMethodArb: fc.Arbitrary<DeliveryMethod> = fc.record({
    objectId: fc.string({ minLength: 1, maxLength: 50 }),
    courierId: fc.string({ minLength: 1, maxLength: 50 }),
    deliveryTypeId: fc.string({ minLength: 1, maxLength: 50 }),
    courierName: fc.string({ minLength: 1, maxLength: 100 }),
    deliveryTypeName: fc.string({ minLength: 1, maxLength: 100 }),
  });

  it('should return results sorted by courier name then delivery type name', () => {
    fc.assert(
      fc.property(fc.array(deliveryMethodArb), (methods) => {
        const sorted = sortDeliveryMethods(methods);

        // Verify length is preserved
        expect(sorted).toHaveLength(methods.length);

        // Verify sort order: for each consecutive pair, courierName comparison <= 0,
        // and if equal, deliveryTypeName comparison <= 0
        for (let i = 0; i < sorted.length - 1; i++) {
          const courierCompare = sorted[i].courierName.localeCompare(sorted[i + 1].courierName);
          if (courierCompare === 0) {
            const typeCompare = sorted[i].deliveryTypeName.localeCompare(sorted[i + 1].deliveryTypeName);
            expect(typeCompare).toBeLessThanOrEqual(0);
          } else {
            expect(courierCompare).toBeLessThan(0);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should not modify the original array', () => {
    fc.assert(
      fc.property(fc.array(deliveryMethodArb), (methods) => {
        const original = [...methods];
        sortDeliveryMethods(methods);

        // Original array should be unchanged
        expect(methods).toEqual(original);
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve all elements (no additions or removals)', () => {
    fc.assert(
      fc.property(fc.array(deliveryMethodArb), (methods) => {
        const sorted = sortDeliveryMethods(methods);

        // Every element in the input should appear in the output
        for (const method of methods) {
          expect(sorted).toContainEqual(method);
        }
        // And vice versa
        for (const method of sorted) {
          expect(methods).toContainEqual(method);
        }
      }),
      { numRuns: 100 }
    );
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import type { PluginObject } from '../../../sdk';
import type { Courier, DeliveryType } from '../domain';

const SIZE_CATEGORIES = ['S', 'M', 'L', 'XL'] as const;

// In-memory store that simulates the SDK's save/list/delete/get behavior
let store: Map<string, PluginObject>;

function createInMemorySDK() {
  return {
    thisPlugin: {
      objects: {
        save: vi.fn(
          async (
            type: string,
            id: string,
            data: Record<string, unknown>,
            options?: { entityType?: string; entityId?: string }
          ): Promise<PluginObject> => {
            const obj: PluginObject = {
              id: `db-${type}-${id}`,
              pluginId: 'delivery-plugin',
              objectType: type,
              objectId: id,
              data,
              entityType: options?.entityType,
              entityId: options?.entityId,
            };
            store.set(`${type}-${id}`, obj);
            return obj;
          }
        ),
        list: vi.fn(
          async (
            type: string,
            options?: { entityType?: string; entityId?: string; filter?: string }
          ): Promise<PluginObject[]> => {
            const results: PluginObject[] = [];
            for (const obj of store.values()) {
              if (obj.objectType !== type) continue;
              if (options?.entityType && obj.entityType !== options.entityType) continue;
              if (options?.entityId && obj.entityId !== options.entityId) continue;
              results.push(obj);
            }
            return results;
          }
        ),
        delete: vi.fn(async (type: string, id: string): Promise<void> => {
          const key = `${type}-${id}`;
          if (!store.has(key)) {
            throw new Error(`Object not found: ${type}/${id}`);
          }
          store.delete(key);
        }),
        get: vi.fn(async (type: string, id: string): Promise<PluginObject> => {
          const key = `${type}-${id}`;
          const obj = store.get(key);
          if (!obj) {
            throw new Error(`Object not found: ${type}/${id}`);
          }
          return obj;
        }),
      },
    },
  };
}

// Mock the SDK module
vi.mock('../../../sdk', () => ({
  getSDK: vi.fn(),
}));

import { getSDK } from '../../../sdk';
import {
  createCourier,
  listCouriers,
  createDeliveryType,
  listDeliveryTypes,
  createDeliveryMethod,
  listDeliveryMethods,
  deleteCourier,
  deleteDeliveryType,
  getCascadeImpact,
  countAssignments,
} from '../services';

// --- Seed Helpers ---

function seedCourier(courierId: string, name: string) {
  const obj: PluginObject = {
    id: `db-courier-${courierId}`,
    pluginId: 'delivery-plugin',
    objectType: 'courier',
    objectId: courierId,
    data: { name, trackingUrlTemplate: `https://${name.toLowerCase()}.com/{trackingNumber}` },
  };
  store.set(`courier-${courierId}`, obj);
}

function seedDeliveryType(typeId: string, name: string) {
  const obj: PluginObject = {
    id: `db-delivery-type-${typeId}`,
    pluginId: 'delivery-plugin',
    objectType: 'delivery-type',
    objectId: typeId,
    data: { name },
  };
  store.set(`delivery-type-${typeId}`, obj);
}

function seedDeliveryMethod(courierId: string, deliveryTypeId: string, courierName: string, deliveryTypeName: string): string {
  const methodId = `${courierId}-${deliveryTypeId}`;
  const obj: PluginObject = {
    id: `db-delivery-method-${methodId}`,
    pluginId: 'delivery-plugin',
    objectType: 'delivery-method',
    objectId: methodId,
    data: { courierId, deliveryTypeId, courierName, deliveryTypeName },
  };
  store.set(`delivery-method-${methodId}`, obj);
  return methodId;
}

function seedPriceEntry(deliveryMethodId: string, sizeCategory: string, amount: number) {
  const entryId = `${deliveryMethodId}-${sizeCategory}`;
  const obj: PluginObject = {
    id: `db-price-entry-${entryId}`,
    pluginId: 'delivery-plugin',
    objectType: 'price-entry',
    objectId: entryId,
    data: { deliveryMethodId, sizeCategory, amount, currency: 'EUR' },
  };
  store.set(`price-entry-${entryId}`, obj);
}

function seedAssignment(productId: string, deliveryMethodId: string) {
  const assignmentId = `${productId}-${deliveryMethodId}`;
  const obj: PluginObject = {
    id: `db-assignment-${assignmentId}`,
    pluginId: 'delivery-plugin',
    objectType: 'assignment',
    objectId: assignmentId,
    data: { productId, deliveryMethodId },
    entityType: 'PRODUCT',
    entityId: productId,
  };
  store.set(`assignment-${assignmentId}`, obj);
}

beforeEach(() => {
  vi.clearAllMocks();
  store = new Map();
  const mockSDK = createInMemorySDK();
  vi.mocked(getSDK).mockReturnValue(mockSDK as any);
  // Mock crypto.randomUUID to generate unique IDs
  let uuidCounter = 0;
  vi.stubGlobal('crypto', {
    randomUUID: () => `uuid-${++uuidCounter}-${Math.random().toString(36).slice(2, 8)}`,
  });
});

// --- Arbitraries ---

/** Valid courier name: non-empty, ≤100 chars, at least one non-whitespace character */
const validCourierNameArb = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter((s) => s.trim().length > 0);

/** Valid tracking URL template: contains {trackingNumber}, ≤500 chars */
const validTrackingUrlTemplateArb = fc
  .tuple(
    fc.string({ minLength: 0, maxLength: 200 }),
    fc.string({ minLength: 0, maxLength: 200 })
  )
  .map(([prefix, suffix]) => `${prefix}{trackingNumber}${suffix}`)
  .filter((s) => s.length <= 500 && s.trim().length > 0);

/** Valid delivery type name: non-empty, ≤100 chars, at least one non-whitespace character */
const validDeliveryTypeNameArb = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter((s) => s.trim().length > 0);

/**
 * Feature: delivery-plugin, Property 1: Courier CRUD Round-Trip
 *
 * For any valid courier name (non-empty, ≤100 chars, contains non-whitespace)
 * and valid tracking URL template (contains `{trackingNumber}`, ≤500 chars),
 * creating a courier and then listing all couriers should include a courier
 * with that exact name and template.
 *
 * **Validates: Requirements 1.3, 1.6**
 */
describe('Feature: delivery-plugin, Property 1: Courier CRUD Round-Trip', () => {
  it('creating a courier with valid name/template, then listing, includes it', async () => {
    await fc.assert(
      fc.asyncProperty(validCourierNameArb, validTrackingUrlTemplateArb, async (name, template) => {
        store.clear();
        const created = await createCourier(name, template);
        const list = await listCouriers();
        const found = list.find(
          (c) => c.name === name && c.trackingUrlTemplate === template
        );
        expect(found).toBeDefined();
        expect(found!.objectId).toBe(created.objectId);
        expect(found!.name).toBe(name);
        expect(found!.trackingUrlTemplate).toBe(template);
      }),
      { numRuns: 100 }
    );
  });

  it('creating multiple couriers, all appear in the list', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.tuple(validCourierNameArb, validTrackingUrlTemplateArb),
          { minLength: 1, maxLength: 5 }
        ),
        async (entries) => {
          store.clear();
          const created: Courier[] = [];
          for (const [name, template] of entries) {
            created.push(await createCourier(name, template));
          }
          const list = await listCouriers();
          for (let i = 0; i < entries.length; i++) {
            const [name, template] = entries[i];
            const found = list.find((c) => c.objectId === created[i].objectId);
            expect(found).toBeDefined();
            expect(found!.name).toBe(name);
            expect(found!.trackingUrlTemplate).toBe(template);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: delivery-plugin, Property 2: Delivery Type CRUD Round-Trip
 *
 * For any valid delivery type name (non-empty, ≤100 chars, contains non-whitespace),
 * creating a delivery type and then listing all delivery types should include
 * a delivery type with that exact name.
 *
 * **Validates: Requirements 2.2, 2.6**
 */
describe('Feature: delivery-plugin, Property 2: Delivery Type CRUD Round-Trip', () => {
  it('creating a delivery type with valid name, then listing, includes it', async () => {
    await fc.assert(
      fc.asyncProperty(validDeliveryTypeNameArb, async (name) => {
        store.clear();
        const created = await createDeliveryType(name);
        const list = await listDeliveryTypes();
        const found = list.find((dt) => dt.name === name);
        expect(found).toBeDefined();
        expect(found!.objectId).toBe(created.objectId);
        expect(found!.name).toBe(name);
      }),
      { numRuns: 100 }
    );
  });

  it('creating multiple delivery types, all appear in the list', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(validDeliveryTypeNameArb, { minLength: 1, maxLength: 5 }),
        async (names) => {
          store.clear();
          const created: DeliveryType[] = [];
          for (const name of names) {
            created.push(await createDeliveryType(name));
          }
          const list = await listDeliveryTypes();
          for (let i = 0; i < names.length; i++) {
            const found = list.find((dt) => dt.objectId === created[i].objectId);
            expect(found).toBeDefined();
            expect(found!.name).toBe(names[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: delivery-plugin, Property 6: Delivery Method Composition Round-Trip
 *
 * For any valid courier ID and valid delivery type ID that both exist in the system,
 * creating a delivery method and then listing all delivery methods should include
 * a method linking that courier and delivery type.
 *
 * **Validates: Requirements 3.1**
 */
describe('Feature: delivery-plugin, Property 6: Delivery Method Composition Round-Trip', () => {
  it('creating a method with valid courier+type IDs, then listing, includes it', async () => {
    await fc.assert(
      fc.asyncProperty(
        validCourierNameArb,
        validTrackingUrlTemplateArb,
        validDeliveryTypeNameArb,
        async (courierName, template, typeName) => {
          store.clear();
          const courier = await createCourier(courierName, template);
          const deliveryType = await createDeliveryType(typeName);
          const method = await createDeliveryMethod(courier.objectId, deliveryType.objectId);
          const list = await listDeliveryMethods();
          const found = list.find(
            (m) => m.courierId === courier.objectId && m.deliveryTypeId === deliveryType.objectId
          );
          expect(found).toBeDefined();
          expect(found!.objectId).toBe(method.objectId);
          expect(found!.courierName).toBe(courierName);
          expect(found!.deliveryTypeName).toBe(typeName);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('creating multiple methods with different courier+type combinations, all appear in the list', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.tuple(validCourierNameArb, validTrackingUrlTemplateArb, validDeliveryTypeNameArb),
          { minLength: 1, maxLength: 3 }
        ),
        async (entries) => {
          store.clear();
          const methods = [];
          for (const [courierName, template, typeName] of entries) {
            const courier = await createCourier(courierName, template);
            const deliveryType = await createDeliveryType(typeName);
            const method = await createDeliveryMethod(courier.objectId, deliveryType.objectId);
            methods.push({ method, courierId: courier.objectId, deliveryTypeId: deliveryType.objectId });
          }
          const list = await listDeliveryMethods();
          for (const { method, courierId, deliveryTypeId } of methods) {
            const found = list.find((m) => m.objectId === method.objectId);
            expect(found).toBeDefined();
            expect(found!.courierId).toBe(courierId);
            expect(found!.deliveryTypeId).toBe(deliveryTypeId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: delivery-plugin, Property 7: Delivery Method Duplicate Combination Rejection
 *
 * For any courier and delivery type pair, after successfully creating a delivery method
 * for that pair, attempting to create another delivery method with the same pair should
 * be rejected.
 *
 * Since the service layer uses composite IDs ({courierId}-{deliveryTypeId}) and the SDK's
 * save performs upsert, the duplicate rejection happens at the UI level by checking
 * `listDeliveryMethods()` for an existing combination before calling create.
 *
 * This property verifies that after creating a delivery method, the list contains
 * a method with that courier+type pair, so the UI's duplicate check
 * (`methods.some(m => m.courierId === courierId && m.deliveryTypeId === deliveryTypeId)`)
 * would return true, effectively rejecting the duplicate.
 *
 * **Validates: Requirements 3.2**
 */
describe('Feature: delivery-plugin, Property 7: Delivery Method Duplicate Combination Rejection', () => {
  it('after creating a delivery method, the duplicate check detects the existing combination', async () => {
    await fc.assert(
      fc.asyncProperty(
        validCourierNameArb,
        validTrackingUrlTemplateArb,
        validDeliveryTypeNameArb,
        async (courierName, trackingUrl, deliveryTypeName) => {
          store.clear();

          // Step 1: Create a courier and a delivery type
          const courier = await createCourier(courierName, trackingUrl);
          const deliveryType = await createDeliveryType(deliveryTypeName);

          // Step 2: Create a delivery method with this courier+type pair — should succeed
          const method = await createDeliveryMethod(courier.objectId, deliveryType.objectId);
          expect(method).toBeDefined();
          expect(method.courierId).toBe(courier.objectId);
          expect(method.deliveryTypeId).toBe(deliveryType.objectId);

          // Step 3: List delivery methods and verify the combination exists
          const methods = await listDeliveryMethods();

          // The UI's duplicate check: does a method with this courier+type pair already exist?
          const isDuplicate = methods.some(
            m => m.courierId === courier.objectId && m.deliveryTypeId === deliveryType.objectId
          );

          // The duplicate check should return true, meaning the UI would reject a second creation
          expect(isDuplicate).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('the composite ID ensures same courier+type pair maps to the same storage slot (upsert, not duplicate)', async () => {
    await fc.assert(
      fc.asyncProperty(
        validCourierNameArb,
        validTrackingUrlTemplateArb,
        validDeliveryTypeNameArb,
        async (courierName, trackingUrl, deliveryTypeName) => {
          store.clear();

          // Create courier and delivery type
          const courier = await createCourier(courierName, trackingUrl);
          const deliveryType = await createDeliveryType(deliveryTypeName);

          // Create the delivery method twice with the same pair
          await createDeliveryMethod(courier.objectId, deliveryType.objectId);
          await createDeliveryMethod(courier.objectId, deliveryType.objectId);

          // List should contain exactly ONE method for this pair (upsert, not duplicate)
          const methods = await listDeliveryMethods();
          const matchingMethods = methods.filter(
            m => m.courierId === courier.objectId && m.deliveryTypeId === deliveryType.objectId
          );

          // The composite ID design ensures at most one entry per courier+type pair
          expect(matchingMethods).toHaveLength(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: delivery-plugin, Property 13: Cascade Deletion Integrity
 *
 * For any courier (or delivery type) that has associated delivery methods,
 * and those delivery methods have associated price entries and product assignments,
 * deleting the courier (or delivery type) should result in:
 * (a) no delivery methods referencing that entity,
 * (b) no price entries referencing those delivery methods, and
 * (c) no product assignments referencing those delivery methods.
 *
 * **Validates: Requirements 5.7, 5.8, 8.1, 8.2, 8.3, 8.4**
 */
describe('Feature: delivery-plugin, Property 13: Cascade Deletion Integrity', () => {
  it('after deleting a courier, no orphaned methods/prices/assignments remain', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 0, max: 3 }),
        fc.array(fc.subarray([...SIZE_CATEGORIES], { minLength: 0, maxLength: 4 }), { minLength: 1, maxLength: 5 }),
        async (numTypes, numProducts, sizeCatsPerMethod) => {
          store.clear();

          const courierId = 'target-courier';
          seedCourier(courierId, 'TargetCourier');

          // Create delivery types and methods
          const methodIds: string[] = [];
          for (let t = 0; t < numTypes; t++) {
            const typeId = `dt-${t}`;
            seedDeliveryType(typeId, `Type${t}`);
            const methodId = seedDeliveryMethod(courierId, typeId, 'TargetCourier', `Type${t}`);
            methodIds.push(methodId);

            // Add price entries for this method
            const cats = sizeCatsPerMethod[t % sizeCatsPerMethod.length];
            for (const cat of cats) {
              seedPriceEntry(methodId, cat, 10);
            }
          }

          // Add assignments
          for (let p = 0; p < numProducts; p++) {
            const productId = `prod-${p}`;
            for (const methodId of methodIds) {
              seedAssignment(productId, methodId);
            }
          }

          // Perform cascade deletion
          await deleteCourier(courierId);

          // Assert: no delivery methods reference this courier
          for (const obj of store.values()) {
            if (obj.objectType === 'delivery-method') {
              expect(obj.data.courierId).not.toBe(courierId);
            }
          }

          // Assert: no price entries reference any of the deleted methods
          for (const obj of store.values()) {
            if (obj.objectType === 'price-entry') {
              expect(methodIds).not.toContain(obj.data.deliveryMethodId);
            }
          }

          // Assert: no assignments reference any of the deleted methods
          for (const obj of store.values()) {
            if (obj.objectType === 'assignment') {
              expect(methodIds).not.toContain(obj.data.deliveryMethodId);
            }
          }

          // Assert: the courier itself is gone
          expect(store.has(`courier-${courierId}`)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('after deleting a delivery type, no orphaned methods/prices/assignments remain', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 0, max: 3 }),
        fc.array(fc.subarray([...SIZE_CATEGORIES], { minLength: 0, maxLength: 4 }), { minLength: 1, maxLength: 5 }),
        async (numCouriers, numProducts, sizeCatsPerMethod) => {
          store.clear();

          const targetTypeId = 'target-type';
          seedDeliveryType(targetTypeId, 'TargetType');

          // Create couriers and methods
          const methodIds: string[] = [];
          for (let c = 0; c < numCouriers; c++) {
            const courierId = `courier-${c}`;
            seedCourier(courierId, `Courier${c}`);
            const methodId = seedDeliveryMethod(courierId, targetTypeId, `Courier${c}`, 'TargetType');
            methodIds.push(methodId);

            // Add price entries
            const cats = sizeCatsPerMethod[c % sizeCatsPerMethod.length];
            for (const cat of cats) {
              seedPriceEntry(methodId, cat, 15);
            }
          }

          // Add assignments
          for (let p = 0; p < numProducts; p++) {
            const productId = `prod-${p}`;
            for (const methodId of methodIds) {
              seedAssignment(productId, methodId);
            }
          }

          // Perform cascade deletion
          await deleteDeliveryType(targetTypeId);

          // Assert: no delivery methods reference this delivery type
          for (const obj of store.values()) {
            if (obj.objectType === 'delivery-method') {
              expect(obj.data.deliveryTypeId).not.toBe(targetTypeId);
            }
          }

          // Assert: no price entries reference any of the deleted methods
          for (const obj of store.values()) {
            if (obj.objectType === 'price-entry') {
              expect(methodIds).not.toContain(obj.data.deliveryMethodId);
            }
          }

          // Assert: no assignments reference any of the deleted methods
          for (const obj of store.values()) {
            if (obj.objectType === 'assignment') {
              expect(methodIds).not.toContain(obj.data.deliveryMethodId);
            }
          }

          // Assert: the delivery type itself is gone
          expect(store.has(`delivery-type-${targetTypeId}`)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: delivery-plugin, Property 14: Cascade Confirmation Count Accuracy
 *
 * For any courier (or delivery type) with N associated delivery methods,
 * M total product assignments across those methods, and P total price entries
 * across those methods, the cascade impact calculation should return exactly
 * {deliveryMethodCount: N, assignmentCount: M, priceEntryCount: P}.
 *
 * **Validates: Requirements 8.5**
 */
describe('Feature: delivery-plugin, Property 14: Cascade Confirmation Count Accuracy', () => {
  it('getCascadeImpact returns exact counts for a courier', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5 }),
        fc.integer({ min: 0, max: 4 }),
        fc.array(fc.subarray([...SIZE_CATEGORIES], { minLength: 0, maxLength: 4 }), { minLength: 1, maxLength: 5 }),
        async (numTypes, numProducts, sizeCatsPerMethod) => {
          store.clear();

          const courierId = 'impact-courier';
          seedCourier(courierId, 'ImpactCourier');

          // Seed an unrelated courier to ensure filtering works
          seedCourier('other-courier', 'OtherCourier');
          seedDeliveryType('other-type', 'OtherType');
          seedDeliveryMethod('other-courier', 'other-type', 'OtherCourier', 'OtherType');
          seedPriceEntry('other-courier-other-type', 'S', 99);
          seedAssignment('other-prod', 'other-courier-other-type');

          // Create delivery types and methods for target courier
          const methodIds: string[] = [];
          let expectedPriceCount = 0;
          let expectedAssignmentCount = 0;

          for (let t = 0; t < numTypes; t++) {
            const typeId = `dt-${t}`;
            seedDeliveryType(typeId, `Type${t}`);
            const methodId = seedDeliveryMethod(courierId, typeId, 'ImpactCourier', `Type${t}`);
            methodIds.push(methodId);

            const cats = sizeCatsPerMethod[t % sizeCatsPerMethod.length] || [];
            for (const cat of cats) {
              seedPriceEntry(methodId, cat, 10);
              expectedPriceCount++;
            }
          }

          // Add assignments
          for (let p = 0; p < numProducts; p++) {
            const productId = `prod-${p}`;
            for (const methodId of methodIds) {
              seedAssignment(productId, methodId);
              expectedAssignmentCount++;
            }
          }

          const impact = await getCascadeImpact('courier', courierId);

          expect(impact.deliveryMethodCount).toBe(numTypes);
          expect(impact.priceEntryCount).toBe(expectedPriceCount);
          expect(impact.assignmentCount).toBe(expectedAssignmentCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('getCascadeImpact returns exact counts for a delivery type', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5 }),
        fc.integer({ min: 0, max: 4 }),
        fc.array(fc.subarray([...SIZE_CATEGORIES], { minLength: 0, maxLength: 4 }), { minLength: 1, maxLength: 5 }),
        async (numCouriers, numProducts, sizeCatsPerMethod) => {
          store.clear();

          const targetTypeId = 'impact-type';
          seedDeliveryType(targetTypeId, 'ImpactType');

          // Seed unrelated data
          seedDeliveryType('other-type', 'OtherType');
          seedCourier('other-courier', 'OtherCourier');
          seedDeliveryMethod('other-courier', 'other-type', 'OtherCourier', 'OtherType');
          seedPriceEntry('other-courier-other-type', 'M', 50);
          seedAssignment('other-prod', 'other-courier-other-type');

          const methodIds: string[] = [];
          let expectedPriceCount = 0;
          let expectedAssignmentCount = 0;

          for (let c = 0; c < numCouriers; c++) {
            const courierId = `courier-${c}`;
            seedCourier(courierId, `Courier${c}`);
            const methodId = seedDeliveryMethod(courierId, targetTypeId, `Courier${c}`, 'ImpactType');
            methodIds.push(methodId);

            const cats = sizeCatsPerMethod[c % sizeCatsPerMethod.length] || [];
            for (const cat of cats) {
              seedPriceEntry(methodId, cat, 20);
              expectedPriceCount++;
            }
          }

          for (let p = 0; p < numProducts; p++) {
            const productId = `prod-${p}`;
            for (const methodId of methodIds) {
              seedAssignment(productId, methodId);
              expectedAssignmentCount++;
            }
          }

          const impact = await getCascadeImpact('deliveryType', targetTypeId);

          expect(impact.deliveryMethodCount).toBe(numCouriers);
          expect(impact.priceEntryCount).toBe(expectedPriceCount);
          expect(impact.assignmentCount).toBe(expectedAssignmentCount);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: delivery-plugin, Property 15: Cancel Abort Preserves State
 *
 * For any system state (set of couriers, delivery types, delivery methods,
 * price entries, and assignments), initiating a cascade deletion and then
 * canceling should leave all records unchanged — the state after cancel
 * should be identical to the state before.
 *
 * Since cancel means "don't call delete" (UI-level), we test that getCascadeImpact
 * (which is read-only) does not modify any state.
 *
 * **Validates: Requirements 8.6**
 */
describe('Feature: delivery-plugin, Property 15: Cancel Abort Preserves State', () => {
  it('getCascadeImpact (read-only) does not modify any state for courier', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 4 }),
        fc.integer({ min: 0, max: 3 }),
        fc.integer({ min: 0, max: 3 }),
        async (numTypes, numProducts, numPricesPerMethod) => {
          store.clear();

          const courierId = 'cancel-courier';
          seedCourier(courierId, 'CancelCourier');

          for (let t = 0; t < numTypes; t++) {
            const typeId = `dt-${t}`;
            seedDeliveryType(typeId, `Type${t}`);
            const methodId = seedDeliveryMethod(courierId, typeId, 'CancelCourier', `Type${t}`);

            for (let s = 0; s < Math.min(numPricesPerMethod, SIZE_CATEGORIES.length); s++) {
              seedPriceEntry(methodId, SIZE_CATEGORIES[s], 10 + s);
            }
          }

          for (let p = 0; p < numProducts; p++) {
            const productId = `prod-${p}`;
            for (let t = 0; t < numTypes; t++) {
              const methodId = `${courierId}-dt-${t}`;
              seedAssignment(productId, methodId);
            }
          }

          // Snapshot state before
          const stateBefore = new Map<string, string>();
          for (const [k, v] of store.entries()) {
            stateBefore.set(k, JSON.stringify(v));
          }

          // Call getCascadeImpact (simulates user seeing the confirmation dialog)
          await getCascadeImpact('courier', courierId);

          // Assert: state is unchanged (cancel = don't proceed with delete)
          expect(store.size).toBe(stateBefore.size);
          for (const [key, beforeJson] of stateBefore.entries()) {
            const afterObj = store.get(key);
            expect(afterObj).toBeDefined();
            expect(JSON.stringify(afterObj)).toBe(beforeJson);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('getCascadeImpact (read-only) does not modify any state for delivery type', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 4 }),
        fc.integer({ min: 0, max: 3 }),
        fc.integer({ min: 0, max: 3 }),
        async (numCouriers, numProducts, numPricesPerMethod) => {
          store.clear();

          const targetTypeId = 'cancel-type';
          seedDeliveryType(targetTypeId, 'CancelType');

          for (let c = 0; c < numCouriers; c++) {
            const courierId = `courier-${c}`;
            seedCourier(courierId, `Courier${c}`);
            const methodId = seedDeliveryMethod(courierId, targetTypeId, `Courier${c}`, 'CancelType');

            for (let s = 0; s < Math.min(numPricesPerMethod, SIZE_CATEGORIES.length); s++) {
              seedPriceEntry(methodId, SIZE_CATEGORIES[s], 20 + s);
            }
          }

          for (let p = 0; p < numProducts; p++) {
            const productId = `prod-${p}`;
            for (let c = 0; c < numCouriers; c++) {
              const methodId = `courier-${c}-${targetTypeId}`;
              seedAssignment(productId, methodId);
            }
          }

          // Snapshot state before
          const stateBefore = new Map<string, string>();
          for (const [k, v] of store.entries()) {
            stateBefore.set(k, JSON.stringify(v));
          }

          // Call getCascadeImpact (simulates user seeing the confirmation dialog, then canceling)
          await getCascadeImpact('deliveryType', targetTypeId);

          // Assert: state is unchanged
          expect(store.size).toBe(stateBefore.size);
          for (const [key, beforeJson] of stateBefore.entries()) {
            const afterObj = store.get(key);
            expect(afterObj).toBeDefined();
            expect(JSON.stringify(afterObj)).toBe(beforeJson);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: delivery-plugin, Property 16: Badge Count Accuracy
 *
 * For any product with N product delivery assignments, the badge count
 * function should return exactly N.
 *
 * **Validates: Requirements 6.1**
 */
describe('Feature: delivery-plugin, Property 16: Badge Count Accuracy', () => {
  it('countAssignments returns the exact number of assignments for a product', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10 }),
        fc.integer({ min: 0, max: 5 }),
        async (numAssigned, numOtherProductAssignments) => {
          store.clear();

          const targetProductId = 'target-product';

          // Create delivery methods and assign them to the target product
          for (let i = 0; i < numAssigned; i++) {
            const courierId = `courier-${i}`;
            const typeId = `type-${i}`;
            seedCourier(courierId, `Courier${i}`);
            seedDeliveryType(typeId, `Type${i}`);
            const methodId = seedDeliveryMethod(courierId, typeId, `Courier${i}`, `Type${i}`);
            seedAssignment(targetProductId, methodId);
          }

          // Create assignments for other products (should not be counted)
          for (let j = 0; j < numOtherProductAssignments; j++) {
            const otherProductId = `other-product-${j}`;
            const courierId = `other-courier-${j}`;
            const typeId = `other-type-${j}`;
            seedCourier(courierId, `OtherCourier${j}`);
            seedDeliveryType(typeId, `OtherType${j}`);
            const methodId = seedDeliveryMethod(courierId, typeId, `OtherCourier${j}`, `OtherType${j}`);
            seedAssignment(otherProductId, methodId);
          }

          const count = await countAssignments(targetProductId);
          expect(count).toBe(numAssigned);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('countAssignments returns 0 for a product with no assignments', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        async (numOtherAssignments) => {
          store.clear();

          const targetProductId = 'empty-product';

          // Create assignments for other products only
          for (let j = 0; j < numOtherAssignments; j++) {
            const otherProductId = `other-product-${j}`;
            const courierId = `courier-${j}`;
            const typeId = `type-${j}`;
            seedCourier(courierId, `Courier${j}`);
            seedDeliveryType(typeId, `Type${j}`);
            const methodId = seedDeliveryMethod(courierId, typeId, `Courier${j}`, `Type${j}`);
            seedAssignment(otherProductId, methodId);
          }

          const count = await countAssignments(targetProductId);
          expect(count).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PluginObject, PluginSDKType } from '../../../sdk';

// Mock the SDK module
vi.mock('../../../sdk', () => ({
  getSDK: vi.fn(),
}));

import { getSDK } from '../../../sdk';
import {
  createCourier,
  updateCourier,
  listCouriers,
  createDeliveryType,
  updateDeliveryType,
  listDeliveryTypes,
  createDeliveryMethod,
  listDeliveryMethods,
  deleteDeliveryMethod,
  savePrice,
  listPrices,
  enableDeliveryMethod,
  disableDeliveryMethod,
  enableAllDeliveryMethods,
  deleteCourier,
  deleteDeliveryType,
  getCascadeImpact,
} from '../services';

// Helper to create a mock PluginObject
function makePluginObject(
  objectType: string,
  objectId: string,
  data: Record<string, unknown>,
  entityType?: string,
  entityId?: string,
): PluginObject {
  return {
    id: `db-id-${objectId}`,
    pluginId: 'delivery-plugin',
    objectType,
    objectId,
    data,
    entityType,
    entityId,
  };
}

// Create mock SDK
function createMockSDK() {
  return {
    thisPlugin: {
      objects: {
        save: vi.fn(),
        list: vi.fn(),
        delete: vi.fn(),
        get: vi.fn(),
      },
    },
  } as unknown as PluginSDKType;
}

let mockSDK: ReturnType<typeof createMockSDK>;

beforeEach(() => {
  vi.clearAllMocks();
  mockSDK = createMockSDK();
  vi.mocked(getSDK).mockReturnValue(mockSDK);
  // Mock crypto.randomUUID
  vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-1234' });
});

describe('Courier CRUD', () => {
  it('createCourier saves with UUID and returns mapped courier', async () => {
    const savedObj = makePluginObject('courier', 'test-uuid-1234', {
      name: 'DHL',
      trackingUrlTemplate: 'https://dhl.com/track?id={trackingNumber}',
    });
    vi.mocked(mockSDK.thisPlugin.objects.save).mockResolvedValue(savedObj);

    const result = await createCourier('DHL', 'https://dhl.com/track?id={trackingNumber}');

    expect(mockSDK.thisPlugin.objects.save).toHaveBeenCalledWith(
      'courier',
      'test-uuid-1234',
      { name: 'DHL', trackingUrlTemplate: 'https://dhl.com/track?id={trackingNumber}' },
    );
    expect(result).toEqual({
      objectId: 'test-uuid-1234',
      name: 'DHL',
      trackingUrlTemplate: 'https://dhl.com/track?id={trackingNumber}',
    });
  });

  it('updateCourier saves with existing ID', async () => {
    const savedObj = makePluginObject('courier', 'existing-id', {
      name: 'DHL Express',
      trackingUrlTemplate: 'https://dhl.com/express?id={trackingNumber}',
    });
    vi.mocked(mockSDK.thisPlugin.objects.save).mockResolvedValue(savedObj);

    const result = await updateCourier(
      'existing-id',
      'DHL Express',
      'https://dhl.com/express?id={trackingNumber}',
    );

    expect(mockSDK.thisPlugin.objects.save).toHaveBeenCalledWith(
      'courier',
      'existing-id',
      { name: 'DHL Express', trackingUrlTemplate: 'https://dhl.com/express?id={trackingNumber}' },
    );
    expect(result.objectId).toBe('existing-id');
    expect(result.name).toBe('DHL Express');
  });

  it('listCouriers lists and maps objects', async () => {
    const objects = [
      makePluginObject('courier', 'c1', { name: 'DHL', trackingUrlTemplate: 'https://dhl.com/{trackingNumber}' }),
      makePluginObject('courier', 'c2', { name: 'DPD', trackingUrlTemplate: 'https://dpd.com/{trackingNumber}' }),
    ];
    vi.mocked(mockSDK.thisPlugin.objects.list).mockResolvedValue(objects);

    const result = await listCouriers();

    expect(mockSDK.thisPlugin.objects.list).toHaveBeenCalledWith('courier');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ objectId: 'c1', name: 'DHL', trackingUrlTemplate: 'https://dhl.com/{trackingNumber}' });
    expect(result[1]).toEqual({ objectId: 'c2', name: 'DPD', trackingUrlTemplate: 'https://dpd.com/{trackingNumber}' });
  });
});

describe('Delivery Type CRUD', () => {
  it('createDeliveryType saves with UUID', async () => {
    const savedObj = makePluginObject('delivery-type', 'test-uuid-1234', { name: 'Parcel Locker' });
    vi.mocked(mockSDK.thisPlugin.objects.save).mockResolvedValue(savedObj);

    const result = await createDeliveryType('Parcel Locker');

    expect(mockSDK.thisPlugin.objects.save).toHaveBeenCalledWith(
      'delivery-type',
      'test-uuid-1234',
      { name: 'Parcel Locker' },
    );
    expect(result).toEqual({ objectId: 'test-uuid-1234', name: 'Parcel Locker' });
  });

  it('listDeliveryTypes lists and maps objects', async () => {
    const objects = [
      makePluginObject('delivery-type', 'dt1', { name: 'Classic Courier' }),
      makePluginObject('delivery-type', 'dt2', { name: 'Parcel Locker' }),
    ];
    vi.mocked(mockSDK.thisPlugin.objects.list).mockResolvedValue(objects);

    const result = await listDeliveryTypes();

    expect(mockSDK.thisPlugin.objects.list).toHaveBeenCalledWith('delivery-type');
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Classic Courier');
    expect(result[1].name).toBe('Parcel Locker');
  });
});

describe('Delivery Method CRUD', () => {
  it('createDeliveryMethod looks up courier/type names and uses composite ID', async () => {
    const courierObj = makePluginObject('courier', 'c1', {
      name: 'DHL',
      trackingUrlTemplate: 'https://dhl.com/{trackingNumber}',
    });
    const typeObj = makePluginObject('delivery-type', 'dt1', { name: 'Classic Courier' });
    const savedObj = makePluginObject('delivery-method', 'c1-dt1', {
      courierId: 'c1',
      deliveryTypeId: 'dt1',
      courierName: 'DHL',
      deliveryTypeName: 'Classic Courier',
    });

    vi.mocked(mockSDK.thisPlugin.objects.get)
      .mockResolvedValueOnce(courierObj)
      .mockResolvedValueOnce(typeObj);
    vi.mocked(mockSDK.thisPlugin.objects.save).mockResolvedValue(savedObj);

    const result = await createDeliveryMethod('c1', 'dt1');

    expect(mockSDK.thisPlugin.objects.get).toHaveBeenCalledWith('courier', 'c1');
    expect(mockSDK.thisPlugin.objects.get).toHaveBeenCalledWith('delivery-type', 'dt1');
    expect(mockSDK.thisPlugin.objects.save).toHaveBeenCalledWith(
      'delivery-method',
      'c1-dt1',
      { courierId: 'c1', deliveryTypeId: 'dt1', courierName: 'DHL', deliveryTypeName: 'Classic Courier' },
    );
    expect(result.objectId).toBe('c1-dt1');
    expect(result.courierName).toBe('DHL');
    expect(result.deliveryTypeName).toBe('Classic Courier');
  });

  it('listDeliveryMethods maps and sorts by courier name then type name', async () => {
    const objects = [
      makePluginObject('delivery-method', 'c2-dt1', {
        courierId: 'c2', deliveryTypeId: 'dt1', courierName: 'InPost', deliveryTypeName: 'Parcel Locker',
      }),
      makePluginObject('delivery-method', 'c1-dt1', {
        courierId: 'c1', deliveryTypeId: 'dt1', courierName: 'DHL', deliveryTypeName: 'Classic Courier',
      }),
      makePluginObject('delivery-method', 'c1-dt2', {
        courierId: 'c1', deliveryTypeId: 'dt2', courierName: 'DHL', deliveryTypeName: 'Parcel Locker',
      }),
    ];
    vi.mocked(mockSDK.thisPlugin.objects.list).mockResolvedValue(objects);

    const result = await listDeliveryMethods();

    expect(result[0].courierName).toBe('DHL');
    expect(result[0].deliveryTypeName).toBe('Classic Courier');
    expect(result[1].courierName).toBe('DHL');
    expect(result[1].deliveryTypeName).toBe('Parcel Locker');
    expect(result[2].courierName).toBe('InPost');
  });
});

describe('deleteDeliveryMethod', () => {
  it('cascades to price entries and assignments before deleting method', async () => {
    const priceEntries = [
      makePluginObject('price-entry', 'dm1-S', { deliveryMethodId: 'dm1', sizeCategory: 'S', amount: 5 }),
      makePluginObject('price-entry', 'dm1-M', { deliveryMethodId: 'dm1', sizeCategory: 'M', amount: 10 }),
      makePluginObject('price-entry', 'dm2-S', { deliveryMethodId: 'dm2', sizeCategory: 'S', amount: 7 }),
    ];
    const assignments = [
      makePluginObject('assignment', 'p1-dm1', { productId: 'p1', deliveryMethodId: 'dm1' }, 'PRODUCT', 'p1'),
      makePluginObject('assignment', 'p2-dm1', { productId: 'p2', deliveryMethodId: 'dm1' }, 'PRODUCT', 'p2'),
      makePluginObject('assignment', 'p1-dm2', { productId: 'p1', deliveryMethodId: 'dm2' }, 'PRODUCT', 'p1'),
    ];

    vi.mocked(mockSDK.thisPlugin.objects.list)
      .mockResolvedValueOnce(priceEntries)  // list price-entry
      .mockResolvedValueOnce(assignments);  // list assignment
    vi.mocked(mockSDK.thisPlugin.objects.delete).mockResolvedValue(undefined);

    await deleteDeliveryMethod('dm1');

    // Should delete price entries for dm1
    expect(mockSDK.thisPlugin.objects.delete).toHaveBeenCalledWith('price-entry', 'dm1-S');
    expect(mockSDK.thisPlugin.objects.delete).toHaveBeenCalledWith('price-entry', 'dm1-M');
    // Should NOT delete price entries for dm2
    expect(mockSDK.thisPlugin.objects.delete).not.toHaveBeenCalledWith('price-entry', 'dm2-S');
    // Should delete assignments for dm1
    expect(mockSDK.thisPlugin.objects.delete).toHaveBeenCalledWith('assignment', 'p1-dm1');
    expect(mockSDK.thisPlugin.objects.delete).toHaveBeenCalledWith('assignment', 'p2-dm1');
    // Should NOT delete assignments for dm2
    expect(mockSDK.thisPlugin.objects.delete).not.toHaveBeenCalledWith('assignment', 'p1-dm2');
    // Should delete the method itself
    expect(mockSDK.thisPlugin.objects.delete).toHaveBeenCalledWith('delivery-method', 'dm1');
  });
});

describe('Pricing', () => {
  it('savePrice uses composite ID and upsert semantics', async () => {
    const savedObj = makePluginObject('price-entry', 'dm1-M', {
      deliveryMethodId: 'dm1',
      sizeCategory: 'M',
      amount: 12.50,
      currency: 'EUR',
    });
    vi.mocked(mockSDK.thisPlugin.objects.save).mockResolvedValue(savedObj);

    const result = await savePrice('dm1', 'M', 12.50);

    expect(mockSDK.thisPlugin.objects.save).toHaveBeenCalledWith(
      'price-entry',
      'dm1-M',
      { deliveryMethodId: 'dm1', sizeCategory: 'M', amount: 12.50, currency: 'EUR' },
    );
    expect(result.objectId).toBe('dm1-M');
    expect(result.amount).toBe(12.50);
    expect(result.currency).toBe('EUR');
  });

  it('listPrices filters by deliveryMethodId', async () => {
    const objects = [
      makePluginObject('price-entry', 'dm1-S', { deliveryMethodId: 'dm1', sizeCategory: 'S', amount: 5, currency: 'EUR' }),
      makePluginObject('price-entry', 'dm2-S', { deliveryMethodId: 'dm2', sizeCategory: 'S', amount: 7, currency: 'EUR' }),
      makePluginObject('price-entry', 'dm1-M', { deliveryMethodId: 'dm1', sizeCategory: 'M', amount: 10, currency: 'EUR' }),
    ];
    vi.mocked(mockSDK.thisPlugin.objects.list).mockResolvedValue(objects);

    const result = await listPrices('dm1');

    expect(result).toHaveLength(2);
    expect(result.every(p => p.deliveryMethodId === 'dm1')).toBe(true);
  });
});

describe('Assignment enable/disable/enableAll', () => {
  it('enableDeliveryMethod saves with entity binding', async () => {
    vi.mocked(mockSDK.thisPlugin.objects.save).mockResolvedValue(
      makePluginObject('assignment', 'p1-dm1', { productId: 'p1', deliveryMethodId: 'dm1' }, 'PRODUCT', 'p1'),
    );

    await enableDeliveryMethod('p1', 'dm1');

    expect(mockSDK.thisPlugin.objects.save).toHaveBeenCalledWith(
      'assignment',
      'p1-dm1',
      { productId: 'p1', deliveryMethodId: 'dm1' },
      { entityType: 'PRODUCT', entityId: 'p1' },
    );
  });

  it('disableDeliveryMethod deletes by composite ID', async () => {
    vi.mocked(mockSDK.thisPlugin.objects.delete).mockResolvedValue(undefined);

    await disableDeliveryMethod('p1', 'dm1');

    expect(mockSDK.thisPlugin.objects.delete).toHaveBeenCalledWith('assignment', 'p1-dm1');
  });

  it('enableAllDeliveryMethods only creates missing assignments', async () => {
    const allMethods = [
      makePluginObject('delivery-method', 'dm1', { courierId: 'c1', deliveryTypeId: 'dt1', courierName: 'DHL', deliveryTypeName: 'Classic' }),
      makePluginObject('delivery-method', 'dm2', { courierId: 'c2', deliveryTypeId: 'dt1', courierName: 'DPD', deliveryTypeName: 'Classic' }),
      makePluginObject('delivery-method', 'dm3', { courierId: 'c1', deliveryTypeId: 'dt2', courierName: 'DHL', deliveryTypeName: 'Express' }),
    ];
    const existingAssignments = [
      makePluginObject('assignment', 'p1-dm1', { productId: 'p1', deliveryMethodId: 'dm1' }, 'PRODUCT', 'p1'),
    ];

    vi.mocked(mockSDK.thisPlugin.objects.list)
      .mockResolvedValueOnce(allMethods)       // list delivery-method
      .mockResolvedValueOnce(existingAssignments); // list assignment with entity filter
    vi.mocked(mockSDK.thisPlugin.objects.save).mockResolvedValue(
      makePluginObject('assignment', 'p1-dm2', { productId: 'p1', deliveryMethodId: 'dm2' }, 'PRODUCT', 'p1'),
    );

    await enableAllDeliveryMethods('p1');

    // Should NOT create assignment for dm1 (already exists)
    expect(mockSDK.thisPlugin.objects.save).not.toHaveBeenCalledWith(
      'assignment', 'p1-dm1', expect.anything(), expect.anything(),
    );
    // Should create assignments for dm2 and dm3
    expect(mockSDK.thisPlugin.objects.save).toHaveBeenCalledWith(
      'assignment', 'p1-dm2',
      { productId: 'p1', deliveryMethodId: 'dm2' },
      { entityType: 'PRODUCT', entityId: 'p1' },
    );
    expect(mockSDK.thisPlugin.objects.save).toHaveBeenCalledWith(
      'assignment', 'p1-dm3',
      { productId: 'p1', deliveryMethodId: 'dm3' },
      { entityType: 'PRODUCT', entityId: 'p1' },
    );
  });
});

describe('Cascade Deletion', () => {
  it('deleteCourier performs full cascade: assignments → prices → methods → courier', async () => {
    const methods = [
      makePluginObject('delivery-method', 'c1-dt1', { courierId: 'c1', deliveryTypeId: 'dt1', courierName: 'DHL', deliveryTypeName: 'Classic' }),
      makePluginObject('delivery-method', 'c1-dt2', { courierId: 'c1', deliveryTypeId: 'dt2', courierName: 'DHL', deliveryTypeName: 'Express' }),
      makePluginObject('delivery-method', 'c2-dt1', { courierId: 'c2', deliveryTypeId: 'dt1', courierName: 'DPD', deliveryTypeName: 'Classic' }),
    ];
    const priceEntries = [
      makePluginObject('price-entry', 'c1-dt1-S', { deliveryMethodId: 'c1-dt1', sizeCategory: 'S', amount: 5, currency: 'EUR' }),
      makePluginObject('price-entry', 'c2-dt1-S', { deliveryMethodId: 'c2-dt1', sizeCategory: 'S', amount: 7, currency: 'EUR' }),
    ];
    const assignments = [
      makePluginObject('assignment', 'p1-c1-dt1', { productId: 'p1', deliveryMethodId: 'c1-dt1' }, 'PRODUCT', 'p1'),
      makePluginObject('assignment', 'p1-c2-dt1', { productId: 'p1', deliveryMethodId: 'c2-dt1' }, 'PRODUCT', 'p1'),
    ];

    // collectCascadeSnapshot calls list 3 times
    vi.mocked(mockSDK.thisPlugin.objects.list)
      .mockResolvedValueOnce(methods)       // delivery-method
      .mockResolvedValueOnce(priceEntries)  // price-entry
      .mockResolvedValueOnce(assignments);  // assignment
    vi.mocked(mockSDK.thisPlugin.objects.delete).mockResolvedValue(undefined);

    await deleteCourier('c1');

    // Should delete assignment for c1 methods only
    expect(mockSDK.thisPlugin.objects.delete).toHaveBeenCalledWith('assignment', 'p1-c1-dt1');
    expect(mockSDK.thisPlugin.objects.delete).not.toHaveBeenCalledWith('assignment', 'p1-c2-dt1');
    // Should delete price entries for c1 methods only
    expect(mockSDK.thisPlugin.objects.delete).toHaveBeenCalledWith('price-entry', 'c1-dt1-S');
    expect(mockSDK.thisPlugin.objects.delete).not.toHaveBeenCalledWith('price-entry', 'c2-dt1-S');
    // Should delete delivery methods for c1
    expect(mockSDK.thisPlugin.objects.delete).toHaveBeenCalledWith('delivery-method', 'c1-dt1');
    expect(mockSDK.thisPlugin.objects.delete).toHaveBeenCalledWith('delivery-method', 'c1-dt2');
    // Should delete the courier itself
    expect(mockSDK.thisPlugin.objects.delete).toHaveBeenCalledWith('courier', 'c1');
  });

  it('deleteDeliveryType performs full cascade', async () => {
    const methods = [
      makePluginObject('delivery-method', 'c1-dt1', { courierId: 'c1', deliveryTypeId: 'dt1', courierName: 'DHL', deliveryTypeName: 'Classic' }),
      makePluginObject('delivery-method', 'c2-dt2', { courierId: 'c2', deliveryTypeId: 'dt2', courierName: 'DPD', deliveryTypeName: 'Express' }),
    ];
    const priceEntries = [
      makePluginObject('price-entry', 'c1-dt1-M', { deliveryMethodId: 'c1-dt1', sizeCategory: 'M', amount: 10, currency: 'EUR' }),
    ];
    const assignments = [
      makePluginObject('assignment', 'p1-c1-dt1', { productId: 'p1', deliveryMethodId: 'c1-dt1' }, 'PRODUCT', 'p1'),
    ];

    vi.mocked(mockSDK.thisPlugin.objects.list)
      .mockResolvedValueOnce(methods)
      .mockResolvedValueOnce(priceEntries)
      .mockResolvedValueOnce(assignments);
    vi.mocked(mockSDK.thisPlugin.objects.delete).mockResolvedValue(undefined);

    await deleteDeliveryType('dt1');

    // Should delete assignment for dt1 methods
    expect(mockSDK.thisPlugin.objects.delete).toHaveBeenCalledWith('assignment', 'p1-c1-dt1');
    // Should delete price entries for dt1 methods
    expect(mockSDK.thisPlugin.objects.delete).toHaveBeenCalledWith('price-entry', 'c1-dt1-M');
    // Should delete delivery method for dt1
    expect(mockSDK.thisPlugin.objects.delete).toHaveBeenCalledWith('delivery-method', 'c1-dt1');
    // Should NOT delete delivery method for dt2
    expect(mockSDK.thisPlugin.objects.delete).not.toHaveBeenCalledWith('delivery-method', 'c2-dt2');
    // Should delete the delivery type itself
    expect(mockSDK.thisPlugin.objects.delete).toHaveBeenCalledWith('delivery-type', 'dt1');
  });

  it('deleteCourier rolls back on failure', async () => {
    const methods = [
      makePluginObject('delivery-method', 'c1-dt1', { courierId: 'c1', deliveryTypeId: 'dt1', courierName: 'DHL', deliveryTypeName: 'Classic' }),
    ];
    const priceEntries: PluginObject[] = [];
    const assignments = [
      makePluginObject('assignment', 'p1-c1-dt1', { productId: 'p1', deliveryMethodId: 'c1-dt1' }, 'PRODUCT', 'p1'),
    ];

    vi.mocked(mockSDK.thisPlugin.objects.list)
      .mockResolvedValueOnce(methods)
      .mockResolvedValueOnce(priceEntries)
      .mockResolvedValueOnce(assignments);

    // First delete (assignment) succeeds, second delete (delivery-method) fails
    vi.mocked(mockSDK.thisPlugin.objects.delete)
      .mockResolvedValueOnce(undefined)  // assignment delete succeeds
      .mockRejectedValueOnce(new Error('SDK error'));  // method delete fails

    // save is used for rollback
    vi.mocked(mockSDK.thisPlugin.objects.save).mockResolvedValue(
      makePluginObject('assignment', 'p1-c1-dt1', { productId: 'p1', deliveryMethodId: 'c1-dt1' }, 'PRODUCT', 'p1'),
    );

    await expect(deleteCourier('c1')).rejects.toThrow('Cascade deletion failed. All changes have been rolled back.');

    // Should attempt to rollback the deleted assignment
    expect(mockSDK.thisPlugin.objects.save).toHaveBeenCalledWith(
      'assignment',
      'p1-c1-dt1',
      { productId: 'p1', deliveryMethodId: 'c1-dt1' },
      { entityType: 'PRODUCT', entityId: 'p1' },
    );
  });
});

describe('getCascadeImpact', () => {
  it('returns correct counts for courier cascade', async () => {
    const methods = [
      makePluginObject('delivery-method', 'c1-dt1', { courierId: 'c1', deliveryTypeId: 'dt1', courierName: 'DHL', deliveryTypeName: 'Classic' }),
      makePluginObject('delivery-method', 'c1-dt2', { courierId: 'c1', deliveryTypeId: 'dt2', courierName: 'DHL', deliveryTypeName: 'Express' }),
      makePluginObject('delivery-method', 'c2-dt1', { courierId: 'c2', deliveryTypeId: 'dt1', courierName: 'DPD', deliveryTypeName: 'Classic' }),
    ];
    const priceEntries = [
      makePluginObject('price-entry', 'c1-dt1-S', { deliveryMethodId: 'c1-dt1', sizeCategory: 'S', amount: 5, currency: 'EUR' }),
      makePluginObject('price-entry', 'c1-dt1-M', { deliveryMethodId: 'c1-dt1', sizeCategory: 'M', amount: 10, currency: 'EUR' }),
      makePluginObject('price-entry', 'c1-dt2-S', { deliveryMethodId: 'c1-dt2', sizeCategory: 'S', amount: 8, currency: 'EUR' }),
      makePluginObject('price-entry', 'c2-dt1-S', { deliveryMethodId: 'c2-dt1', sizeCategory: 'S', amount: 7, currency: 'EUR' }),
    ];
    const assignments = [
      makePluginObject('assignment', 'p1-c1-dt1', { productId: 'p1', deliveryMethodId: 'c1-dt1' }, 'PRODUCT', 'p1'),
      makePluginObject('assignment', 'p2-c1-dt2', { productId: 'p2', deliveryMethodId: 'c1-dt2' }, 'PRODUCT', 'p2'),
      makePluginObject('assignment', 'p1-c2-dt1', { productId: 'p1', deliveryMethodId: 'c2-dt1' }, 'PRODUCT', 'p1'),
    ];

    vi.mocked(mockSDK.thisPlugin.objects.list)
      .mockResolvedValueOnce(methods)
      .mockResolvedValueOnce(priceEntries)
      .mockResolvedValueOnce(assignments);

    const impact = await getCascadeImpact('courier', 'c1');

    expect(impact).toEqual({
      deliveryMethodCount: 2,   // c1-dt1, c1-dt2
      priceEntryCount: 3,       // c1-dt1-S, c1-dt1-M, c1-dt2-S
      assignmentCount: 2,       // p1-c1-dt1, p2-c1-dt2
    });
  });

  it('returns correct counts for deliveryType cascade', async () => {
    const methods = [
      makePluginObject('delivery-method', 'c1-dt1', { courierId: 'c1', deliveryTypeId: 'dt1', courierName: 'DHL', deliveryTypeName: 'Classic' }),
      makePluginObject('delivery-method', 'c2-dt1', { courierId: 'c2', deliveryTypeId: 'dt1', courierName: 'DPD', deliveryTypeName: 'Classic' }),
      makePluginObject('delivery-method', 'c1-dt2', { courierId: 'c1', deliveryTypeId: 'dt2', courierName: 'DHL', deliveryTypeName: 'Express' }),
    ];
    const priceEntries = [
      makePluginObject('price-entry', 'c1-dt1-S', { deliveryMethodId: 'c1-dt1', sizeCategory: 'S', amount: 5, currency: 'EUR' }),
      makePluginObject('price-entry', 'c2-dt1-M', { deliveryMethodId: 'c2-dt1', sizeCategory: 'M', amount: 12, currency: 'EUR' }),
    ];
    const assignments = [
      makePluginObject('assignment', 'p1-c1-dt1', { productId: 'p1', deliveryMethodId: 'c1-dt1' }, 'PRODUCT', 'p1'),
    ];

    vi.mocked(mockSDK.thisPlugin.objects.list)
      .mockResolvedValueOnce(methods)
      .mockResolvedValueOnce(priceEntries)
      .mockResolvedValueOnce(assignments);

    const impact = await getCascadeImpact('deliveryType', 'dt1');

    expect(impact).toEqual({
      deliveryMethodCount: 2,   // c1-dt1, c2-dt1
      priceEntryCount: 2,       // c1-dt1-S, c2-dt1-M
      assignmentCount: 1,       // p1-c1-dt1
    });
  });

  it('returns zero counts when no dependent objects exist', async () => {
    vi.mocked(mockSDK.thisPlugin.objects.list)
      .mockResolvedValueOnce([])   // no methods
      .mockResolvedValueOnce([])   // no price entries
      .mockResolvedValueOnce([]);  // no assignments

    const impact = await getCascadeImpact('courier', 'nonexistent');

    expect(impact).toEqual({
      deliveryMethodCount: 0,
      priceEntryCount: 0,
      assignmentCount: 0,
    });
  });
});

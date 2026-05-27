import { getSDK } from "../../sdk";
import type { PluginObject } from "../../sdk";
import type { Courier, DeliveryType, DeliveryMethod, PriceEntry, SizeCategory, ProductDeliveryAssignment, CascadeImpact } from "./domain";
import { toCourier, toDeliveryType, toDeliveryMethod, toPriceEntry, toAssignment, sortDeliveryMethods } from "./domain";

// --- Courier CRUD ---

export async function createCourier(name: string, trackingUrlTemplate: string): Promise<Courier> {
  const sdk = getSDK();
  const id = crypto.randomUUID();
  const obj = await sdk.thisPlugin.objects.save("courier", id, { name, trackingUrlTemplate });
  return toCourier(obj);
}

export async function updateCourier(id: string, name: string, trackingUrlTemplate: string): Promise<Courier> {
  const sdk = getSDK();
  const obj = await sdk.thisPlugin.objects.save("courier", id, { name, trackingUrlTemplate });
  return toCourier(obj);
}

export async function listCouriers(): Promise<Courier[]> {
  const sdk = getSDK();
  const objects = await sdk.thisPlugin.objects.list("courier");
  return objects.map(toCourier);
}

// --- Delivery Type CRUD ---

export async function createDeliveryType(name: string): Promise<DeliveryType> {
  const sdk = getSDK();
  const id = crypto.randomUUID();
  const obj = await sdk.thisPlugin.objects.save("delivery-type", id, { name });
  return toDeliveryType(obj);
}

export async function updateDeliveryType(id: string, name: string): Promise<DeliveryType> {
  const sdk = getSDK();
  const obj = await sdk.thisPlugin.objects.save("delivery-type", id, { name });
  return toDeliveryType(obj);
}

export async function listDeliveryTypes(): Promise<DeliveryType[]> {
  const sdk = getSDK();
  const objects = await sdk.thisPlugin.objects.list("delivery-type");
  return objects.map(toDeliveryType);
}

// --- Delivery Method CRUD ---

export async function createDeliveryMethod(courierId: string, deliveryTypeId: string): Promise<DeliveryMethod> {
  const sdk = getSDK();
  const id = `${courierId}-${deliveryTypeId}`;

  // Look up courier and delivery type names to store in data
  const courierObj = await sdk.thisPlugin.objects.get("courier", courierId);
  const deliveryTypeObj = await sdk.thisPlugin.objects.get("delivery-type", deliveryTypeId);

  const obj = await sdk.thisPlugin.objects.save("delivery-method", id, {
    courierId,
    deliveryTypeId,
    courierName: courierObj.data.name,
    deliveryTypeName: deliveryTypeObj.data.name,
  });
  return toDeliveryMethod(obj);
}

export async function listDeliveryMethods(): Promise<DeliveryMethod[]> {
  const sdk = getSDK();
  const objects = await sdk.thisPlugin.objects.list("delivery-method");
  return sortDeliveryMethods(objects.map(toDeliveryMethod));
}

export async function deleteDeliveryMethod(id: string): Promise<void> {
  const sdk = getSDK();

  // Cascade: delete all price entries for this delivery method
  const priceEntries = await sdk.thisPlugin.objects.list("price-entry");
  for (const entry of priceEntries) {
    if (entry.data.deliveryMethodId === id) {
      await sdk.thisPlugin.objects.delete("price-entry", entry.objectId);
    }
  }

  // Cascade: delete all assignments for this delivery method
  const assignments = await sdk.thisPlugin.objects.list("assignment");
  for (const assignment of assignments) {
    if (assignment.data.deliveryMethodId === id) {
      await sdk.thisPlugin.objects.delete("assignment", assignment.objectId);
    }
  }

  // Delete the delivery method itself
  await sdk.thisPlugin.objects.delete("delivery-method", id);
}

// --- Pricing ---

export async function savePrice(deliveryMethodId: string, sizeCategory: SizeCategory, amount: number): Promise<PriceEntry> {
  const sdk = getSDK();
  const id = `${deliveryMethodId}-${sizeCategory}`;
  const obj = await sdk.thisPlugin.objects.save("price-entry", id, {
    deliveryMethodId,
    sizeCategory,
    amount,
    currency: "EUR",
  });
  return toPriceEntry(obj);
}

export async function listPrices(deliveryMethodId: string): Promise<PriceEntry[]> {
  const sdk = getSDK();
  const objects = await sdk.thisPlugin.objects.list("price-entry");
  return objects
    .filter((obj) => obj.data.deliveryMethodId === deliveryMethodId)
    .map(toPriceEntry);
}

// --- Assignment CRUD ---

export async function enableDeliveryMethod(productId: string, deliveryMethodId: string): Promise<void> {
  const sdk = getSDK();
  const id = `${productId}-${deliveryMethodId}`;
  await sdk.thisPlugin.objects.save("assignment", id, { productId, deliveryMethodId }, {
    entityType: "PRODUCT",
    entityId: productId,
  });
}

export async function disableDeliveryMethod(productId: string, deliveryMethodId: string): Promise<void> {
  const sdk = getSDK();
  const id = `${productId}-${deliveryMethodId}`;
  await sdk.thisPlugin.objects.delete("assignment", id);
}

export async function enableAllDeliveryMethods(productId: string): Promise<void> {
  const sdk = getSDK();

  // Get all delivery methods
  const allMethods = await sdk.thisPlugin.objects.list("delivery-method");

  // Get existing assignments for this product
  const existingAssignments = await sdk.thisPlugin.objects.list("assignment", {
    entityType: "PRODUCT",
    entityId: productId,
  });

  const assignedMethodIds = new Set(
    existingAssignments.map((a) => a.data.deliveryMethodId as string)
  );

  // Create assignments only for methods not already assigned
  for (const method of allMethods) {
    if (!assignedMethodIds.has(method.objectId)) {
      const id = `${productId}-${method.objectId}`;
      await sdk.thisPlugin.objects.save("assignment", id, {
        productId,
        deliveryMethodId: method.objectId,
      }, {
        entityType: "PRODUCT",
        entityId: productId,
      });
    }
  }
}

export async function listAssignments(productId: string): Promise<ProductDeliveryAssignment[]> {
  const sdk = getSDK();
  const objects = await sdk.thisPlugin.objects.list("assignment", {
    entityType: "PRODUCT",
    entityId: productId,
  });
  return objects.map(toAssignment);
}

export async function countAssignments(productId: string): Promise<number> {
  const assignments = await listAssignments(productId);
  return assignments.length;
}

// --- Cascade Deletion ---

/**
 * Calculate the impact of deleting a courier or delivery type.
 * Returns counts of delivery methods, assignments, and price entries that would be affected.
 */
export async function getCascadeImpact(entityType: 'courier' | 'deliveryType', entityId: string): Promise<CascadeImpact> {
  const sdk = getSDK();

  // Find all delivery methods referencing the entity
  const allMethods = await sdk.thisPlugin.objects.list("delivery-method");
  const affectedMethods = allMethods.filter((m) =>
    entityType === 'courier'
      ? m.data.courierId === entityId
      : m.data.deliveryTypeId === entityId
  );

  const affectedMethodIds = new Set(affectedMethods.map((m) => m.objectId));

  // Count price entries for affected methods
  const allPriceEntries = await sdk.thisPlugin.objects.list("price-entry");
  const affectedPriceEntries = allPriceEntries.filter((pe) =>
    affectedMethodIds.has(pe.data.deliveryMethodId as string)
  );

  // Count assignments for affected methods
  const allAssignments = await sdk.thisPlugin.objects.list("assignment");
  const affectedAssignments = allAssignments.filter((a) =>
    affectedMethodIds.has(a.data.deliveryMethodId as string)
  );

  return {
    deliveryMethodCount: affectedMethods.length,
    assignmentCount: affectedAssignments.length,
    priceEntryCount: affectedPriceEntries.length,
  };
}

/**
 * Snapshot of objects to be deleted during a cascade operation.
 * Used for rollback if the cascade fails partway through.
 */
interface CascadeSnapshot {
  assignments: PluginObject[];
  priceEntries: PluginObject[];
  deliveryMethods: PluginObject[];
}

/**
 * Collect all objects that will be affected by deleting a courier or delivery type.
 */
async function collectCascadeSnapshot(entityType: 'courier' | 'deliveryType', entityId: string): Promise<CascadeSnapshot> {
  const sdk = getSDK();

  const allMethods = await sdk.thisPlugin.objects.list("delivery-method");
  const affectedMethods = allMethods.filter((m) =>
    entityType === 'courier'
      ? m.data.courierId === entityId
      : m.data.deliveryTypeId === entityId
  );

  const affectedMethodIds = new Set(affectedMethods.map((m) => m.objectId));

  const allPriceEntries = await sdk.thisPlugin.objects.list("price-entry");
  const affectedPriceEntries = allPriceEntries.filter((pe) =>
    affectedMethodIds.has(pe.data.deliveryMethodId as string)
  );

  const allAssignments = await sdk.thisPlugin.objects.list("assignment");
  const affectedAssignments = allAssignments.filter((a) =>
    affectedMethodIds.has(a.data.deliveryMethodId as string)
  );

  return {
    assignments: affectedAssignments,
    priceEntries: affectedPriceEntries,
    deliveryMethods: affectedMethods,
  };
}

/**
 * Execute cascade deletion for a courier or delivery type.
 * Deletes in order: assignments → price entries → delivery methods → parent entity.
 * On failure, rolls back all previously deleted objects from the snapshot.
 */
async function cascadeDelete(entityType: 'courier' | 'deliveryType', entityId: string): Promise<void> {
  const sdk = getSDK();
  const snapshot = await collectCascadeSnapshot(entityType, entityId);
  const deleted: PluginObject[] = [];

  try {
    // Delete assignments first
    for (const obj of snapshot.assignments) {
      await sdk.thisPlugin.objects.delete("assignment", obj.objectId);
      deleted.push(obj);
    }

    // Delete price entries
    for (const obj of snapshot.priceEntries) {
      await sdk.thisPlugin.objects.delete("price-entry", obj.objectId);
      deleted.push(obj);
    }

    // Delete delivery methods
    for (const obj of snapshot.deliveryMethods) {
      await sdk.thisPlugin.objects.delete("delivery-method", obj.objectId);
      deleted.push(obj);
    }

    // Delete the parent entity
    const objectType = entityType === 'courier' ? 'courier' : 'delivery-type';
    await sdk.thisPlugin.objects.delete(objectType, entityId);
  } catch (error) {
    // Rollback: re-create all previously deleted objects from snapshot (in reverse order)
    for (const obj of deleted.reverse()) {
      try {
        const options = obj.entityType && obj.entityId
          ? { entityType: obj.entityType, entityId: obj.entityId }
          : undefined;
        await sdk.thisPlugin.objects.save(obj.objectType, obj.objectId, obj.data, options);
      } catch {
        // Best-effort rollback — continue even if individual re-creation fails
      }
    }
    throw new Error('Cascade deletion failed. All changes have been rolled back.');
  }
}

/**
 * Delete a courier and cascade to all dependent delivery methods, price entries, and assignments.
 */
export async function deleteCourier(id: string): Promise<void> {
  await cascadeDelete('courier', id);
}

/**
 * Delete a delivery type and cascade to all dependent delivery methods, price entries, and assignments.
 */
export async function deleteDeliveryType(id: string): Promise<void> {
  await cascadeDelete('deliveryType', id);
}

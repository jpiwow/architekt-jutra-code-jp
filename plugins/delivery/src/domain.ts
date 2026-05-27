import type { PluginObject } from "../../sdk";

// Re-export PluginObject for convenience in other modules
export type { PluginObject };

// --- Domain Types ---

export type SizeCategory = 'S' | 'M' | 'L' | 'XL';

export interface Courier {
  objectId: string;
  name: string;
  trackingUrlTemplate: string;
}

export interface DeliveryType {
  objectId: string;
  name: string;
}

export interface DeliveryMethod {
  objectId: string;
  courierId: string;
  deliveryTypeId: string;
  courierName: string;
  deliveryTypeName: string;
}

export interface PriceEntry {
  objectId: string;
  deliveryMethodId: string;
  sizeCategory: SizeCategory;
  amount: number;
  currency: string;
}

export interface ProductDeliveryAssignment {
  objectId: string;
  productId: string;
  deliveryMethodId: string;
}

export interface CascadeImpact {
  deliveryMethodCount: number;
  assignmentCount: number;
  priceEntryCount: number;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// --- Validators ---

export function validateCourierName(name: string): ValidationResult {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Courier name is required' };
  }
  if (name.length > 100) {
    return { valid: false, error: 'Courier name must not exceed 100 characters' };
  }
  return { valid: true };
}

export function validateTrackingUrlTemplate(template: string): ValidationResult {
  if (!template || template.trim().length === 0) {
    return { valid: false, error: 'Tracking URL template is required' };
  }
  if (template.length > 500) {
    return { valid: false, error: 'Tracking URL template must not exceed 500 characters' };
  }
  if (!template.includes('{trackingNumber}')) {
    return { valid: false, error: 'Tracking URL template must contain {trackingNumber} placeholder' };
  }
  return { valid: true };
}

export function validateDeliveryTypeName(name: string): ValidationResult {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Delivery type name is required' };
  }
  if (name.length > 100) {
    return { valid: false, error: 'Delivery type name must not exceed 100 characters' };
  }
  return { valid: true };
}

export function validatePrice(amount: number): ValidationResult {
  if (amount < 0) {
    return { valid: false, error: 'Price must not be negative' };
  }
  if (amount > 999_999.99) {
    return { valid: false, error: 'Price must not exceed 999,999.99' };
  }
  // Check for more than 2 decimal places
  const decimalStr = String(amount);
  const dotIndex = decimalStr.indexOf('.');
  if (dotIndex !== -1) {
    const decimalPlaces = decimalStr.length - dotIndex - 1;
    if (decimalPlaces > 2) {
      return { valid: false, error: 'Price must have at most 2 decimal places' };
    }
  }
  return { valid: true };
}

export function isNameDuplicate(name: string, existingNames: string[], _excludeId?: string): boolean {
  const normalizedName = name.toLowerCase().trim();
  return existingNames.some(existing => existing.toLowerCase().trim() === normalizedName);
}

// --- Mappers ---

export function toCourier(obj: PluginObject): Courier {
  return {
    objectId: obj.objectId,
    name: obj.data.name as string,
    trackingUrlTemplate: obj.data.trackingUrlTemplate as string,
  };
}

export function toDeliveryType(obj: PluginObject): DeliveryType {
  return {
    objectId: obj.objectId,
    name: obj.data.name as string,
  };
}

export function toDeliveryMethod(obj: PluginObject): DeliveryMethod {
  return {
    objectId: obj.objectId,
    courierId: obj.data.courierId as string,
    deliveryTypeId: obj.data.deliveryTypeId as string,
    courierName: obj.data.courierName as string,
    deliveryTypeName: obj.data.deliveryTypeName as string,
  };
}

export function toPriceEntry(obj: PluginObject): PriceEntry {
  return {
    objectId: obj.objectId,
    deliveryMethodId: obj.data.deliveryMethodId as string,
    sizeCategory: obj.data.sizeCategory as SizeCategory,
    amount: obj.data.amount as number,
    currency: obj.data.currency as string,
  };
}

export function toAssignment(obj: PluginObject): ProductDeliveryAssignment {
  return {
    objectId: obj.objectId,
    productId: obj.data.productId as string,
    deliveryMethodId: obj.data.deliveryMethodId as string,
  };
}

// --- Sorting ---

/**
 * Sorts delivery methods alphabetically by courier name first,
 * then by delivery type name within the same courier.
 */
export function sortDeliveryMethods(methods: DeliveryMethod[]): DeliveryMethod[] {
  return [...methods].sort((a, b) => {
    const courierCompare = a.courierName.localeCompare(b.courierName);
    if (courierCompare !== 0) return courierCompare;
    return a.deliveryTypeName.localeCompare(b.deliveryTypeName);
  });
}



# Implementation Plan: Delivery Plugin

## Overview

Implement the Delivery Plugin as a standalone Vite/React frontend plugin (port 3010) following the established plugin architecture pattern. The plugin manages couriers, delivery types, delivery methods (courier × type compositions), per-size-category pricing, and per-product delivery method assignments. All data is persisted via the Plugin SDK's `thisPlugin.objects` API with client-side cascade deletion logic.

## Tasks

- [ ] 1. Set up plugin project structure and configuration
  - [ ] 1.1 Create plugin scaffold with Vite, React, and TypeScript configuration
    - Create `plugins/delivery/` directory with `package.json`, `vite.config.ts` (port 3010), `tsconfig.json`, and `index.html`
    - Follow the same structure as the warehouse plugin (`plugins/warehouse/`)
    - Include `react`, `react-dom`, `react-router-dom` as dependencies
    - Include `vitest`, `fast-check`, `@testing-library/react`, `@testing-library/jest-dom` as dev dependencies
    - _Requirements: 7.1, 7.6_

  - [ ] 1.2 Create manifest.json with extension points
    - Register `menu.main` extension point (label: "Delivery", path: `/`)
    - Register `product.detail.tabs` extension point (label: "Delivery", path: `/product-delivery`)
    - Register `product.detail.info` extension point (path: `/product-delivery-badge`)
    - _Requirements: 7.2, 7.3, 7.4_

  - [ ] 1.3 Create main.tsx with router setup
    - Set up `BrowserRouter` with three routes: `/` → DeliveryPage, `/product-delivery` → ProductDeliveryTab, `/product-delivery-badge` → ProductDeliveryBadge
    - Follow the same pattern as `plugins/warehouse/src/main.tsx`
    - _Requirements: 7.2, 7.3, 7.4_

- [ ] 2. Implement domain layer (types, validators, mappers)
  - [ ] 2.1 Create domain types and interfaces in `src/domain.ts`
    - Define `Courier`, `DeliveryType`, `DeliveryMethod`, `PriceEntry`, `ProductDeliveryAssignment`, `SizeCategory`, `CascadeImpact`, `ValidationResult` interfaces
    - Define `SizeCategory` type as `'S' | 'M' | 'L' | 'XL'`
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1_

  - [ ] 2.2 Implement mapper functions in `src/domain.ts`
    - Implement `toCourier`, `toDeliveryType`, `toDeliveryMethod`, `toPriceEntry`, `toAssignment` mappers from `PluginObject` to domain types
    - Follow the same pattern as `plugins/warehouse/src/domain.ts`
    - _Requirements: 7.5_

  - [ ] 2.3 Implement validation functions in `src/domain.ts`
    - Implement `validateCourierName(name)`: non-empty, ≥1 non-whitespace char, ≤100 chars
    - Implement `validateTrackingUrlTemplate(template)`: non-empty, ≤500 chars, must contain `{trackingNumber}`
    - Implement `validateDeliveryTypeName(name)`: non-empty, ≥1 non-whitespace char, ≤100 chars
    - Implement `validatePrice(amount)`: ≥0.00, ≤999,999.99, max 2 decimal places
    - Implement `isNameDuplicate(name, existingNames, excludeId?)`: case-insensitive comparison
    - _Requirements: 1.4, 1.7, 1.8, 1.9, 2.3, 2.5, 2.7, 4.5_

  - [ ] 2.4 Implement sorting function in `src/domain.ts`
    - Implement `sortDeliveryMethods(methods)`: sort alphabetically by courier name, then by delivery type name
    - _Requirements: 3.4_

  - [ ]* 2.5 Write property tests for name validation (Properties 3, 4)
    - **Property 3: Case-Insensitive Name Uniqueness** — for any existing name and case-variant, `isNameDuplicate` returns true
    - **Property 4: Name Validation Rejects Invalid Input** — for any empty/whitespace-only/over-100-char string, validation rejects
    - **Validates: Requirements 1.4, 1.7, 2.3, 2.5, 2.7, 2.8**

  - [ ]* 2.6 Write property tests for tracking URL and price validation (Properties 5, 10)
    - **Property 5: Tracking URL Template Placeholder Validation** — for any string without `{trackingNumber}`, validation rejects
    - **Property 10: Price Validation Rejects Invalid Values** — for any negative, >2 decimal places, or >999,999.99 value, validation rejects
    - **Validates: Requirements 1.8, 4.5**

  - [ ]* 2.7 Write property test for delivery method sort order (Property 8)
    - **Property 8: Delivery Methods Sort Order** — for any set of delivery methods, result is sorted by courier name then delivery type name
    - **Validates: Requirements 3.4**

- [ ] 3. Implement service layer (SDK interactions and cascade logic)
  - [ ] 3.1 Create service layer in `src/services.ts` — Courier CRUD
    - Implement `createCourier(name, trackingUrlTemplate)`: generate UUID, save via SDK
    - Implement `updateCourier(id, name, trackingUrlTemplate)`: save via SDK with existing ID
    - Implement `listCouriers()`: list objects of type `courier`, map with `toCourier`
    - _Requirements: 1.1, 1.3, 1.6_

  - [ ] 3.2 Implement Delivery Type CRUD in `src/services.ts`
    - Implement `createDeliveryType(name)`: generate UUID, save via SDK
    - Implement `updateDeliveryType(id, name)`: save via SDK with existing ID
    - Implement `listDeliveryTypes()`: list objects of type `delivery-type`, map with `toDeliveryType`
    - _Requirements: 2.1, 2.2, 2.6_

  - [ ] 3.3 Implement Delivery Method CRUD in `src/services.ts`
    - Implement `createDeliveryMethod(courierId, deliveryTypeId)`: use composite ID `{courierId}-{deliveryTypeId}`, store courier/type names in data
    - Implement `listDeliveryMethods()`: list objects of type `delivery-method`, map and sort
    - Implement `deleteDeliveryMethod(id)`: delete with cascade to price entries and assignments
    - _Requirements: 3.1, 3.4, 3.5_

  - [ ] 3.4 Implement Pricing service functions in `src/services.ts`
    - Implement `savePrice(deliveryMethodId, sizeCategory, amount)`: use composite ID `{deliveryMethodId}-{sizeCategory}`, upsert semantics, currency defaults to EUR
    - Implement `listPrices(deliveryMethodId)`: list objects of type `price-entry`, filter by deliveryMethodId
    - _Requirements: 4.3, 4.4, 4.7_

  - [ ] 3.5 Implement Assignment service functions in `src/services.ts`
    - Implement `enableDeliveryMethod(productId, deliveryMethodId)`: use composite ID `{productId}-{deliveryMethodId}`, bind to PRODUCT entity
    - Implement `disableDeliveryMethod(productId, deliveryMethodId)`: delete assignment object
    - Implement `enableAllDeliveryMethods(productId)`: create assignments for all methods not already assigned
    - Implement `listAssignments(productId)`: list assignments filtered by entity binding
    - Implement `countAssignments(productId)`: return count of assignments for product
    - _Requirements: 5.2, 5.3, 5.4, 5.5_

  - [ ] 3.6 Implement cascade deletion logic in `src/services.ts`
    - Implement `deleteCourier(id)`: cascade delete delivery methods → price entries + assignments → courier
    - Implement `deleteDeliveryType(id)`: cascade delete delivery methods → price entries + assignments → delivery type
    - Implement `getCascadeImpact(entityType, entityId)`: calculate counts of affected delivery methods, assignments, and price entries
    - Implement snapshot-based rollback on cascade failure (re-create deleted objects from snapshot)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.7_

  - [ ]* 3.7 Write unit tests for service layer with mocked SDK
    - Test CRUD operations for couriers, delivery types, delivery methods
    - Test cascade deletion flow and rollback on failure
    - Test assignment enable/disable/enableAll
    - _Requirements: 7.5, 7.7, 8.7_

- [ ] 4. Checkpoint - Ensure domain and service layers compile and tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement DeliveryPage (main management UI)
  - [ ] 5.1 Implement Couriers section in `src/pages/DeliveryPage.tsx`
    - Display list of couriers with name and tracking URL template
    - Add form for creating new couriers with validation (inline errors)
    - Add edit functionality with validation (inline errors, duplicate check)
    - Add delete button with cascade confirmation dialog showing impact counts
    - Display empty state when no couriers exist
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9_

  - [ ] 5.2 Implement Delivery Types section in `src/pages/DeliveryPage.tsx`
    - Display list of delivery types with names
    - Add form for creating new delivery types with validation
    - Add edit functionality with duplicate name check (case-insensitive)
    - Add delete button with cascade confirmation dialog
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [ ] 5.3 Implement Delivery Methods section in `src/pages/DeliveryPage.tsx`
    - Display list of delivery methods showing courier name + delivery type name, sorted alphabetically
    - Add composition form with courier and delivery type dropdowns
    - Validate both fields required and combination uniqueness
    - Add delete button with cascade confirmation
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ] 5.4 Implement Pricing panel in `src/pages/DeliveryPage.tsx`
    - Show inline pricing panel when a delivery method is selected
    - Display price input for each size category (S, M, L, XL)
    - Show "Not configured" for empty price entries
    - Validate price input (≥0.00, ≤999,999.99, max 2 decimal places)
    - Save prices with upsert semantics, default currency EUR
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ] 5.5 Implement error handling and form state preservation in DeliveryPage
    - Wrap all SDK calls in try/catch, display errors using `tc-error` class
    - Preserve user-entered form data on SDK failure (do not clear inputs)
    - Use host UI stylesheet (`plugin-ui.css`) for consistent styling
    - _Requirements: 7.6, 7.7_

- [ ] 6. Implement ProductDeliveryTab (per-product assignment)
  - [ ] 6.1 Implement `src/pages/ProductDeliveryTab.tsx`
    - Read `productId` from SDK context (`thisPlugin.productId`)
    - Display all delivery methods with toggle switches (enabled/disabled per product)
    - Implement toggle to enable/disable individual delivery method assignments
    - Implement "Enable All" bulk action button
    - Display empty state when no delivery methods exist in the system
    - Show all methods as disabled when product has no assignments
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 6.2 Write unit tests for ProductDeliveryTab
    - Test toggle enable/disable behavior
    - Test "Enable All" with mixed existing/new assignments
    - Test empty state display
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_

- [ ] 7. Implement ProductDeliveryBadge (info badge)
  - [ ] 7.1 Implement `src/pages/ProductDeliveryBadge.tsx`
    - Read `productId` from SDK context
    - Display count of enabled delivery methods using `countAssignments`
    - Use `tc-badge--success` style when count > 0 (e.g., "3 delivery methods")
    - Use `tc-badge--danger` style when count === 0 ("No delivery methods")
    - Display neutral style on SDK error ("Delivery info unavailable")
    - Keep badge compact (~60px height)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 7.2 Write unit tests for ProductDeliveryBadge
    - Test badge displays correct count
    - Test danger style for zero methods
    - Test success style for non-zero methods
    - Test error state display
    - _Requirements: 6.1, 6.2, 6.3, 6.5_

- [ ] 8. Checkpoint - Ensure all components render and tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Property-based tests for round-trip and cascade properties
  - [ ]* 9.1 Write property tests for CRUD round-trips (Properties 1, 2, 6)
    - **Property 1: Courier CRUD Round-Trip** — create courier with valid name/template, list includes it
    - **Property 2: Delivery Type CRUD Round-Trip** — create delivery type with valid name, list includes it
    - **Property 6: Delivery Method Composition Round-Trip** — create method with valid courier+type IDs, list includes it
    - **Validates: Requirements 1.3, 1.6, 2.2, 2.6, 3.1**

  - [ ]* 9.2 Write property test for duplicate method rejection (Property 7)
    - **Property 7: Delivery Method Duplicate Combination Rejection** — creating same courier+type pair twice is rejected
    - **Validates: Requirements 3.2**

  - [ ]* 9.3 Write property tests for price and assignment round-trips (Properties 9, 11, 12)
    - **Property 9: Price Entry Upsert Round-Trip** — save price, retrieve matches; save again overwrites
    - **Property 11: Assignment Toggle Round-Trip** — enable then list includes; disable then list excludes
    - **Property 12: Enable All Idempotence** — enable all twice produces same state
    - **Validates: Requirements 4.3, 4.7, 5.2, 5.3, 5.4**

  - [ ]* 9.4 Write property tests for cascade and badge (Properties 13, 14, 15, 16)
    - **Property 13: Cascade Deletion Integrity** — after cascade, no orphaned methods/prices/assignments
    - **Property 14: Cascade Confirmation Count Accuracy** — impact counts match actual dependent objects
    - **Property 15: Cancel Abort Preserves State** — cancel leaves all records unchanged
    - **Property 16: Badge Count Accuracy** — badge count equals number of assignments
    - **Validates: Requirements 5.7, 5.8, 6.1, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6**

- [ ] 10. Final checkpoint - Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The plugin uses TypeScript with Vite/React, following the same patterns as `plugins/warehouse/`
- All data persistence uses `thisPlugin.objects` API — no backend changes needed
- fast-check is used for property-based testing, Vitest for unit/component tests

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.4"] },
    { "id": 4, "tasks": ["2.5", "2.6", "2.7"] },
    { "id": 5, "tasks": ["3.1", "3.2"] },
    { "id": 6, "tasks": ["3.3", "3.4", "3.5"] },
    { "id": 7, "tasks": ["3.6"] },
    { "id": 8, "tasks": ["3.7"] },
    { "id": 9, "tasks": ["5.1", "5.2", "5.3"] },
    { "id": 10, "tasks": ["5.4", "5.5"] },
    { "id": 11, "tasks": ["6.1", "7.1"] },
    { "id": 12, "tasks": ["6.2", "7.2"] },
    { "id": 13, "tasks": ["9.1", "9.2", "9.3", "9.4"] }
  ]
}
```

# Requirements Document

## Introduction

The Delivery Plugin is a new plugin for the microkernel e-commerce platform that enables administrators to manage delivery options for products. It provides courier management, delivery type configuration, and per-product delivery method assignment with the ability to restrict certain delivery methods for products that are incompatible (e.g., oversized items that cannot go to parcel lockers). The plugin also manages pricing per delivery method based on package size categories. The plugin follows the established plugin architecture pattern — a standalone Vite/React frontend running on port 3010, communicating with the host application via the Plugin SDK.

## Glossary

- **Delivery_Plugin**: The plugin application responsible for managing couriers, delivery types, delivery methods, pricing, and product-delivery assignments
- **Courier**: A shipping carrier entity (e.g., DHL, DPD, InPost, EVRi, FedEx) that physically transports packages. Has a name and a tracking URL template.
- **Delivery_Type**: A category of delivery method (e.g., "Classic Courier", "Parcel Locker") that defines how a package reaches the customer
- **Delivery_Method**: A specific combination of a Courier and a Delivery_Type (e.g., "InPost — Parcel Locker", "DHL — Classic Courier") with associated pricing per size category
- **Size_Category**: A predefined package size classification (S, M, L, XL) used to determine delivery pricing
- **Price_Entry**: A price value in a specified currency assigned to a specific Size_Category within a Delivery_Method
- **Product_Delivery_Assignment**: A record that links a Product to a Delivery_Method, indicating that the Delivery_Method is enabled for that Product
- **Admin**: A user with permissions to manage delivery configuration through the plugin interface
- **Host_Application**: The core microkernel platform running on port 8080 that manages products and plugin lifecycle
- **Tracking_URL_Template**: A URL pattern for a Courier that contains a placeholder for the tracking number (e.g., "https://www.dhl.com/track?id={trackingNumber}")

## Requirements

### Requirement 1: Courier Management

**User Story:** As an Admin, I want to manage a list of couriers with their tracking URL templates, so that I can define which shipping carriers are available in the system.

#### Acceptance Criteria

1. WHEN the Admin navigates to the Delivery_Plugin main page, THE Delivery_Plugin SHALL display a list of all configured Couriers with their names and Tracking_URL_Templates
2. WHEN no Couriers are configured, THE Delivery_Plugin SHALL display an empty state message indicating no couriers have been added
3. WHEN the Admin submits a new Courier with a name and Tracking_URL_Template, THE Delivery_Plugin SHALL create the Courier and display it in the list
4. IF the Admin submits a Courier name that already exists (case-insensitive comparison), THEN THE Delivery_Plugin SHALL reject the submission and display a validation error indicating the name is duplicated
5. WHEN the Admin requests to delete a Courier, THE Delivery_Plugin SHALL remove the Courier from the system
6. WHEN the Admin requests to edit a Courier, THE Delivery_Plugin SHALL update the Courier with the new name and Tracking_URL_Template
7. IF the Admin submits a Courier name that is empty or contains only whitespace, THEN THE Delivery_Plugin SHALL reject the submission and display a validation error indicating the name is required
8. IF the Admin submits a Tracking_URL_Template that does not contain the placeholder "{trackingNumber}", THEN THE Delivery_Plugin SHALL reject the submission and display a validation error indicating the placeholder is required
9. THE Delivery_Plugin SHALL enforce a maximum length of 100 characters for Courier names and 500 characters for Tracking_URL_Templates

### Requirement 2: Delivery Type Management

**User Story:** As an Admin, I want to manage types of delivery, so that I can define the different ways packages can reach customers.

#### Acceptance Criteria

1. WHEN the Admin navigates to the Delivery_Plugin main page, THE Delivery_Plugin SHALL display a list of all configured Delivery_Types with their names
2. WHEN the Admin submits a new Delivery_Type name, THE Delivery_Plugin SHALL create the Delivery_Type and display it in the list
3. WHEN the Admin submits a Delivery_Type name that already exists (compared case-insensitively), THE Delivery_Plugin SHALL reject the creation and display a validation error indicating the name is duplicated
4. WHEN the Admin requests to delete a Delivery_Type, THE Delivery_Plugin SHALL remove the Delivery_Type from the system
5. WHEN the Admin requests to edit a Delivery_Type name to a name that already exists (compared case-insensitively), THE Delivery_Plugin SHALL reject the update and display a validation error indicating the name is duplicated
6. WHEN the Admin requests to edit a Delivery_Type name to a valid unique name, THE Delivery_Plugin SHALL update the Delivery_Type with the new name
7. THE Delivery_Plugin SHALL validate that a Delivery_Type name is non-empty, contains at least one non-whitespace character, and does not exceed 100 characters before persisting it
8. IF the Delivery_Type name fails validation, THEN THE Delivery_Plugin SHALL reject the operation and display a validation error indicating the reason for failure

### Requirement 3: Delivery Method Composition

**User Story:** As an Admin, I want to combine couriers with delivery types to form delivery methods, so that I can define the specific delivery options available in the system.

#### Acceptance Criteria

1. WHEN the Admin selects a Courier and a Delivery_Type and confirms the combination, THE Delivery_Plugin SHALL create a Delivery_Method linking the selected Courier and Delivery_Type and display it in the delivery methods list
2. IF the Admin attempts to create a Delivery_Method with a Courier and Delivery_Type combination that already exists, THEN THE Delivery_Plugin SHALL reject the creation and display a validation error indicating the combination is duplicated
3. IF the Admin attempts to create a Delivery_Method without selecting both a Courier and a Delivery_Type, THEN THE Delivery_Plugin SHALL reject the creation and display a validation error indicating both fields are required
4. WHEN the Admin navigates to the delivery methods section, THE Delivery_Plugin SHALL display all Delivery_Methods showing both the Courier name and Delivery_Type name, ordered alphabetically by Courier name then by Delivery_Type name
5. WHEN the Admin requests to delete a Delivery_Method, THE Delivery_Plugin SHALL remove the Delivery_Method from the system

### Requirement 4: Delivery Method Pricing

**User Story:** As an Admin, I want to configure prices per size category for each delivery method, so that customers can see the cost of delivery based on their package size.

#### Acceptance Criteria

1. THE Delivery_Plugin SHALL support four Size_Categories: S, M, L, XL
2. WHEN the Admin opens the pricing configuration for a Delivery_Method, THE Delivery_Plugin SHALL display a price input field for each Size_Category
3. WHEN the Admin enters a price for a Size_Category and saves, THE Delivery_Plugin SHALL persist the Price_Entry with the amount (up to 2 decimal places, in the range 0.00 to 999,999.99) and currency
4. THE Delivery_Plugin SHALL default the currency to EUR for all Price_Entries
5. IF the Admin enters a price value that is negative, has more than 2 decimal places, or exceeds 999,999.99, THEN THE Delivery_Plugin SHALL reject the input and display a validation error indicating the accepted format
6. WHEN a Delivery_Method has no prices configured for a Size_Category, THE Delivery_Plugin SHALL display that Size_Category as "Not configured"
7. WHEN the Admin saves a price for a Size_Category that already has a Price_Entry configured, THE Delivery_Plugin SHALL overwrite the existing Price_Entry with the new amount

### Requirement 5: Product Delivery Assignment

**User Story:** As an Admin, I want to assign delivery methods to individual products, so that customers see only the delivery options that are physically possible for each product.

#### Acceptance Criteria

1. WHEN the Admin opens the delivery tab for a Product, THE Delivery_Plugin SHALL display all available Delivery_Methods identified by their Courier name and Delivery_Type name, each with a toggle indicating whether that Delivery_Method is currently enabled for that Product
2. WHEN the Admin enables a Delivery_Method for a Product, THE Delivery_Plugin SHALL create a Product_Delivery_Assignment linking the Product to that Delivery_Method
3. WHEN the Admin disables a Delivery_Method for a Product, THE Delivery_Plugin SHALL remove the Product_Delivery_Assignment for that Product and Delivery_Method
4. WHEN the Admin activates the "Enable All" action for a Product, THE Delivery_Plugin SHALL create Product_Delivery_Assignments for all available Delivery_Methods that are not already assigned to that Product, leaving existing assignments unchanged
5. WHEN a Product has no Product_Delivery_Assignments, THE Delivery_Plugin SHALL display all Delivery_Methods as disabled for that Product
6. IF no Delivery_Methods exist in the system when the Admin opens the delivery tab for a Product, THEN THE Delivery_Plugin SHALL display an empty state message indicating that no Delivery_Methods are available for assignment
7. WHEN a Courier is deleted, THE Delivery_Plugin SHALL remove all Product_Delivery_Assignments that reference Delivery_Methods of that Courier
8. WHEN a Delivery_Type is deleted, THE Delivery_Plugin SHALL remove all Product_Delivery_Assignments that reference Delivery_Methods of that Delivery_Type

### Requirement 6: Product Delivery Info Badge

**User Story:** As an Admin, I want to see a quick summary of delivery configuration on the product detail page, so that I can verify at a glance which products have delivery methods configured.

#### Acceptance Criteria

1. WHEN the Admin views a Product detail page, THE Delivery_Plugin SHALL display an info badge below the product details showing the count of enabled Delivery_Methods for that Product based on existing Product_Delivery_Assignments
2. IF a Product has zero enabled Delivery_Methods, THEN THE Delivery_Plugin SHALL display the badge with a danger style indicating "No delivery methods"
3. IF a Product has one or more enabled Delivery_Methods, THEN THE Delivery_Plugin SHALL display the badge with a success style showing the count (e.g., "3 delivery methods")
4. WHEN a Product_Delivery_Assignment is created or removed for a Product, THE Delivery_Plugin SHALL update the info badge count to reflect the current number of enabled Delivery_Methods without requiring a full page reload
5. IF the Delivery_Plugin fails to retrieve delivery assignment data for a Product, THEN THE Delivery_Plugin SHALL display the badge with a neutral style indicating that delivery information is unavailable

### Requirement 7: Plugin Integration with Host

**User Story:** As an Admin, I want the delivery plugin to integrate seamlessly with the host application, so that I can manage delivery settings from within the main platform interface.

#### Acceptance Criteria

1. THE Delivery_Plugin SHALL run its development server on port 3010
2. THE Delivery_Plugin SHALL register a sidebar menu item labeled "Delivery" with the Host_Application using the "menu.main" extension point
3. THE Delivery_Plugin SHALL register a product detail tab labeled "Delivery" with the Host_Application using the "product.detail.tabs" extension point for per-product delivery configuration
4. THE Delivery_Plugin SHALL register a product detail info badge with the Host_Application using the "product.detail.info" extension point
5. THE Delivery_Plugin SHALL use the Plugin SDK `thisPlugin.objects` API to persist Couriers, Delivery_Types, Delivery_Methods, Price_Entries, and Product_Delivery_Assignments as custom objects in the Host_Application database
6. THE Delivery_Plugin SHALL use the host UI stylesheet (plugin-ui.css) for consistent visual styling with the Host_Application
7. IF a Plugin SDK `thisPlugin.objects` API call fails, THEN THE Delivery_Plugin SHALL display an error message indicating the operation could not be completed and SHALL preserve any user-entered data in the form

### Requirement 8: Data Integrity on Cascade Deletion

**User Story:** As an Admin, I want the system to maintain data consistency when I delete couriers or delivery types, so that no orphaned or invalid delivery methods remain.

#### Acceptance Criteria

1. WHEN the Admin deletes a Courier that is referenced by one or more Delivery_Methods, THE Delivery_Plugin SHALL delete all Delivery_Methods that reference that Courier
2. WHEN the Admin deletes a Delivery_Type that is referenced by one or more Delivery_Methods, THE Delivery_Plugin SHALL delete all Delivery_Methods that reference that Delivery_Type
3. WHEN a Delivery_Method is deleted (directly or via cascade), THE Delivery_Plugin SHALL delete all Product_Delivery_Assignments that reference that Delivery_Method
4. WHEN a Delivery_Method is deleted (directly or via cascade), THE Delivery_Plugin SHALL delete all Price_Entries that reference that Delivery_Method
5. WHEN the Admin attempts to delete a Courier or Delivery_Type that has dependent Delivery_Methods, THE Delivery_Plugin SHALL display a confirmation dialog showing the count of Delivery_Methods, Product_Delivery_Assignments, and Price_Entries that will be removed, and SHALL provide both a confirm and a cancel action
6. IF the Admin selects the cancel action on the cascade confirmation dialog, THEN THE Delivery_Plugin SHALL abort the deletion and leave all records unchanged
7. IF a cascade deletion fails after partially executing, THEN THE Delivery_Plugin SHALL roll back all changes made during that cascade operation and display an error message indicating the deletion could not be completed

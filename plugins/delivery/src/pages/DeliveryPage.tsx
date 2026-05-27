import React, { useEffect, useState, useCallback } from "react";
import {
  createCourier,
  updateCourier,
  listCouriers,
  deleteCourier,
  createDeliveryType,
  updateDeliveryType,
  listDeliveryTypes,
  deleteDeliveryType,
  createDeliveryMethod,
  listDeliveryMethods,
  deleteDeliveryMethod,
  getCascadeImpact,
  savePrice,
  listPrices,
} from "../services";
import {
  validateCourierName,
  validateTrackingUrlTemplate,
  validateDeliveryTypeName,
  validatePrice,
  isNameDuplicate,
} from "../domain";
import type { Courier, DeliveryType, DeliveryMethod, PriceEntry, SizeCategory, CascadeImpact } from "../domain";

export function DeliveryPage() {
  return (
    <div className="tc-plugin" style={{ padding: "1rem", maxWidth: 900 }}>
      <h1>Delivery Management</h1>
      <CouriersSection />
      <DeliveryTypesSection />
      <DeliveryMethodsSection />
    </div>
  );
}

// --- Couriers Section ---

function CouriersSection() {
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [newName, setNewName] = useState("");
  const [newTrackingUrl, setNewTrackingUrl] = useState("");
  const [createErrors, setCreateErrors] = useState<{ name?: string; trackingUrl?: string }>({});

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTrackingUrl, setEditTrackingUrl] = useState("");
  const [editErrors, setEditErrors] = useState<{ name?: string; trackingUrl?: string }>({});

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    courierId: string;
    courierName: string;
    impact: CascadeImpact;
  } | null>(null);

  const loadCouriers = useCallback(async () => {
    try {
      const data = await listCouriers();
      setCouriers(data);
    } catch (err) {
      console.error("Failed to load couriers:", err);
      setError(err instanceof Error ? err.message : "Failed to load couriers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCouriers();
  }, [loadCouriers]);

  async function handleCreate() {
    setCreateErrors({});
    setError(null);

    const nameResult = validateCourierName(newName);
    const urlResult = validateTrackingUrlTemplate(newTrackingUrl);

    const errors: { name?: string; trackingUrl?: string } = {};

    if (!nameResult.valid) {
      errors.name = nameResult.error;
    } else if (isNameDuplicate(newName, couriers.map((c) => c.name))) {
      errors.name = "A courier with this name already exists";
    }

    if (!urlResult.valid) {
      errors.trackingUrl = urlResult.error;
    }

    if (errors.name || errors.trackingUrl) {
      setCreateErrors(errors);
      return;
    }

    try {
      await createCourier(newName.trim(), newTrackingUrl.trim());
      setNewName("");
      setNewTrackingUrl("");
      setCreateErrors({});
      await loadCouriers();
    } catch (err) {
      // Preserve form data on SDK errors
      console.error("Failed to create courier:", err);
      setError(err instanceof Error ? err.message : "Failed to create courier");
    }
  }

  function startEdit(courier: Courier) {
    setEditingId(courier.objectId);
    setEditName(courier.name);
    setEditTrackingUrl(courier.trackingUrlTemplate);
    setEditErrors({});
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditTrackingUrl("");
    setEditErrors({});
  }

  async function handleUpdate() {
    if (!editingId) return;
    setEditErrors({});
    setError(null);

    const nameResult = validateCourierName(editName);
    const urlResult = validateTrackingUrlTemplate(editTrackingUrl);

    const errors: { name?: string; trackingUrl?: string } = {};

    if (!nameResult.valid) {
      errors.name = nameResult.error;
    } else {
      const otherNames = couriers
        .filter((c) => c.objectId !== editingId)
        .map((c) => c.name);
      if (isNameDuplicate(editName, otherNames)) {
        errors.name = "A courier with this name already exists";
      }
    }

    if (!urlResult.valid) {
      errors.trackingUrl = urlResult.error;
    }

    if (errors.name || errors.trackingUrl) {
      setEditErrors(errors);
      return;
    }

    try {
      await updateCourier(editingId, editName.trim(), editTrackingUrl.trim());
      cancelEdit();
      await loadCouriers();
    } catch (err) {
      // Preserve form data on SDK errors
      console.error("Failed to update courier:", err);
      setError(err instanceof Error ? err.message : "Failed to update courier");
    }
  }

  async function handleDeleteClick(courier: Courier) {
    setError(null);
    try {
      const impact = await getCascadeImpact("courier", courier.objectId);
      setDeleteConfirm({
        courierId: courier.objectId,
        courierName: courier.name,
        impact,
      });
    } catch (err) {
      console.error("Failed to check deletion impact:", err);
      setError(err instanceof Error ? err.message : "Failed to check deletion impact");
    }
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;
    setError(null);
    try {
      await deleteCourier(deleteConfirm.courierId);
      setDeleteConfirm(null);
      await loadCouriers();
    } catch (err) {
      console.error("Failed to delete courier:", err);
      setError(
        err instanceof Error ? err.message : "Failed to delete courier. All changes have been rolled back."
      );
      setDeleteConfirm(null);
    }
  }

  function cancelDelete() {
    setDeleteConfirm(null);
  }

  if (loading) return <p>Loading...</p>;

  return (
    <section className="tc-section">
      <h2>Couriers</h2>
      {error && <p className="tc-error">{error}</p>}

      {/* Create form */}
      <div style={{ marginBottom: "1rem" }}>
        <div className="tc-flex" style={{ marginBottom: "0.25rem", gap: "0.5rem" }}>
          <input
            className="tc-input"
            placeholder="Courier name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            className="tc-input"
            placeholder="Tracking URL (must include {trackingNumber})"
            value={newTrackingUrl}
            onChange={(e) => setNewTrackingUrl(e.target.value)}
            style={{ flex: 2 }}
          />
          <button className="tc-primary-button" onClick={() => void handleCreate()}>
            Add
          </button>
        </div>
        {createErrors.name && <p className="tc-error">{createErrors.name}</p>}
        {createErrors.trackingUrl && <p className="tc-error">{createErrors.trackingUrl}</p>}
      </div>

      {/* Courier list */}
      {couriers.length === 0 ? (
        <p>No couriers configured yet. Add one above.</p>
      ) : (
        <table className="tc-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Tracking URL Template</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {couriers.map((courier) =>
              editingId === courier.objectId ? (
                <tr key={courier.objectId}>
                  <td>
                    <input
                      className="tc-input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                    {editErrors.name && <p className="tc-error">{editErrors.name}</p>}
                  </td>
                  <td>
                    <input
                      className="tc-input"
                      value={editTrackingUrl}
                      onChange={(e) => setEditTrackingUrl(e.target.value)}
                    />
                    {editErrors.trackingUrl && (
                      <p className="tc-error">{editErrors.trackingUrl}</p>
                    )}
                  </td>
                  <td>
                    <button className="tc-primary-button" onClick={() => void handleUpdate()}>
                      Save
                    </button>
                    <button className="tc-ghost-button" onClick={cancelEdit}>
                      Cancel
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={courier.objectId}>
                  <td>{courier.name}</td>
                  <td>{courier.trackingUrlTemplate}</td>
                  <td>
                    <button className="tc-ghost-button" onClick={() => startEdit(courier)}>
                      Edit
                    </button>
                    <button
                      className="tc-ghost-button tc-ghost-button--danger"
                      onClick={() => void handleDeleteClick(courier)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      )}

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <div
          className="tc-modal-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            className="tc-modal"
            style={{
              background: "white",
              padding: "1.5rem",
              borderRadius: "8px",
              maxWidth: 450,
            }}
          >
            <h3>Confirm Deletion</h3>
            <p>
              Are you sure you want to delete courier{" "}
              <strong>{deleteConfirm.courierName}</strong>?
            </p>
            {(deleteConfirm.impact.deliveryMethodCount > 0 ||
              deleteConfirm.impact.assignmentCount > 0 ||
              deleteConfirm.impact.priceEntryCount > 0) && (
              <>
                <p>This will also remove:</p>
                <ul>
                  {deleteConfirm.impact.deliveryMethodCount > 0 && (
                    <li>{deleteConfirm.impact.deliveryMethodCount} delivery method(s)</li>
                  )}
                  {deleteConfirm.impact.assignmentCount > 0 && (
                    <li>{deleteConfirm.impact.assignmentCount} product assignment(s)</li>
                  )}
                  {deleteConfirm.impact.priceEntryCount > 0 && (
                    <li>{deleteConfirm.impact.priceEntryCount} price entry/entries</li>
                  )}
                </ul>
              </>
            )}
            <div className="tc-flex" style={{ gap: "0.5rem", marginTop: "1rem" }}>
              <button
                className="tc-ghost-button tc-ghost-button--danger"
                onClick={() => void confirmDelete()}
              >
                Delete
              </button>
              <button className="tc-ghost-button" onClick={cancelDelete}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}


// --- Delivery Types Section ---

function DeliveryTypesSection() {
  const [deliveryTypes, setDeliveryTypes] = useState<DeliveryType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    typeId: string;
    typeName: string;
    impact: CascadeImpact;
  } | null>(null);

  const loadTypes = useCallback(async () => {
    try {
      const data = await listDeliveryTypes();
      setDeliveryTypes(data);
    } catch (err) {
      console.error("Failed to load delivery types:", err);
      setError(err instanceof Error ? err.message : "Failed to load delivery types");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTypes();
  }, [loadTypes]);

  async function handleCreate() {
    setCreateError(null);
    setError(null);

    const nameResult = validateDeliveryTypeName(newName);
    if (!nameResult.valid) {
      setCreateError(nameResult.error ?? "Invalid name");
      return;
    }

    if (isNameDuplicate(newName, deliveryTypes.map((dt) => dt.name))) {
      setCreateError("A delivery type with this name already exists");
      return;
    }

    try {
      await createDeliveryType(newName.trim());
      setNewName("");
      setCreateError(null);
      await loadTypes();
    } catch (err) {
      console.error("Failed to create delivery type:", err);
      setError(err instanceof Error ? err.message : "Failed to create delivery type");
    }
  }

  function startEdit(dt: DeliveryType) {
    setEditingId(dt.objectId);
    setEditName(dt.name);
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditError(null);
  }

  async function handleUpdate() {
    if (!editingId) return;
    setEditError(null);
    setError(null);

    const nameResult = validateDeliveryTypeName(editName);
    if (!nameResult.valid) {
      setEditError(nameResult.error ?? "Invalid name");
      return;
    }

    const otherNames = deliveryTypes
      .filter((dt) => dt.objectId !== editingId)
      .map((dt) => dt.name);
    if (isNameDuplicate(editName, otherNames)) {
      setEditError("A delivery type with this name already exists");
      return;
    }

    try {
      await updateDeliveryType(editingId, editName.trim());
      cancelEdit();
      await loadTypes();
    } catch (err) {
      console.error("Failed to update delivery type:", err);
      setError(err instanceof Error ? err.message : "Failed to update delivery type");
    }
  }

  async function handleDeleteClick(dt: DeliveryType) {
    setError(null);
    try {
      const impact = await getCascadeImpact("deliveryType", dt.objectId);
      setDeleteConfirm({
        typeId: dt.objectId,
        typeName: dt.name,
        impact,
      });
    } catch (err) {
      console.error("Failed to check deletion impact:", err);
      setError(err instanceof Error ? err.message : "Failed to check deletion impact");
    }
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;
    setError(null);
    try {
      await deleteDeliveryType(deleteConfirm.typeId);
      setDeleteConfirm(null);
      await loadTypes();
    } catch (err) {
      console.error("Failed to delete delivery type:", err);
      setError(
        err instanceof Error ? err.message : "Failed to delete delivery type. All changes have been rolled back."
      );
      setDeleteConfirm(null);
    }
  }

  function cancelDelete() {
    setDeleteConfirm(null);
  }

  if (loading) return <p>Loading...</p>;

  return (
    <section className="tc-section">
      <h2>Delivery Types</h2>
      {error && <p className="tc-error">{error}</p>}

      {/* Create form */}
      <div style={{ marginBottom: "1rem" }}>
        <div className="tc-flex" style={{ marginBottom: "0.25rem", gap: "0.5rem" }}>
          <input
            className="tc-input"
            placeholder="Delivery type name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button className="tc-primary-button" onClick={() => void handleCreate()}>
            Add
          </button>
        </div>
        {createError && <p className="tc-error">{createError}</p>}
      </div>

      {/* Delivery types list */}
      {deliveryTypes.length === 0 ? (
        <p>No delivery types configured yet. Add one above.</p>
      ) : (
        <table className="tc-table">
          <thead>
            <tr>
              <th>Name</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {deliveryTypes.map((dt) =>
              editingId === dt.objectId ? (
                <tr key={dt.objectId}>
                  <td>
                    <input
                      className="tc-input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                    {editError && <p className="tc-error">{editError}</p>}
                  </td>
                  <td>
                    <button className="tc-primary-button" onClick={() => void handleUpdate()}>
                      Save
                    </button>
                    <button className="tc-ghost-button" onClick={cancelEdit}>
                      Cancel
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={dt.objectId}>
                  <td>{dt.name}</td>
                  <td>
                    <button className="tc-ghost-button" onClick={() => startEdit(dt)}>
                      Edit
                    </button>
                    <button
                      className="tc-ghost-button tc-ghost-button--danger"
                      onClick={() => void handleDeleteClick(dt)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      )}

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <div
          className="tc-modal-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            className="tc-modal"
            style={{
              background: "white",
              padding: "1.5rem",
              borderRadius: "8px",
              maxWidth: 450,
            }}
          >
            <h3>Confirm Deletion</h3>
            <p>
              Are you sure you want to delete delivery type{" "}
              <strong>{deleteConfirm.typeName}</strong>?
            </p>
            {(deleteConfirm.impact.deliveryMethodCount > 0 ||
              deleteConfirm.impact.assignmentCount > 0 ||
              deleteConfirm.impact.priceEntryCount > 0) && (
              <>
                <p>This will also remove:</p>
                <ul>
                  {deleteConfirm.impact.deliveryMethodCount > 0 && (
                    <li>{deleteConfirm.impact.deliveryMethodCount} delivery method(s)</li>
                  )}
                  {deleteConfirm.impact.assignmentCount > 0 && (
                    <li>{deleteConfirm.impact.assignmentCount} product assignment(s)</li>
                  )}
                  {deleteConfirm.impact.priceEntryCount > 0 && (
                    <li>{deleteConfirm.impact.priceEntryCount} price entry/entries</li>
                  )}
                </ul>
              </>
            )}
            <div className="tc-flex" style={{ gap: "0.5rem", marginTop: "1rem" }}>
              <button
                className="tc-ghost-button tc-ghost-button--danger"
                onClick={() => void confirmDelete()}
              >
                Delete
              </button>
              <button className="tc-ghost-button" onClick={cancelDelete}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}


// --- Delivery Methods Section ---

const SIZE_CATEGORIES: SizeCategory[] = ['S', 'M', 'L', 'XL'];

function DeliveryMethodsSection() {
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [deliveryTypes, setDeliveryTypes] = useState<DeliveryType[]>([]);
  const [methods, setMethods] = useState<DeliveryMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Composition form state
  const [selectedCourierId, setSelectedCourierId] = useState("");
  const [selectedDeliveryTypeId, setSelectedDeliveryTypeId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    methodId: string;
    methodName: string;
  } | null>(null);

  // Pricing panel state
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [courierData, typeData, methodData] = await Promise.all([
        listCouriers(),
        listDeliveryTypes(),
        listDeliveryMethods(),
      ]);
      setCouriers(courierData);
      setDeliveryTypes(typeData);
      setMethods(methodData);
    } catch (err) {
      console.error("Failed to load delivery methods:", err);
      setError(err instanceof Error ? err.message : "Failed to load delivery methods");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleCreate() {
    setFormError(null);
    setError(null);

    if (!selectedCourierId || !selectedDeliveryTypeId) {
      setFormError("Both courier and delivery type are required");
      return;
    }

    // Check combination uniqueness
    const exists = methods.some(
      (m) => m.courierId === selectedCourierId && m.deliveryTypeId === selectedDeliveryTypeId
    );
    if (exists) {
      setFormError("This courier and delivery type combination already exists");
      return;
    }

    try {
      await createDeliveryMethod(selectedCourierId, selectedDeliveryTypeId);
      setSelectedCourierId("");
      setSelectedDeliveryTypeId("");
      setFormError(null);
      await loadData();
    } catch (err) {
      // Preserve form data on SDK errors
      console.error("Failed to create delivery method:", err);
      setError(err instanceof Error ? err.message : "Failed to create delivery method");
    }
  }

  function handleDeleteClick(method: DeliveryMethod) {
    setDeleteConfirm({
      methodId: method.objectId,
      methodName: `${method.courierName} — ${method.deliveryTypeName}`,
    });
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;
    setError(null);
    try {
      await deleteDeliveryMethod(deleteConfirm.methodId);
      setDeleteConfirm(null);
      // Close pricing panel if the deleted method was selected
      if (selectedMethodId === deleteConfirm.methodId) {
        setSelectedMethodId(null);
      }
      await loadData();
    } catch (err) {
      console.error("Failed to delete delivery method:", err);
      setError(err instanceof Error ? err.message : "Failed to delete delivery method");
      setDeleteConfirm(null);
    }
  }

  function cancelDelete() {
    setDeleteConfirm(null);
  }

  function handleMethodClick(methodId: string) {
    setSelectedMethodId((prev) => (prev === methodId ? null : methodId));
  }

  if (loading) return <p>Loading...</p>;

  return (
    <section className="tc-section">
      <h2>Delivery Methods</h2>
      {error && <p className="tc-error">{error}</p>}

      {/* Composition form */}
      <div style={{ marginBottom: "1rem" }}>
        <div className="tc-flex" style={{ marginBottom: "0.25rem", gap: "0.5rem" }}>
          <select
            className="tc-select"
            value={selectedCourierId}
            onChange={(e) => setSelectedCourierId(e.target.value)}
          >
            <option value="">-- Select courier --</option>
            {couriers.map((c) => (
              <option key={c.objectId} value={c.objectId}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            className="tc-select"
            value={selectedDeliveryTypeId}
            onChange={(e) => setSelectedDeliveryTypeId(e.target.value)}
          >
            <option value="">-- Select delivery type --</option>
            {deliveryTypes.map((dt) => (
              <option key={dt.objectId} value={dt.objectId}>
                {dt.name}
              </option>
            ))}
          </select>
          <button className="tc-primary-button" onClick={() => void handleCreate()}>
            Add
          </button>
        </div>
        {formError && <p className="tc-error">{formError}</p>}
      </div>

      {/* Methods list */}
      {methods.length === 0 ? (
        <p>No delivery methods configured yet. Select a courier and delivery type above to create one.</p>
      ) : (
        <table className="tc-table">
          <thead>
            <tr>
              <th>Delivery Method</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {methods.map((method) => (
              <React.Fragment key={method.objectId}>
                <tr
                  style={{ cursor: "pointer", background: selectedMethodId === method.objectId ? "#f0f4ff" : undefined }}
                  onClick={() => handleMethodClick(method.objectId)}
                >
                  <td>{method.courierName} — {method.deliveryTypeName}</td>
                  <td>
                    <button
                      className="tc-ghost-button tc-ghost-button--danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(method);
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
                {selectedMethodId === method.objectId && (
                  <tr>
                    <td colSpan={2} style={{ padding: 0 }}>
                      <PricingPanel deliveryMethodId={method.objectId} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <div
          className="tc-modal-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            className="tc-modal"
            style={{
              background: "white",
              padding: "1.5rem",
              borderRadius: "8px",
              maxWidth: 450,
            }}
          >
            <h3>Confirm Deletion</h3>
            <p>
              Are you sure you want to delete{" "}
              <strong>{deleteConfirm.methodName}</strong>?
            </p>
            <p>All associated price entries and product assignments will be removed.</p>
            <div className="tc-flex" style={{ gap: "0.5rem", marginTop: "1rem" }}>
              <button
                className="tc-ghost-button tc-ghost-button--danger"
                onClick={() => void confirmDelete()}
              >
                Delete
              </button>
              <button className="tc-ghost-button" onClick={cancelDelete}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// --- Pricing Panel ---

function PricingPanel({ deliveryMethodId }: { deliveryMethodId: string }) {
  const [prices, setPrices] = useState<PriceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<SizeCategory | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const loadPrices = useCallback(async () => {
    try {
      const data = await listPrices(deliveryMethodId);
      setPrices(data);
    } catch (err) {
      console.error("Failed to load prices:", err);
      setError(err instanceof Error ? err.message : "Failed to load prices");
    } finally {
      setLoading(false);
    }
  }, [deliveryMethodId]);

  useEffect(() => {
    void loadPrices();
  }, [loadPrices]);

  function getPriceForCategory(category: SizeCategory): PriceEntry | undefined {
    return prices.find((p) => p.sizeCategory === category);
  }

  function startEdit(category: SizeCategory) {
    const existing = getPriceForCategory(category);
    setEditingCategory(category);
    setEditValue(existing ? String(existing.amount) : "");
    setEditError(null);
  }

  function cancelEdit() {
    setEditingCategory(null);
    setEditValue("");
    setEditError(null);
  }

  async function handleSave() {
    if (!editingCategory) return;
    setEditError(null);

    const trimmed = editValue.trim();
    if (trimmed === "") {
      setEditError("Price is required");
      return;
    }

    const amount = Number(trimmed);
    if (isNaN(amount)) {
      setEditError("Price must be a valid number");
      return;
    }

    const result = validatePrice(amount);
    if (!result.valid) {
      setEditError(result.error ?? "Invalid price");
      return;
    }

    try {
      await savePrice(deliveryMethodId, editingCategory, amount);
      cancelEdit();
      await loadPrices();
    } catch (err) {
      // Preserve form data on SDK errors
      console.error("Failed to save price:", err);
      setError(err instanceof Error ? err.message : "Failed to save price");
    }
  }

  if (loading) {
    return (
      <div style={{ padding: "0.75rem 1rem", background: "#f9fafb" }}>
        <p>Loading prices...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "0.75rem 1rem", background: "#f9fafb", borderTop: "1px solid #e5e7eb" }}>
      <h4 style={{ margin: "0 0 0.5rem 0" }}>Pricing (EUR)</h4>
      {error && <p className="tc-error">{error}</p>}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "0.25rem 0.5rem" }}>Size</th>
            <th style={{ textAlign: "left", padding: "0.25rem 0.5rem" }}>Price</th>
            <th style={{ padding: "0.25rem 0.5rem" }}></th>
          </tr>
        </thead>
        <tbody>
          {SIZE_CATEGORIES.map((category) => {
            const priceEntry = getPriceForCategory(category);
            const isEditing = editingCategory === category;

            return (
              <tr key={category}>
                <td style={{ padding: "0.25rem 0.5rem", fontWeight: 500 }}>{category}</td>
                <td style={{ padding: "0.25rem 0.5rem" }}>
                  {isEditing ? (
                    <div>
                      <input
                        className="tc-input"
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder="0.00"
                        style={{ width: 120 }}
                      />
                      {editError && <p className="tc-error">{editError}</p>}
                    </div>
                  ) : priceEntry ? (
                    `€${priceEntry.amount.toFixed(2)}`
                  ) : (
                    <span style={{ color: "#9ca3af", fontStyle: "italic" }}>Not configured</span>
                  )}
                </td>
                <td style={{ padding: "0.25rem 0.5rem" }}>
                  {isEditing ? (
                    <div className="tc-flex" style={{ gap: "0.25rem" }}>
                      <button className="tc-primary-button" onClick={() => void handleSave()}>
                        Save
                      </button>
                      <button className="tc-ghost-button" onClick={cancelEdit}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button className="tc-ghost-button" onClick={() => startEdit(category)}>
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

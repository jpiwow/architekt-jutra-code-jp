import { useEffect, useState } from "react";
import { getSDK } from "../../../sdk";
import type { DeliveryMethod, ProductDeliveryAssignment } from "../domain";
import {
  listDeliveryMethods,
  listAssignments,
  enableDeliveryMethod,
  disableDeliveryMethod,
  enableAllDeliveryMethods,
} from "../services";

export function ProductDeliveryTab() {
  const [methods, setMethods] = useState<DeliveryMethod[]>([]);
  const [assignments, setAssignments] = useState<ProductDeliveryAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [enablingAll, setEnablingAll] = useState(false);

  const sdk = getSDK();
  const productId = sdk.thisPlugin.productId ?? "";

  async function loadData() {
    try {
      const [loadedMethods, loadedAssignments] = await Promise.all([
        listDeliveryMethods(),
        listAssignments(productId),
      ]);
      setMethods(loadedMethods);
      setAssignments(loadedAssignments);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load delivery data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!productId) {
      setLoading(false);
      return;
    }
    void loadData();
  }, [productId]);

  async function handleToggle(methodId: string, currentlyEnabled: boolean) {
    setTogglingId(methodId);
    setError(null);
    try {
      if (currentlyEnabled) {
        await disableDeliveryMethod(productId, methodId);
      } else {
        await enableDeliveryMethod(productId, methodId);
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update delivery method assignment");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleEnableAll() {
    setEnablingAll(true);
    setError(null);
    try {
      await enableAllDeliveryMethods(productId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to enable all delivery methods");
    } finally {
      setEnablingAll(false);
    }
  }

  if (!productId) return <p>No product context available.</p>;
  if (loading) return <p>Loading delivery methods...</p>;

  const assignedMethodIds = new Set(assignments.map((a) => a.deliveryMethodId));
  const allEnabled = methods.length > 0 && methods.every((m) => assignedMethodIds.has(m.objectId));

  if (methods.length === 0) {
    return (
      <div className="tc-plugin" style={{ padding: "1rem" }}>
        <h2>Product Delivery</h2>
        <p>No delivery methods available. Configure delivery methods in the Delivery plugin.</p>
      </div>
    );
  }

  return (
    <div className="tc-plugin" style={{ padding: "1rem" }}>
      <h2>Product Delivery</h2>

      {error && <p className="tc-error">{error}</p>}

      <div style={{ marginBottom: "1rem" }}>
        <button
          className="tc-btn tc-btn--primary"
          onClick={handleEnableAll}
          disabled={enablingAll || allEnabled}
        >
          {enablingAll ? "Enabling..." : "Enable All"}
        </button>
      </div>

      <table className="tc-table">
        <thead>
          <tr>
            <th>Delivery Method</th>
            <th>Enabled</th>
          </tr>
        </thead>
        <tbody>
          {methods.map((method) => {
            const isEnabled = assignedMethodIds.has(method.objectId);
            const isToggling = togglingId === method.objectId;
            return (
              <tr key={method.objectId}>
                <td>{method.courierName} — {method.deliveryTypeName}</td>
                <td>
                  <label className="tc-toggle">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      disabled={isToggling}
                      onChange={() => handleToggle(method.objectId, isEnabled)}
                    />
                    <span className="tc-toggle__slider"></span>
                  </label>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

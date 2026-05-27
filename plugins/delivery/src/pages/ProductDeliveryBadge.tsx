import { useEffect, useState } from "react";
import { getSDK } from "../../../sdk";
import { countAssignments } from "../services";

export function ProductDeliveryBadge() {
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const sdk = getSDK();
        const productId = sdk.thisPlugin.productId ?? "";
        if (!productId) {
          setError(true);
          setLoading(false);
          return;
        }
        const result = await countAssignments(productId);
        setCount(result);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (loading) return null;

  if (error) {
    return (
      <span className="tc-badge">Delivery info unavailable</span>
    );
  }

  if (count === 0) {
    return (
      <span className="tc-badge tc-badge--danger">No delivery methods</span>
    );
  }

  return (
    <span className="tc-badge tc-badge--success">
      {count} delivery method{count === 1 ? "" : "s"}
    </span>
  );
}

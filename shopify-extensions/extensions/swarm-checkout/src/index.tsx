import {
  reactExtension,
  useApi,
  useApplyAttributeChange,
  useAttributeValues,
} from "@shopify/ui-extensions-react/checkout";
import { useEffect } from "react";

/**
 * Reads the swarm_ref cookie (set by the Theme App Extension on the storefront)
 * and writes it into the checkout attributes so it survives into the order
 * payload. Idempotent — if the attribute is already set on the checkout, it
 * is left alone.
 */
function Extension() {
  const api = useApi();
  const applyAttribute = useApplyAttributeChange();
  const attrs = useAttributeValues(["swarm_ref", "swarm_source"]);

  useEffect(() => {
    void run();

    async function run() {
      if (attrs[0]) return;
      const ref = readSwarmRefCookie();
      if (!ref) return;
      await applyAttribute({ type: "updateAttribute", key: "swarm_ref", value: ref });
      await applyAttribute({ type: "updateAttribute", key: "swarm_source", value: "checkout_ext" });
    }
  }, [api, applyAttribute, attrs]);

  return null;
}

function readSwarmRefCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)swarm_ref=([^;]+)/);
  if (!match) return null;
  const raw = decodeURIComponent(match[1]);
  return /^[A-Za-z0-9_-]{6,32}$/.test(raw) ? raw : null;
}

export default reactExtension("purchase.checkout.block.render", () => <Extension />);

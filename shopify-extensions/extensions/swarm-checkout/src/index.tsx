import {
  reactExtension,
  useAttributeValues,
} from "@shopify/ui-extensions-react/checkout";

/**
 * Observer-only extension. Renders nothing visible.
 *
 * Reading the storefront `swarm_ref` cookie from inside the checkout
 * sandbox is not possible — Shopify's checkout extension runtime is a Web
 * Worker without access to the parent page's DOM or cookies. Attribution
 * therefore relies entirely on the cart attribute set by the Theme App
 * Extension on add-to-cart / checkout-click, which Shopify forwards
 * through into `note_attributes` on the order webhook automatically.
 *
 * This extension exists so we can add diagnostics (logs, merchant-facing
 * "missing attribution" hints) without changing the checkout flow.
 */

function Extension() {
  const [swarmRef] = useAttributeValues(["swarm_ref"]);
  if (process.env.NODE_ENV !== "production" && !swarmRef) {
    // eslint-disable-next-line no-console
    console.debug("[AffiliateSwarm] no swarm_ref on checkout — attribution may be missing");
  }
  return null;
}

export default reactExtension("purchase.checkout.block.render", () => <Extension />);

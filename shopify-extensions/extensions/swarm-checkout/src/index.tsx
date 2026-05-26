import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useAttributeValues } from "@shopify/ui-extensions/checkout/preact";

/**
 * Observer-only extension. Renders nothing visible.
 *
 * Reading the storefront `swarm_ref` cookie from inside the checkout
 * sandbox is not possible — Shopify's checkout extension runtime is a
 * Web Worker without access to the parent page's DOM or cookies.
 * Attribution therefore relies entirely on the cart attribute set by the
 * Theme App Extension on add-to-cart / checkout-click, which Shopify
 * forwards through into `note_attributes` on the order webhook
 * automatically.
 *
 * Built on the Preact preset (`@shopify/ui-extensions@^2026.4.0`), which
 * Shopify recommends for new checkout UI extensions — the React wrapper
 * (`@shopify/ui-extensions-react`) is on a deprecation runway.
 */

export default function extension() {
  render(<Extension />, document.body);
}

function Extension() {
  const [swarmRef] = useAttributeValues(["swarm_ref"]);
  if (!swarmRef) {
    // eslint-disable-next-line no-console
    console.debug("[AffiliateSwarm] no swarm_ref on checkout — attribution may be missing");
  }
  return null;
}

import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/test/mock-landing — Test-only: mock advertiser landing page.
 *
 * In E2E tests, campaigns set their landingUrl to this endpoint.
 * When an affiliate link sends a user here with ?swarm_ref=CODE, this page
 * captures the value and returns a simple HTML page simulating an advertiser's
 * website.
 *
 * Only available when NODE_ENV !== "production".
 */
export async function GET(req: NextRequest) {
  // Flag-only gate: this page is navigated to by a real browser (it is a
  // campaign landingUrl), so it cannot carry the x-test-secret header that the
  // mutating /api/test/* routes require. The flag must still be an explicit
  // allow-list value so a stray env value cannot enable it.
  const flag = process.env.ENABLE_TEST_ROUTES;
  if (flag !== "1" && flag !== "true") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  // Sanitise to the tracking-code charset to neutralise reflected XSS — the
  // value is echoed into both HTML and an inline script below.
  const rawRef = req.nextUrl.searchParams.get("swarm_ref");
  const swarmRef = rawRef ? rawRef.replace(/[^A-Za-z0-9_-]/g, "") : null;

  // Return a simple HTML page that shows the tracking code and a "Buy Now" button.
  // The value is also available as a data attribute for Playwright to extract.
  const html = `<!DOCTYPE html>
<html>
<head><title>Mock Landing Page</title></head>
<body>
  <h1>Mock Advertiser Product Page</h1>
  <p>This is a test landing page for E2E automated testing.</p>
  ${swarmRef ? `<p data-testid="swarm-ref-code">Tracking swarm_ref: <code id="swarm-ref">${swarmRef}</code></p>` : '<p>No swarm_ref parameter received.</p>'}
  <button data-testid="buy-button">Buy Now</button>
  <script>
    // Store swarm_ref in sessionStorage so it persists across page navigation
    ${swarmRef ? `sessionStorage.setItem('swarm_ref', '${swarmRef}');` : ''}
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}

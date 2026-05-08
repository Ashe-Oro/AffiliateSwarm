import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/test/mock-landing — Test-only: mock advertiser landing page.
 *
 * In E2E tests, campaigns set their landingUrl to this endpoint.
 * When Regatta's tracking redirect sends a user here with ?rgta_ref=CODE,
 * this page captures the value and returns a simple HTML page simulating
 * an advertiser's website.
 *
 * Only available when NODE_ENV !== "production".
 */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production" && !process.env.ENABLE_TEST_ROUTES) {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const rgtaRef = req.nextUrl.searchParams.get("rgta_ref");

  // Return a simple HTML page that shows the tracking code and a "Buy Now" button.
  // The value is also available as a data attribute for Playwright to extract.
  const html = `<!DOCTYPE html>
<html>
<head><title>Mock Landing Page</title></head>
<body>
  <h1>Mock Advertiser Product Page</h1>
  <p>This is a test landing page for E2E automated testing.</p>
  ${rgtaRef ? `<p data-testid="rgta-ref-code">Tracking rgta_ref: <code id="rgta-ref">${rgtaRef}</code></p>` : '<p>No rgta_ref parameter received.</p>'}
  <button data-testid="buy-button">Buy Now</button>
  <script>
    // Store rgta_ref in sessionStorage so it persists across page navigation
    ${rgtaRef ? `sessionStorage.setItem('rgta_ref', '${rgtaRef}');` : ''}
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}

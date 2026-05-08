import { describe, expect, it } from "vitest";
import { apiReferenceSections } from "../endpoints";

describe("public API reference endpoints", () => {
  it("does not publish admin-only routes in the public v1 API reference", () => {
    const publicPaths = apiReferenceSections.flatMap((section) =>
      section.routes.map((route) => route.path)
    );

    expect(publicPaths).not.toContain("/api/v1/admin/payouts/process");
    expect(publicPaths.every((path) => !path.startsWith("/api/v1/admin/"))).toBe(true);
  });
});

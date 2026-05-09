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

  it("does not publish removed legacy contracts", () => {
    const searchable = JSON.stringify(apiReferenceSections);
    const publicPaths = apiReferenceSections.flatMap((section) =>
      section.routes.map((route) => route.path)
    );
    const oldBrandPattern = new RegExp(["reg", "atta"].join(""), "i");
    const oldRefPattern = new RegExp(["rg", "ta_ref"].join(""), "i");
    const oldKeyPattern = new RegExp(["rgt", "_live"].join(""), "i");
    const removedProtocolsPattern = new RegExp(["m", "cp|s", "dk"].join(""), "i");

    expect(searchable).not.toMatch(oldBrandPattern);
    expect(searchable).not.toMatch(oldRefPattern);
    expect(searchable).not.toMatch(oldKeyPattern);
    expect(searchable).not.toMatch(removedProtocolsPattern);
    expect(publicPaths).not.toContain("/api/v1/discover/affiliates");
    expect(publicPaths).not.toContain("/api/v1/wallets/:agentId/deposits");
    expect(searchable).toContain("swarm_ref");
  });
});

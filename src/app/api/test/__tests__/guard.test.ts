import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { assertTestRoutesEnabled } from "../_guard";

function makeReq(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/test/credit-wallet", {
    method: "POST",
    headers,
  });
}

const ORIGINAL = {
  NODE_ENV: process.env.NODE_ENV,
  ENABLE_TEST_ROUTES: process.env.ENABLE_TEST_ROUTES,
  TEST_ROUTES_SECRET: process.env.TEST_ROUTES_SECRET,
};

function setEnv(env: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete (process.env as Record<string, string | undefined>)[k];
    else (process.env as Record<string, string>)[k] = v;
  }
}

describe("assertTestRoutesEnabled", () => {
  beforeEach(() => {
    setEnv({ ENABLE_TEST_ROUTES: undefined, TEST_ROUTES_SECRET: undefined });
  });

  afterEach(() => {
    setEnv(ORIGINAL);
  });

  it("blocks when the flag is unset", () => {
    setEnv({ NODE_ENV: "development" });
    expect(assertTestRoutesEnabled(makeReq())?.status).toBe(404);
  });

  it("blocks loose/truthy-but-not-allowlisted flag values", () => {
    setEnv({ NODE_ENV: "development", ENABLE_TEST_ROUTES: "false" });
    expect(assertTestRoutesEnabled(makeReq())?.status).toBe(404);
    setEnv({ ENABLE_TEST_ROUTES: "0" });
    expect(assertTestRoutesEnabled(makeReq())?.status).toBe(404);
    setEnv({ ENABLE_TEST_ROUTES: "yes" });
    expect(assertTestRoutesEnabled(makeReq())?.status).toBe(404);
  });

  it("allows in non-production with the flag set, no secret needed", () => {
    setEnv({ NODE_ENV: "development", ENABLE_TEST_ROUTES: "1" });
    expect(assertTestRoutesEnabled(makeReq())).toBeNull();
    setEnv({ ENABLE_TEST_ROUTES: "true" });
    expect(assertTestRoutesEnabled(makeReq())).toBeNull();
  });

  it("blocks in production when the flag is on but no secret is configured", () => {
    setEnv({ NODE_ENV: "production", ENABLE_TEST_ROUTES: "1", TEST_ROUTES_SECRET: undefined });
    expect(assertTestRoutesEnabled(makeReq())?.status).toBe(404);
  });

  it("blocks in production when the secret header is missing or wrong", () => {
    setEnv({ NODE_ENV: "production", ENABLE_TEST_ROUTES: "1", TEST_ROUTES_SECRET: "s3cret" });
    expect(assertTestRoutesEnabled(makeReq())?.status).toBe(404);
    expect(assertTestRoutesEnabled(makeReq({ "x-test-secret": "wrong" }))?.status).toBe(404);
    // length-mismatch must not throw
    expect(assertTestRoutesEnabled(makeReq({ "x-test-secret": "x" }))?.status).toBe(404);
  });

  it("allows in production with the flag on and a matching secret header", () => {
    setEnv({ NODE_ENV: "production", ENABLE_TEST_ROUTES: "1", TEST_ROUTES_SECRET: "s3cret" });
    expect(assertTestRoutesEnabled(makeReq({ "x-test-secret": "s3cret" }))).toBeNull();
  });
});

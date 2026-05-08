import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

beforeEach(() => {
  // Full module isolation: the singleton cache must reset between tests so
  // env changes actually take effect on the next getCdp() call. vi.stubEnv
  // is used because newer @types/node types NODE_ENV as readonly.
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv("CDP_API_KEY_ID", "");
  vi.stubEnv("CDP_API_KEY_SECRET", "");
  vi.stubEnv("CDP_API_KEY_PRIVATE_KEY", "");
  vi.stubEnv("CDP_WALLET_SECRET", "");
  vi.stubEnv("ALLOW_MOCK_CDP", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getCdp", () => {
  it("throws in production when creds are missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { getCdp } = await import("../cdp");
    expect(() => getCdp()).toThrow(/CDP credentials missing/);
  });

  it("returns a mock client in test mode when creds are missing", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const { getCdp } = await import("../cdp");
    const cdp = getCdp();
    expect(cdp).toBeTruthy();
    expect(typeof cdp.evm.getOrCreateAccount).toBe("function");
  });

  it("returns a mock client in development when creds are missing", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { getCdp } = await import("../cdp");
    const cdp = getCdp();
    expect(cdp).toBeTruthy();
    expect(typeof cdp.evm.getOrCreateAccount).toBe("function");
  });

  it("returns a mock client in production when explicitly enabled", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_MOCK_CDP", "1");
    const { getCdp } = await import("../cdp");
    const cdp = getCdp();
    expect(cdp).toBeTruthy();
    expect(typeof cdp.evm.getOrCreateAccount).toBe("function");
  });

  it("mock getOrCreateAccount returns a deterministic address for a name", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const { getCdp } = await import("../cdp");
    const cdp = getCdp();

    const a = await cdp.evm.getOrCreateAccount({ name: "agent-123" });
    const b = await cdp.evm.getOrCreateAccount({ name: "agent-123" });

    expect(a.address).toMatch(/^0x[0-9a-f]{40}$/);
    expect(a.address).toBe(b.address); // idempotent per name
    expect(a.name).toBe("agent-123");
  });

  it("mock getOrCreateAccount gives different addresses for different names", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const { getCdp } = await import("../cdp");
    const cdp = getCdp();

    const a = await cdp.evm.getOrCreateAccount({ name: "agent-a" });
    const b = await cdp.evm.getOrCreateAccount({ name: "agent-b" });

    expect(a.address).not.toBe(b.address);
  });

  it("mock getOrCreateSmartAccount returns a deterministic address per name", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const { getCdp } = await import("../cdp");
    const cdp = getCdp();

    const owner = await cdp.evm.getOrCreateAccount({ name: "regatta-owner" });
    const a = await cdp.evm.getOrCreateSmartAccount({ name: "agent-x", owner });
    const b = await cdp.evm.getOrCreateSmartAccount({ name: "agent-x", owner });

    expect(a.address).toMatch(/^0x[0-9a-f]{40}$/);
    expect(a.address).toBe(b.address); // idempotent per name
    expect(a.address).not.toBe(owner.address); // smart account != owner EOA
    expect(a.owners).toEqual([owner]);
  });

  it("mock getOrCreateSmartAccount rejects multiple smart accounts for one owner", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const { getCdp } = await import("../cdp");
    const cdp = getCdp();

    const owner = await cdp.evm.getOrCreateAccount({ name: "shared-owner" });
    await cdp.evm.getOrCreateSmartAccount({ name: "agent-a", owner });

    await expect(
      cdp.evm.getOrCreateSmartAccount({ name: "agent-b", owner })
    ).rejects.toThrow(/Multiple smart wallets with the same owner/);
  });

  it("mock getOrCreateSmartAccount rejects a different owner for an existing smart account name", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const { getCdp } = await import("../cdp");
    const cdp = getCdp();

    const oldOwner = await cdp.evm.getOrCreateAccount({ name: "old-owner" });
    const newOwner = await cdp.evm.getOrCreateAccount({ name: "new-owner" });
    await cdp.evm.getOrCreateSmartAccount({
      name: "existing-smart-account",
      owner: oldOwner,
    });

    await expect(
      cdp.evm.getOrCreateSmartAccount({
        name: "existing-smart-account",
        owner: newOwner,
      })
    ).rejects.toThrow(/Owner mismatch/);
  });

  it("derives stable v2 CDP smart account names for agents", async () => {
    const { cdpSmartAccountNameForAgent } = await import("../cdp");

    const smartAccountName = cdpSmartAccountNameForAgent(
      "6f20c031-d804-4f46-af4f-6b7fd0c6e605"
    );

    expect(smartAccountName).toMatch(/^agent-[0-9a-f]{30}$/);
    expect(smartAccountName).toHaveLength(36);
    expect(smartAccountName).toBe(
      cdpSmartAccountNameForAgent("6f20c031-d804-4f46-af4f-6b7fd0c6e605")
    );
    expect(smartAccountName).not.toBe("6f20c031-d804-4f46-af4f-6b7fd0c6e605");
  });

  it("derives stable CDP-valid owner names for smart accounts", async () => {
    const { cdpOwnerNameForSmartAccount } = await import("../cdp");

    const ownerName = cdpOwnerNameForSmartAccount(
      "6f20c031-d804-4f46-af4f-6b7fd0c6e605"
    );

    expect(ownerName).toMatch(/^owner-[0-9a-f]{30}$/);
    expect(ownerName).toHaveLength(36);
    expect(ownerName).toBe(
      cdpOwnerNameForSmartAccount("6f20c031-d804-4f46-af4f-6b7fd0c6e605")
    );
    expect(ownerName).not.toBe(cdpOwnerNameForSmartAccount("platform-hot"));
  });

  it("mock sendUserOperation throws loudly", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const { getCdp } = await import("../cdp");
    const cdp = getCdp();

    await expect(cdp.evm.sendUserOperation()).rejects.toThrow(/MOCK CDP/);
  });

  it("mock waitForUserOperation throws loudly", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const { getCdp } = await import("../cdp");
    const cdp = getCdp();

    await expect(cdp.evm.waitForUserOperation()).rejects.toThrow(/MOCK CDP/);
  });

  it("mock requestFaucet throws loudly", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const { getCdp } = await import("../cdp");
    const cdp = getCdp();

    await expect(cdp.evm.requestFaucet()).rejects.toThrow(/MOCK CDP/);
  });
});

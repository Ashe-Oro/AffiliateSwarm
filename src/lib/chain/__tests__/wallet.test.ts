import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv("CDP_API_KEY_ID", "");
  vi.stubEnv("CDP_API_KEY_SECRET", "");
  vi.stubEnv("CDP_API_KEY_PRIVATE_KEY", "");
  vi.stubEnv("CDP_WALLET_SECRET", "");
});

afterEach(() => {
  vi.doUnmock("../cdp");
  vi.unstubAllEnvs();
});

describe("CDP wallet accounts", () => {
  it("uses a unique owner EOA for each smart account", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const { cdpSmartAccountNameForAgent, PLATFORM_HOT_OWNER_ACCOUNT_NAME } =
      await import("../cdp");
    const { getOrCreateAgentAccount, getPlatformAccount } =
      await import("../wallet");

    const agentId = "6f20c031-d804-4f46-af4f-6b7fd0c6e605";
    const platform = await getPlatformAccount();
    const agent = await getOrCreateAgentAccount(agentId);

    expect(platform.name).toBe("swarm-hot");
    expect(platform.smartAccount.owners[0].name).toBe(
      PLATFORM_HOT_OWNER_ACCOUNT_NAME
    );
    expect(agent.name).toBe(cdpSmartAccountNameForAgent(agentId));
    expect(platform.smartAccount.owners[0].name).not.toBe(
      agent.smartAccount.owners[0].name
    );
    expect(platform.smartAccount.owners[0].address).not.toBe(
      agent.smartAccount.owners[0].address
    );
  });

  it("clears a rejected owner lookup so the next call can retry", async () => {
    const getOrCreateAccount = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary CDP failure"))
      .mockResolvedValue({
        address: "0x1111111111111111111111111111111111111111",
        name: "owner-name",
      });
    const getOrCreateSmartAccount = vi.fn().mockResolvedValue({
      address: "0x2222222222222222222222222222222222222222",
      name: "swarm-hot",
      owners: [
        {
          address: "0x1111111111111111111111111111111111111111",
          name: "owner-name",
        },
      ],
    });

    vi.doMock("../cdp", () => ({
      getCdp: () => ({
        evm: { getOrCreateAccount, getOrCreateSmartAccount },
      }),
      cdpSmartAccountNameForAgent: (agentId: string) => agentId.slice(0, 36),
      cdpOwnerNameForSmartAccount: () => "owner-name",
      PLATFORM_HOT_ACCOUNT_NAME: "swarm-hot",
      PLATFORM_HOT_OWNER_ACCOUNT_NAME: "owner-name",
    }));

    const { getPlatformAccount } = await import("../wallet");

    await expect(getPlatformAccount()).rejects.toThrow("temporary CDP failure");
    await expect(getPlatformAccount()).resolves.toMatchObject({
      address: "0x2222222222222222222222222222222222222222",
      name: "swarm-hot",
    });
    expect(getOrCreateAccount).toHaveBeenCalledTimes(2);
  });

});

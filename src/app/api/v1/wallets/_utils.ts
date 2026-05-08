import { getWallet } from "@/services/escrow.service";

export async function getWalletResponse(agentId: string) {
  const wallet = await getWallet(agentId);

  const { prisma } = await import("@/lib/prisma");
  const fullWallet = await prisma.wallet.findUnique({ where: { agentId } });

  return {
    ...wallet,
    walletType: fullWallet?.walletType ?? null,
    chainAddress: fullWallet?.chainAddress ?? null,
    depositAddress: fullWallet?.depositAddress ?? null,
  };
}

import { describe, expect, it } from "vitest";
import {
  getAdvertiserWalletTotalCents,
  getWalletLedgerEntryDisplay,
} from "../ledger-display";

const WALLET_ID = "770e8400-e29b-41d4-a716-446655440000";
const ESCROW_ID = "880e8400-e29b-41d4-a716-446655440000";

describe("getWalletLedgerEntryDisplay", () => {
  it("labels wallet-to-escrow auto funding as an outflow, not a deposit", () => {
    const display = getWalletLedgerEntryDisplay(
      {
        amountCents: 900,
        debitAccountType: "WALLET",
        debitAccountId: WALLET_ID,
        creditAccountType: "ESCROW",
        creditAccountId: ESCROW_ID,
        entryType: "DEPOSIT",
        referenceType: "LEAD",
      },
      WALLET_ID
    );

    expect(display).toMatchObject({
      label: "escrow funding",
      referenceLabel: "lead escrow",
      amountLabel: "-$9.00",
      direction: "outflow",
    });
  });

  it("labels onchain deposits as wallet inflows", () => {
    const display = getWalletLedgerEntryDisplay(
      {
        amountCents: 200,
        debitAccountType: "EXTERNAL",
        debitAccountId: null,
        creditAccountType: "WALLET",
        creditAccountId: WALLET_ID,
        entryType: "CHAIN_DEPOSIT",
        referenceType: "CHAIN_TX",
      },
      WALLET_ID
    );

    expect(display).toMatchObject({
      label: "onchain deposit",
      referenceLabel: "chain tx",
      amountLabel: "+$2.00",
      direction: "inflow",
    });
  });

  it("uses account type, not only matching ids, when deriving direction", () => {
    const display = getWalletLedgerEntryDisplay(
      {
        amountCents: 30,
        debitAccountType: "WALLET",
        debitAccountId: WALLET_ID,
        creditAccountType: "PLATFORM_REVENUE",
        creditAccountId: WALLET_ID,
        entryType: "FEE",
        referenceType: "WALLET",
      },
      WALLET_ID
    );

    expect(display).toMatchObject({
      amountLabel: "-$0.30",
      direction: "outflow",
    });
  });
});

describe("getAdvertiserWalletTotalCents", () => {
  it("keeps affiliate escrow in the advertiser wallet total", () => {
    expect(
      getAdvertiserWalletTotalCents({
        availableCents: 300,
        campaignEscrowCents: 0,
        affiliateEscrowCents: 900,
      })
    ).toBe(1200);
  });
});

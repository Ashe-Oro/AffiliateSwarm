"use client";

import { useState, useTransition } from "react";
import { saveApiKeyAction, testConnectionAction } from "./actions";

interface RecentOrder {
  shopifyOrderId: string;
  attributionPath: string;
  postbackStatus: string;
  postbackError: string | null;
  revenueCents: number;
  swarmRef: string | null;
  createdAt: string;
}

interface Props {
  shop: string;
  connected: boolean;
  apiKeyConfigured: boolean;
  apiKeyValid: boolean;
  installedAt: string | null;
  recentOrders: RecentOrder[];
}

export function ShopifyAdminClient(props: Props) {
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [testing, startTest] = useTransition();

  function onSave(form: FormData) {
    setSaveMsg(null);
    startSave(async () => {
      const result = await saveApiKeyAction(form);
      setSaveMsg(result.ok ? "Saved and validated." : (result.error ?? "Save failed."));
    });
  }

  function onTest(form: FormData) {
    setTestMsg(null);
    startTest(async () => {
      const result = await testConnectionAction(form);
      setTestMsg(result.message);
    });
  }

  return (
    <main className="p-6 max-w-3xl mx-auto space-y-8 font-sans">
      <header>
        <h1 className="text-2xl font-semibold">AffiliateSwarm</h1>
        <p className="text-sm text-muted-foreground">
          Connected to <code>{props.shop}</code>
          {props.installedAt && (
            <> — installed {new Date(props.installedAt).toLocaleDateString()}</>
          )}
        </p>
      </header>

      <section className="border rounded-lg p-5 space-y-4">
        <div>
          <h2 className="font-medium">1. Connect your AffiliateSwarm account</h2>
          <p className="text-sm text-muted-foreground">
            Paste your advertiser API key from <a className="underline" href="https://affiliateswarm.ai/dashboard/settings" target="_blank" rel="noopener">affiliateswarm.ai/dashboard/settings</a>.
          </p>
        </div>
        <form action={onSave} className="space-y-3">
          <input type="hidden" name="shop" value={props.shop} />
          <input
            name="apiKey"
            type="password"
            required
            placeholder="swarm_live_..."
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded bg-black text-white text-sm disabled:opacity-50"
          >
            {saving ? "Saving…" : props.apiKeyConfigured ? "Update key" : "Save key"}
          </button>
        </form>
        {props.apiKeyConfigured && (
          <p className="text-sm">
            Status:{" "}
            <span className={props.apiKeyValid ? "text-green-600" : "text-amber-600"}>
              {props.apiKeyValid ? "key validated" : "key saved but not validated"}
            </span>
          </p>
        )}
        {saveMsg && <p className="text-sm">{saveMsg}</p>}
      </section>

      <section className="border rounded-lg p-5 space-y-4">
        <div>
          <h2 className="font-medium">2. Confirm tracking</h2>
          <p className="text-sm text-muted-foreground">
            Paste the <code>testTrackingCode</code> from any AffiliateSwarm
            campaign. We&apos;ll fire a test postback so the campaign unlocks
            activation.
          </p>
        </div>
        <form action={onTest} className="space-y-3">
          <input type="hidden" name="shop" value={props.shop} />
          <input
            name="testTrackingCode"
            required
            placeholder="8-character code"
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={testing}
            className="px-4 py-2 rounded border text-sm disabled:opacity-50"
          >
            {testing ? "Testing…" : "Fire test postback"}
          </button>
        </form>
        {testMsg && <p className="text-sm">{testMsg}</p>}
      </section>

      <section className="border rounded-lg p-5 space-y-3">
        <h2 className="font-medium">Recent attributed orders</h2>
        {props.recentOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            None yet. Once a customer lands with{" "}
            <code>?swarm_ref=…</code> or uses an affiliate&apos;s discount code,
            their order will show up here.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-1">Order</th>
                <th>Path</th>
                <th>Status</th>
                <th>Revenue</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {props.recentOrders.map((o) => (
                <tr key={o.shopifyOrderId} className="border-t">
                  <td className="py-1">{o.shopifyOrderId}</td>
                  <td>{o.attributionPath}</td>
                  <td title={o.postbackError ?? undefined}>{o.postbackStatus}</td>
                  <td>${(o.revenueCents / 100).toFixed(2)}</td>
                  <td>{new Date(o.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

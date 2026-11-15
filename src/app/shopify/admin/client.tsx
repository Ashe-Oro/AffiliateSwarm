"use client";

import { useCallback, useEffect, useState } from "react";

interface MeResponse {
  shop: string;
  installedAt: string | null;
  apiKeyConfigured: boolean;
  apiKeyValid: boolean;
  recentOrders: RecentOrder[];
}

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
  hintedShop: string | null;
}

/**
 * Fetches everything via App Bridge-authenticated calls. The `hintedShop`
 * prop is a render hint only — the server re-derives the true shop from
 * the verified session-token JWT.
 */
export function ShopifyAdminClient({ hintedShop }: Props) {
  const [state, setState] = useState<MeResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [testCode, setTestCode] = useState("");
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/shopify/admin/api/me", { cache: "no-store" });
      if (!res.ok) {
        setLoadError(`Failed to load state (HTTP ${res.status}). Try reopening the app from your Shopify admin.`);
        return;
      }
      const body = (await res.json()) as MeResponse;
      setState(body);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Unknown error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveApiKey(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy("save");
    setMsg(null);
    try {
      const res = await fetch("/shopify/admin/api/api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const body = (await res.json()) as { ok: boolean; error?: string };
      setMsg(body.ok ? "Saved and validated." : body.error ?? "Save failed.");
      if (body.ok) {
        setApiKey("");
        void load();
      }
    } finally {
      setBusy(null);
    }
  }

  async function fireTest(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy("test");
    setMsg(null);
    try {
      const res = await fetch("/shopify/admin/api/test-postback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testTrackingCode: testCode }),
      });
      const body = (await res.json()) as { ok: boolean; message: string };
      setMsg(body.message);
    } finally {
      setBusy(null);
    }
  }

  if (loadError) {
    return (
      <main className="p-6 max-w-3xl mx-auto font-sans">
        <h1 className="text-2xl font-semibold">AffiliateSwarm</h1>
        <p className="text-sm text-red-600 mt-2">{loadError}</p>
        <p className="text-sm text-muted-foreground mt-1">
          {hintedShop ? <>Shop hinted as <code>{hintedShop}</code>.</> : null}
        </p>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="p-6 max-w-3xl mx-auto font-sans">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-3xl mx-auto space-y-8 font-sans">
      <header>
        <h1 className="text-2xl font-semibold">AffiliateSwarm</h1>
        <p className="text-sm text-muted-foreground">
          Connected to <code>{state.shop}</code>
          {state.installedAt && (
            <> — installed {new Date(state.installedAt).toLocaleDateString()}</>
          )}
        </p>
      </header>

      <section className="border rounded-lg p-5 space-y-4">
        <div>
          <h2 className="font-medium">1. Connect your AffiliateSwarm account</h2>
          <p className="text-sm text-muted-foreground">
            Paste your advertiser API key from <a className="underline" href="https://your-deployment.example/dashboard/settings" target="_blank" rel="noopener">your-deployment.example/dashboard/settings</a>.
          </p>
        </div>
        <form onSubmit={saveApiKey} className="space-y-3">
          <input
            type="password"
            required
            placeholder="swarm_live_..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={busy === "save"}
            className="px-4 py-2 rounded bg-black text-white text-sm disabled:opacity-50"
          >
            {busy === "save" ? "Saving…" : state.apiKeyConfigured ? "Update key" : "Save key"}
          </button>
        </form>
        {state.apiKeyConfigured && (
          <p className="text-sm">
            Status:{" "}
            <span className={state.apiKeyValid ? "text-green-600" : "text-amber-600"}>
              {state.apiKeyValid ? "key validated" : "key saved but not validated"}
            </span>
          </p>
        )}
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
        <form onSubmit={fireTest} className="space-y-3">
          <input
            required
            placeholder="8-character code"
            value={testCode}
            onChange={(e) => setTestCode(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={busy === "test"}
            className="px-4 py-2 rounded border text-sm disabled:opacity-50"
          >
            {busy === "test" ? "Testing…" : "Fire test postback"}
          </button>
        </form>
      </section>

      {msg && <p className="text-sm">{msg}</p>}

      <section className="border rounded-lg p-5 space-y-3">
        <h2 className="font-medium">Recent attributed orders</h2>
        {state.recentOrders.length === 0 ? (
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
              {state.recentOrders.map((o) => (
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

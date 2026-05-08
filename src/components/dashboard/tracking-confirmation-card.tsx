"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildAgentIntegrationPrompt } from "@/lib/agent-integration-prompt";

const LLM_GUIDE_PATH = "/docs/llm-integration-guide.md";
const HUMAN_GUIDE_PATH = "/docs/integration";
const SETTINGS_PATH = "/dashboard/settings";

interface TrackingConfirmationCardProps {
  campaignStatus: string;
  testTrackingCode: string | null;
  trackingConfirmedAt: string | null;
  postbackUrl: string;
}

export function TrackingConfirmationCard({
  campaignStatus,
  testTrackingCode,
  trackingConfirmedAt,
  postbackUrl,
}: TrackingConfirmationCardProps) {
  const [copied, setCopied] = useState(false);

  if (trackingConfirmedAt) {
    return (
      <Card className="border-green-500/50 bg-green-500/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge variant="default" className="bg-green-600">
              Tracking Confirmed
            </Badge>
            <CardTitle className="text-base">
              Your integration is wired up correctly
            </CardTitle>
          </div>
          <CardDescription>
            A test postback was received on{" "}
            {new Date(trackingConfirmedAt).toLocaleString()}. Real affiliate
            conversions will be tracked and paid out.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!testTrackingCode) return null;

  const isPreActivation =
    campaignStatus === "DRAFT" || campaignStatus === "PENDING_ESCROW";
  if (!isPreActivation) return null;

  // Build absolute guide URL for the agent prompt so the link works regardless
  // of the agent's working context. The card's own doc links stay relative.
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://regatta.network";
  const llmGuideUrl = `${origin}${LLM_GUIDE_PATH}`;

  const agentPrompt = buildAgentIntegrationPrompt({
    testTrackingCode,
    postbackUrl,
    llmGuideUrl,
  });

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(agentPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  }

  return (
    <Card className="border-amber-500/50 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="text-base">
          Confirm your test postback to activate
        </CardTitle>
        <CardDescription>
          Fire one real test postback to prove your integration works. This card
          turns green and Activate unlocks when we receive it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          Generate an API key in{" "}
          <a href={SETTINGS_PATH} className="underline">
            Settings
          </a>{" "}
          and add it to your backend as <code>REGATTA_API_KEY</code>. Your agent
          will handle the rest.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={copyPrompt} size="lg">
            {copied ? "Copied!" : "Copy prompt for your agent"}
          </Button>
          <div className="text-xs text-muted-foreground">
            Waiting for your first test postback…
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          <a
            href={LLM_GUIDE_PATH}
            className="underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            LLM / agent integration guide
          </a>
          {" · "}
          <a
            href={HUMAN_GUIDE_PATH}
            className="underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Human integration guide
          </a>
        </p>

        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none">
            Prefer to test without an agent? Show curl example
          </summary>
          <pre className="mt-2 overflow-x-auto rounded bg-muted p-3 text-xs">
{`curl -X POST "${postbackUrl}" \\
  -H "Authorization: Bearer $REGATTA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "rgta_ref": "${testTrackingCode}",
    "externalId": "confirm-test-001",
    "eventType": "PURCHASE"
  }'`}
          </pre>
        </details>
      </CardContent>
    </Card>
  );
}

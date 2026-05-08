"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EditProfileForm } from "@/components/dashboard/edit-profile-form";
import { ApiKeyManagement } from "@/components/dashboard/api-key-management";
import { WebhookManagement } from "@/components/dashboard/webhook-management";

interface AgentData {
  id: string;
  type: string;
  status: string;
  verificationLevel: string;
  displayName: string;
  description: string | null;
  email: string | null;
  websiteUrl: string | null;
  contactEndpoint: string | null;
  logoUrl: string | null;
  capabilities: string[];
  // ISO timestamp; null if the welcome email hasn't been delivered yet
  onboardingEmailSentAt: string | null;
  onboardingEmailLastError: string | null;
}

interface ApiKey {
  id: string;
  apiKeyPrefix: string;
  label: string;
  scopes: string[];
  rateLimitTier: string;
  lastUsedAt: string | null;
  createdAt: string;
}

interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  createdAt: string;
}

interface SettingsClientProps {
  agent: AgentData;
  credentials: ApiKey[];
  webhooks: Webhook[];
}

export function SettingsClient({
  agent,
  credentials,
  webhooks,
}: SettingsClientProps) {
  const [editing, setEditing] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendResult, setResendResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [onboardingResendLoading, setOnboardingResendLoading] = useState(false);
  const [onboardingResendResult, setOnboardingResendResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  async function handleResendVerification() {
    setResendLoading(true);
    setResendResult(null);
    try {
      const res = await fetch("/api/dashboard/settings/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agent.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResendResult({
          type: "error",
          message: data.error ?? "Failed to resend",
        });
        return;
      }
      setResendResult({
        type: "success",
        message: `Verification email sent to ${data.data.email}`,
      });
    } catch {
      setResendResult({
        type: "error",
        message: "Failed to resend verification email",
      });
    } finally {
      setResendLoading(false);
    }
  }

  async function handleResendOnboarding() {
    setOnboardingResendLoading(true);
    setOnboardingResendResult(null);
    try {
      const res = await fetch("/api/dashboard/settings/resend-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agent.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOnboardingResendResult({
          type: "error",
          message: data.error?.message ?? data.error ?? "Failed to resend",
        });
        return;
      }
      setOnboardingResendResult({
        type: "success",
        message: `Welcome email sent to ${data.data.email}`,
      });
    } catch {
      setOnboardingResendResult({
        type: "error",
        message: "Failed to resend welcome email",
      });
    } finally {
      setOnboardingResendLoading(false);
    }
  }

  const showOnboardingResend =
    agent.verificationLevel !== "UNVERIFIED" && !agent.onboardingEmailSentAt;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Agent Info</CardTitle>
          {!editing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
            >
              Edit Profile
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {editing ? (
            <EditProfileForm
              initial={{
                displayName: agent.displayName,
                description: agent.description,
                websiteUrl: agent.websiteUrl,
                contactEndpoint: agent.contactEndpoint,
                logoUrl: agent.logoUrl,
                capabilities: agent.capabilities,
              }}
              onClose={() => setEditing(false)}
            />
          ) : (
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Agent ID</dt>
                <dd className="font-mono text-xs">{agent.id}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Type</dt>
                <dd className="font-medium">{agent.type}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <Badge
                    variant={
                      agent.status === "ACTIVE" ? "default" : "secondary"
                    }
                  >
                    {agent.status.toLowerCase().replace(/_/g, " ")}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Verification Level</dt>
                <dd>
                  <Badge
                    variant={
                      agent.verificationLevel === "IDENTITY_VERIFIED"
                        ? "default"
                        : "outline"
                    }
                  >
                    {agent.verificationLevel
                      .toLowerCase()
                      .replace(/_/g, " ")}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Display Name</dt>
                <dd className="font-medium">{agent.displayName}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Email</dt>
                <dd className="flex items-center gap-2">
                  <span className="font-medium">
                    {agent.email ?? "Not set"}
                  </span>
                  {agent.email && (
                    <Badge
                      variant={
                        agent.verificationLevel === "UNVERIFIED"
                          ? "destructive"
                          : "default"
                      }
                    >
                      {agent.verificationLevel === "UNVERIFIED"
                        ? "email unverified"
                        : "email verified"}
                    </Badge>
                  )}
                  {agent.verificationLevel === "UNVERIFIED" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto px-2 py-1 text-xs text-blue-600 hover:text-blue-700"
                      disabled={resendLoading}
                      onClick={handleResendVerification}
                    >
                      {resendLoading ? "Sending..." : "Resend verification email"}
                    </Button>
                  )}
                </dd>
                {resendResult && (
                  <p
                    className={`mt-1 text-xs ${
                      resendResult.type === "success"
                        ? "text-blue-600"
                        : "text-red-600"
                    }`}
                  >
                    {resendResult.message}
                  </p>
                )}
                {showOnboardingResend && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      Welcome email didn&apos;t send
                      {agent.onboardingEmailLastError
                        ? ` (${agent.onboardingEmailLastError})`
                        : ""}
                      .
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto px-2 py-1 text-xs text-blue-600 hover:text-blue-700"
                      disabled={onboardingResendLoading}
                      onClick={handleResendOnboarding}
                    >
                      {onboardingResendLoading
                        ? "Sending..."
                        : "Resend welcome email"}
                    </Button>
                  </div>
                )}
                {onboardingResendResult && (
                  <p
                    className={`mt-1 text-xs ${
                      onboardingResendResult.type === "success"
                        ? "text-blue-600"
                        : "text-red-600"
                    }`}
                  >
                    {onboardingResendResult.message}
                  </p>
                )}
              </div>
              {agent.description && (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Description</dt>
                  <dd className="font-medium">{agent.description}</dd>
                </div>
              )}
              {agent.websiteUrl && (
                <div>
                  <dt className="text-muted-foreground">Website</dt>
                  <dd className="font-medium truncate">{agent.websiteUrl}</dd>
                </div>
              )}
              {agent.contactEndpoint && (
                <div>
                  <dt className="text-muted-foreground">Contact Endpoint</dt>
                  <dd className="font-medium truncate">
                    {agent.contactEndpoint}
                  </dd>
                </div>
              )}
              {agent.logoUrl && (
                <div>
                  <dt className="text-muted-foreground">Logo URL</dt>
                  <dd className="font-medium truncate">{agent.logoUrl}</dd>
                </div>
              )}
              {agent.capabilities.length > 0 && (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Capabilities</dt>
                  <dd className="flex flex-wrap gap-1 mt-1">
                    {agent.capabilities.map((cap) => (
                      <Badge key={cap} variant="secondary">
                        {cap}
                      </Badge>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
        </CardHeader>
        <CardContent>
          <ApiKeyManagement credentials={credentials} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Webhooks</CardTitle>
        </CardHeader>
        <CardContent>
          <WebhookManagement webhooks={webhooks} />
        </CardContent>
      </Card>
    </>
  );
}

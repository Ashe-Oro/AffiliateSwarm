"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface AdminAgentActionsProps {
  agentId: string;
  status: string;
  verificationLevel: string;
  canResendVerification: boolean;
  mode?: "status" | "verification" | "onboarding";
}

export function AdminAgentActions({
  agentId,
  status,
  verificationLevel,
  canResendVerification,
  mode = "status",
}: AdminAgentActionsProps) {
  const router = useRouter();
  const [statusLoading, setStatusLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleAction(action: "SUSPEND" | "ACTIVATE") {
    setStatusLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/agents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Failed to ${action.toLowerCase()} agent`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setStatusLoading(false);
    }
  }

  async function handleResend(op: "resend_verification" | "resend_onboarding") {
    setResendLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, op }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data.error ?? `Failed to ${op.replace("_", " ")}`
        );
      }
      const label =
        op === "resend_verification" ? "Verification email" : "Welcome email";
      setMessage(data.email ? `Sent to ${data.email}` : `${label} sent`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setResendLoading(false);
    }
  }

  if (mode === "verification") {
    if (verificationLevel !== "UNVERIFIED") {
      return null;
    }

    return (
      <div className="flex flex-col gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-auto justify-start rounded-none px-0 text-blue-600 hover:bg-transparent hover:text-blue-700"
          disabled={resendLoading || !canResendVerification}
          onClick={() => handleResend("resend_verification")}
        >
          {resendLoading ? "Sending..." : "Resend email"}
        </Button>
        {message && <p className="text-xs text-blue-600">{message}</p>}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  if (mode === "onboarding") {
    // Onboarding email is only meaningful once verification has succeeded.
    if (verificationLevel === "UNVERIFIED") {
      return null;
    }

    return (
      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={resendLoading}
          onClick={() => handleResend("resend_onboarding")}
        >
          {resendLoading ? "Sending..." : "Resend welcome email"}
        </Button>
        {message && <p className="text-xs text-blue-600">{message}</p>}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {status === "ACTIVE" && (
        <Button
          variant="destructive"
          size="sm"
          disabled={statusLoading}
          onClick={() => handleAction("SUSPEND")}
        >
          Suspend
        </Button>
      )}
      {status === "SUSPENDED" && (
        <Button
          variant="outline"
          size="sm"
          disabled={statusLoading}
          onClick={() => handleAction("ACTIVATE")}
        >
          Activate
        </Button>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

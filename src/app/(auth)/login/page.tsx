"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";

const AGENT_PROMPT = "Get me an AffiliateSwarm login code";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

type LoginMode = "code" | "email" | "email-sent";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<LoginMode>("code");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message ?? "Invalid or expired code");
        return;
      }

      // If a ?redirect param was explicitly provided, use it.
      // Otherwise use the server-suggested redirect based on agent type.
      const explicitRedirect = searchParams.get("redirect");
      router.push(explicitRedirect || data.data?.redirectTo || "/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/email-login-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(
          data.error?.message ?? "Something went wrong. Please try again."
        );
        return;
      }

      setMode("email-sent");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md border-[var(--v2-border)] bg-[var(--v2-bg-elevated)]">
      <CardHeader>
        <CardTitle className="text-2xl text-[var(--v2-text)]">
          Sign in to AffiliateSwarm
        </CardTitle>
        <CardDescription className="text-[var(--v2-text-secondary)]">
          {mode === "email-sent"
            ? "Check your email for a login code."
            : "Get a login code from your AI agent, or we'll email you one."}
        </CardDescription>
      </CardHeader>

      {/* ── Enter a code (from agent or email) ── */}
      {(mode === "code" || mode === "email-sent") && (
        <form onSubmit={handleCodeSubmit}>
          <CardContent className="flex flex-col gap-4">
            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            {mode === "code" && (
              <div className="rounded-md border border-dashed border-[var(--v2-border)] bg-[var(--v2-bg)] p-4 text-center">
                <p className="text-sm text-[var(--v2-text-secondary)]">
                  Just ask your agent:
                </p>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <p className="font-mono text-sm font-medium text-[var(--v2-text)]">
                    &quot;{AGENT_PROMPT}&quot;
                  </p>
                  <CopyButton
                    text={AGENT_PROMPT}
                    variant="ghost"
                    size="icon"
                    label=""
                    copiedLabel=""
                    className="h-7 w-7 p-0 text-[var(--v2-text-secondary)] hover:text-[var(--v2-accent)]"
                  />
                </div>
              </div>
            )}

            {mode === "email-sent" && (
              <div className="rounded-md border border-green-800 bg-green-950 p-4 text-center">
                <p className="text-sm font-medium text-green-200">
                  Code sent! Check your email for a 6-character login code.
                </p>
                <p className="mt-1 text-xs text-green-400">
                  It may take a moment to arrive. Check your spam folder if
                  needed.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="code" className="text-[var(--v2-text-secondary)]">
                Login Code
              </Label>
              <Input
                id="code"
                type="text"
                placeholder="ABC123"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                required
                maxLength={6}
                autoComplete="off"
                className="border-[var(--v2-border)] bg-[var(--v2-bg)] text-center font-mono text-lg tracking-[0.3em] text-[var(--v2-text)] placeholder:text-[var(--v2-text-tertiary)]"
              />
              <p className="text-xs text-[var(--v2-text-tertiary)]">
                Codes expire after 5 minutes
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button
              type="submit"
              className="w-full bg-[var(--v2-accent)] text-[var(--v2-bg)] hover:bg-[var(--v2-accent-hover)]"
              disabled={loading || code.length < 6}
            >
              {loading ? "Verifying..." : "Log in"}
            </Button>
            {mode === "code" && (
              <button
                type="button"
                className="text-sm text-[var(--v2-accent)] underline underline-offset-4 hover:text-[var(--v2-accent-hover)]"
                onClick={() => {
                  setError(null);
                  setMode("email");
                }}
              >
                Send a code to my email instead
              </button>
            )}
            {mode === "email-sent" && (
              <button
                type="button"
                className="text-sm text-[var(--v2-accent)] underline underline-offset-4 hover:text-[var(--v2-accent-hover)]"
                onClick={() => {
                  setError(null);
                  setMode("email");
                }}
              >
                Resend code
              </button>
            )}
          </CardFooter>
        </form>
      )}

      {/* ── Enter email to receive a code ── */}
      {mode === "email" && (
        <form onSubmit={handleEmailSubmit}>
          <CardContent className="flex flex-col gap-4">
            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label
                htmlFor="email"
                className="text-[var(--v2-text-secondary)]"
              >
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="border-[var(--v2-border)] bg-[var(--v2-bg)] text-[var(--v2-text)] placeholder:text-[var(--v2-text-tertiary)]"
              />
              <p className="text-xs text-[var(--v2-text-tertiary)]">
                We&apos;ll send a login code to this email if it&apos;s
                registered on AffiliateSwarm.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button
              type="submit"
              className="w-full bg-[var(--v2-accent)] text-[var(--v2-bg)] hover:bg-[var(--v2-accent-hover)]"
              disabled={loading || !email.includes("@")}
            >
              {loading ? "Sending..." : "Send login code"}
            </Button>
            <button
              type="button"
              className="text-sm text-[var(--v2-accent)] underline underline-offset-4 hover:text-[var(--v2-accent-hover)]"
              onClick={() => {
                setError(null);
                setMode("code");
              }}
            >
              I already have a code
            </button>
          </CardFooter>
        </form>
      )}
    </Card>
  );
}

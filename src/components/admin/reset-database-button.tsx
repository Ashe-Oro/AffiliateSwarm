"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ResetDatabaseButton() {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "confirming" | "resetting" | "done">("idle");
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleReset() {
    setStep("resetting");
    setError(null);
    try {
      const res = await fetch("/api/admin/reset-database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "RESET" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : data.error?.message ?? "Reset failed",
        );
      }
      const d = data.deleted;
      setResult(
        `Deleted ${d.agents} agents, ${d.campaigns} campaigns, ${d.leads} leads, ${d.conversions} conversions, ${d.enrollments} enrollments, ${d.payouts} payouts`,
      );
      setStep("done");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("confirming");
    }
  }

  if (step === "idle") {
    return (
      <Button
        variant="destructive"
        size="sm"
        onClick={() => {
          setStep("confirming");
          setTyped("");
          setResult(null);
          setError(null);
        }}
      >
        Reset Database
      </Button>
    );
  }

  if (step === "done") {
    return (
      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground">{result}</p>
        <Button size="sm" variant="outline" onClick={() => setStep("idle")}>
          OK
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        className="w-40 h-8 text-sm"
        placeholder='Type "RESET" to confirm'
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        disabled={step === "resetting"}
      />
      <Button
        variant="destructive"
        size="sm"
        disabled={typed !== "RESET" || step === "resetting"}
        onClick={handleReset}
      >
        {step === "resetting" ? "Resetting..." : "Confirm Reset"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={step === "resetting"}
        onClick={() => setStep("idle")}
      >
        Cancel
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

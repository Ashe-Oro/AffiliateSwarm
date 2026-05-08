"use client";

import { useState } from "react";

export function CopyTrackingLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }

  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 truncate text-sm">{url}</code>
      <button
        onClick={handleCopy}
        className="shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

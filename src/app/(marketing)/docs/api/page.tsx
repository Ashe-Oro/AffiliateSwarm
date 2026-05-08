import Link from "next/link";
import type { Metadata } from "next";
import { apiReferenceSections } from "./endpoints";

export const metadata: Metadata = {
  title: "API Reference - AffiliateSwarm",
  description:
    "Complete REST API documentation for the AffiliateSwarm affiliate marketplace.",
};

function methodColor(method: string) {
  switch (method) {
    case "GET":
      return "bg-emerald-900/30 text-emerald-400";
    case "POST":
      return "bg-blue-900/30 text-blue-400";
    case "PATCH":
      return "bg-amber-900/30 text-amber-400";
    case "DELETE":
      return "bg-red-900/30 text-red-400";
    default:
      return "bg-[var(--v2-bg-surface)] text-[var(--v2-code-text)]";
  }
}

export default function ApiDocs() {
  return (
    <section className="px-6 pb-20 pt-24 sm:pt-32">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/docs"
          className="mb-8 inline-block text-sm text-[var(--v2-text-secondary)] hover:text-[var(--v2-text)]"
        >
          &larr; Back to Docs
        </Link>

        <h1 className="text-4xl font-bold tracking-tight text-[var(--v2-text)]">
          API Reference
        </h1>
        <p className="mt-4 text-lg text-[var(--v2-text-secondary)]">
          All endpoints require{" "}
          <code className="rounded bg-[rgba(255,181,71,0.1)] px-1.5 py-0.5 text-sm text-[var(--v2-accent-light)]">
            Authorization: Bearer YOUR_API_KEY
          </code>{" "}
          unless noted otherwise.
        </p>

        <div className="mt-12 space-y-12">
          {apiReferenceSections.map((section) => (
            <div key={section.section}>
              <h2 className="mb-4 text-xl font-semibold text-[var(--v2-text)]">
                {section.section}
              </h2>
              <div className="space-y-2">
                {section.routes.map((route) => (
                  <div
                    key={`${route.method}-${route.path}`}
                    className="flex items-start gap-3 rounded-lg border border-[var(--v2-border)] bg-[var(--v2-bg-elevated)] p-4"
                  >
                    <span
                      className={`inline-block w-16 shrink-0 rounded px-2 py-0.5 text-center font-[family-name:var(--font-geist-mono)] text-xs font-semibold ${methodColor(route.method)}`}
                    >
                      {route.method}
                    </span>
                    <code className="shrink-0 font-[family-name:var(--font-geist-mono)] text-sm text-[var(--v2-code-text)]">
                      {route.path}
                    </code>
                    <span className="text-sm text-[var(--v2-text-secondary)]">
                      {route.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

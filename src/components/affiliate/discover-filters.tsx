"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const COMPENSATION_MODELS = [
  { value: "", label: "All models" },
  { value: "CPL", label: "Cost per Lead" },
  { value: "CPA", label: "Flat fee" },
  { value: "CPC", label: "Cost per Click" },
  { value: "REV_SHARE", label: "Percent of sale" },
];

export function DiscoverFilters({ categories }: { categories: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      // Reset to page 1 when filters change
      params.delete("page");
      router.push(`/affiliate/discover?${params.toString()}`);
    },
    [router, searchParams]
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        placeholder="Search campaigns..."
        defaultValue={searchParams.get("q") ?? ""}
        onChange={(e) => {
          // Debounce-ish: update on blur or enter
        }}
        onBlur={(e) => updateParam("q", e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            updateParam("q", e.currentTarget.value);
          }
        }}
        className="w-64"
      />
      <Select
        value={searchParams.get("compensationModel") ?? ""}
        onChange={(e) => updateParam("compensationModel", e.target.value)}
      >
        {COMPENSATION_MODELS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </Select>
      {categories.length > 0 && (
        <Select
          value={searchParams.get("category") ?? ""}
          onChange={(e) => updateParam("category", e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}

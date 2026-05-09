import { cn } from "@/lib/utils";

interface BrandMarkProps {
  className?: string;
}

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("h-8 w-8", className)}
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x="5"
        y="5"
        width="54"
        height="54"
        rx="13"
        fill="var(--v2-bg-surface)"
        stroke="var(--v2-border)"
      />
      <path
        d="M18 18h13l15 8 7 14-13 9H23L11 38l7-20Z"
        fill="none"
        stroke="var(--v2-accent)"
        strokeWidth="2.1"
        strokeLinejoin="round"
      />
      <path
        d="M18 18 32 32 46 26M11 38l21-6 21 8M23 49l9-17 8 17"
        fill="none"
        stroke="var(--v2-accent-2)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
        opacity="0.9"
      />
      <path
        d="M32 18v14l8 17"
        fill="none"
        stroke="var(--v2-text-secondary)"
        strokeLinecap="round"
        strokeWidth="1.3"
        opacity="0.75"
      />
      <circle cx="32" cy="32" r="5.5" fill="var(--v2-bg)" />
      <circle cx="32" cy="32" r="3.2" fill="var(--v2-accent)" />
      {(
        [
          [18, 18, "var(--v2-accent-2)"],
          [46, 26, "var(--v2-accent)"],
          [53, 40, "var(--v2-accent-2)"],
          [40, 49, "var(--v2-accent-3)"],
          [23, 49, "var(--v2-accent)"],
          [11, 38, "var(--v2-accent-2)"],
          [32, 18, "var(--v2-text)"],
        ] as const
      ).map(([cx, cy, fill]) => (
        <circle
          key={`${cx}-${cy}`}
          cx={cx}
          cy={cy}
          r="3.4"
          fill={fill}
          stroke="var(--v2-bg)"
          strokeWidth="1.7"
        />
      ))}
    </svg>
  );
}

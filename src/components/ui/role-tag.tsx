import { cn } from "@/lib/utils";

type RoleTagProps = {
  role: "affiliate" | "advertiser";
  className?: string;
};

const roleStyles: Record<RoleTagProps["role"], string> = {
  affiliate: "bg-emerald-900 text-emerald-300",
  advertiser: "bg-blue-900 text-blue-300",
};

const roleLabels: Record<RoleTagProps["role"], string> = {
  affiliate: "Affiliate",
  advertiser: "Advertiser",
};

export function RoleTag({ role, className }: RoleTagProps) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-xs font-medium",
        roleStyles[role],
        className
      )}
    >
      {roleLabels[role]}
    </span>
  );
}

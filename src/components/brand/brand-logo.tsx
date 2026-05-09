import { BrandMark } from "@/components/brand/brand-mark";
import { PRODUCT_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  suffix?: string;
}

export function BrandLogo({
  className,
  markClassName,
  textClassName,
  suffix,
}: BrandLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="brand-mark-shell">
        <BrandMark className={cn("h-7 w-7", markClassName)} />
      </span>
      <span className={cn("tracking-tight", textClassName)}>
        {PRODUCT_NAME}
        {suffix ? (
          <span className="text-[var(--v2-text-secondary)]"> {suffix}</span>
        ) : null}
      </span>
    </span>
  );
}

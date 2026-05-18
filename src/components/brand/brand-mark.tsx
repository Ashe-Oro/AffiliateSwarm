import Image from "next/image";
import { cn } from "@/lib/utils";

interface BrandMarkProps {
  className?: string;
}

export const BRAND_MARK_SRC = "/brand/production-logo/affiliateswarm-logo.png";

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <Image
      src={BRAND_MARK_SRC}
      alt=""
      width={1024}
      height={1024}
      sizes="32px"
      className={cn("h-8 w-8 object-contain", className)}
      aria-hidden="true"
    />
  );
}

import Image from "next/image";
import { cn } from "@/lib/utils";

export type BrandMarkVariant = "default" | "navDark";

interface BrandMarkProps {
  className?: string;
  variant?: BrandMarkVariant;
}

export const BRAND_MARK_SRC = "/brand/production-logo/affiliateswarm-logo.png";
export const BRAND_MARK_NAV_DARK_SRC =
  "/brand/production-logo/affiliateswarm-logo-nav-dark.png";

export function BrandMark({ className, variant = "default" }: BrandMarkProps) {
  const src = variant === "navDark" ? BRAND_MARK_NAV_DARK_SRC : BRAND_MARK_SRC;

  return (
    <Image
      src={src}
      alt=""
      width={1024}
      height={1024}
      sizes="36px"
      quality={100}
      className={cn("h-8 w-8 object-contain", className)}
      aria-hidden="true"
    />
  );
}

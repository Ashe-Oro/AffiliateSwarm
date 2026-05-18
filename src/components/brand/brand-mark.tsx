import { cn } from "@/lib/utils";

interface BrandMarkProps {
  className?: string;
}

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg
      viewBox="96 83 1062 1062"
      className={cn("h-8 w-8", className)}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient
          id="brand-mark-teal-left"
          x1="167"
          y1="442"
          x2="459"
          y2="753"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#28d4cc" />
          <stop offset="1" stopColor="#18b5b0" />
        </linearGradient>
        <linearGradient
          id="brand-mark-teal-right"
          x1="797"
          y1="442"
          x2="1086"
          y2="753"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#28d4cc" />
          <stop offset="1" stopColor="#18b5b0" />
        </linearGradient>
        <linearGradient
          id="brand-mark-teal-head"
          x1="489"
          y1="240"
          x2="766"
          y2="470"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#28d4cc" />
          <stop offset="1" stopColor="#18b5b0" />
        </linearGradient>
        <linearGradient
          id="brand-mark-gold"
          x1="460"
          y1="117"
          x2="795"
          y2="1114"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#ffd034" />
          <stop offset="1" stopColor="#f6ae13" />
        </linearGradient>
        <linearGradient
          id="brand-mark-navy"
          x1="490"
          y1="495"
          x2="766"
          y2="962"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#06274f" />
          <stop offset="1" stopColor="#001832" />
        </linearGradient>
        <linearGradient
          id="brand-mark-cream"
          x1="490"
          y1="730"
          x2="766"
          y2="903"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#fffdfa" />
          <stop offset="1" stopColor="#f8f2e5" />
        </linearGradient>
      </defs>
      <path
        d="M168 442 459 539v81L243 753Z"
        fill="url(#brand-mark-teal-left)"
      />
      <path
        d="M1086 442 797 539v81l214 133Z"
        fill="url(#brand-mark-teal-right)"
      />
      <g
        fill="none"
        stroke="url(#brand-mark-gold)"
        strokeWidth="24"
        strokeLinecap="butt"
      >
        <path d="M531 258 469 148" />
        <path d="M723 258 785 148" />
      </g>
      <g fill="url(#brand-mark-gold)">
        <circle cx="460" cy="146" r="29" />
        <circle cx="793" cy="146" r="29" />
      </g>
      <path
        d="M557 240h141l68 115-68 115H557l-68-115Z"
        fill="url(#brand-mark-teal-head)"
      />
      <path d="M532 963h192l-96 151Z" fill="url(#brand-mark-gold)" />
      <path d="M544 495h167l55 44v423H490V539Z" fill="url(#brand-mark-navy)" />
      <path
        d="M544 495h167l55 44v71L628 700 490 610v-71Z"
        fill="url(#brand-mark-gold)"
      />
      <path
        d="M490 730 628 835l138-105v60L628 903 490 790Z"
        fill="url(#brand-mark-cream)"
      />
    </svg>
  );
}

export type AvailabilityInfo = {
  label: string;
  variant: "default" | "secondary" | "outline";
  dateLine?: string;
};

type LeadForAvailability = {
  status: string;
  escrowHold: {
    status: string;
    releaseAt: Date | null;
    releasedAt?: Date | null;
  } | null;
};

function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function getAvailability(
  lead: LeadForAvailability,
  now: Date
): AvailabilityInfo {
  if (lead.status !== "VERIFIED") {
    return { label: "--", variant: "secondary" };
  }

  const hold = lead.escrowHold;
  if (!hold) {
    return { label: "Pending", variant: "secondary" };
  }

  if (hold.status === "RELEASED") {
    const since = hold.releasedAt ?? hold.releaseAt;
    return {
      label: "Available",
      variant: "default",
      dateLine: since ? `since ${formatShortDate(since)}` : undefined,
    };
  }

  if (hold.status === "PENDING_RELEASE" && hold.releaseAt) {
    const daysRemaining = Math.ceil(
      (hold.releaseAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysRemaining <= 0) {
      return {
        label: "Available",
        variant: "default",
        dateLine: `since ${formatShortDate(hold.releaseAt)}`,
      };
    }
    return {
      label: `${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}`,
      variant: "outline",
      dateLine: formatShortDate(hold.releaseAt),
    };
  }

  return { label: "Pending", variant: "secondary" };
}

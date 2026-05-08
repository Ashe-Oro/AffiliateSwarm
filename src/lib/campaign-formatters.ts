export function formatHoldingPeriodDays(days: number): string {
  if (days === 0) return "0 days (instant)";
  if (days === 1) return "1 day";
  return `${days} days`;
}

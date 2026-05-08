import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DisputeConversionDialog } from "@/components/dashboard/dispute-conversion-dialog";
import type {
  UnifiedConversionRow,
  UnifiedConversionStatus,
} from "@/services/conversions.service";

function formatCents(cents: number | null): string {
  if (cents == null) return "--";
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusVariant(
  status: UnifiedConversionStatus
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "PAID":
    case "MATURED":
      return "default";
    case "HELD":
    case "PENDING":
      return "secondary";
    case "DISPUTED":
    case "REVERSED":
      return "destructive";
    default:
      return "outline";
  }
}

function statusLabel(status: UnifiedConversionStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

interface ConversionsTableProps {
  rows: UnifiedConversionRow[];
  emptyLabel?: string;
  showCampaignColumn?: boolean;
  campaignMap?: Map<string, string>;
  leadCampaignMap?: Map<string, string>;
}

export function ConversionsTable({
  rows,
  emptyLabel = "No conversions yet",
  showCampaignColumn = false,
  leadCampaignMap,
}: ConversionsTableProps) {
  const colCount = showCampaignColumn ? 7 : 6;

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {showCampaignColumn && <TableHead>Campaign</TableHead>}
            <TableHead>Source</TableHead>
            <TableHead>Conversion Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Hold Window</TableHead>
            <TableHead>Maturity</TableHead>
            <TableHead className="text-right">Payout</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={colCount + 2}
                className="text-center text-muted-foreground"
              >
                {emptyLabel}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.leadId}>
                {showCampaignColumn && (
                  <TableCell className="font-medium">
                    {leadCampaignMap?.get(row.leadId) ?? "--"}
                  </TableCell>
                )}
                <TableCell>
                  <div className="flex flex-col">
                    <span>{row.affiliateDisplayName}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {row.source}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {formatDateTime(row.conversionDate)}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(row.unifiedStatus)}>
                    {statusLabel(row.unifiedStatus)}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {row.daysRemaining != null
                    ? `${row.daysRemaining} day${row.daysRemaining === 1 ? "" : "s"}`
                    : "--"}
                </TableCell>
                <TableCell className="text-sm">
                  {row.maturityDate
                    ? `Matures ${formatDate(row.maturityDate)}`
                    : "--"}
                </TableCell>
                <TableCell className="text-right">
                  {formatCents(row.payoutCents)}
                </TableCell>
                <TableCell>
                  <DisputeConversionDialog
                    leadId={row.leadId}
                    canDispute={row.canDispute}
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

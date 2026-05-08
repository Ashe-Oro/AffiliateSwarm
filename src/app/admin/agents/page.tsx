export const dynamic = "force-dynamic";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { AdminAgentActions } from "@/components/admin/agent-actions";

function statusVariant(status: string) {
  switch (status) {
    case "ACTIVE":
      return "default" as const;
    case "SUSPENDED":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

export default async function AgentsPage() {
  const agents = await prisma.agent.findMany({
    include: {
      reputation: true,
      wallet: true,
      ownerUser: {
        select: { email: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Agents</h2>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Verification</TableHead>
              <TableHead>Resend Verification</TableHead>
              <TableHead>Trust Tier</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  No agents found
                </TableCell>
              </TableRow>
            ) : (
              agents.map((agent) => (
                <TableRow key={agent.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/admin/agents/${agent.id}`}
                      className="hover:underline"
                    >
                      {agent.displayName}
                    </Link>
                  </TableCell>
                  <TableCell className="capitalize">
                    {agent.type.toLowerCase()}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {agent.email ?? agent.ownerUser?.email ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(agent.status)}>
                      {agent.status.toLowerCase().replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="capitalize text-sm">
                    {agent.verificationLevel.toLowerCase().replace(/_/g, " ")}
                  </TableCell>
                  <TableCell>
                    <AdminAgentActions
                      agentId={agent.id}
                      status={agent.status}
                      verificationLevel={agent.verificationLevel}
                      canResendVerification={
                        agent.verificationLevel === "UNVERIFIED" &&
                        Boolean(agent.email ?? agent.ownerUser?.email)
                      }
                      mode="verification"
                    />
                  </TableCell>
                  <TableCell className="capitalize">
                    {agent.reputation?.trustTier?.toLowerCase().replace("_", " ") ?? "unknown"}
                  </TableCell>
                  <TableCell>
                    {agent.createdAt.toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </TableCell>
                  <TableCell>
                    <AdminAgentActions
                      agentId={agent.id}
                      status={agent.status}
                      verificationLevel={agent.verificationLevel}
                      canResendVerification={
                        agent.verificationLevel === "UNVERIFIED" &&
                        Boolean(agent.email ?? agent.ownerUser?.email)
                      }
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

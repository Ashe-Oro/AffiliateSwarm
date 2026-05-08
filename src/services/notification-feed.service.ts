import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { NotFoundError } from "@/lib/errors";
import { EVENT_CONFIG } from "@/lib/notifications/events";
import { resolveRecipients } from "@/lib/notifications/recipients";
import { renderNotification } from "@/lib/notifications/feed";
import type { NotificationEvent } from "@/lib/notifications/events";
import type { ListNotificationsInput } from "@/lib/validators/notification";
import type { Prisma } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FormattedNotification {
  id: string;
  eventType: string;
  category: string;
  title: string;
  summary: string;
  resourceType: string | null;
  resourceId: string | null;
  read: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Create feed notifications (called from notify() pipeline)
// ---------------------------------------------------------------------------

export async function createFeedNotifications(
  event: NotificationEvent
): Promise<void> {
  const config = EVENT_CONFIG[event.type];
  if (config.recipients === "none") return;

  const recipients = await resolveRecipients(event);
  if (recipients.length === 0) return;

  const rows: Prisma.NotificationCreateManyInput[] = [];
  const seenAgentIds = new Set<string>();

  for (const recipient of recipients) {
    // Dedup: a DUAL agent could appear as both advertiser and affiliate
    if (seenAgentIds.has(recipient.agentId)) continue;
    seenAgentIds.add(recipient.agentId);

    const rendered = renderNotification(event, recipient);
    if (!rendered) continue;

    rows.push({
      agentId: recipient.agentId,
      eventType: event.type,
      category: rendered.category,
      title: rendered.title,
      summary: rendered.summary,
      resourceType: rendered.resourceType,
      resourceId: rendered.resourceId,
    });
  }

  if (rows.length > 0) {
    await prisma.notification.createMany({ data: rows });
    logger.debug(
      { eventType: event.type, count: rows.length },
      "Feed notifications created"
    );
  }
}

// ---------------------------------------------------------------------------
// List notifications (paginated)
// ---------------------------------------------------------------------------

export async function listNotifications(
  agentId: string | string[],
  filters: ListNotificationsInput
): Promise<{
  notifications: FormattedNotification[];
  totalCount: number;
  page: number;
  pageSize: number;
}> {
  const where: Prisma.NotificationWhereInput = agentIdFilter(agentId);

  if (filters.read === true) {
    where.readAt = { not: null };
  } else if (filters.read === false) {
    where.readAt = null;
  }

  if (filters.category) {
    where.category = filters.category;
  }

  if (filters.eventType) {
    where.eventType = filters.eventType;
  }

  const [notifications, totalCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.notification.count({ where }),
  ]);

  return {
    notifications: notifications.map(formatNotification),
    totalCount,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

// ---------------------------------------------------------------------------
// Mark one as read
// ---------------------------------------------------------------------------

export async function markRead(agentId: string | string[], notificationId: string): Promise<FormattedNotification> {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  const ids = Array.isArray(agentId) ? agentId : [agentId];
  if (!notification || !ids.includes(notification.agentId)) {
    throw new NotFoundError("Notification", notificationId);
  }

  if (notification.readAt) {
    return formatNotification(notification);
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  });

  return formatNotification(updated);
}

// ---------------------------------------------------------------------------
// Mark all as read
// ---------------------------------------------------------------------------

export async function markAllRead(
  agentId: string | string[],
  before?: Date
): Promise<number> {
  const where: Prisma.NotificationWhereInput = {
    ...agentIdFilter(agentId),
    readAt: null,
  };

  if (before) {
    where.createdAt = { lte: before };
  }

  const result = await prisma.notification.updateMany({
    where,
    data: { readAt: new Date() },
  });

  return result.count;
}

// ---------------------------------------------------------------------------
// Unread count
// ---------------------------------------------------------------------------

export async function getUnreadCount(agentId: string | string[]): Promise<number> {
  return prisma.notification.count({
    where: { ...agentIdFilter(agentId), readAt: null },
  });
}

// ---------------------------------------------------------------------------
// Cleanup old notifications
// ---------------------------------------------------------------------------

export async function cleanupOldNotifications(
  retentionDays = 90
): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const result = await prisma.notification.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  logger.info(
    { deleted: result.count, retentionDays },
    "Old notifications cleaned up"
  );

  return result.count;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function agentIdFilter(agentId: string | string[]): Prisma.NotificationWhereInput {
  return Array.isArray(agentId)
    ? { agentId: { in: agentId } }
    : { agentId };
}

function formatNotification(n: {
  id: string;
  eventType: string;
  category: string;
  title: string;
  summary: string;
  resourceType: string | null;
  resourceId: string | null;
  readAt: Date | null;
  createdAt: Date;
}): FormattedNotification {
  return {
    id: n.id,
    eventType: n.eventType,
    category: n.category,
    title: n.title,
    summary: n.summary,
    resourceType: n.resourceType,
    resourceId: n.resourceId,
    read: n.readAt !== null,
    createdAt: n.createdAt.toISOString(),
  };
}

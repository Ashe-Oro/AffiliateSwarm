import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getResend, getFromAddress } from "@/lib/email";
import { deliverEvent } from "@/services/webhook.service";
import { createFeedNotifications } from "@/services/notification-feed.service";
import { EVENT_CONFIG, getAggregateInfo } from "@/lib/notifications/events";
import { resolveRecipients } from "@/lib/notifications/recipients";
import { renderEmail } from "@/lib/notifications/emails";
import type { NotificationEvent } from "@/lib/notifications/events";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEDUP_WINDOW_MS = 60_000; // 60 seconds

// ---------------------------------------------------------------------------
// Dedup check via DomainEvent table
// ---------------------------------------------------------------------------

async function isDuplicate(
  aggregateType: string,
  aggregateId: string,
  eventType: string
): Promise<boolean> {
  const cutoff = new Date(Date.now() - DEDUP_WINDOW_MS);
  const existing = await prisma.domainEvent.findFirst({
    where: {
      aggregateType,
      aggregateId,
      eventType,
      createdAt: { gte: cutoff },
    },
    select: { id: true },
  });
  return existing !== null;
}

async function recordEvent(
  aggregateType: string,
  aggregateId: string,
  eventType: string,
  payload: unknown
): Promise<void> {
  // Get the next version for this aggregate
  const lastEvent = await prisma.domainEvent.findFirst({
    where: { aggregateType, aggregateId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (lastEvent?.version ?? 0) + 1;

  await prisma.domainEvent.create({
    data: {
      aggregateType,
      aggregateId,
      eventType,
      payload: payload as object,
      version,
      publishedAt: new Date(),
    },
  });
}

// ---------------------------------------------------------------------------
// Email dispatch
// ---------------------------------------------------------------------------

async function sendEmails(event: NotificationEvent): Promise<void> {
  const config = EVENT_CONFIG[event.type];
  if (!config.email) return;

  const recipients = await resolveRecipients(event);
  if (recipients.length === 0) return;

  const resend = getResend();

  for (const recipient of recipients) {
    const rendered = renderEmail(event, recipient);
    if (!rendered) continue;

    if (resend) {
      const { error } = await resend.emails.send({
        from: getFromAddress(),
        to: recipient.email,
        subject: rendered.subject,
        html: rendered.html,
      });
      if (error) {
        logger.error(
          { error, to: recipient.email, eventType: event.type },
          "Failed to send notification email"
        );
      }
    } else {
      logger.info(
        { to: recipient.email, subject: rendered.subject, eventType: event.type },
        "Notification email (dev mode — set RESEND_API_KEY)"
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send a notification for a lifecycle event.
 * Fire-and-forget — does not block the caller.
 */
export function notify(event: NotificationEvent): void {
  void (async () => {
    try {
      const { aggregateType, aggregateId } = getAggregateInfo(event);

      // Dedup: skip if we already processed this event recently
      if (await isDuplicate(aggregateType, aggregateId, event.type)) {
        logger.debug(
          { eventType: event.type, aggregateType, aggregateId },
          "Skipping duplicate notification"
        );
        return;
      }

      // Record in audit log
      await recordEvent(aggregateType, aggregateId, event.type, event.data);

      // Dispatch webhook
      const config = EVENT_CONFIG[event.type];
      if (config.webhook) {
        deliverEvent(event.type, event.data);
      }

      // Create in-app feed notifications
      try {
        await createFeedNotifications(event);
      } catch (err) {
        logger.error(
          { err, eventType: event.type },
          "Feed notification creation failed"
        );
      }

      // Dispatch emails
      if (config.email) {
        await sendEmails(event);
      }
    } catch (err) {
      logger.error(
        { err, eventType: event.type },
        "Notification dispatch failed"
      );
    }
  })();
}

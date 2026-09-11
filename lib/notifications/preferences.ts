// Notification preferences (Phase 3). In-app is currently always on; this
// module will read a reserved `notification_preferences` table when it ships —
// see docs/NOTIFICATION_ARCHITECTURE.md §11. The table does NOT exist yet and
// is deliberately NOT created here: the in-app path must not depend on it, so
// this stays DB-free and returns true until the seam is wired.

import type { NotificationType } from "./types";

// Future seam: `notification_preferences` (user_id × notification_type →
// in_app_enabled / email_enabled / push_enabled) read slots in here for
// external delivery (docs/NOTIFICATION_ARCHITECTURE.md §11). The in-app path
// ignores it by design — absence of the table degrades to "always on".
export async function areInAppNotificationsEnabled(_userId: string, _type: NotificationType): Promise<boolean> {
  return true;
}

const TYPE_LABELS: Record<NotificationType, string> = {
  "agent.started": "Agent started",
  "agent.completed": "Agent run completed",
  "agent.awaiting_approval": "Your plan is ready",
  "agent.failed": "Agent run failed",
  "agent.paused": "Agent run stopped",
  "source.processing": "Your source is processing",
  "source.ready": "Your source is ready",
  "source.failed": "Source processing failed",
  "content.generated": "Your draft is ready",
  "content.validated": "Content validated",
  "content.review_required": "Review required",
  "content.approved": "Content approved",
  "publish.scheduled": "Post scheduled",
  "publish.started": "Publishing started",
  "publish.published": "Published successfully",
  "publish.failed": "Publishing failed",
  "usage.limit_near": "You've used most of your monthly usage",
  "usage.limit_reached": "Your monthly usage limit has been reached",
  "subscription.updated": "Plan updated",
  "payment.failed": "Payment failed",
  "system.maintenance": "Maintenance",
  "system.warning": "System warning",
  "system.announcement": "Announcement"
};

// Human label for a taxonomy type (used by the frontend later); falls back to
// the raw type string for anything unknown.
export function notificationTypeLabel(type: NotificationType): string {
  return TYPE_LABELS[type] ?? type;
}
// SERVER-ONLY — never import this module (or the barrel) from a client component
// Notification service (Phase 3) — public surface. Downstream phases (emitters,
// API layer, frontend) import everything they need from this single entry.

export {
  NOTIFICATION_SEVERITIES,
  NOTIFICATION_TYPES,
  ALLOWED_ACTION_URL_PREFIXES,
  isSafeActionUrl
} from "./types";
export type {
  NotificationSeverity,
  NotificationType,
  NotificationInput,
  NotificationRecord
} from "./types";

export { createNotification, notificationRowToRecord } from "./create";

export {
  notifyAgentRunChanged,
  notifySourceChanged,
  notifyContentGenerated,
  notifyPublishChanged,
  notifyUsageLimit,
  notifyBillingEvent
} from "./events";

export { areInAppNotificationsEnabled, notificationTypeLabel } from "./preferences";
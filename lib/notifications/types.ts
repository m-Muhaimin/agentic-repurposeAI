// Domain types for the notification service (Phase 3). The frontend and the
// API layer import these exact shapes, so this file stays dependency-free:
// no supabase, no logger. See docs/NOTIFICATION_ARCHITECTURE.md for the
// locked design this implements.

export const NOTIFICATION_SEVERITIES = ["info", "success", "warning", "error"] as const;
export type NotificationSeverity = (typeof NOTIFICATION_SEVERITIES)[number];

// The allowlisted taxonomy (docs/NOTIFICATION_ARCHITECTURE.md §3). `type` is a
// contract, not free text: createNotification drops anything outside this list.
export const NOTIFICATION_TYPES = [
  "agent.started",
  "agent.completed",
  "agent.awaiting_approval",
  "agent.failed",
  "agent.paused",
  "source.processing",
  "source.ready",
  "source.failed",
  "content.generated",
  "content.validated",
  "content.review_required",
  "content.approved",
  "publish.scheduled",
  "publish.started",
  "publish.published",
  "publish.failed",
  "usage.limit_near",
  "usage.limit_reached",
  "subscription.updated",
  "payment.failed",
  "system.maintenance",
  "system.warning",
  "system.announcement"
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// What a domain emitter passes in. Entity/dedupe/expiry are all optional —
// most builders only fill a subset.
export interface NotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  severity?: NotificationSeverity;
  entityType?: string | null;
  entityId?: string | null;
  actionUrl?: string | null;
  metadata?: Record<string, unknown> | null;
  dedupeKey?: string | null;
  expiresAt?: string | null;
}

// The camelCase domain shape returned to callers and (later) the API layer —
// converted from the snake_case DB row by notificationRowToRecord.
export interface NotificationRecord {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  severity: NotificationSeverity;
  entityType: string | null;
  entityId: string | null;
  actionUrl: string | null;
  metadata: Record<string, unknown> | null;
  dedupeKey: string | null;
  expiresAt: string | null;
  readAt: string | null;
  createdAt: string;
}

// Internal-path allowlist for action_url (docs/NOTIFICATION_ARCHITECTURE.md §9
// pt 4). The UI renders a link only when this passes — anything else is stored
// NULL so the browser never gets an unsafe href.
export const ALLOWED_ACTION_URL_PREFIXES = [
  "/agent",
  "/library",
  "/repurpose",
  "/publish",
  "/settings",
  "/dashboard",
  "/content",
  "/connections",
  "/branding",
  "/notifications",
  "/upload"
] as const;

// A safe action URL is a relative internal path: exactly one leading "/" (not
// "//"), no ":" (blocks https:, javascript:, mailto: schemes), no backslashes,
// no control characters, and a known app-route prefix.
export function isSafeActionUrl(url: string | null | undefined): boolean {
  if (typeof url !== "string") return false;
  if (!url.startsWith("/") || url.startsWith("//")) return false;
  if (url.includes(":")) return false;
  if (url.includes("\\")) return false;
  if (/[\u0000-\u001f\u007f\u0080-\u009f]/.test(url)) return false;
  return ALLOWED_ACTION_URL_PREFIXES.some((prefix) => url.startsWith(prefix));
}
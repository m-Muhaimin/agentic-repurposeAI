// P10: Publish-queue approval state machine + publish gating — pure logic, no I/O.
//
// The "publish queue" is a read-mostly surface over the existing
// `v4_distribution_jobs` table (reused, not a parallel table). These phases only
// add the honest, manual-approval workflow GROUNDWORK on top of the Stage-4
// stub. There is deliberately:
//   - NO autopilot: no action in this state machine auto-advances a job.
//   - NO real publishing: any "send to a provider" transition is gated by a
//     `channelsConnected` flag that is ALWAYS false in this build (no provider
//     is wired), so a job can never reach `published` here.
//
// Stored status vocabulary matches the schema enum exactly:
//   draft | scheduled | published | failed | cancelled
// We map the queue's notion of "queued, waiting for the human" onto the
// existing `scheduled` enum value — but here `scheduled` means "pending human
// approval, sitting indefinitely" and NEVER auto-advances. The schema enum is
// intentionally unchanged (no migration).

import type { DistributionPlatform } from "@/types/agent";

export const PUBLISH_CHANNELS = [
  "linkedin",
  "x",
  "newsletter",
  "youtube_shorts",
  "tiktok",
  "instagram"
] as const;
export type PublishChannel = (typeof PUBLISH_CHANNELS)[number];

// The only non-terminal statuses the queue ever writes. `published` is only
// ever reached by an explicit `send` action AND channelsConnected=true — which
// is impossible in this build.
export type PublishJobStatus = "draft" | "scheduled" | "published" | "failed" | "cancelled";

export type PublishAction =
  // A human queues a draft for later send (creates a pending job).
  | { type: "queue" }
  // The human explicitly approves sending a queued job.
  | { type: "approve_send" }
  // The user withdraws the job.
  | { type: "cancel" };

// Whether any external publishing provider is connected. This is the single
// honest gate: in this build no provider is wired, so it is ALWAYS false. Any
// code that wants to actually send MUST consult this and refuse when false.
export function publishingChannelsConnected(): boolean {
  return false;
}

export const NOT_CONNECTED_MESSAGE =
  "No publishing channel is connected. Publishing to a provider is not available yet — this is the honest stub state.";

// The legal transitions of the approval state machine. `published` requires an
// explicit `approve_send` action AND an actual connected channel; both are
// checked here, so even a forced `approve_send` cannot produce `published`
// when channels are disconnected. Every action is explicit — nothing advances
// on its own (no autopilot).
export function nextPublishStatus(
  current: PublishJobStatus,
  action: PublishAction,
  channelsConnected = publishingChannelsConnected()
): PublishJobStatus {
  switch (action.type) {
    case "queue":
      // A draft becomes a scheduled/pending item only when a human queues it.
      if (current === "draft") return "scheduled";
      return current;
    case "approve_send":
      // Explicit pre-send approval — but sending still requires a real
      // connected channel. Without one, the job stays pending; it can never
      // reach `published`.
      if (current === "scheduled" && channelsConnected) return "published";
      return current;
    case "cancel":
      if (current === "draft" || current === "scheduled") return "cancelled";
      return current;
    default:
      return current;
  }
}

// Convenience predicates used by the UI to decide how to render + gate actions,
// derived entirely from the state machine above so the UI can't drift.
export function isPublishable(status: PublishJobStatus): boolean {
  return status === "draft";
}

export function isPendingSend(status: PublishJobStatus): boolean {
  return status === "scheduled";
}

export function canRequestSend(status: PublishJobStatus): boolean {
  return status === "scheduled" && publishingChannelsConnected();
}

// The honest reason a "Send" is blocked, when it is. Returns null when the job
// both may be sent AND a channel is connected (never true in this build).
export function publishBlockReason(status: PublishJobStatus): string | null {
  if (isPendingSend(status) && !publishingChannelsConnected()) {
    return NOT_CONNECTED_MESSAGE;
  }
  if (status === "published") return "Already marked published.";
  if (status === "cancelled") return "This job was cancelled.";
  if (status === "failed") return "This job failed.";
  return null;
}

// Label for a queue entry's status — read-mostly render aid.
export function publishStatusLabel(status: PublishJobStatus): string {
  switch (status) {
    case "draft":
      return "Draft — not queued";
    case "scheduled":
      return "Queued — awaiting your approval to send";
    case "published":
      return "Published";
    case "cancelled":
      return "Cancelled";
    case "failed":
      return "Failed";
  }
}

// Validate + normalize a platform string against the known enum (shared by the
// route and tests so bad client input can't sneak through).
export function normalizePlatform(v: unknown): DistributionPlatform | null {
  return typeof v === "string" && (PUBLISH_CHANNELS as readonly string[]).includes(v)
    ? (v as DistributionPlatform)
    : null;
}

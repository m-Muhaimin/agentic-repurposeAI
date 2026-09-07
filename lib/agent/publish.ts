// P10: Publish-queue approval state machine + publish gating — pure logic, no I/O.
//
// The "publish queue" is a read-mostly surface over the existing
// `v4_distribution_jobs` table. These phases add the honest, manual-approval
// workflow on top of the Stage-4 BYOB publish path. There is deliberately:
//   - NO autopilot: no action in this state machine auto-advances a job.
//   - Gated publishing: any "send to a provider" transition needs an explicit
//     human approval AND a connected channel, which is now real (Buffer via
//     buffer_connections, see publishingChannelsConnected below). Without a
//     connected channel a job can never reach `published`.
//
// Stored status vocabulary matches the schema enum exactly:
//   draft | scheduled | published | failed | cancelled
// We map the queue's notion of "queued, waiting for the human" onto the
// existing `scheduled` enum value — but here `scheduled` means "pending human
// approval, sitting indefinitely" and NEVER auto-advances. The schema enum is
// intentionally unchanged (no migration).

import type { DistributionPlatform } from "@/types/agent";
import { createServiceClient } from "@/lib/supabase/server";

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
// ever reached by an explicit `send` action AND channelsConnected=true.
export type PublishJobStatus = "draft" | "scheduled" | "published" | "failed" | "cancelled";

export type PublishAction =
  // A human queues a draft for later send (creates a pending job).
  | { type: "queue" }
  // The human explicitly approves sending a queued job.
  | { type: "approve_send" }
  // The user withdraws the job.
  | { type: "cancel" };

export type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

// Whether the user has a real publishing provider connected (Buffer, Stage 4).
// This is the single honest gate: no buffer_connections row for the user means
// no channel, and SENDING MUST refuse when false. Async, DB-backed — callers
// pass the same service client they already hold for the request.
export async function publishingChannelsConnected(userId: string, service: ServiceClient): Promise<boolean> {
  if (!userId || typeof service?.from !== "function") return false;
  const { data, error } = await service
    .from("buffer_connections")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return false;
  return true;
}

export const NOT_CONNECTED_MESSAGE =
  "No publishing channel is connected. Connect a Buffer account to enable sending to your channels.";

// The legal transitions of the approval state machine. `published` requires an
// explicit `approve_send` action AND an actual connected channel; both are
// checked here, so even a forced `approve_send` cannot produce `published`
// when channels are disconnected. Every action is explicit — nothing advances
// on its own (no autopilot). Callers resolve `channelsConnected` via the
// DB-backed publishingChannelsConnected(userId, serviceClient).
export function nextPublishStatus(
  current: PublishJobStatus,
  action: PublishAction,
  channelsConnected = false
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

export function canRequestSend(status: PublishJobStatus, channelsConnected = false): boolean {
  return status === "scheduled" && channelsConnected;
}

// The honest reason a "Send" is blocked, when it is. Returns null when the job
// both may be sent AND a channel is connected.
export function publishBlockReason(status: PublishJobStatus, channelsConnected = false): string | null {
  if (isPendingSend(status) && !channelsConnected) {
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

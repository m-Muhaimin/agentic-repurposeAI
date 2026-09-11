// Domain event builders (Phase 3) — the ONLY entry points integrations use.
// Each builder maps a domain transition to a NotificationInput and delegates
// persistence to createNotification. This file is deliberately PURE of
// supabase imports: it only knows createNotification + the domain types.

import { createNotification } from "./create";
import type { NotificationRecord, NotificationSeverity, NotificationType } from "./types";

// ── Agent runs ───────────────────────────────────────────────────────────────

// v4_agent_runs.status → notification type. "created"/"evaluating" (and any
// future status) deliberately map to NOTHING: they are sub-phase noise, not
// user-facing transitions (docs/NOTIFICATION_ARCHITECTURE.md §3 anti-spam).
const AGENT_STATUS_TO_TYPE: Record<string, NotificationType> = {
  planning: "agent.started",
  executing: "agent.started",
  awaiting_approval: "agent.awaiting_approval",
  done: "agent.completed",
  failed: "agent.failed",
  cancelled: "agent.paused"
};

const AGENT_RUN_COPY: Record<string, { title: string; body: string; severity: NotificationSeverity }> = {
  "agent.started": {
    title: "Agent started",
    body: "VervAI is analyzing your source and preparing recommendations.",
    severity: "info"
  },
  "agent.awaiting_approval": {
    title: "Your plan is ready",
    body: "VervAI has prepared recommendations for your review.",
    severity: "info"
  },
  "agent.completed": {
    title: "Agent run completed",
    body: "Your recommended content plan is ready to review.",
    severity: "success"
  },
  "agent.failed": {
    title: "Agent run failed",
    body: "VervAI couldn't complete this run. Review the run status and try again.",
    severity: "error"
  },
  "agent.paused": {
    title: "Agent run stopped",
    body: "Your agent run was stopped before it finished.",
    severity: "warning"
  }
};

export async function notifyAgentRunChanged(
  userId: string,
  run: { id: string; status: string },
  opts?: { actionUrl?: string }
): Promise<NotificationRecord | null> {
  const type = AGENT_STATUS_TO_TYPE[run.status];
  if (!type) return null; // not a notifiable phase — no notification, no insert
  const copy = AGENT_RUN_COPY[type];
  return createNotification({
    userId,
    type,
    title: copy.title,
    body: copy.body,
    severity: copy.severity,
    entityType: "agent_run",
    entityId: run.id,
    actionUrl: opts?.actionUrl ?? `/agent?run=${run.id}`,
    // Dedupe per (mapped type, run, user): a transient failure that re-enters
    // "executing" must not re-notify "started", while a run that legitimately
    // progresses awaiting_approval → done produces distinct keys
    // (agent.awaiting_approval vs agent.completed) so BOTH notifications fire.
    // The userId segment is mandatory tenant scope (mirrors the usage key): the
    // table's dedupe constraint is unique (user_id, dedupe_key), so two users
    // with the same entity id must never share a key — run ids are globally
    // unique uuids today, but a future non-uuid id (provider-side id, slug)
    // would otherwise collide across tenants.
    dedupeKey: `agent.${type}:agent_run:${userId}:${run.id}`
  });
}

// ── Sources ──────────────────────────────────────────────────────────────────

const SOURCE_EVENT_TO_TYPE = {
  processing: "source.processing",
  ready: "source.ready",
  failed: "source.failed"
} as const;

const SOURCE_COPY: Record<"source.processing" | "source.ready" | "source.failed", { title: string; body: string; severity: NotificationSeverity }> = {
  "source.processing": {
    title: "Your source is processing",
    body: "VervAI is turning your source into usable content.",
    severity: "info"
  },
  "source.ready": {
    title: "Your source is ready",
    body: "Your source has been processed and is ready for VervAI.",
    severity: "success"
  },
  "source.failed": {
    title: "Source processing failed",
    body: "VervAI couldn't process this source. Check the source status and try again.",
    severity: "error"
  }
};

const SOURCE_DEFAULT_ACTION_URL: Record<"source.processing" | "source.ready" | "source.failed", string> = {
  "source.processing": "/agent",
  "source.ready": "/agent",
  "source.failed": "/library"
};

export async function notifySourceChanged(
  userId: string,
  source: { id: string },
  event: "processing" | "ready" | "failed",
  opts?: { actionUrl?: string }
): Promise<NotificationRecord | null> {
  const type = SOURCE_EVENT_TO_TYPE[event];
  const copy = SOURCE_COPY[type];
  return createNotification({
    userId,
    type,
    title: copy.title,
    body: copy.body,
    severity: copy.severity,
    entityType: "source",
    entityId: source.id,
    actionUrl: opts?.actionUrl ?? SOURCE_DEFAULT_ACTION_URL[type],
    // Dedupe keyed for ALL THREE states, deliberately: "Try again" re-queues
    // the SAME source id, so a retried run would otherwise re-announce
    // "processing" (and a second `ready` for the same source would be spam).
    // One announcement per source per state is the product intent — a genuinely
    // new source row is a fresh id → fresh key → notifies normally. The userId
    // segment keeps the key tenant-scoped even if source ids ever stop being
    // globally-unique uuids (mirrors the usage key's userId scope).
    dedupeKey: `${event}:source:${userId}:${source.id}`
  });
}

// ── Content generation ───────────────────────────────────────────────────────

export async function notifyContentGenerated(
  userId: string,
  output: { id: string },
  opts?: { actionUrl?: string }
): Promise<NotificationRecord | null> {
  // `actionUrl` default verified against the editor route: `/repurpose/[id]`
  // resolves rows from the `outputs` table by params.id
  // (app/(app)/repurpose/[id]/page.tsx:23-28 — `.from("outputs").eq("id", id)`,
  // rendered via <OutputEditor outputId={output.id}> at line 88), so `[id]` is
  // an OUTPUT id and `/repurpose/${output.id}` is the correct editor URL.
  return createNotification({
    userId,
    type: "content.generated",
    title: "Your draft is ready",
    body: "VervAI finished a new draft for you.",
    severity: "success",
    entityType: "output",
    entityId: output.id,
    actionUrl: opts?.actionUrl ?? `/repurpose/${output.id}`
    // No dedupeKey — deliberate (docs/NOTIFICATION_ARCHITECTURE.md §8): each
    // output is a distinct instance of a repeated event; a coarse key would
    // wrongly squash "output B ready" after "output A ready".
  });
}

// ── Publishing ───────────────────────────────────────────────────────────────

const PUBLISH_EVENT_TO_TYPE = {
  scheduled: "publish.scheduled",
  started: "publish.started",
  published: "publish.published",
  failed: "publish.failed"
} as const;

const PUBLISH_COPY: Record<"publish.scheduled" | "publish.started" | "publish.published" | "publish.failed", { title: string; body: string; severity: NotificationSeverity }> = {
  "publish.scheduled": {
    title: "Post scheduled",
    body: "Your content is scheduled for publishing.",
    severity: "info"
  },
  "publish.started": {
    title: "Publishing started",
    body: "VervAI is publishing your content.",
    severity: "info"
  },
  "publish.published": {
    title: "Published successfully",
    body: "Your content was published successfully.",
    severity: "success"
  },
  "publish.failed": {
    title: "Publishing failed",
    body: "We couldn't publish this content. Check the publishing connection and try again.",
    severity: "error"
  }
};

export async function notifyPublishChanged(
  userId: string,
  job: { id: string },
  event: "scheduled" | "started" | "published" | "failed",
  opts?: { channel?: string }
): Promise<NotificationRecord | null> {
  const type = PUBLISH_EVENT_TO_TYPE[event];
  const copy = PUBLISH_COPY[type];
  return createNotification({
    userId,
    type,
    title: copy.title,
    body: copy.body,
    severity: copy.severity,
    entityType: "distribution_job",
    entityId: job.id,
    actionUrl: "/publish",
    // Surface the target platform/channel when the caller knows it.
    metadata: opts?.channel ? { channel: opts.channel } : null,
    // Dedupe per (event, job, user): a failing job that retries must not spam,
    // while a job that legitimately goes scheduled → published produces two
    // distinct notifications because the keys differ. The userId segment keeps
    // the key tenant-scoped (mirrors the usage key) — distribution_job ids are
    // uuids today, but a future non-uuid id must not collide across tenants.
    dedupeKey: `publish.${event}:distribution_job:${userId}:${job.id}`
  });
}

// ── Usage limits ─────────────────────────────────────────────────────────────

export async function notifyUsageLimit(
  userId: string,
  opts: { percent: number; limit: number; used: number; windowLabel: string }
): Promise<NotificationRecord | null> {
  // Belt-and-braces guard: emitters already call only at 80%/100% crossings
  // (same detection as lib/analytics/events.ts::trackUsageThresholds), but the
  // 80/100 decision stays in one place so a miswired caller cannot spam
  // sub-threshold notifications.
  if (opts.percent < 80) return null;
  const reached = opts.percent >= 100;
  return createNotification({
    userId,
    type: reached ? "usage.limit_reached" : "usage.limit_near",
    title: reached ? "Your monthly usage limit has been reached" : "You've used most of your monthly usage",
    body: reached
      ? "You can't create more content until your limit resets."
      : `You've used ${Math.floor(opts.percent)}% of your monthly usage limit.`,
    severity: reached ? "error" : "warning",
    entityType: "usage",
    entityId: opts.windowLabel,
    metadata: { percent: opts.percent, limit: opts.limit, used: opts.used },
    // Once per month window — the entity IS the window, so next month is a
    // fresh key and the user notifies again. The userId segment is mandatory
    // tenant scope: the window label ("2026-09") is identical across ALL users
    // and the table's dedupe constraint is unique (user_id, dedupe_key), so a
    // bare label would let the first user to cross a threshold in a month own
    // the key and every other user's usage notification would be swallowed
    // (docs/NOTIFICATION_ARCHITECTURE.md §8).
    dedupeKey: `usage.limit_${reached ? "reached" : "near"}:usage:${userId}:${opts.windowLabel}`
  });
}

// ── Billing ──────────────────────────────────────────────────────────────────

const BILLING_COPY: Record<"subscription.updated" | "payment.failed", { title: string; body: string; severity: NotificationSeverity }> = {
  "subscription.updated": {
    title: "Plan updated",
    body: "Your subscription plan was updated.",
    severity: "info"
  },
  "payment.failed": {
    title: "Payment failed",
    body: "We couldn't process your latest payment. Check your billing details.",
    severity: "error"
  }
};

export async function notifyBillingEvent(
  userId: string,
  event: "subscription.updated" | "payment.failed",
  opts?: { planLabel?: string }
): Promise<NotificationRecord | null> {
  const copy = BILLING_COPY[event];
  return createNotification({
    userId,
    type: event,
    title: copy.title,
    body: copy.body,
    severity: copy.severity,
    entityType: "billing",
    actionUrl: "/settings",
    metadata: opts?.planLabel ? { plan: opts.planLabel } : null
    // No dedupeKey: every plan change / failed payment is its own event.
  });
}
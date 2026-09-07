// Usage accounting + snapshots for UI and error bodies.
//
// ENFORCEMENT no longer lives here: the monthly cap is enforced atomically in
// the `enqueue_job` DB function (supabase/migrations/0004_billing_ledger.sql),
// which serializes per-user via an advisory lock so concurrent enqueues can't
// overshoot, and FAILS CLOSED on any error. `usage_events` records the
// reserve/consume/refund audit trail.
//
// What remains here is DISPLAY: a reactive monthly count from the jobs table
// (user_id + created_at within the UTC month, excluding refunded) for /api/usage
// and limit-error bodies. That read fails OPEN (consistent with lib/rate-limit.ts):
// a display hiccup must never block an enqueue — enforcement already ran in the RPC.

import { createServiceClient } from "@/lib/supabase/server";
import { MAX_INPUT_SECONDS } from "@/lib/limits";
import { getPlan, type Plan } from "./plans";

export interface UsageSnapshot {
  planId: Plan["id"];
  planName: string;
  jobsUsed: number;
  jobsLimit: number | null; // null = unlimited
  jobsRemaining: number | null;
  percent: number; // 0..100 // 0 when unlimited
  resetAt: string; // ISO start of the next window
  windowLabel: string; // e.g. "September 2026"
  atLimit: boolean;
}

export interface UsageWindow {
  start: Date;
  end: Date; // exclusive
  label: string;
  resetAt: string;
}

export function currentWindow(now: Date = new Date()): UsageWindow {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return {
    start,
    end,
    label: start.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
    resetAt: end.toISOString()
  };
}

// Effective seconds cap for a user: their plan's per-source limit, but never
// above the deployment-wide hard cap so admins can tighten it with one env var.
export function maxInputSecondsFor(plan: Plan): number {
  return Math.max(1, Math.min(plan.limits.maxInputMinutes * 60, MAX_INPUT_SECONDS));
}

export async function getUsageSnapshot(userId: string, plan: Plan): Promise<UsageSnapshot> {
  const { start, end, label, resetAt } = currentWindow();
  let used: number | null = null;

  try {
    const service = createServiceClient();
    const { count, error } = await service
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("refunded", false)
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString());
    if (!error) used = count ?? 0;
  } catch {
    used = null;
  }

  if (used === null) used = 0; // fail open

  const limit = plan.limits.maxJobsPerMonth;
  const remaining = limit === null ? null : Math.max(0, limit - used);
  const percent = limit === null ? 0 : Math.min(100, Math.floor((used / limit) * 100));

  return {
    planId: plan.id,
    planName: plan.name,
    jobsUsed: used,
    jobsLimit: limit,
    jobsRemaining: remaining,
    percent,
    resetAt,
    windowLabel: label,
    atLimit: limit !== null && used >= limit
  };
}

// Human-facing structured error bodies for the 429s below. Clients key off
// `code` ("USAGE_LIMIT_REACHED") rather than parsing prose.
export type LimitCode =
  | "USAGE_LIMIT_REACHED"
  | "OUTPUT_LIMIT_REACHED"
  | "REGENERATION_LIMIT_REACHED"
  | "INPUT_TOO_LONG";

export function limitErrorBody(
  code: LimitCode,
  c: { used?: number; limit?: number | null; remaining?: number | null; resetAt?: string }
): Record<string, unknown> {
  const body: Record<string, unknown> = { error: defaultMessage(code), code };
  if (c.used !== undefined) body.used = c.used;
  if (c.limit !== undefined) body.limit = c.limit;
  if (c.remaining !== undefined) body.remaining = c.remaining;
  if (c.resetAt !== undefined) body.resetAt = c.resetAt;
  return body;
}

function defaultMessage(code: LimitCode): string {
  switch (code) {
    case "USAGE_LIMIT_REACHED":
      return "You've used all your repurpose jobs for this month. They reset at the start of next month.";
    case "OUTPUT_LIMIT_REACHED":
      return "This plan allows fewer outputs per job than you requested.";
    case "REGENERATION_LIMIT_REACHED":
      return "This output has been regenerated as many times as your plan allows.";
    case "INPUT_TOO_LONG":
      return "That recording is longer than your plan allows.";
  }
}

export { getPlan };
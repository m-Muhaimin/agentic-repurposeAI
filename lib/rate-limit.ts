// Per-user rate limiting for the paid-work endpoints. Uses the jobs table
// itself as the counter (jobs are the only thing /api/repurpose creates), so no
// extra infra or Redis is needed. Deliberately fails OPEN on any error — a
// rate-limit check must never break enqueueing when the schema lags.

import { createServiceClient } from "@/lib/supabase/server";
import { REPURPOSE_RATE_LIMIT_PER_MIN } from "@/lib/limits";

const WINDOW_MS = 60 * 1000;

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

export async function checkRepurposeRateLimit(userId: string): Promise<RateLimitResult> {
  if (REPURPOSE_RATE_LIMIT_PER_MIN <= 0) return { ok: true };

  const cutoff = new Date(Date.now() - WINDOW_MS).toISOString();
  const service = createServiceClient();

  const { count, error } = await service
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", cutoff);

  if (error) return { ok: true };

  if ((count ?? 0) >= REPURPOSE_RATE_LIMIT_PER_MIN) {
    return { ok: false, retryAfterSeconds: Math.ceil(WINDOW_MS / 1000) };
  }
  return { ok: true };
}
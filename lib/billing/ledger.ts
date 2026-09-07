// Billing ledger writes. `usage_events` is the immutable audit trail behind the
// monthly jobs budget: `reserve` on enqueue (written by the enqueue_job RPC),
// `consume` on success, `refund` on platform-side failure, `release` reserved
// for user-cancelled jobs.
//
// The ledger is write-only from app code (service role; RLS on with no
// policies) and never gate-keeps anything — enforcement reads the jobs table
// atomically in the enqueue_job RPC. So these writes are best-effort: a failed
// ledger write is a logged warning, never a thrown error.

import { createServiceClient } from "@/lib/supabase/server";
import { log } from "@/lib/logger";

export type UsageAction = "reserve" | "consume" | "refund" | "release";

export async function recordUsageEvent(
  userId: string,
  jobId: string,
  action: UsageAction
): Promise<void> {
  try {
    const service = createServiceClient();
    const { error } = await service
      .from("usage_events")
      .insert({ user_id: userId, job_id: jobId, action });
    if (error) {
      log.warn("billing.ledger_write_failed", {
        action,
        job_id: jobId,
        error: error.message
      });
    }
  } catch (err) {
    log.warn("billing.ledger_write_failed", {
      action,
      job_id: jobId,
      error: err instanceof Error ? err.message : String(err)
    });
  }
}
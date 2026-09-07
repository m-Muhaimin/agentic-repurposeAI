// Product analytics (validation phase). Events are written to the `events`
// table via the service role and — because RLS is enabled with no policies —
// are invisible to clients. This is also our only place that names events, so
// dashboards/SQL stay stable when product terms change.
//
// Tracking must NEVER throw into the product path: a failed analytics write is
// a logged warning, not a 500 on the user's job.

import { createServiceClient } from "@/lib/supabase/server";
import { log } from "@/lib/logger";
import { EVENTS } from "./event-names";
import type { EventName } from "./event-names";

export { EVENTS };
export type { EventName };

export async function track(
  name: EventName,
  userId: string | null | undefined,
  properties: Record<string, unknown> = {}
): Promise<void> {
  try {
    const service = createServiceClient();
    await service.from("events").insert({ name, user_id: userId ?? null, properties });
  } catch (err) {
    log.warn("analytics.track_failed", {
      event: name,
      user_id: userId,
      error: err instanceof Error ? err.message : String(err)
    });
  }
}

// Usage thresholds firing, keyed off the jobs count for the month. Pass the
// count *before* the event (usedBefore) and *after* enqueue/reservation
// (usedAfter) so each threshold fires exactly once when crossed.
const THRESHOLDS: Array<{ pct: number; event: EventName }> = [
  { pct: 50, event: EVENTS.USAGE_50 },
  { pct: 80, event: EVENTS.USAGE_80 },
  { pct: 100, event: EVENTS.USAGE_100 }
];

export async function trackUsageThresholds(
  userId: string,
  planId: string,
  limit: number,
  usedBefore: number,
  usedAfter: number
): Promise<void> {
  if (!limit || limit <= 0) return;
  const beforePct = Math.floor((usedBefore / limit) * 100);
  const afterPct = Math.floor((usedAfter / limit) * 100);
  for (const t of THRESHOLDS) {
    if (afterPct >= t.pct && beforePct < t.pct) {
      await track(t.event, userId, { plan: planId, used: usedAfter, limit, percent: afterPct });
    }
  }
}
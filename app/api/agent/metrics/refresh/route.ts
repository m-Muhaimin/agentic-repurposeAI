import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { refreshRunMetrics } from "@/lib/agent/schedule";
import { log } from "@/lib/logger";

// POST /api/agent/metrics/refresh — pull fresh Buffer post analytics for the
// user's distribution jobs (the "review metrics" step backing the run-detail
// Performance panel). Metrics land on v4_distribution_jobs.metrics +
// metrics_refreshed_at. Honest by construction: no Buffer API key → the response
// says so instead of fabricating numbers.

export async function POST() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const service = createServiceClient();

  try {
    const result = await refreshRunMetrics(service, user.id);
    if (result.errors.includes("no_buffer_api_key")) {
      return NextResponse.json(
        { ok: false, error: "Add a Buffer API key to fetch post metrics.", code: "NO_BUFFER_API_KEY" },
        { status: 503 }
      );
    }
    log.info("agent.metrics_refresh_requested", { user_id: user.id, ...result });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    log.error("agent.metrics_refresh_failed", err instanceof Error ? err : new Error(String(err)), { user_id: user.id });
    return NextResponse.json({ ok: false, error: "Metrics refresh failed." }, { status: 502 });
  }
}
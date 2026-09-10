import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { retentionWindow, capAt, RETENTION_DEFAULTS } from "@/lib/agent/retention";
import {
  publishingChannelsConnected,
  publishStatusLabel,
  publishBlockReason,
  NOT_CONNECTED_MESSAGE
} from "@/lib/agent/publish";
import type { PublishJobStatus } from "@/lib/agent/publish";
import { getApiKey } from "@/lib/buffer/connections";
import { log } from "@/lib/logger";

// GET /api/agent/queue — the read-mostly Publish queue surface (P10).
//
// Built from REAL server data only:
//   1. done runs' outputs (`v4_agent_runs.output_ids` → outputs rows) that are
//      not already covered by a distribution job — these are "publishable drafts";
//   2. the user's existing `v4_distribution_jobs` (draft/scheduled/published/
//      failed/cancelled) — the durable queue.
// channelsConnected is real: a connected Buffer account (buffer_connections)
// enables Send; without one, the response carries the truthful reason why the
// Send affordance is blocked. There is NO fabricated success/failure state.

// Map the domain status vocabulary onto the schema enum (which is unchanged).
function jobStatusToView(status: string | null): PublishJobStatus {
  const s = (status ?? "draft") as PublishJobStatus;
  return s;
}

export async function GET() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const service = createServiceClient();
  const window = retentionWindow({
    now: new Date(),
    lookbackMs: RETENTION_DEFAULTS.QUEUE_HISTORY_MS
  });

  // Real gate: is a Buffer channel connected for this user? One DB query, shared
  // by the job reasons below and the payload's channelsConnected field.
  const [channelsConnected, hasApiKey] = await Promise.all([
    publishingChannelsConnected(user.id, service),
    getApiKey(user.id).catch(() => null)
  ]);

  const [runsResult, jobsResult] = await Promise.all([
    service
      .from("v4_agent_runs")
      .select("id, status, output_ids, created_at, finished_at")
      .eq("user_id", user.id)
      .eq("status", "done")
      .gte("created_at", window.from)
      .order("created_at", { ascending: false })
      .limit(capAt(RETENTION_DEFAULTS.MAX_RUNS, RETENTION_DEFAULTS.MAX_RUNS)),
    service
      .from("v4_distribution_jobs")
      .select("id, run_id, output_id, platform, status, scheduled_at, published_at, external_id, error_message, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(capAt(RETENTION_DEFAULTS.MAX_QUEUE_ITEMS, RETENTION_DEFAULTS.MAX_QUEUE_ITEMS))
  ]);

  const runs = runsResult.data ?? [];
  const jobs = jobsResult.data ?? [];
  const outputIds = [
    ...new Set(runs.flatMap((r: { output_ids: string[] | null }) => r.output_ids ?? []))
  ];

  // Resolve output rows (format + title) so the queue shows real drafts.
  let outputsById: Record<string, { id: string; format: string; content: string; created_at: string }> = {};
  if (outputIds.length > 0) {
    const { data: outputs } = await service
      .from("outputs")
      .select("id, format, content, created_at")
      .in("id", outputIds)
      .eq("user_id", user.id);
    outputsById = Object.fromEntries((outputs ?? []).map((o: { id: string; format: string; content: string; created_at: string }) => [o.id, o]));
  }

  // Drafts from done runs that DON'T already have a distribution job row.
  const coveredOutputIds = new Set(jobs.flatMap((j: { output_id: string | null }) => (j.output_id ? [j.output_id] : [])));
  const publishable = runs
    .flatMap((r: { id: string; output_ids: string[] | null; created_at: string }) =>
      (r.output_ids ?? [])
        .filter((oid) => !coveredOutputIds.has(oid) && outputsById[oid])
        .map((oid) => ({
          id: oid,
          runId: r.id,
          format: outputsById[oid].format,
          preview: outputsById[oid].content.slice(0, 240),
          createdAt: outputsById[oid].created_at
        }))
    )
    .slice(0, capAt(RETENTION_DEFAULTS.MAX_QUEUE_ITEMS, RETENTION_DEFAULTS.MAX_QUEUE_ITEMS));

  const jobViews = jobs.map((j: { id: string; run_id: string | null; output_id: string | null; platform: string; status: string; scheduled_at: string | null; published_at: string | null; external_id: string | null; error_message: string | null; created_at: string; updated_at: string }) => {
    const status = jobStatusToView(j.status);
    const preview = j.output_id && outputsById[j.output_id] ? outputsById[j.output_id].content.slice(0, 240) : "";
    return {
      id: j.id,
      runId: j.run_id,
      outputId: j.output_id,
      platform: j.platform,
      status,
      statusLabel: publishStatusLabel(status),
      blockReason: publishBlockReason(status, channelsConnected),
      scheduledAt: j.scheduled_at,
      publishedAt: j.published_at,
      externalId: j.external_id,
      errorMessage: j.error_message,
      createdAt: j.created_at,
      updatedAt: j.updated_at,
      preview,
      format: j.output_id && outputsById[j.output_id] ? outputsById[j.output_id].format : null
    };
  });

  log.info("agent.queue_listed", { user_id: user.id, publishable: publishable.length, jobs: jobViews.length });

  return NextResponse.json({
    ok: true,
    publishable,
    jobs: jobViews,
    channelsConnected,
    hasApiKey: Boolean(hasApiKey),
    notConnectedMessage: NOT_CONNECTED_MESSAGE,
    historyWindowMs: RETENTION_DEFAULTS.QUEUE_HISTORY_MS,
    // Honest "history is retained" note — bounded query window, no data loss.
    note: "The queue surfaces drafts from the recent window only. Underlying history is fully retained."
  });
}
import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  normalizePlatform,
  nextPublishStatus,
  canRequestSend,
  publishingChannelsConnected,
  NOT_CONNECTED_MESSAGE
} from "@/lib/agent/publish";
import { distributionTool } from "@/lib/agent/tools/distribution";
import { log } from "@/lib/logger";

// POST /api/agent/queue/publish — the manual approval step of the Publish queue
// (P10 + Stage 4 BYOB). HONEST by construction.
//
// Body: { outputId, platform, confirm: true, mode?: "queue" | "send",
//         profileIds?: string[], scheduledAt?: string }
//
//   mode "queue" (default): records a `v4_distribution_jobs` row in `scheduled`
//   (pending human approval). This NEVER auto-advances and never reaches a
//   provider — it waits for an explicit human `send`.
//
//   mode "send": the explicit pre-send attempt. Two gates must pass:
//     1. confirm: true (the single non-negotiable manual approval step), and
//     2. a real connected publishing channel (buffer_connections).
//   Only then does it invoke the distribution tool, which posts to the user's
//   Buffer (optionally to chosen profileIds at scheduledAt) and flips the job
//   to published / stays scheduled-with-update-id / failed. There is no
//   fabricated post-sent success — failures are truthful 502s with the real
//   error.

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Gated server-side, never client-side entitlement.
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { outputId, platform: rawPlatform, confirm, mode } = body;

  const platform = normalizePlatform(rawPlatform);
  if (!platform) return NextResponse.json({ error: "platform must be a known distribution channel" }, { status: 400 });

  // The single non-negotiable manual approval step: `confirm: true` must be
  // sent by the client right before anything happens. No confirm, no action.
  if (confirm !== true) {
    return NextResponse.json(
      { error: "Explicit approval required — send confirm: true to proceed." },
      { status: 400 }
    );
  }

  // Ownership check: the output must exist and belong to this user (RLS would
  // also block it, but we enforce explicitly and fail closed on missing rows).
  const service = createServiceClient();
  const { data: output, error: outputErr } = await service
    .from("outputs")
    .select("id, user_id")
    .eq("id", outputId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (outputErr || !output) {
    return NextResponse.json({ error: "Output not found" }, { status: 404 });
  }

  const sendMode = mode === "send" ? "send" : "queue";

  // Helpers for the optional send controls.
  const isValidScheduledAt = (v: unknown): v is string =>
    typeof v === "string" && !Number.isNaN(Date.parse(v)) && !Number.isNaN(new Date(v).getTime());
  const profileIds =
    Array.isArray(body.profileIds) && body.profileIds.every((p) => typeof p === "string")
      ? (body.profileIds as string[]).slice(0, 20)
      : undefined;

  if (sendMode === "send") {
    // Gate 1: is a real Buffer publish channel connected for this user?
    const channelsConnected = await publishingChannelsConnected(user.id, service);
    if (!canRequestSend("scheduled", channelsConnected)) {
      log.info("agent.queue_send_blocked", {
        user_id: user.id,
        output_id: outputId,
        platform,
        reason: channelsConnected ? "not_scheduled" : "no_publishing_channel"
      });
      return NextResponse.json(
        { ok: false, error: NOT_CONNECTED_MESSAGE, code: "PUBLISH_NOT_CONNECTED", channelsConnected },
        { status: 503 }
      );
    }

    // Gate 2 passed — perform the REAL send via the distribution tool. Manual
    // trigger: the user just approved this exact draft.
    // Resolve the run that produced this output (when one exists) so the tool can
    // write a real distribution timeline step; otherwise the job row is the
    // durable record and no step is fabricated.
    let runId = "";
    const { data: runRow } = await service
      .from("v4_agent_runs")
      .select("id")
      .eq("user_id", user.id)
      .contains("output_ids", [outputId])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (runRow) runId = runRow.id;

    const result = await distributionTool.run(
      { userId: user.id, runId, mode: "assist" },
      {
        platform,
        outputId,
        ...(profileIds && profileIds.length > 0 ? { profileIds } : {}),
        ...(isValidScheduledAt(body.scheduledAt) ? { scheduledAt: new Date(body.scheduledAt as string).toISOString() } : {})
      }
    );
    if (!result.ok) {
      log.warn("agent.queue_send_failed", { user_id: user.id, output_id: outputId, platform, error: result.error });
      return NextResponse.json(
        { ok: false, error: result.error, code: "PUBLISH_FAILED", channelsConnected },
        { status: 502 }
      );
    }
    log.info("agent.queue_sent", { user_id: user.id, output_id: outputId, platform, update_id: (result.data as { updateId?: string }).updateId });
    return NextResponse.json({ ok: true, ...(result.data as object), channelsConnected });
  }

  // ── mode "queue": record a pending human-approval job ──────────────────
  // The transition draft → scheduled via the pure state machine (an explicit
  // human `queue` action). It stays `scheduled` forever unless the human acts
  // again; no worker exists to move it.
  const fromStatus = "draft";
  const status = nextPublishStatus(fromStatus, { type: "queue" });
  if (status !== "scheduled") {
    return NextResponse.json({ error: "Could not queue the job in this state." }, { status: 409 });
  }

  const { data: job, error: insertErr } = await service
    .from("v4_distribution_jobs")
    .insert({
      user_id: user.id,
      output_id: output.id,
      platform,
      status: "scheduled",
      scheduled_at: new Date().toISOString()
    })
    .select("id, output_id, platform, status, created_at, updated_at")
    .maybeSingle();

  if (insertErr) {
    log.error("agent.queue_insert_failed", new Error(insertErr.message), { user_id: user.id, output_id: outputId, platform });
    return NextResponse.json({ error: "Failed to record the queued job." }, { status: 500 });
  }

  log.info("agent.queue_recorded", {
    user_id: user.id,
    job_id: job?.id,
    output_id: outputId,
    platform,
    status
  });

  // Truthful response: the job is QUEUED FOR APPROVAL, not sent. channelsConnected
  // reflects the real Buffer gate so the UI shows Send accurately.
  const channelsConnected = await publishingChannelsConnected(user.id, service);
  return NextResponse.json({
    ok: true,
    job,
    status,
    channelsConnected,
    publishBlockedMessage: channelsConnected ? null : NOT_CONNECTED_MESSAGE
  });
}
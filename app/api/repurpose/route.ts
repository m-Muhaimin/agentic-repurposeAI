import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { checkRepurposeRateLimit } from "@/lib/rate-limit";
import { isOutputFormat } from "@/lib/billing/plans";
import { ensureProfile } from "@/lib/billing/entitlements";
import { currentWindow, limitErrorBody } from "@/lib/billing/usage";
import { track, trackUsageThresholds, EVENTS } from "@/lib/analytics/events";
import { notifyUsageLimit } from "@/lib/notifications";
import { log } from "@/lib/logger";

function normalizeFormats(input: unknown): string[] | null {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input) || input.length === 0) return [];
  if (!input.every((f) => isOutputFormat(f))) return null;
  return input as string[];
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { sourceId, formats: rawFormats, idempotencyKey } = body;
  if (!sourceId) return NextResponse.json({ error: "sourceId is required" }, { status: 400 });

  const formats = normalizeFormats(rawFormats);
  if (formats === null) {
    return NextResponse.json(
      { error: "Unsupported format. Use linkedin_post, newsletter, shortform_script, thread, or carousel." },
      { status: 400 }
    );
  }

  // Auth check with the user's own session — confirms they own this source
  // before we do any paid work on it.
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: source, error: fetchError } = await supabase
    .from("sources")
    .select("id, user_id, status")
    .eq("id", sourceId)
    .eq("user_id", user.id)
    .single();
  if (fetchError || !source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }
  // `uploaded` is the fresh state; `failed` is allowed so the dashboard can
  // re-queue ("Try again") a recording whose last run errored out.
  if (source.status !== "uploaded" && source.status !== "failed") {
    return NextResponse.json({ error: "Source is already processing" }, { status: 409 });
  }

  const service = createServiceClient();

  // Entitlement gate — everything below is plan-aware and server-side.
  const plan = await ensureProfile(user.id);

  // 1) Output budget per job. The client's format array is a request, the DB
  //    is the contract: truncation happens here, not in the UI. (The RPC
  //    re-checks the cap defensively.)
  const selected = formats.length > 0 ? formats : [];
  if (selected.length > plan.limits.maxOutputsPerJob) {
    return NextResponse.json(
      { ...limitErrorBody("OUTPUT_LIMIT_REACHED", { limit: plan.limits.maxOutputsPerJob }) },
      { status: 400 }
    );
  }

  // 2) Idempotency: a client-supplied key (unique per user) makes retries,
  //    double-clicks and back-button resubmits return the existing job instead
  //    of consuming another slot. Replay is handled inside the RPC so the
  //    check and the reservation share one lock.
  const key = typeof idempotencyKey === "string" && idempotencyKey.trim() ? idempotencyKey.trim() : null;

  // 3) Rate limit: cap how many jobs a single user can kick off in a rolling
  //    minute (drives paid transcription + generation).
  const rate = await checkRepurposeRateLimit(user.id);
  if (!rate.ok) {
    log.warn("repurpose.rate_limited", {
      user_id: user.id,
      source_id: source.id,
      retry_after_s: rate.retryAfterSeconds
    });
    return NextResponse.json(
      { error: "You've enqueued a lot recently — try again in a minute.", retryAfter: rate.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  // 4) Monthly usage + reservation — ATOMIC, in the DB. enqueue_job runs one
  //    transaction serialized per user (advisory lock), so the "used < limit"
  //    check and the insert can't race: concurrent enqueues can't overshoot
  //    the cap. It also handles idempotent replay and writes the `reserve`
  //    ledger event in the same transaction.
  //
  //    The limit values come from plans.ts (server-side), never the client.
  const { data, error } = await service
    .rpc("enqueue_job", {
      p_user_id: user.id,
      p_source_id: source.id,
      p_formats: selected,
      p_idempotency_key: key,
      p_max_jobs_per_month: plan.limits.maxJobsPerMonth,
      p_max_outputs_per_job: plan.limits.maxOutputsPerJob
    })
    .maybeSingle();

  // Reservation FAILED (migration not applied / DB hiccup). Fail CLOSED: we
  // could not confirm the reservation, so the paid work must not start.
  if (error || !data) {
    log.error("repurpose.enqueue_rpc_failed", new Error(error?.message ?? "no row returned"), {
      user_id: user.id,
      plan: plan.id,
      hint: "is migration 20260907000004_billing_ledger.sql applied?"
    });
    return NextResponse.json(
      { error: "Repurposing is temporarily unavailable. Please try again shortly." },
      { status: 503 }
    );
  }

  const { job_id, created_new, jobs_used } = data;

  if (data.error_code === "USAGE_LIMIT_REACHED") {
    const limit = plan.limits.maxJobsPerMonth;
    const remaining = limit === null ? null : Math.max(0, limit - jobs_used);
    log.info("repurpose.limit_reached", {
      user_id: user.id,
      plan: plan.id,
      used: jobs_used,
      limit
    });
    await track(EVENTS.LIMIT_REACHED, user.id, {
      plan: plan.id,
      feature: "repurpose_job",
      used: jobs_used,
      limit,
      remaining,
      resetAt: currentWindow().resetAt
    });
    return NextResponse.json(
      {
        ...limitErrorBody("USAGE_LIMIT_REACHED", {
          used: jobs_used,
          limit,
          remaining,
          resetAt: currentWindow().resetAt
        })
      },
      { status: 429 }
    );
  }

  if (data.error_code === "OUTPUT_LIMIT_REACHED") {
    await track(EVENTS.LIMIT_REACHED, user.id, {
      plan: plan.id,
      feature: "repurpose_job",
      used: selected.length,
      limit: plan.limits.maxOutputsPerJob
    });
    return NextResponse.json(
      { ...limitErrorBody("OUTPUT_LIMIT_REACHED", { limit: plan.limits.maxOutputsPerJob }) },
      { status: 400 }
    );
  }

  if (!job_id) {
    log.error("repurpose.enqueue_rpc_no_job", new Error("enqueue_job returned no job and no error_code"), {
      user_id: user.id,
      plan: plan.id
    });
    return NextResponse.json({ error: "Repurposing is temporarily unavailable." }, { status: 503 });
  }

  if (!created_new) {
    // Idempotent replay — the reservation already happened on the first call.
    log.info("repurpose.idempotent_replay", {
      job_id,
      user_id: user.id,
      source_id: source.id
    });
    return NextResponse.json({
      ok: true,
      jobId: job_id,
      idempotent: true,
      ...usageRollup(plan.id, plan.limits.maxJobsPerMonth, jobs_used)
    });
  }

  // Tracked after the reservation is durable. `jobs_used` is the count
  // INCLUDING this job (returned atomically from the RPC).
  const usedAfter = jobs_used;
  const usedBefore = usedAfter - 1;
  await trackUsageThresholds(user.id, plan.id, plan.limits.maxJobsPerMonth ?? 0, usedBefore, usedAfter);

  // Notification crossings — the EXACT same detection math as the analytics
  // thresholds above (80/100, firing only when a threshold is crossed, once per
  // month window via the notification dedupe key). Guarded on a finite cap.
  const limit = plan.limits.maxJobsPerMonth;
  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
    const beforePct = Math.floor((usedBefore / limit) * 100);
    const afterPct = Math.floor((usedAfter / limit) * 100);
    if (afterPct >= 80 && beforePct < 80) {
      await notifyUsageLimit(user.id, { percent: 80, limit, used: usedAfter, windowLabel: currentWindow().label });
    }
    if (afterPct >= 100 && beforePct < 100) {
      await notifyUsageLimit(user.id, { percent: 100, limit, used: usedAfter, windowLabel: currentWindow().label });
    }
  }

  if (usedBefore === 0) {
    await track(EVENTS.FIRST_JOB_STARTED, user.id, { source_id: source.id, formats: selected });
  }

  log.info("repurpose.enqueued", {
    job_id,
    source_id: source.id,
    user_id: user.id,
    formats: selected,
    idempotent: false
  });
  return NextResponse.json({ ok: true, jobId: job_id, ...usageRollup(plan.id, plan.limits.maxJobsPerMonth, jobs_used) });
}

// Compact usage rollup for the enqueue response (the full snapshot lives on
// /api/usage). Numbers come from the RPC so they're always the post-reservation
// truth.
function usageRollup(planId: string, limit: number | null, used: number) {
  const percent = limit ? Math.min(100, Math.floor((used / limit) * 100)) : 0;
  return {
    usage: {
      plan: planId,
      used,
      limit,
      remaining: limit === null ? null : Math.max(0, limit - used),
      percent,
      resetAt: currentWindow().resetAt
    }
  };
}
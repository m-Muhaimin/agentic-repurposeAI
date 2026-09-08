import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ingestSource, saveTranscript, type IngestionContext } from "@/lib/ingestion";
import { supabaseContentStore, registerStoreBackedProviders } from "@/lib/ingestion/store";
import { generateOutput, type OutputFormat } from "@/lib/ai/generate";
import { buildSystemPrompt } from "@/lib/ai/prompts";
import { getUserPrompts, type UserPromptMap } from "@/lib/prompts";
import { resolvePlan } from "@/lib/billing/entitlements";
import { maxInputSecondsFor, currentWindow } from "@/lib/billing/usage";
import { recordUsageEvent } from "@/lib/billing/ledger";
import { track, EVENTS } from "@/lib/analytics/events";
import { log } from "@/lib/logger";

const FORMATS: OutputFormat[] = ["linkedin_post", "newsletter", "shortform_script"];

// A claimed job is considered stale (and re-claimable) after this long, so a
// serverless function that died to a timeout doesn't leave the job parked in
// `running` forever.
const STALE_AFTER_MS = 10 * 60 * 1000;

// Raised when the source violates its plan cap (too long). Treated as invalid
// user input: the job is marked failed but usage is NOT refunded.
class InputLimitError extends Error {}

const encoder = new TextEncoder();

// Wraps the whole job run in a text/event-stream response, so the dashboard
// that kicked the job gets live `progress` events (stage + percentage) instead
// of one big silent POST that resolves at the end.
function sseResponse(run: (send: (event: string, data: unknown) => void) => Promise<void>): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // Client went away — stop pumping; the job keeps running server-side.
        }
      };
      try {
        await run(send);
      } catch {
        // The run() closure reports its own errors as `error` events.
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    }
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform"
    }
  });
}

export async function POST(request: Request) {
  const { jobId } = await request.json();
  if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });

  // Confirm the caller owns the job.
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const service = createServiceClient();

  // Phase 3: wire the live idempotency store into the file/url providers before
  // ingesting — identical bytes/URL for the same user + kind reuse the earlier
  // transcript (key persisted on sources.content_hash, unique per user+type+key
  // via migration …0002). Re-registration is last-wins and cheap per request.
  registerStoreBackedProviders(supabaseContentStore(service));

  const { data: existing } = await service
    .from("jobs")
    .select("id, source_id, user_id, status, attempt, refunded, started_at")
    .eq("id", jobId)
    .eq("user_id", user?.id ?? "")
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const userId = existing.user_id;

  // Claim atomically: only `queued` jobs, or `running` jobs past the stale
  // window (the original executor likely timed out). A concurrent claim just
  // loses the update and gets a clean "no rows" back.
  const staleCutoff = new Date(Date.now() - STALE_AFTER_MS).toISOString();
  const claimUpdate = {
    status: "running",
    attempt: (existing.attempt ?? 0) + 1,
    started_at: new Date().toISOString()
  };
  const claimFilter = `status.eq.queued,and(status.eq.running,started_at.lt.${staleCutoff})`;

  let claimed: { id: string; source_id: string; formats?: string[] | null } | null = null;
  let claimError: { message: string } | null = null;

  const withFormats = await service
    .from("jobs")
    .update(claimUpdate)
    .eq("id", jobId)
    .or(claimFilter)
    .select("id, source_id, formats")
    .maybeSingle();
  if (!withFormats.error) {
    claimed = withFormats.data;
  } else if (/could not find the\s*\w*\s*["']?formats|column\s+[\w.]*\s*formats\s+does\s*(n'?t|not)?\s*exist|undefined_column|42703/i.test(withFormats.error.message)) {
    // Schema migration for the `formats` column not applied yet — claim without it.
    const withoutFormats = await service
      .from("jobs")
      .update(claimUpdate)
      .eq("id", jobId)
      .or(claimFilter)
      .select("id, source_id")
      .maybeSingle();
    claimed = withoutFormats.data ?? null;
    claimError = withoutFormats.error;
  } else {
    claimError = withFormats.error;
  }

  if (claimError) {
    return NextResponse.json({ error: claimError.message }, { status: 500 });
  }
  if (!claimed) {
    // Another executor already holds this job — not ours to run. Emit a done
    // event anyway so stream consumers resolve cleanly.
    log.info("process.claim_skipped", { job_id: jobId });
    return sseResponse(async (send) => send("done", { ok: true, skipped: true }));
  }

  const sourceId = claimed.source_id;
  const requestedFormats = Array.isArray(claimed.formats)
    ? (claimed.formats.filter((f) => FORMATS.includes(f as OutputFormat)) as OutputFormat[])
    : [];
  const formats: OutputFormat[] = requestedFormats.length > 0 ? requestedFormats : FORMATS;
  const attempt = (existing.attempt ?? 0) + 1;
  const jobStarted = Date.now();

  // What is this user entitled to? Drives the duration cap and refund decisions.
  const plan = await resolvePlan(userId);

  log.info("process.claimed", {
    job_id: jobId,
    source_id: sourceId,
    user_id: userId,
    attempt,
    formats: formats.length
  });

  if (attempt > 1) {
    await track(EVENTS.JOB_RETRIED, userId, { job_id: jobId, source_id: sourceId, attempt });
  }

  return sseResponse(async (send) => {
    try {
      // Custom prompt overrides for this user (empty map if the table missing —
      // generation then uses the built-in defaults).
      let promptMap: UserPromptMap = {};
      try {
        promptMap = await getUserPrompts(userId);
      } catch {
        // Keep defaults if the prompt table query fails for any reason.
      }

      const { data: source } = await service
        .from("sources")
        .select("*")
        .eq("id", sourceId)
        .single();
      if (!source) throw new Error("Source not found.");

      // Regeneration: drop any drafts from a previous run.
      await service.from("outputs").delete().eq("source_id", sourceId);

      await service.from("sources").update({ status: "transcribing", error_message: null }).eq("id", sourceId);
      send("progress", { stage: "Preparing", pct: 5 });

      // Ingest the source into a canonical TranscriptDocument. The worker
      // doesn't know or care whether the source is a YouTube captions track, a
      // directly transcribed upload, or a parsed transcript file — each
      // provider in lib/ingestion/ yields the same contract.
      const ctx: IngestionContext = {
        service,
        onProgress: (stage, pct) => send("progress", { stage, pct })
      };
      const doc = await ingestSource(source, ctx);

      // Plan duration cap — enforced on the actual media length, not the file
      // size. Exceeding the cap is user input, marked failed, NOT refunded.
      const maxSeconds = maxInputSecondsFor(plan);
      if (doc.durationSeconds != null && doc.durationSeconds > maxSeconds) {
        throw new InputLimitError(
          `This recording is longer than your ${plan.name.toLowerCase()} limit (${plan.limits.maxInputMinutes} minutes max).`
        );
      }

      // Persist the canonical transcript (one row per source). Missing table =
      // migration not applied — the row still lands in sources.transcript, so
      // log and keep going rather than failing a job that would otherwise work.
      try {
        await saveTranscript(service, source, doc);
      } catch (err) {
        log.warn("process.transcript_save_failed", {
          source_id: sourceId,
          error: err instanceof Error ? err.message : String(err)
        });
      }

      await service
        .from("sources")
        .update({
          status: "generating",
          transcript: doc.text,
          duration_seconds: doc.durationSeconds ?? null
        })
        .eq("id", sourceId);
      send("progress", { stage: "Generating outputs", pct: 82 });

      let doneCount = 0;
      const generated = await Promise.all(
        formats.map(async (format) => {
          const result = await generateOutput(
            format,
            doc.text,
            buildSystemPrompt(format, promptMap)
          );
          doneCount += 1;
          send("progress", {
            stage: "Generating outputs",
            pct: 82 + Math.round((doneCount / formats.length) * 15)
          });
          return { format, content: result.content };
        })
      );

      await service.from("outputs").insert(
        generated.map((g) => ({
          source_id: sourceId,
          user_id: userId,
          format: g.format,
          content: g.content
        }))
      );

      await service.from("sources").update({ status: "done" }).eq("id", sourceId);
      await service
        .from("jobs")
        .update({ status: "done", finished_at: new Date().toISOString() })
        .eq("id", jobId);
      await recordUsageEvent(userId, jobId, "consume");

      send("progress", { stage: "Ready", pct: 100 });
      send("done", { ok: true });

      log.info("process.completed", {
        job_id: jobId,
        source_id: sourceId,
        duration_ms: Date.now() - jobStarted,
        formats
      });

      // First completed job is the core activation signal for validation.
      const { start } = currentWindow();
      const { count, error } = await service
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "done")
        .gte("finished_at", start.toISOString());
      if (!error && (count ?? 0) === 1) {
        await track(EVENTS.FIRST_JOB_COMPLETED, userId, { source_id: sourceId, formats });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";

      await service.from("sources").update({ status: "failed", error_message: message }).eq("id", sourceId);

      // Refund platform-side failures (transcription/generation errors) so the
      // user's monthly budget is theirs again. Invalid input (too long) is
      // counted — it was their call.
      const refund = !(err instanceof InputLimitError) && !existing.refunded;
      if (refund) {
        await service
          .from("jobs")
          .update({ status: "failed", error_message: message, finished_at: new Date().toISOString(), refunded: true })
          .eq("id", jobId);
        await recordUsageEvent(userId, jobId, "refund");
      } else {
        await service
          .from("jobs")
          .update({ status: "failed", error_message: message, finished_at: new Date().toISOString() })
          .eq("id", jobId);
      }

      send("error", { error: message });

      log.error("process.failed", err instanceof Error ? err : new Error(message), {
        job_id: jobId,
        source_id: sourceId,
        duration_ms: Date.now() - jobStarted,
        refunded: refund
      });

      await track(EVENTS.JOB_FAILED, userId, {
        job_id: jobId,
        source_id: sourceId,
        attempt,
        reason: message,
        refunded: refund
      });
    }
  });
}
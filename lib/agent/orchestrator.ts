// Agentic V1 orchestrator — the durable worker behind /api/agent/process.
// Mirrors the base /api/process job semantics so a serverless function that dies
// mid-run doesn't park a run forever:
//   - claim/resume runs with the same 10-minute stale window
//   - every transition persists a v4_agent_steps row (append-only timeline)
//   - nothing important lives in memory between requests
//
// State machine:
//   created → planning → awaiting_approval → executing → evaluating → done
//                                              └──────────────→ failed
// The run parks at awaiting_approval while the human decides. Approval flips
// status to executing (POST /api/agent/runs/[id]/approve); a later process call
// picks it up exactly like a fresh claim.

import { createServiceClient } from "@/lib/supabase/server";
import { log } from "@/lib/logger";
import type { AgentMode, AgentRunRow, ContentPlan, OutputFormat } from "@/types/agent";
import { generationTool } from "@/lib/agent/tools/generation";
import { intelligenceTool } from "@/lib/agent/tools/intelligence";
import { sourceTool } from "@/lib/agent/tools/source";
import { reviewTool } from "@/lib/agent/tools/review";

export type Send = (event: string, data: unknown) => void;

// A claimed run is re-claimable after this long (matches /api/process).
const STALE_AFTER_MS = 10 * 60 * 1000;

// Coarse cost accounting: the roadmap uses a single "cost units" accumulator so
// Stage 1 stays cheap and predictable. We approximate units from token counts —
// planning tokens are real (from Gemini usageMetadata), generation tokens are
// estimated from transcript+draft size. Deliberately crude; fine for V1.
function estimateGenerationTokens(transcript: string, content: string): number {
  return Math.round(transcript.length / 4 + content.length / 4);
}

interface ClaimedRun {
  run: AgentRunRow;
  phase: "planning" | "execution";
}

interface RunRowLite {
  id: string;
  user_id: string;
  status: string;
  attempt: number | null;
  started_at: string | null;
  updated_at: string | null;
}

// Claim a run for planning (created/planning, or stale) or execution
// (executing/evaluating, if stale). Runs sitting at awaiting_approval, done,
// failed or cancelled are never claimed. Returns null when we don't hold it.
async function claimRun(service: Awaited<ReturnType<typeof createServiceClient>>, runId: string): Promise<ClaimedRun | null> {
  const staleCutoff = new Date(Date.now() - STALE_AFTER_MS).toISOString();

  // Which phase should we run? Planning phase: created or planning. Execution
  // phase: executing or evaluating (a previous executor died mid-run).
  const { data: existing } = await service
    .from("v4_agent_runs")
    .select("id, user_id, status, attempt, started_at, updated_at")
    .eq("id", runId)
    .maybeSingle();
  const existingRow = (existing ?? null) as RunRowLite | null;
  if (!existingRow) return null;

  const nextStatus = existingRow.status === "executing" || existingRow.status === "evaluating" ? "executing" : "planning";

  const attempt = (existingRow.attempt ?? 0) + 1;
  const touchedAt = new Date().toISOString();

  // Atomic claim: only runs in a claimable state (fresh, or past the stale
  // window). A concurrent claim just loses the update and gets no row back.
  const claimableOr =
    `and(status.eq.created),` +
    `and(status.eq.planning,updated_at.lt.${staleCutoff}),` +
    `and(status.eq.executing,updated_at.lt.${staleCutoff}),` +
    `and(status.eq.evaluating,updated_at.lt.${staleCutoff})`;

  const claimedRow = await service
    .from("v4_agent_runs")
    .update({ status: nextStatus, attempt, started_at: touchedAt, updated_at: touchedAt })
    .eq("id", runId)
    .or(claimableOr)
    .select("*")
    .maybeSingle();

  const claimed = (claimedRow?.data ?? null) as AgentRunRow | null;
  if (!claimed) return null;
  return { run: claimed, phase: nextStatus === "executing" ? "execution" : "planning" };
}

// Record a durable step row. `kind` must map to the schema's allowed set.
async function recordStep(
  service: Awaited<ReturnType<typeof createServiceClient>>,
  runId: string,
  userId: string,
  kind: string,
  status: "done" | "failed" | "skipped",
  label: string,
  input: unknown,
  output: unknown,
  retryCount = 0
): Promise<void> {
  await service.from("v4_agent_steps").insert({
    run_id: runId,
    user_id: userId,
    kind,
    status,
    label,
    input: input as never,
    output: output as never,
    retry_count: retryCount,
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString()
  });
}

// ── Planning phase: transcript → plan, then park for human approval ──────────
async function runPlanning(
  service: Awaited<ReturnType<typeof createServiceClient>>,
  run: AgentRunRow,
  send: Send
): Promise<void> {
  const { runId, userId, sourceId, mode } = { runId: run.id, userId: run.user_id, sourceId: run.source_id, mode: run.mode as AgentMode };

  send("progress", { stage: "Loading source", pct: 5 });

  const srcCtx = { userId, runId, mode };
  const src = await sourceTool.run(srcCtx, { sourceId });
  await recordStep(
    service,
    runId,
    userId,
    "source",
    src.ok ? "done" : "failed",
    "Load source transcript",
    { sourceId },
    src.ok ? src.data : { error: src.error }
  );
  if (!src.ok) throw new Error(src.error ?? "Failed to load source.");

  const sourceOut = src.data as { transcript: string };

  // Persist a durable transcript snapshot so execution doesn't depend on the
  // source row still existing / being unchanged (Stage 0 durability rule).
  await service
    .from("v4_agent_runs")
    .update({ transcript_snapshot: sourceOut.transcript, updated_at: new Date().toISOString() })
    .eq("id", runId);

  send("progress", { stage: "Planning angles", pct: 20 });

  const planResult = await intelligenceTool.run(srcCtx, { transcript: sourceOut.transcript });
  await recordStep(
    service,
    runId,
    userId,
    "planning",
    planResult.ok ? "done" : "failed",
    "Plan content angles",
    { transcriptLength: sourceOut.transcript.length },
    planResult.ok ? planResult.data : { error: planResult.error }
  );
  if (!planResult.ok) throw new Error(planResult.error ?? "Planning failed.");

  const plan = (planResult.data as { plan: ContentPlan }).plan;
  const inputTokens = (planResult.data as { inputTokens: number }).inputTokens ?? 0;
  const outputTokens = (planResult.data as { outputTokens: number }).outputTokens ?? 0;
  const costUnits = Math.round((inputTokens + outputTokens) / 100) / 100;

  // Persist the plan + each angle as a v4_content_ideas row for the approval UI.
  await service
    .from("v4_agent_runs")
    .update({
      plan: plan as never,
      status: "awaiting_approval",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_units: costUnits,
      step_count: 2,
      updated_at: new Date().toISOString()
    })
    .eq("id", runId);

  await service.from("v4_content_ideas").insert(
    plan.angles.map((a, i) => ({
      run_id: runId,
      user_id: userId,
      title: a.title,
      description: a.description,
      suggested_formats: a.suggestedFormats,
      quotes: a.quotes,
      rationale: a.rationale,
      approved: true,
      sort_order: i
    }))
  );

  send("progress", { stage: "Awaiting approval", pct: 55 });

  log.info("agent.planning_done", {
    run_id: runId,
    user_id: userId,
    angles: plan.angles.length,
    input_tokens: inputTokens,
    output_tokens: outputTokens
  });
}

// ── Execution phase: approved ideas → drafts → evaluation → done ────────────
async function runExecution(
  service: Awaited<ReturnType<typeof createServiceClient>>,
  run: AgentRunRow,
  send: Send
): Promise<void> {
  const { runId, userId, sourceId, mode } = { runId: run.id, userId: run.user_id, sourceId: run.source_id, mode: run.mode as AgentMode };

  const transcript = run.transcript_snapshot ?? "";
  if (!transcript) throw new Error("Run has no transcript snapshot — execution requires a planned run.");

  const ctx = { userId, runId, mode };

  // Approved angles, in order. V1: every approved angle × its suggested formats.
  const { data: ideas, error: ideasError } = await service
    .from("v4_content_ideas")
    .select("id, title, description, suggested_formats")
    .eq("run_id", runId)
    .eq("user_id", userId)
    .eq("approved", true)
    .order("sort_order", { ascending: true });
  if (ideasError) throw new Error(ideasError.message);
  const approvedIdeas = ideas ?? [];
  if (approvedIdeas.length === 0) {
    // All angles rejected — a legitimately empty run, not a failure.
    await service
      .from("v4_agent_runs")
      .update({ status: "done", finished_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", runId);
    send("progress", { stage: "No approved angles", pct: 100 });
    send("done", { ok: true, empty: true });
    return;
  }

  send("progress", { stage: "Generating drafts", pct: 60 });

  const outputIds: string[] = [];
  const FORMARTS: OutputFormat[] = ["linkedin_post", "newsletter", "shortform_script"];
  let estimatedTokens = 0;
  let steps = 0;

  for (const idea of approvedIdeas) {
    const formats = (idea.suggested_formats ?? []).filter((f: string) =>
      FORMARTS.includes(f as OutputFormat)
    ) as OutputFormat[];
    for (const format of formats) {
      // 1) Generate
      send("progress", { stage: `Generating ${format}`, pct: 60 + Math.round((steps / (approvedIdeas.length * 3)) * 25) });
      const gen = await generationTool.run(ctx, {
        sourceId,
        format,
        transcript,
        angleTitle: idea.title,
        angleDescription: idea.description ?? undefined
      });
      steps += 1;
      await recordStep(
        service,
        runId,
        userId,
        "generation",
        gen.ok ? "done" : "failed",
        `Generate ${format} — ${idea.title}`,
        { ideaId: idea.id, format },
        gen.ok ? { outputId: (gen.data as { outputId: string }).outputId } : { error: gen.error }
      );
      if (!gen.ok) continue; // one bad draft doesn't sink the run

      const { outputId, content } = gen.data as { outputId: string; content: string };
      outputIds.push(outputId);
      estimatedTokens += estimateGenerationTokens(transcript, content);

      // 2) Evaluate
      send("progress", { stage: `Rating ${format}`, pct: 85 });
      const review = await reviewTool.run(ctx, { format, transcript, content });
      steps += 1;
      await recordStep(
        service,
        runId,
        userId,
        "review",
        review.ok ? "done" : "failed",
        `Rate ${format} — ${idea.title}`,
        { ideaId: idea.id, format },
        review.ok ? review.data : { error: review.error }
      );
      if (!review.ok) continue;

      const rv = review.data as { evaluation: { score: number; flags: string[]; weak: boolean }; canRevise: boolean; revisionInstruction: string };

      // 3) Bounded single revision (execute/automate only) — never loop.
      if (rv.evaluation.weak && rv.canRevise && rv.revisionInstruction) {
        send("progress", { stage: `Revising ${format}`, pct: 92 });
        const revise = await generationTool.run(ctx, {
          sourceId,
          format,
          transcript,
          angleTitle: idea.title,
          angleDescription: idea.description ?? undefined,
          revisionInstruction: rv.revisionInstruction,
          outputId
        });
        steps += 1;
        await recordStep(
          service,
          runId,
          userId,
          "review",
          revise.ok ? "done" : "failed",
          `One-pass revision — ${format}`,
          { ideaId: idea.id, format, revisionInstruction: rv.revisionInstruction },
          revise.ok ? { outputId, revised: (revise.data as { revised: boolean }).revised } : { error: revise.error }
        );
        if (revise.ok) {
          // Re-evaluate the revised draft once; whatever it scores stands.
          const revisedContent = (revise.data as { content: string }).content;
          const re = await reviewTool.run(ctx, { format, transcript, content: revisedContent, isRevision: true });
          steps += 1;
          await recordStep(
            service,
            runId,
            userId,
            "review",
            re.ok ? "done" : "failed",
            `Re-rank ${format}`,
            { ideaId: idea.id, format, isRevision: true },
            re.ok ? re.data : { error: re.error }
          );
        }
      }

      // Persist the final evaluation onto the idea's row (replaces saveBestDrill).
      const finalEval = rv.evaluation;
      const { error: evalError } = await service
        .from("v4_content_ideas")
        .update({ evaluation: finalEval as never, updated_at: new Date().toISOString() })
        .eq("id", idea.id);
      if (evalError) throw new Error(evalError.message);
    }
  }

  send("progress", { stage: "Finalising", pct: 97 });

  const costUnits = (run.cost_units ?? 0) + Math.round(estimatedTokens / 100) / 100;

  await service
    .from("v4_agent_runs")
    .update({
      status: "done",
      output_ids: outputIds,
      step_count: steps,
      cost_units: costUnits,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", runId);

  send("progress", { stage: "Ready", pct: 100 });
  send("done", { ok: true, outputs: outputIds.length });

  log.info("agent.execution_done", {
    run_id: runId,
    user_id: userId,
    ideas: approvedIdeas.length,
    outputs: outputIds.length,
    cost_units: costUnits
  });
}

// ── Public entry point: claim then dispatch. Throws on unrecoverable failure. ─
export async function processAgentRun(runId: string, send: Send): Promise<void> {
  const service = createServiceClient();

  const claimed = await claimRun(service, runId);
  if (!claimed) {
    // Not ours: already claimed, awaiting approval, done, failed or cancelled.
    send("done", { ok: true, skipped: true });
    return;
  }

  const { run, phase } = claimed;
  log.info("agent.claimed", { run_id: runId, user_id: run.user_id, phase, attempt: run.attempt });

  try {
    // Set a transient in-flight status so the UI shows life.
    if (phase === "execution" && run.status !== "executing") {
      await service
        .from("v4_agent_runs")
        .update({ status: "executing", updated_at: new Date().toISOString() })
        .eq("id", runId);
    }

    if (phase === "planning") {
      await runPlanning(service, run, send);
    } else {
      await runExecution(service, run, send);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown agent failure";

    await recordStep(service, runId, run.user_id, "planning", "failed", "Run failed", {}, { error: message }).catch(() => {});
    await service
      .from("v4_agent_runs")
      .update({
        status: "failed",
        error_message: message.slice(0, 500),
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", runId);

    send("error", { error: message });
    log.error("agent.run_failed", err instanceof Error ? err : new Error(message), {
      run_id: runId,
      user_id: run.user_id,
      phase
    });
    throw err;
  }
}

export { STALE_AFTER_MS };
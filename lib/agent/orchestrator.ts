// Agentic orchestrator v2 (P2) — the durable worker behind /api/agent/process.
// Mirrors the base /api/process job semantics so a serverless function that dies
// mid-run doesn't park a run forever, and adds P2 governance on top of V1:
//
//   - claim/resume runs: planning window runs off updated_at (10 min), execution
//     re-claims on heartbeat staleness (90 s) so a dead worker is picked up fast
//   - every transition persists a v4_agent_steps row (append-only timeline)
//   - nothing important lives in memory between requests
//   - PER-RUN BUDGETS (P2): maxSteps / maxCostUnits / maxRuntimeS, snapshotted from
//     the user's plan at creation, enforced here — a hit STOPS the run and keeps
//     whatever drafts already completed (partial completion)
//   - HEARTBEAT (P2): heartbeat_at touched between steps; also the cancel check
//   - RETRY CLASSIFICATION (P2): transient provider/network errors leave the run
//     re-claimable (bounded by MAX_PHASE_ATTEMPTS) instead of failing it forever;
//     permanent errors (validation, schema, capability stubs) fail fast
//   - CANCELLATION (P2): status flips to cancelled via /api/agent/runs/[id]/cancel;
//     the worker checks between steps and stops cleanly, keeping accepted work
//
// State machine:
//   created → planning → awaiting_approval → executing → evaluating → done
//                                              └──────────────→ failed | cancelled
// The run parks at awaiting_approval while the human decides. Approval flips
// status to executing (POST /api/agent/runs/[id]/approve); a later process call
// picks it up exactly like a fresh claim.
//
// `automate` mode auto-approves: runPlanning flips to executing (approval_decision
// "auto_approved") and the same process call continues straight into execution —
// one claim, one continuous run to done. The worker state machine is unchanged;
// only the gate (human vs auto approval) is skipped.

import { createServiceClient } from "@/lib/supabase/server";
import { log } from "@/lib/logger";
import type { AgentMode, AgentRunRow, ContentPlan, OutputFormat, RunStatus, StopReason } from "@/types/agent";
import { budgetViolation, type BudgetSnapshot } from "@/lib/agent/budgets";
import { describeError, isTransientError, MAX_PHASE_ATTEMPTS } from "@/lib/agent/errors";
import { scoreAngle } from "@/lib/agent/idea-scoring";
import { buildSpendEvent, tokensToCostUnits } from "@/lib/agent/spend";
import { generationTool } from "@/lib/agent/tools/generation";
import { intelligenceTool } from "@/lib/agent/tools/intelligence";
import { sourceTool } from "@/lib/agent/tools/source";
import { reviewTool } from "@/lib/agent/tools/review";
import { scheduleRunOutputs } from "@/lib/agent/schedule";
import { notifyAgentRunChanged } from "@/lib/notifications";

export type Send = (event: string, data: unknown) => void;

// Claim windows. Execution runs heartbeat between steps, so a worker that died
// mid-generation is re-claimable after 90 s of silence instead of the coarse
// 10-minute window used for planning (which has no long-running loop).
const STALE_AFTER_MS = 10 * 60 * 1000;
const HEARTBEAT_STALE_MS = 90 * 1000;

// Coarse cost accounting: a single "cost units" accumulator (roadmap Stage 1
// stays cheap and predictable). Planning tokens are real (usageMetadata);
// generation tokens are estimated from transcript+draft size. Deliberately
// crude — the P2 budget ceilings are the guardrail on top of the estimate.
export function estimateGenerationTokens(transcript: string, content: string): number {
  return Math.round(transcript.length / 4 + content.length / 4);
}

// Pre-call cost estimate for one generation (the transcript half), used so the
// cost guard can trip BEFORE spending on the next LLM call.
export function estimateGenerationCost(transcript: string): number {
  return Math.round(transcript.length / 4) / 100;
}

// Budget hit during planning. Classified permanent (it's not transient) so the
// run fails with the budget message rather than retrying.
class RunBudgetError extends Error {}

export interface ClaimedRun {
  run: AgentRunRow;
  phase: "planning" | "execution";
}

export interface RunRowLite {
  id: string;
  user_id: string;
  status: string;
  attempt: number | null;
  started_at: string | null;
  updated_at: string | null;
}

// What a phase ended with. `done` = normal completion; the rest are clean stops
// that keep whatever completed work already exists.
export interface RunOutcome {
  reason: StopReason;
  costUnits: number;
  inputTokens: number;
  outputTokens: number;
  outputIds: string[];
  completed: number; // drafts written
  attempted: number; // drafts attempted
  // Planning only: where the run should sit after the phase. Missing for
  // execution. Used to continue a same-invocation run in automate mode.
  parkedStatus?: "awaiting_approval" | "executing";
}

// Claim a run for planning (created/planning, or stale) or execution
// (executing/evaluating, if stale). Runs at awaiting_approval, done, failed or
// cancelled are never claimed. Returns null when we don't hold it.
export async function claimRun(
  service: Awaited<ReturnType<typeof createServiceClient>>,
  runId: string
): Promise<ClaimedRun | null> {
  const staleCutoff = new Date(Date.now() - STALE_AFTER_MS).toISOString();
  const hbCutoff = new Date(Date.now() - HEARTBEAT_STALE_MS).toISOString();

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
  // window). Execution staleness is heartbeat-driven when a heartbeat exists
  // (90 s) and falls back to the 10-minute updated_at window otherwise. A
  // concurrent claim just loses the update and gets no row back.
  const claimableOr =
    `and(status.eq.created),` +
    `and(status.eq.planning,updated_at.lt.${staleCutoff}),` +
    `and(status.eq.executing,or(heartbeat_at.lt.${hbCutoff},and(heartbeat_at.is.null,updated_at.lt.${staleCutoff}))),` +
    `and(status.eq.evaluating,or(heartbeat_at.lt.${hbCutoff},and(heartbeat_at.is.null,updated_at.lt.${staleCutoff})))`;

  const claimedRow = await service
    .from("v4_agent_runs")
    .update({ status: nextStatus, attempt, started_at: touchedAt, updated_at: touchedAt, heartbeat_at: touchedAt })
    .eq("id", runId)
    .or(claimableOr)
    .select("*")
    .maybeSingle();

  const claimed = (claimedRow?.data ?? null) as AgentRunRow | null;
  if (!claimed) return null;
  return { run: claimed, phase: nextStatus === "executing" ? "execution" : "planning" };
}

// Record a durable step row. `kind` must map to the schema's allowed set.
export async function recordStep(
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

// Touch the run like "still alive": bumps heartbeat (claim freshness) and
// returns the live status. Also the cancellation check — if the run was
// cancelled between steps, a later process call must not keep working on it.
// Returns null when the row no longer exists (or reached a terminal status).
export async function touchRun(
  service: Awaited<ReturnType<typeof createServiceClient>>,
  runId: string
): Promise<RunStatus | null> {
  const { data, error } = await service
    .from("v4_agent_runs")
    .update({ heartbeat_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", runId)
    .in("status", ["created", "planning", "awaiting_approval", "executing", "evaluating"])
    .select("status")
    .maybeSingle();
  if (error || !data) return null;
  return data.status as RunStatus;
}

// Durable, cross-claim step count — the run's true work so far (retries
// included), the basis of the maxSteps guard.
export async function countRecordedSteps(
  service: Awaited<ReturnType<typeof createServiceClient>>,
  runId: string
): Promise<number> {
  const { count } = await service
    .from("v4_agent_steps")
    .select("id", { count: "exact", head: true })
    .eq("run_id", runId);
  return count ?? 0;
}

// ── Planning phase: transcript → plan, then park for human approval ──────────
async function runPlanning(
  service: Awaited<ReturnType<typeof createServiceClient>>,
  run: AgentRunRow,
  send: Send
): Promise<RunOutcome> {
  const { runId, userId, sourceId, mode } = { runId: run.id, userId: run.user_id, sourceId: run.source_id, mode: run.mode as AgentMode };

  const budget: BudgetSnapshot = {
    maxSteps: run.max_steps ?? 50,
    maxCostUnits: run.max_cost_units ?? 2500,
    maxRuntimeSeconds: run.max_runtime_s ?? 1800
  };
  const recordedSteps = await countRecordedSteps(service, runId);
  const startedAtMs = run.started_at ? Date.parse(run.started_at) : Date.now();

  const planningGuard = (inFlightSteps: number, inFlightCost: number, what: string) => {
    const violation = budgetViolation(
      budget,
      { steps: recordedSteps, costUnits: run.cost_units ?? 0, startedAtMs },
      Date.now(),
      { steps: inFlightSteps, costUnits: inFlightCost }
    );
    if (violation) throw new RunBudgetError(`Planning stopped at budget (${violation}) while ${what}.`);
  };

  send("progress", { stage: "Loading source", pct: 5 });

  const control = await touchRun(service, runId);
  if (!control || control === "cancelled") {
    return { reason: "cancelled", costUnits: run.cost_units ?? 0, inputTokens: 0, outputTokens: 0, outputIds: [], completed: 0, attempted: 0 };
  }

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
  planningGuard(2, 0, "loading the source");

  const sourceOut = src.data as { transcript: string };

  // Persist a durable transcript snapshot so execution doesn't depend on the
  // source row still existing / being unchanged (Stage 0 durability rule).
  await service
    .from("v4_agent_runs")
    .update({ transcript_snapshot: sourceOut.transcript, updated_at: new Date().toISOString() })
    .eq("id", runId);

  send("progress", { stage: "Planning angles", pct: 20 });
  const planGuard = await touchRun(service, runId);
  if (!planGuard || planGuard === "cancelled") {
    return { reason: "cancelled", costUnits: run.cost_units ?? 0, inputTokens: 0, outputTokens: 0, outputIds: [], completed: 0, attempted: 0 };
  }

  const planResult = await intelligenceTool.run(srcCtx, { transcript: sourceOut.transcript });
  if (!planResult.ok) {
    await recordStep(
      service,
      runId,
      userId,
      "planning",
      "failed",
      "Plan content angles",
      { transcriptLength: sourceOut.transcript.length },
      { error: planResult.error }
    );
    throw new Error(planResult.error ?? "Planning failed.");
  }
  planningGuard(3, 0, "planning the angles");

  const plan = (planResult.data as { plan: ContentPlan }).plan;
  const inputTokens = (planResult.data as { inputTokens: number }).inputTokens ?? 0;
  const outputTokens = (planResult.data as { outputTokens: number }).outputTokens ?? 0;
  const costUnits = tokensToCostUnits(inputTokens, outputTokens);
  const totalCost = Math.round((costUnits + (run.cost_units ?? 0)) * 100) / 100;

  // Record the planning step with spend data (real usageMetadata from Gemini).
  await recordStep(
    service,
    runId,
    userId,
    "planning",
    "done",
    "Plan content angles",
    { transcriptLength: sourceOut.transcript.length },
    {
      planSummary: plan.summary,
      angles: plan.angles.length,
      spend: buildSpendEvent({ inputTokens, outputTokens }, "gemini")
    }
  );

  // Persist the plan + each angle as a v4_content_ideas row for the approval UI.
  // In `automate` mode the angles are auto-approved on the user's behalf (the
  // capability) but that state is visible: status goes straight to `executing`
  // and approval_decision records it — the same place a manual approval lands.
  const autoApproved = mode === "automate";
  const { error: runError } = await service
    .from("v4_agent_runs")
    .update({
      plan: plan as never,
      status: autoApproved ? "executing" : "awaiting_approval",
      approval_decision: autoApproved ? "auto_approved" : null,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_units: totalCost,
      step_count: recordedSteps + 2,
      updated_at: new Date().toISOString()
    })
    .eq("id", runId);
  if (runError) throw new Error(`Could not persist plan: ${runError.message}`);

  // Notify AFTER the durable park write lands (persist-first). Automate
  // auto-approval parks straight into `executing` (agent.started, deduped to
  // once per run); the human path parks at `awaiting_approval`. Best-effort —
  // the builder never throws.
  await notifyAgentRunChanged(userId, { id: runId, status: autoApproved ? "executing" : "awaiting_approval" });

  // Score every angle with the deterministic P3 rubric (objective, grounded,
  // ranked) and persist the evaluation onto each idea row at ingest time — so
  // the approval surface and the later P5 strategist see the same server-side
  // score, not client-supplied rankings.
  const scoredAngles = plan.angles.map((a) => ({
    idea: a,
    evaluation: scoreAngle(a, sourceOut.transcript, plan.angles)
  }));

  await service.from("v4_content_ideas").insert(
    scoredAngles.map(({ idea: a, evaluation }, i) => ({
      run_id: runId,
      user_id: userId,
      title: a.title,
      description: a.description,
      suggested_formats: a.suggestedFormats,
      quotes: a.quotes,
      rationale: a.rationale,
      approved: true,
      sort_order: i,
      // Objective idea score + grounding/weakness fields (P3) — inside the
      // existing `evaluation` jsonb column; no schema change.
      evaluation: evaluation as never
    }))
  );

  send("progress", {
    stage: autoApproved ? "Angles auto-approved (automate)" : "Awaiting approval",
    pct: autoApproved ? 60 : 55
  });

  log.info("agent.planning_done", {
    run_id: runId,
    user_id: userId,
    angles: plan.angles.length,
    auto_approved: autoApproved,
    input_tokens: inputTokens,
    output_tokens: outputTokens
  });

  return {
    reason: null,
    costUnits: totalCost,
    inputTokens,
    outputTokens,
    outputIds: [],
    completed: 0,
    attempted: 0,
    parkedStatus: autoApproved ? "executing" : "awaiting_approval"
  };
}

// ── Execution phase: approved ideas → drafts → evaluation → done ────────────
async function runExecution(
  service: Awaited<ReturnType<typeof createServiceClient>>,
  run: AgentRunRow,
  send: Send
): Promise<RunOutcome> {
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
    send("progress", { stage: "No approved angles", pct: 100 });
    return { reason: null, costUnits: run.cost_units ?? 0, inputTokens: 0, outputTokens: 0, outputIds: [], completed: 0, attempted: 0 };
  }

  // Budgets are snapshotted columns on the run row (set at creation from the
  // plan) — never read from a live plan mid-run, so an in-flight run isn't
  // re-budgeted by a plan change.
  const budget: BudgetSnapshot = {
    maxSteps: run.max_steps ?? 50,
    maxCostUnits: run.max_cost_units ?? 2500,
    maxRuntimeSeconds: run.max_runtime_s ?? 1800
  };
  const recordedSteps = await countRecordedSteps(service, runId);
  const startedAtMs = run.started_at ? Date.parse(run.started_at) : Date.now();
  const estGenCost = estimateGenerationCost(transcript);

  // Partial resume: any drafts a previous execution already wrote stay linked
  // to this run.
  const outputIds = [...(run.output_ids ?? [])];
  let estimatedTokens = 0;
  let accumulatedInputTokens = 0; // real generation tokens (0 when unknown)
  let accumulatedOutputTokens = 0;
  let currentCost = run.cost_units ?? 0;
  let localSteps = 0;
  let attempted = 0;
  let completed = 0;

  const FORMARTS: OutputFormat[] = ["linkedin_post", "newsletter", "shortform_script", "thread", "carousel"];

  const guard = (inFlightSteps: number, inFlightCost: number): StopReason =>
    budgetViolation(
      budget,
      { steps: recordedSteps + localSteps, costUnits: currentCost, startedAtMs },
      Date.now(),
      { steps: inFlightSteps, costUnits: inFlightCost }
    );

  send("progress", { stage: "Generating drafts", pct: 60 });

  for (const idea of approvedIdeas) {
    const formats = (idea.suggested_formats ?? []).filter((f: string) =>
      FORMARTS.includes(f as OutputFormat)
    ) as OutputFormat[];
    for (const format of formats) {
      // 0) Heartbeat + cancellation check before each output. A cancelled run
      //    stops cleanly here; whatever drafts already arrived are kept.
      const control = await touchRun(service, runId);
      if (!control || control === "cancelled") {
        return { reason: "cancelled", costUnits: currentCost, inputTokens: run.input_tokens + accumulatedInputTokens, outputTokens: run.output_tokens + accumulatedOutputTokens, outputIds, completed, attempted };
      }

      // Budget guard before the next LLM call — trip BEFORE spending.
      const violation = guard(1, estGenCost);
      if (violation) {
        return { reason: violation, costUnits: currentCost, inputTokens: run.input_tokens + accumulatedInputTokens, outputTokens: run.output_tokens + accumulatedOutputTokens, outputIds, completed, attempted };
      }

      // 1) Generate
      send("progress", { stage: `Generating ${format}`, pct: 60 + Math.round((localSteps / (approvedIdeas.length * 3)) * 25) });
      const gen = await generationTool.run(ctx, {
        sourceId,
        format,
        transcript,
        angleTitle: idea.title,
        angleDescription: idea.description ?? undefined
      });
      localSteps += 1;
      attempted += 1;

      // Extract real token counts from the generation result (actual when the
      // provider returned usage metadata, 0 when unknown).
      const genData = gen.ok ? (gen.data as { outputId: string; content: string; inputTokens: number; outputTokens: number }) : null;
      const genInputTokens = genData?.inputTokens ?? 0;
      const genOutputTokens = genData?.outputTokens ?? 0;
      const genTokenSource: "actual" | "estimated" = genInputTokens > 0 || genOutputTokens > 0 ? "actual" : "estimated";

      await recordStep(
        service,
        runId,
        userId,
        "generation",
        gen.ok ? "done" : "failed",
        `Generate ${format} — ${idea.title}`,
        { ideaId: idea.id, format },
        gen.ok
          ? {
              outputId: genData!.outputId,
              spend: buildSpendEvent({ inputTokens: genInputTokens, outputTokens: genOutputTokens }, "gemini", genTokenSource)
            }
          : { error: gen.error }
      );
      if (!gen.ok) continue; // one bad draft doesn't sink the run

      const { outputId, content } = gen.data as { outputId: string; content: string };
      if (!outputIds.includes(outputId)) outputIds.push(outputId);
      completed += 1;

      // Accumulate real token counts (actual when available, 0 when unknown).
      // Total run tokens are persisted on the run row for the spend summary UI.
      if (genInputTokens > 0 || genOutputTokens > 0) {
        // Real token counts from the provider — accumulate directly.
        const stepCostUnits = tokensToCostUnits(genInputTokens, genOutputTokens);
        currentCost = Math.round((currentCost + stepCostUnits) * 100) / 100;
        // Track total tokens for the run row (planning tokens are already in
        // run.input_tokens / run.output_tokens, so we add on top).
        accumulatedInputTokens += genInputTokens;
        accumulatedOutputTokens += genOutputTokens;
        estimatedTokens += genInputTokens + genOutputTokens;
      } else {
        // Fallback: the provider didn't return usage metadata (OpenRouter path).
        // Use the coarse estimate so budget enforcement stays functional.
        const fallbackTokens = estimateGenerationTokens(transcript, content);
        estimatedTokens += fallbackTokens;
        currentCost = Math.round((currentCost + fallbackTokens / 100) * 100) / 100;
      }

      // 2) Evaluate (deterministic — no LLM, but counts as a step)
      const evalGuard = guard(1, 0);
      if (evalGuard) {
        return { reason: evalGuard, costUnits: currentCost, inputTokens: run.input_tokens + accumulatedInputTokens, outputTokens: run.output_tokens + accumulatedOutputTokens, outputIds, completed, attempted };
      }
      send("progress", { stage: `Rating ${format}`, pct: 85 });
      const review = await reviewTool.run(ctx, { format, transcript, content });
      localSteps += 1;
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
        const revGuard = guard(1, estGenCost);
        if (revGuard) {
          return { reason: revGuard, costUnits: currentCost, inputTokens: run.input_tokens + accumulatedInputTokens, outputTokens: run.output_tokens + accumulatedOutputTokens, outputIds, completed, attempted };
        }
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
        localSteps += 1;
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
          localSteps += 1;
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

  return {
    reason: null,
    costUnits: Math.round((currentCost) * 100) / 100,
    inputTokens: run.input_tokens + accumulatedInputTokens,
    outputTokens: run.output_tokens + accumulatedOutputTokens,
    outputIds,
    completed,
    attempted
  };
}

// Central finalizer — done / cancelled / budget-stop all land here so the
// partial-completion rule is one code path: whatever completed work exists is
// preserved on the run and in the library.
export async function finalizeRun(
  service: Awaited<ReturnType<typeof createServiceClient>>,
  runId: string,
  userId: string,
  outcome: RunOutcome,
  phase: "planning" | "execution"
): Promise<void> {
  const stepCount = await countRecordedSteps(service, runId);
  const now = new Date().toISOString();

  const common = {
    step_count: stepCount,
    cost_units: outcome.costUnits,
    output_ids: outcome.outputIds,
    updated_at: now,
    finished_at: now
  };

  // Persist accumulated token counts. Planning already wrote input/output
  // tokens during its phase; execution adds generation tokens on top. We
  // merge here so the final run row reflects the total.
  const tokenPatch = outcome.inputTokens > 0 || outcome.outputTokens > 0
    ? { input_tokens: outcome.inputTokens, output_tokens: outcome.outputTokens }
    : {};

  let patch: Record<string, unknown>;
  if (outcome.reason === null) {
    if (phase === "planning") {
      // Planning never writes outputs, so a "normal" planning finish is a
      // PARK, not a completion: the run stays awaiting_approval (or executing,
      // in automate mode) — the transition out of it happens on human approval
      // or the same-call execution continuation. Stamping `done`/`finished_at`
      // here is the classic skip-the-quality-review bug: angles could be
      // approved from a row that already claims the run finished.
      return;
    }
    patch = { ...common, ...tokenPatch, status: "done", error_message: null } as never;
  } else if (outcome.reason === "cancelled") {
    const phaseText = phase === "planning" ? "planning angles" : "generating drafts";
    patch = {
      ...common,
      ...tokenPatch,
      status: "cancelled",
      error_message: `Cancelled by you while ${phaseText}. Completed drafts are saved in your library.`
    } as never;
  } else {
    const label = outcome.reason === "steps" ? "step" : outcome.reason === "cost" ? "cost" : "runtime";
    patch = {
      ...common,
      ...tokenPatch,
      status: "failed",
      error_message: `Run stopped at its ${label} budget; ${outcome.completed} of ${outcome.attempted} planned draft${outcome.attempted === 1 ? "" : "s"} completed and saved in your library.`
    } as never;
  }

  const { error } = await service.from("v4_agent_runs").update(patch as never).eq("id", runId);
  if (error) {
    log.error("agent.finalize_failed", new Error(error.message), { run_id: runId });
  }

  // Notify AFTER the durable terminal write lands (persist-first). `done` is the
  // completion; `cancelled` (worker observed the cancel flag between steps) and
  // budget-stop `failed` are the same terminal transitions the cancel route and
  // permanent-failure path notify — the per-run dedupe key makes any re-emission
  // a no-op. Best-effort — the builder never throws.
  const terminalStatus =
    outcome.reason === null ? "done" : outcome.reason === "cancelled" ? "cancelled" : "failed";
  await notifyAgentRunChanged(userId, { id: runId, status: terminalStatus });
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

  let effectivePhase = phase;

  try {
    // Set a transient in-flight status so the UI shows life.
    if (phase === "execution" && run.status !== "executing") {
      await service
        .from("v4_agent_runs")
        .update({ status: "executing", updated_at: new Date().toISOString() })
        .eq("id", runId);
    }

    let outcome =
      phase === "planning" ? await runPlanning(service, run, send) : await runExecution(service, run, send);

    // `automate` auto-approval: runPlanning parked straight into `executing`, so
    // continue through execution in the same worker invocation — one claim, one
    // POST, straight to done. Re-read the live row (planning persisted tokens,
    // cost and status); a second claimRun would lose, but we already hold the
    // fresh heartbeat from planning.
    if (phase === "planning" && outcome.reason === null && outcome.parkedStatus === "executing") {
      const { data: live } = await service.from("v4_agent_runs").select("*").eq("id", runId).maybeSingle();
      if (live) {
        effectivePhase = "execution";
        send("progress", { stage: "Angles approved — generating drafts", pct: 60 });
        outcome = await runExecution(service, live as AgentRunRow, send);
      }
    }

    // Automate-only: schedule approved drafts into the user's Buffer queue. This
    // is a best-effort bonus on top of the drafts — a scheduling failure must
    // never fail the run, so it's wrapped and logged here.
    if (outcome.reason === null && effectivePhase === "execution" && (run.mode ?? "assist") === "automate") {
      if (outcome.outputIds.length > 0) {
        try {
          send("progress", { stage: "Scheduling approved drafts", pct: 95 });
          const sched = await scheduleRunOutputs(
            service,
            { userId: run.user_id, runId, mode: "automate" },
            outcome.outputIds
          );
          log.info("agent.schedule_summary", {
            run_id: runId,
            user_id: run.user_id,
            ...sched
          });
        } catch (err) {
          log.error("agent.schedule_error", err instanceof Error ? err : new Error(String(err)), {
            run_id: runId,
            user_id: run.user_id
          });
        }
      }
    }

    await finalizeRun(service, runId, run.user_id, outcome, effectivePhase);

    if (outcome.reason === null) {
      send("progress", { stage: "Ready", pct: 100 });
      send("done", {
        ok: true,
        stopped: null,
        outputs: outcome.outputIds.length,
        completed: outcome.completed,
        cancelled: false
      });
    } else {
      send("progress", { stage: "Stopping", pct: 100 });
      send("done", {
        ok: true,
        stopped: outcome.reason,
        outputs: outcome.outputIds.length,
        completed: outcome.completed,
        cancelled: outcome.reason === "cancelled"
      });
      log.info("agent.run_stopped", {
        run_id: runId,
        user_id: run.user_id,
        reason: outcome.reason,
        completed: outcome.completed,
        attempted: outcome.attempted,
        cost_units: outcome.costUnits
      });
    }
  } catch (err) {
    const message = describeError(err);
    const transient = isTransientError(err);
    const canRetry = transient && (run.attempt ?? 0) < MAX_PHASE_ATTEMPTS;

    const failedKind = effectivePhase === "planning" ? "planning" : "generation";
    await recordStep(
      service,
      runId,
      run.user_id,
      failedKind,
      "failed",
      "Run failed",
      {},
      { error: message.slice(0, 500), retryable: transient }
    ).catch(() => {});

    if (canRetry) {
      // Transient failure: keep the run claimable (status stays planning /
      // executing) so the next process POST retries. Bounded by attempt count.
      await service
        .from("v4_agent_runs")
        .update({ error_message: message.slice(0, 300), updated_at: new Date().toISOString() })
        .eq("id", runId);

      send("error", { error: message, retryable: true });
      log.warn("agent.run_transient", {
        run_id: runId,
        user_id: run.user_id,
        attempt: run.attempt,
        phase: effectivePhase,
        error: message
      });
      return;
    }

    // Permanent (or retries exhausted): fail the run.
    await service
      .from("v4_agent_runs")
      .update({
        status: "failed",
        error_message: message.slice(0, 500),
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", runId);

    // Notify AFTER the durable failed write (persist-first). The transient path
    // above keeps the run claimable and is deliberately NOT notified.
    await notifyAgentRunChanged(run.user_id, { id: runId, status: "failed" });

    send("error", { error: message, retryable: false });
    log.error("agent.run_failed", err instanceof Error ? err : new Error(message), {
      run_id: runId,
      user_id: run.user_id,
      attempt: run.attempt,
      phase: effectivePhase,
      retryable: false
    });
    throw err;
  }
}

export { STALE_AFTER_MS, HEARTBEAT_STALE_MS };
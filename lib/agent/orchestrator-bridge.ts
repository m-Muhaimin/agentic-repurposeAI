// VervAI orchestrator v1 wiring — the bridge between the pure v1 policy package
// (lib/agent/orchestrator/) and the durable runtime worker (lib/agent/orchestrator.ts).
//
// The bridge is deliberately a SIBLING of the runtime, never part of the policy
// package (purity contract: lib/agent/orchestrator/types.ts:11-13) and never
// inside the runtime (hot path untouched). It has two halves:
//   - the ADAPTER (this file): status maps + hydrate() + ownership seam
//   - the LOOP  (processAgentRunV1): the v1 policy loop — same file, appended by T9.6
//
// Deep-import rule: policy pieces come ONLY via deep paths
// (@/lib/agent/orchestrator/types, /executor, /context, /flag, /idempotency,
// /events, /retry, /approvals, /state-machine). Never import the policy index via
// the bare specifier "@/lib/agent/orchestrator" — that resolves to the RUNTIME
// file (orchestrator.ts wins over orchestrator/index.ts in TS resolution).

import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { AgentMode, AgentRunRow, RunStatus } from "@/types/agent";
import type {
  OrchestrationMode,
  OrchestrationPlan,
  OrchestrationRunStatus,
  PlanApproval
} from "@/lib/agent/orchestrator/types";
import type { RunState } from "@/lib/agent/orchestrator/executor";
import type { ResolverSeam } from "@/lib/agent/orchestrator/context";

// ── T9.6 loop-half imports (design §10.2) ───────────────────────────────────
// Runtime internals via the BARE specifier (the runtime file — intentionally
// the name-collision winner); policy pieces ONLY via deep paths.
// NOTE: AgentRunRow + OrchestrationRunStatus are already bound by T9.5's
// imports above (same sources) — the brief's identical duplicate lines are
// omitted here because TS2300 rejects re-importing the same name.
import { log } from "@/lib/logger";
import type { ContentPlan, StopReason } from "@/types/agent";
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
import { nextStep, markStepDone, markStepSkipped } from "@/lib/agent/orchestrator/executor";
import { isExecutable } from "@/lib/agent/orchestrator/approvals";
import { transitionPath } from "@/lib/agent/orchestrator/state-machine";
import { decideRetry, DEFAULT_RETRY_POLICY } from "@/lib/agent/orchestrator/retry";
import { persistKeySafely, stableKey, type IdempotencyStoreSeam } from "@/lib/agent/orchestrator/idempotency";
import { runEventFor } from "@/lib/agent/orchestrator/events";
import { resolveContext } from "@/lib/agent/orchestrator/context";
import { track, type EventName } from "@/lib/analytics/events";
import {
  claimRun,
  recordStep,
  touchRun,
  countRecordedSteps,
  finalizeRun,
  estimateGenerationCost,
  type Send,
  type RunOutcome
} from "@/lib/agent/orchestrator";

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;
type UserClient = Awaited<ReturnType<typeof createClient>>;

// The runtime's generation formats (orchestrator.ts:437) — the plan only ever
// plans into this union. `newsletter` stays a first-class LLM format here.
const FORMATS: readonly string[] = ["linkedin_post", "newsletter", "shortform_script", "thread", "carousel"];
// 15 v1 statuses → the runtime's 8 (lossy by design, mapping-layer only).
// Never emit v1 labels over SSE; the DB + SSE stay on runtime vocabulary.
export function toRunStatus(v1: OrchestrationRunStatus): RunStatus {
  switch (v1) {
    case "idle":
      return "created";
    case "understanding":
    case "context_loaded":
    case "opportunities_identified":
    case "recommendations_ready":
    case "planning":
      return "planning";
    case "awaiting_approval":
      return "awaiting_approval";
    case "approved":
      return "executing"; // transient edge in v1; persisted as executing + approval_decision
    case "executing":
      return "executing";
    case "validating":
      return "executing"; // runtime's evaluating is claimable-only, never written
    case "review":
      return "done"; // v1 terminal-review park ≡ runtime drafts-ready done
    case "completed":
      return "done";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    case "paused":
      // No runtime equivalent, no route, no UI (design §3.1). Refuse explicitly.
      throw new Error("v1 status 'paused' has no runtime equivalent — not persisted");
  }
}

// Reverse map used by hydration (design §3.1). 8 runtime statuses → 15 v1.
export function toV1RunStatus(run: RunStatus): OrchestrationRunStatus {
  switch (run) {
    case "created":
      return "idle";
    case "planning":
      return "planning";
    case "awaiting_approval":
      return "awaiting_approval";
    case "executing":
      return "executing";
    case "evaluating":
      return "executing"; // dormant status — executing-equivalent (design risk #6)
    case "done":
      return "completed";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
  }
}

// Inverse of the package's toAgentMode (types.ts:31-33): assist→manual,
// execute→assisted, automate→agent.
export function toOrchestrationMode(mode: AgentMode): OrchestrationMode {
  return mode === "automate" ? "agent" : mode === "execute" ? "assisted" : "manual";
}
export interface V1RunModel {
  run: AgentRunRow;
  plan: OrchestrationPlan;
  state: RunState;
  approval: PlanApproval | null;
  sourceId: string;
  transcript: string;
  userId: string;
  mode: AgentMode;
  // stepId (gen-{ideaId}-{format} / review-{ideaId}-{format}) → the DB rows the
  // loop needs to execute it. Avoids parsing the composite id ever again.
  stepMeta: Record<string, { ideaId: string; format: string; title: string; description?: string }>;
}
// The loop records generation/review steps with input EXACTLY { ideaId, format }
// (orchestrator.ts:493, :541). Revision/re-rank rows add extra keys
// (revisionInstruction / isRevision) and must NOT match. Strict equality:
// object, exactly 2 keys, both equal.
function isExactStepKey(input: unknown, ideaId: string, format: string): boolean {
  if (typeof input !== "object" || input === null) return false;
  const record = input as Record<string, unknown>;
  const keys = Object.keys(record);
  return keys.length === 2 && record.ideaId === ideaId && record.format === format;
}
// Reconstruct the v1 in-memory model from the SAME rows the runtime writes —
// no new columns, one table format for flag-on and flag-off runs.
export async function hydrate(service: ServiceClient, run: AgentRunRow): Promise<V1RunModel> {
  const runId = run.id;
  const userId = run.user_id;

  // Approved angles, in order — identical read to runExecution (orchestrator.ts:399-407).
  const { data: ideas, error: ideasError } = await service
    .from("v4_content_ideas")
    .select("id, title, description, suggested_formats")
    .eq("run_id", runId)
    .eq("user_id", userId)
    .eq("approved", true)
    .order("sort_order", { ascending: true });
  if (ideasError) throw new Error(ideasError.message);
  const approvedIdeas = ideas ?? [];

  // Durable step timeline for this run.
  const { data: stepRows, error: stepsError } = await service
    .from("v4_agent_steps")
    .select("kind, status, input")
    .eq("run_id", runId);
  if (stepsError) throw new Error(stepsError.message);

  // Build the plan: every (idea, format) pair yields gen-{ideaId}-{format}
  // (type generate) + review-{ideaId}-{format} (type review, dependsOn [gen]) —
  // structurally identical to buildPlan's output (planner.ts:64-87) and the
  // runtime's (idea × suggested_formats) loop (orchestrator.ts:449-453).
  const steps: OrchestrationPlan["steps"] = [];
  const outputIds: string[] = [];
  const stepMeta: V1RunModel["stepMeta"] = {};
  const stepStatus: Record<string, RunState["stepStatus"][string]> = {};

  // Map each (idea, format) to its v1 step ids; DB done|failed|skipped rows with
  // an exact {ideaId, format} input win; pending/running rows leave the step
  // pending (absent = pending).
  for (const idea of approvedIdeas) {
    const formats = (idea.suggested_formats ?? []).filter((f: string) => FORMATS.includes(f)) as string[];
    for (const format of formats) {
      const genId = `gen-${idea.id}-${format}`;
      const revId = `review-${idea.id}-${format}`;
      steps.push({
        id: genId,
        type: "generate",
        outputId: format,
        sourceIds: [run.source_id],
        opportunityIds: [],
        dependsOn: [],
        requiresApproval: run.mode !== "automate",
        status: "pending"
      });
      steps.push({
        id: revId,
        type: "review",
        outputId: format,
        sourceIds: [run.source_id],
        opportunityIds: [],
        dependsOn: [genId],
        requiresApproval: false,
        status: "pending"
      });
      outputIds.push(format);
      stepMeta[genId] = { ideaId: idea.id, format, title: idea.title, description: idea.description ?? undefined };
      stepMeta[revId] = { ideaId: idea.id, format, title: idea.title, description: idea.description ?? undefined };
    }
  }

  for (const row of stepRows ?? []) {
    if (row.kind !== "generation" && row.kind !== "review") continue;
    const status = row.status as "done" | "failed" | "skipped" | "pending" | "running";
    if (status !== "done" && status !== "failed" && status !== "skipped") continue;
    for (const idea of approvedIdeas) {
      const formats = (idea.suggested_formats ?? []).filter((f: string) => FORMATS.includes(f)) as string[];
      for (const format of formats) {
        if (!isExactStepKey(row.input, idea.id, format)) continue;
        const id = row.kind === "generation" ? `gen-${idea.id}-${format}` : `review-${idea.id}-${format}`;
        stepStatus[id] = status;
      }
    }
  }

  // Approval (design §3.2): planApproved from the persisted decision; automate
  // mirrors policies.ts:45-53 (generate approval-gated in assist/execute only).
  const mode = run.mode as AgentMode;
  const approvalRequired = mode !== "automate";
  const planApproved =
    run.approval_decision === "approved" ||
    run.approval_decision === "auto_approved" ||
    !approvalRequired;

  const plan: OrchestrationPlan = {
    id: `run:${runId}`,
    version: 1, // no edit/plan route exists → version-bound approval trivially satisfied
    objective: { text: "" }, // objective is not persisted anywhere; balanced default
    outputIds,
    recommendationIds: [],
    rationale: `Planned ${outputIds.length} output(s) from the approved angle(s).`,
    approvalRequired,
    steps,
    status:
      run.status === "awaiting_approval"
        ? "awaiting_approval"
        : planApproved
          ? "approved"
          : "draft"
  };

  return {
    run,
    plan,
    state: { runId, userId, stepStatus, planApproved },
    approval: planApproved ? { runId, planId: plan.id, planVersion: 1, userId, decision: "approved", at: run.updated_at ?? new Date().toISOString() } : null,
    sourceId: run.source_id,
    transcript: run.transcript_snapshot ?? "",
    userId,
    mode,
    stepMeta
  };
}
// DB-backed ResolverSeam for the v1 planning phase: ownership is asserted with
// the USER client (RLS), never the service client. Returns false (refused) on
// any error — never silently trusts.
export function dbResolverSeam(userClient: UserClient): ResolverSeam {
  return {
    async sourceOwnedByUser(userId: string, sourceId: string): Promise<boolean> {
      const { data, error } = await userClient
        .from("sources")
        .select("id")
        .eq("id", sourceId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error || !data) return false;
      return true;
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// T9.6 — LOOP half (processAgentRunV1)
// Flag-on entry point mirroring the runtime's processAgentRun but driving the
// pure v1 policy loop (nextStep / approvals / state-machine / retry /
// idempotency / events). Runs through the SAME runtime internals (claim,
// recordStep, touchRun, budgets, SSE) — never reimplementing them (design §8).
// ═══════════════════════════════════════════════════════════════════════════

// ORCH_* analytics (lib/analytics/event-names.ts:28-39) emitted at loop-observed
// transitions ONLY, after the durable status write lands. Intermediate v1 states
// return null from runEventFor (events.ts:58-59) — no events. The in-claim set
// keeps re-emission across resumed claims low-grade (design §7 default).
const emittedKeys: Set<string> = new Set();

async function emitOnce(runId: string, userId: string, v1: OrchestrationRunStatus): Promise<void> {
  const event = runEventFor(v1);
  if (!event) return;
  const key = `${runId}:${v1}`;
  if (emittedKeys.has(key)) return;
  emittedKeys.add(key);
  // runEventFor returns string; track wants the EventName literal union —
  // cast per repo precedent (app/api/events/route.ts:27).
  await track(event as EventName, userId, { run_id: runId, status: v1 });
}

// v4_agent_steps.idempotency_key (migration 20260912000003). persistKey targets
// exactly the row this step recorded: run + kind + input jsonb strictly equal to
// { ideaId, format } (revision rows carry extra keys and are not touched).
function parseStepId(stepId: string): { kind: "generation" | "review"; ideaId: string; format: string } | null {
  const m = /^(gen|review)-([0-9a-fA-F-]{36})-([a-z_]+)$/.exec(stepId);
  if (!m) return null;
  return { kind: m[1] === "gen" ? "generation" : "review", ideaId: m[2], format: m[3] };
}

function makeIdemSeam(service: ServiceClient): IdempotencyStoreSeam {
  return {
    async stepExistsByKey(key: string): Promise<boolean> {
      const { data } = await service
        .from("v4_agent_steps")
        .select("id")
        .eq("idempotency_key", key)
        .maybeSingle();
      return data !== null;
    },
    async persistKey(runId: string, stepId: string, key: string): Promise<void> {
      const parsed = parseStepId(stepId);
      if (!parsed) return;
      await service
        .from("v4_agent_steps")
        .update({ idempotency_key: key })
        .eq("run_id", runId)
        .eq("kind", parsed.kind)
        .eq("input", { ideaId: parsed.ideaId, format: parsed.format } as never);
    }
  };
}

function stepStableKey(userId: string, runId: string, sourceId: string, stepType: "generate" | "review", format: string): string {
  return stableKey({
    userId,
    runId,
    objective: "", // not persisted anywhere in this milestone (design §3.2)
    sourceIds: [sourceId],
    outputId: stepType === "generate" ? format : `${format}:review`
  });
}

// ── v1 planning phase ───────────────────────────────────────────────────────
// Transcribed from the runtime's runPlanning (orchestrator.ts:207-383) with the
// v1 additions: server-authoritative ownership gate (resolveContext via the USER
// client), the policy state-machine park validation, and the persist-first ORCH
// park event. Every persisted value stays identical to the runtime.
// NOTE: the runtime's local `RunBudgetError` class (orchestrator.ts:69, not
// exported) is out of scope here — the planning guard throws a plain Error with
// the SAME message. Classification is message-based (isTransientError), so the
// budget trip stays permanent exactly like the runtime's.
async function v1Planning(
  service: ServiceClient,
  run: AgentRunRow,
  userClient: UserClient,
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
    if (violation) throw new Error(`Planning stopped at budget (${violation}) while ${what}.`);
  };

  send("progress", { stage: "Loading source", pct: 5 });

  const control = await touchRun(service, runId);
  if (!control || control === "cancelled") {
    return { reason: "cancelled", costUnits: run.cost_units ?? 0, inputTokens: 0, outputTokens: 0, outputIds: [], completed: 0, attempted: 0 };
  }

  // NEW (v1): server-authoritative ownership gate before any work. Throws
  // PERMISSION_DENIED → permanent, fail fast.
  const resolvedCtx = await resolveContext(dbResolverSeam(userClient), {
    userId,
    runId,
    objective: { text: "" },
    mode: toOrchestrationMode(mode),
    sourceIds: [sourceId],
    intelligenceIds: [],
    opportunityIds: [],
    recommendationIds: [],
    constraints: {
      maxOutputs: budget.maxSteps,
      budget: budget.maxCostUnits,
      allowedPlatforms: [],
      requireApproval: mode !== "automate"
    }
  });
  if (resolvedCtx instanceof Error) throw resolvedCtx; // PERMISSION_DENIED → permanent, fail fast

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

  // NEW (v1): validate the park transition through the policy state machine.
  // Both parks are legal (planning → awaiting_approval direct; planning →
  // executing via the auto-approval path) — this is a belt-and-braces guard.
  const parked = autoApproved ? "executing" : "awaiting_approval";
  if (transitionPath("planning", parked).length === 0) {
    throw new Error(`Invalid park transition planning → ${parked}`);
  }

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

  // NEW (v1): emit the park event after the ideas insert (persist-first).
  await emitOnce(runId, userId, parked === "executing" ? "executing" : "awaiting_approval");

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

// The v1 policy loop: nextStep-driven, same tools, same runtime internals, same
// counters — never reimplementing claim/resume/budgets/SSE (design §8).
async function v1Execution(
  service: ServiceClient,
  run: AgentRunRow,
  send: Send
): Promise<RunOutcome> {
  const runId = run.id;
  const userId = run.user_id;
  const sourceId = run.source_id;
  const mode = run.mode as "assist" | "execute" | "automate";

  const transcript = run.transcript_snapshot ?? "";
  if (!transcript) throw new Error("Run has no transcript snapshot — execution requires a planned run.");

  const h = await hydrate(service, run);
  const { plan } = h;

  // Approval gate (design §5): enforcement in the loop — an unapproved run can't
  // execute even if a rogue process POST arrives. nextStep already gates on
  // state.planApproved; this is the explicit approvals-module assert.
  if (!isExecutable(runId, plan, userId, h.approval)) {
    send("done", { ok: true, skipped: true });
    return { reason: null, costUnits: run.cost_units ?? 0, inputTokens: 0, outputTokens: 0, outputIds: [], completed: 0, attempted: 0 };
  }

  if (plan.steps.length === 0) {
    // All angles rejected / none approved — a legitimately empty run.
    send("progress", { stage: "No approved angles", pct: 100 });
    return { reason: null, costUnits: run.cost_units ?? 0, inputTokens: 0, outputTokens: 0, outputIds: [], completed: 0, attempted: 0 };
  }

  await emitOnce(runId, userId, "approved"); // ORCH_PLAN_APPROVED
  await emitOnce(runId, userId, "executing"); // ORCH_EXECUTION_STARTED

  const budget: BudgetSnapshot = {
    maxSteps: run.max_steps ?? 50,
    maxCostUnits: run.max_cost_units ?? 2500,
    maxRuntimeSeconds: run.max_runtime_s ?? 1800
  };
  const recordedSteps = await countRecordedSteps(service, runId);
  const startedAtMs = run.started_at ? Date.parse(run.started_at) : Date.now();
  const estGenCost = estimateGenerationCost(transcript);

  const ctx = { userId, runId, mode };
  const idemSeam = makeIdemSeam(service);
  const outputIds = [...(run.output_ids ?? [])];
  let currentCost = run.cost_units ?? 0;
  let accumulatedInputTokens = 0;
  let accumulatedOutputTokens = 0;
  let completed = 0;
  let attempted = 0;
  let localSteps = 0;
  let state = h.state;
  // In-claim memory: generated draft per (idea, format) — the same locals the
  // runtime keeps for the review step (orchestrator.ts:531-532).
  const genContent: Record<string, string> = {};

  // Trip BEFORE spending (design §4 boundedness; runtime :439-445 semantics).
  const guard = (inFlightSteps: number, inFlightCost: number): StopReason =>
    budgetViolation(
      budget,
      { steps: recordedSteps + localSteps, costUnits: currentCost, startedAtMs },
      Date.now(),
      { steps: inFlightSteps, costUnits: inFlightCost }
    );

  const stop = (reason: StopReason): RunOutcome => ({
    reason,
    costUnits: currentCost,
    inputTokens: run.input_tokens + accumulatedInputTokens,
    outputTokens: run.output_tokens + accumulatedOutputTokens,
    outputIds,
    completed,
    attempted
  });

  send("progress", { stage: "Generating drafts", pct: 60 });

  for (;;) {
    // Heartbeat + cancellation check between steps (runtime :456-459 semantics).
    const control = await touchRun(service, runId);
    if (!control || control === "cancelled") return stop("cancelled");

    const violation = guard(0, 0);
    if (violation) return stop(violation);

    const stepId = nextStep(plan, state);
    if (!stepId) break; // nothing actionable (approval gate, all done)

    const step = plan.steps.find((s) => s.id === stepId)!;
    const meta = h.stepMeta[stepId];

    switch (step.type) {
      case "generate": {
        const genGuard = guard(1, estGenCost);
        if (genGuard) return stop(genGuard);

        send("progress", { stage: `Generating ${meta.format}`, pct: 60 + Math.round((localSteps / plan.steps.length) * 25) });

        // Bounded retry loop: transient errors retry with DECIDE_RETRY backoff
        // (classification delegated to the same isTransientError, retry.ts:11);
        // permanent/exhausted → markStepSkipped, never the run (runtime :501).
        let gen: Awaited<ReturnType<typeof generationTool.run>>;
        let attempt = 1;
        for (;;) {
          gen = await generationTool.run(ctx, {
            sourceId,
            format: meta.format,
            transcript,
            angleTitle: meta.title,
            angleDescription: meta.description
          });
          localSteps += 1;
          attempted += 1;
          await recordStep(
            service,
            runId,
            userId,
            "generation",
            gen.ok ? "done" : "failed",
            `Generate ${meta.format} — ${meta.title}`,
            { ideaId: meta.ideaId, format: meta.format }, // EXACT input shape hydrate matches (T9.5)
            gen.ok
              ? { outputId: (gen.data as { outputId: string }).outputId, spend: buildSpendEvent({ inputTokens: (gen.data as { inputTokens: number }).inputTokens ?? 0, outputTokens: (gen.data as { outputTokens: number }).outputTokens ?? 0 }, "gemini") }
              : { error: gen.error }
          );
          if (gen.ok) break;
          const decision = decideRetry(gen.error, attempt++, DEFAULT_RETRY_POLICY);
          if (decision.action === "fail") {
            state = markStepSkipped(plan, state, stepId); // never re-offered
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, decision.delayMs));
        }
        if (!gen.ok) break; // step skipped — continue to the next step, run intact

        const genData = gen.data as { outputId: string; content: string; inputTokens: number; outputTokens: number };
        if (!outputIds.includes(genData.outputId)) outputIds.push(genData.outputId);
        completed += 1;
        genContent[`${meta.ideaId}:${meta.format}`] = genData.content;
        state = markStepDone(plan, state, stepId);

        // Cost accumulation — identical to runtime :509-524 (actual tokens when
        // the provider reported them, coarse estimate otherwise).
        const genInputTokens = genData.inputTokens ?? 0;
        const genOutputTokens = genData.outputTokens ?? 0;
        const genTokenSource: "actual" | "estimated" = genInputTokens > 0 || genOutputTokens > 0 ? "actual" : "estimated";
        if (genInputTokens > 0 || genOutputTokens > 0) {
          const stepCostUnits = tokensToCostUnits(genInputTokens, genOutputTokens);
          currentCost = Math.round((currentCost + stepCostUnits) * 100) / 100;
          accumulatedInputTokens += genInputTokens;
          accumulatedOutputTokens += genOutputTokens;
        } else {
          const fallbackTokens = Math.round(transcript.length / 4 + genData.content.length / 4);
          currentCost = Math.round((currentCost + fallbackTokens / 100) * 100) / 100;
        }

        // Idempotency bookkeeping — fire-and-forget, never fails the step (§6).
        await persistKeySafely(idemSeam, runId, stepId, stepStableKey(userId, runId, sourceId, "generate", meta.format));
        break;
      }

      case "review": {
        const evalGuard = guard(1, 0);
        if (evalGuard) return stop(evalGuard);
        send("progress", { stage: `Rating ${meta.format}`, pct: 85 });

        const content = genContent[`${meta.ideaId}:${meta.format}`];
        if (!content) {
          // Defensive: dependency ordering should guarantee this; never spin.
          state = markStepSkipped(plan, state, stepId);
          break;
        }
        const review = await reviewTool.run(ctx, { format: meta.format, transcript, content });
        localSteps += 1;
        await recordStep(
          service,
          runId,
          userId,
          "review",
          review.ok ? "done" : "failed",
          `Rate ${meta.format} — ${meta.title}`,
          { ideaId: meta.ideaId, format: meta.format }, // EXACT input shape hydrate matches
          review.ok ? review.data : { error: review.error }
        );
        await persistKeySafely(idemSeam, runId, stepId, stepStableKey(userId, runId, sourceId, "review", meta.format));
        if (!review.ok) {
          state = markStepSkipped(plan, state, stepId);
          break;
        }

        const rv = review.data as {
          evaluation: { score: number; flags: string[]; weak: boolean };
          canRevise: boolean;
          revisionInstruction: string;
        };

        // Bounded single revision (execute/automate only) — one revision + one
        // re-rank, never a loop (mirror runtime :548-591).
        if (rv.evaluation.weak && rv.canRevise && rv.revisionInstruction) {
          const revGuard = guard(1, estGenCost);
          if (revGuard) return stop(revGuard);
          send("progress", { stage: `Revising ${meta.format}`, pct: 92 });
          const revise = await generationTool.run(ctx, {
            sourceId,
            format: meta.format,
            transcript,
            angleTitle: meta.title,
            angleDescription: meta.description,
            revisionInstruction: rv.revisionInstruction,
            outputId: undefined
          });
          localSteps += 1;
          await recordStep(
            service,
            runId,
            userId,
            "review",
            revise.ok ? "done" : "failed",
            `One-pass revision — ${meta.format}`,
            { ideaId: meta.ideaId, format: meta.format, revisionInstruction: rv.revisionInstruction }, // extra keys — correctly NOT matched by hydrate
            revise.ok ? { outputId: undefined, revised: (revise.data as { revised: boolean }).revised } : { error: revise.error }
          );
          if (revise.ok) {
            const revisedContent = (revise.data as { content: string }).content;
            const re = await reviewTool.run(ctx, { format: meta.format, transcript, content: revisedContent, isRevision: true });
            localSteps += 1;
            await recordStep(
              service,
              runId,
              userId,
              "review",
              re.ok ? "done" : "failed",
              `Re-rank ${meta.format}`,
              { ideaId: meta.ideaId, format: meta.format, isRevision: true }, // extra keys — correctly NOT matched by hydrate
              re.ok ? re.data : { error: re.error }
            );
          }
        }

        // Persist the final evaluation onto the idea's row (runtime :593-599).
        const { error: evalError } = await service
          .from("v4_content_ideas")
          .update({ evaluation: rv.evaluation as never, updated_at: new Date().toISOString() })
          .eq("id", meta.ideaId);
        if (evalError) throw new Error(evalError.message);

        state = markStepDone(plan, state, stepId);
        break;
      }

      case "publish":
      case "schedule":
      case "analyze":
      case "recommend":
        // Invariant (design §4): buildPlan never emits these and this milestone
        // never plans them. Defensive: skip + log rather than spin (plan §4 #6).
        log.warn("agent.v1_unreachable_step", { run_id: runId, step_id: stepId, type: step.type });
        state = markStepSkipped(plan, state, stepId);
        break;
    }
  }

  send("progress", { stage: "Finalising", pct: 97 });

  return {
    reason: null,
    costUnits: Math.round(currentCost * 100) / 100,
    inputTokens: run.input_tokens + accumulatedInputTokens,
    outputTokens: run.output_tokens + accumulatedOutputTokens,
    outputIds,
    completed,
    attempted
  };
}

// Flag-on execution dispatch (T9.7 branches here when isOrchestratorV1Enabled()).
// Mirrors processAgentRun's claim/finalize/error structure EXACTLY — the v1
// policy only replaces the two phase bodies.
export async function processAgentRunV1(runId: string, send: Send): Promise<void> {
  const service = createServiceClient();
  const userClient = createClient(); // ownership seam for the planning phase

  const claimed = await claimRun(service, runId);
  if (!claimed) {
    send("done", { ok: true, skipped: true }); // byte-identical to orchestrator.ts:696-697
    return;
  }

  const { run, phase } = claimed;
  log.info("agent.claimed", { run_id: runId, user_id: run.user_id, phase, attempt: run.attempt, v1: true });

  let effectivePhase = phase;

  try {
    if (phase === "execution" && run.status !== "executing") {
      await service
        .from("v4_agent_runs")
        .update({ status: "executing", updated_at: new Date().toISOString() })
        .eq("id", runId);
    }

    let outcome =
      phase === "planning"
        ? await v1Planning(service, run, userClient, send)
        : await v1Execution(service, run, send);

    // automate continuation — one claim, one POST, straight to done (runtime :722-729).
    if (phase === "planning" && outcome.reason === null && outcome.parkedStatus === "executing") {
      const { data: live } = await service.from("v4_agent_runs").select("*").eq("id", runId).maybeSingle();
      if (live) {
        effectivePhase = "execution";
        send("progress", { stage: "Angles approved — generating drafts", pct: 60 });
        outcome = await v1Execution(service, live as AgentRunRow, send);
      }
    }

    // automate-only: best-effort Buffer scheduling (runtime :734-755, verbatim).
    if (outcome.reason === null && effectivePhase === "execution" && (run.mode ?? "assist") === "automate") {
      if (outcome.outputIds.length > 0) {
        try {
          send("progress", { stage: "Scheduling approved drafts", pct: 95 });
          const sched = await scheduleRunOutputs(service, { userId: run.user_id, runId, mode: "automate" }, outcome.outputIds);
          log.info("agent.schedule_summary", { run_id: runId, user_id: run.user_id, ...sched });
        } catch (err) {
          log.error("agent.schedule_error", err instanceof Error ? err : new Error(String(err)), {
            run_id: runId,
            user_id: run.user_id
          });
        }
      }
    }

    await finalizeRun(service, runId, run.user_id, outcome, effectivePhase);

    // SSE responder — the documented wire contract (docs/API.md:123-129) with the
    // runtime's exact payload shapes (orchestrator.ts:759-785).
    if (outcome.reason === null) {
      await emitOnce(runId, run.user_id, "completed"); // ORCH_RUN_COMPLETED
      send("progress", { stage: "Ready", pct: 100 });
      send("done", {
        ok: true,
        stopped: null,
        outputs: outcome.outputIds.length,
        completed: outcome.completed,
        cancelled: false
      });
    } else {
      await emitOnce(runId, run.user_id, outcome.reason === "cancelled" ? "cancelled" : "failed");
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
    // Transient/permanent split identical to the runtime (:786-846): keep the run
    // claimable on transient (bounded by attempts), fail + notify on permanent.
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

    await service
      .from("v4_agent_runs")
      .update({
        status: "failed",
        error_message: message.slice(0, 500),
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", runId);
    await notifyAgentRunChanged(run.user_id, { id: runId, status: "failed" });
    await emitOnce(runId, run.user_id, "failed"); // ORCH_RUN_FAILED
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
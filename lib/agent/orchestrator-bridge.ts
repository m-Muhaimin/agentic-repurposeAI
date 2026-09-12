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
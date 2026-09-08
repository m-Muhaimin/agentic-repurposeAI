// VervAI Orchestrator v1 — pure orchestration-domain types.
//
// This module describes the *coordination* layer that sits on top of the
// existing subsystems. It does NOT reimplement the agent runtime: the durable
// worker in lib/agent/orchestrator.ts (claim/resume/budget/cancel), the tool
// registry, provider abstraction, publishing, billing and idempotency all stay
// where they are. This package only defines the run lifecycle, plan/approval
// model, retry/error taxonomy and event vocabulary the rest of the app reasons
// about, and converts recommendations into a reviewable plan.
//
// Everything here is PURE (no imports of network/DB/side-effect modules) so it
// is unit-testable and safe for any server code to import. Persistence
// continues through the existing v4_agent_runs / v4_agent_steps tables.

// ── Modes ───────────────────────────────────────────────────────────────────
// Reuses the autonomy axis from types/agent.ts. A mode is a capability set
// (lib/agent/permissions.ts), never a loosening of safety.
export type OrchestrationMode = "manual" | "assisted" | "agent";

export const ORCHESTRATION_MODES: readonly OrchestrationMode[] = [
  "manual",
  "assisted",
  "agent"
];

// Map an orchestration mode onto the existing agent autonomy modes where the
// plan involves the agent runtime. `manual` = fully human-driven steps only;
// `assisted` = plan + human approval then deterministic generation (default);
// `agent` = reserved for future higher-autonomy flows (still approval-gated for
// any consequential action).
export function toAgentMode(mode: OrchestrationMode): "assist" | "execute" | "automate" {
  return mode === "agent" ? "automate" : mode === "assisted" ? "execute" : "assist";
}

// ── Objective ────────────────────────────────────────────────────────────────
// The user's stated goal. `normalized` is the canonical intent key (when it can
// be resolved) and may be absent for a free-form objective the planner handles
// as "balanced / default".
export interface OrchestrationObjective {
  text: string;
  normalized?: string; // grow_linkedin | grow_email | get_reach | clarify_ideas | drive_action
}

// ── Context references ──────────────────────────────────────────────────────
// Server-resolved references (IDs + summaries), never full content dumps into
// client-owned shape. Ownership is resolved server-side and asserted before use.
export interface OrchestrationContext {
  userId: string;
  runId: string;
  objective: OrchestrationObjective;
  mode: OrchestrationMode;
  sourceIds: string[];
  intelligenceIds: string[];
  opportunityIds: string[];
  recommendationIds: string[];
  constraints: {
    maxOutputs: number;
    budget: number; // cost units
    allowedPlatforms: string[];
    requireApproval: boolean;
  };
}

// ── Plan ────────────────────────────────────────────────────────────────────
export type PlanStepType =
  | "analyze"
  | "recommend"
  | "generate"
  | "review"
  | "publish"
  | "schedule";

export const PLAN_STEP_TYPES: readonly PlanStepType[] = [
  "analyze",
  "recommend",
  "generate",
  "review",
  "publish",
  "schedule"
];

export type StepStatus = "pending" | "ready" | "running" | "done" | "failed" | "skipped";

export interface PlanStep {
  id: string;
  type: PlanStepType;
  outputId?: string;
  sourceIds: string[];
  opportunityIds: string[];
  dependsOn: string[]; // plan-step ids that must be done first
  requiresApproval: boolean;
  status: StepStatus;
}

export interface OrchestrationPlan {
  id: string;
  version: number;
  objective: OrchestrationObjective;
  outputIds: string[];
  recommendationIds: string[];
  rationale: string;
  approvalRequired: boolean;
  steps: PlanStep[];
  status: "draft" | "awaiting_approval" | "approved" | "superseded" | "rejected";
}

// ── Approval ────────────────────────────────────────────────────────────────
// Bound to { runId, planId, planVersion, userId }. A plan change invalidates a
// prior approval by bumping the version (and thus the planId, if changed).
export interface PlanApproval {
  runId: string;
  planId: string;
  planVersion: number;
  userId: string;
  decision: "approved" | "rejected";
  at: string;
}

// ── Execution ───────────────────────────────────────────────────────────────
export type ExecutionStatus =
  | "not_started"
  | "running"
  | "completed"
  | "completed_with_errors"
  | "cancelled"
  | "failed";

// ── Orchestration run ───────────────────────────────────────────────────────
// The coordination object. Persistence of the counterpart lives in
// v4_agent_runs / v4_agent_steps; this in-memory model is the typed, validated
// shape the state machine and executor operate on.
export interface VervAIOrchestrationRun {
  id: string;
  objective: OrchestrationObjective;
  mode: OrchestrationMode;
  context: OrchestrationContext;
  recommendationIds: string[];
  plan: OrchestrationPlan | null;
  approval: PlanApproval | null;
  execution: {
    status: ExecutionStatus;
    stepByStepId: Record<string, StepStatus>;
  };
  outputIds: string[];
  errors: Array<{ code: string; message: string; at: string }>;
  timestamps: {
    created: string;
    contextLoaded?: string;
    recommendationsReady?: string;
    planCreated?: string;
    approved?: string;
    started?: string;
    completed?: string;
  };
}

// ── Run status (the lifecycle) ──────────────────────────────────────────────
export type OrchestrationRunStatus =
  | "idle"
  | "understanding"
  | "context_loaded"
  | "opportunities_identified"
  | "recommendations_ready"
  | "planning"
  | "awaiting_approval"
  | "approved"
  | "executing"
  | "validating"
  | "review"
  | "completed"
  | "failed"
  | "cancelled"
  | "paused";

// ── Tool risk model ─────────────────────────────────────────────────────────
// read → auto-allow; write → allowed by a valid run policy; consequential →
// explicit approval (including ALL publishing). Used by policies/permissions.
export type ToolRisk = "read" | "write" | "consequential";

// ── Errors ──────────────────────────────────────────────────────────────────
export type OrchestrationErrorCode =
  | "INVALID_OBJECTIVE"
  | "INSUFFICIENT_EVIDENCE"
  | "NO_RECOMMENDATION"
  | "APPROVAL_REQUIRED"
  | "APPROVAL_INVALID"
  | "PERMISSION_DENIED"
  | "USAGE_LIMIT"
  | "TOOL_FAILED"
  | "VALIDATION_FAILED"
  | "PUBLISH_FAILED"
  | "RUN_CANCELLED"
  | "RUN_TIMEOUT";

export interface OrchestrationError {
  code: OrchestrationErrorCode;
  userMessage: string;
  detail?: string; // technical detail for logs only, never rendered raw
}

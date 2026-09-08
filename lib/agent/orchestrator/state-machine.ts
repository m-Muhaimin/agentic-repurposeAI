// VervAI Orchestrator v1 — state machine.
//
// Server-authoritative lifecycle with a single centralized transition function
// that rejects invalid transitions. This is a PURE policy module: it decides
// what transition is legal, and the caller (the runtime/existing orchestrator)
// persists the new state to v4_agent_runs / v4_agent_steps. The policy here is
// the source of truth for whether a move is allowed.

import type { OrchestrationRunStatus } from "./types";

// Terminal states can never leave.
const TERMINAL: ReadonlySet<OrchestrationRunStatus> = new Set([
  "completed",
  "failed",
  "cancelled"
]);

// States that pause/resume apply to.
const PAUSABLE: ReadonlySet<OrchestrationRunStatus> = new Set([
  "understanding",
  "context_loaded",
  "opportunities_identified",
  "recommendations_ready",
  "planning",
  "awaiting_approval",
  "approved",
  "executing",
  "validating",
  "review"
]);

export interface TransitionResult {
  ok: boolean;
  reason?: string;
}

/**
 * The only legal edges in the lifecycle. Key invariant edges that MUST be
 * rejected are tested explicitly:
 *   - can't go planning → publishing-like forward jumps without the middle
 *   - can't go awaiting_approval → executing without an approval gate
 *   - can't go completed → executing / cancelled → executing
 */
const EDGES: Record<OrchestrationRunStatus, ReadonlyArray<OrchestrationRunStatus>> = {
  idle: ["understanding"],
  understanding: ["context_loaded", "failed", "cancelled"],
  context_loaded: ["opportunities_identified", "failed", "cancelled"],
  opportunities_identified: ["recommendations_ready", "failed", "cancelled", "paused"],
  recommendations_ready: ["planning", "failed", "cancelled", "paused"],
  planning: ["awaiting_approval", "failed", "cancelled", "paused"],
  awaiting_approval: ["approved", "rejected" as OrchestrationRunStatus, "failed", "cancelled"],
  approved: ["executing", "failed", "cancelled"],
  executing: ["validating", "failed", "cancelled", "paused", "completed"],
  validating: ["review", "failed", "cancelled"],
  review: ["completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
  paused: []
};

// Paused can resume into any of the non-terminal, non-paused, non-idle states
// it came from. We allow resume to the set of "active" states except idle and
// the already-terminal ones.
function canResumeFromPaused(target: OrchestrationRunStatus): boolean {
  return target !== "idle" && target !== "paused" && !TERMINAL.has(target);
}

/**
 * Central transition function. Returns ok:false (never throws) for invalid
 * transitions so callers can surface a controlled failure.
 */
export function canTransition(
  from: OrchestrationRunStatus,
  to: OrchestrationRunStatus
): TransitionResult {
  if (from === to) {
    return { ok: true, reason: "no-op" };
  }

  // Terminal states are immutable.
  if (TERMINAL.has(from)) {
    return { ok: false, reason: `terminal state '${from}' cannot transition` };
  }

  // Paused is special: it can resume to any active state.
  if (from === "paused") {
    if (canResumeFromPaused(to)) return { ok: true };
    return { ok: false, reason: `cannot resume from 'paused' to '${to}'` };
  }

  const edges = EDGES[from];
  if (!edges) return { ok: false, reason: `unknown state '${from}'` };

  if (edges.includes(to)) return { ok: true };
  return {
    ok: false,
    reason: `invalid transition '${from}' → '${to}'`
  };
}

/**
 * `awaiting_approval → executing` is only legal once approval has been granted.
 * The state machine encodes `awaiting_approval → approved` as the approval
 * edge; `approved → executing` as the execution edge. This helper makes the
 * production flow explicit: you cannot jump straight from awaiting_approval to
 * executing without first transitioning through the granted-approval state.
 */
export function transitionPath(
  from: OrchestrationRunStatus,
  to: OrchestrationRunStatus
): OrchestrationRunStatus[] {
  if (canTransition(from, to).ok) return [to];

  // awaiting_approval → executing requires an explicit approved step.
  if (
    from === "awaiting_approval" &&
    (to === "executing" || to === "validating")
  ) {
    return ["approved", to];
  }

  // planning → executing (without parked approval) is only valid if the plan is
  // not human-gated; otherwise it must pass through approval.
  if (from === "planning" && to === "executing") {
    return ["awaiting_approval", "approved", to];
  }

  return [];
}

/**
 * Easy aliases for the human-flow (same rules, thinner call sites).
 */
export function canPause(from: OrchestrationRunStatus): TransitionResult {
  if (from === "paused") return { ok: true };
  if (PAUSABLE.has(from)) return { ok: true };
  return { ok: false, reason: `state '${from}' is not pauseable` };
}

export function canCancel(from: OrchestrationRunStatus): TransitionResult {
  if (TERMINAL.has(from)) return { ok: false, reason: `state '${from}' already terminal` };
  return { ok: true, reason: from === "cancelled" ? "already cancelled (idempotent)" : undefined };
}

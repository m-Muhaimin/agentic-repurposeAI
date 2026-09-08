// VervAI Orchestrator v1 — executor tick.
//
// A PURE "what next?" function the durable worker (lib/agent/orchestrator.ts)
// consults between steps. It never runs side effects — it only decides WHICH
// step is next, honoring dependency edges and the approval gate. The worker
// executes the step via the existing tool registry / provider abstraction and
// then reports the result back through markStepDone / markStepFailed.
//
// This keeps the orchestration *policy* deterministic and testable while the
// runtime keeps doing the actual work.

import type { OrchestrationPlan, PlanStep, StepStatus } from "./types";
import { isExecutable } from "./approvals";

export interface RunState {
  runId: string;
  userId: string;
  stepStatus: Record<string, StepStatus>;
  planApproved: boolean; // whether the gate passed for this plan
}

function depsMet(step: PlanStep, status: Record<string, StepStatus>): boolean {
  return step.dependsOn.every((dep) => status[dep] === "done");
}

/**
 * Returns the id of the next step that should run, or null when nothing is
 * actionable (waiting on approval, all done, etc.).
 */
export function nextStep(plan: OrchestrationPlan, state: RunState): string | null {
  if (plan.status !== "approved" && plan.status !== "draft") return null;

  // Approval gate: for plans requiring approval, no step runs until the gate
  // has passed for THIS plan version.
  if (plan.approvalRequired && !state.planApproved) return null;

  const ready = plan.steps.filter((s) => {
    if (state.stepStatus[s.id] === "done" || state.stepStatus[s.id] === "skipped") return false;
    if (state.stepStatus[s.id] === "running") return false;
    return depsMet(s, state.stepStatus);
  });

  // Deterministic: plan.steps order is already dependency-ordered by the
  // planner, so the first ready step is the right one.
  return ready.length > 0 ? ready[0].id : null;
}

export function markStepDone(
  plan: OrchestrationPlan,
  state: RunState,
  stepId: string
): RunState {
  return {
    ...state,
    stepStatus: { ...state.stepStatus, [stepId]: "done" }
  };
}

export function markStepFailed(
  plan: OrchestrationPlan,
  state: RunState,
  stepId: string
): RunState {
  return {
    ...state,
    stepStatus: { ...state.stepStatus, [stepId]: "failed" }
  };
}

export function markStepRunning(
  plan: OrchestrationPlan,
  state: RunState,
  stepId: string
): RunState {
  return {
    ...state,
    stepStatus: { ...state.stepStatus, [stepId]: "running" }
  };
}

export function allStepsDone(plan: OrchestrationPlan, state: RunState): boolean {
  return plan.steps.every((s) => state.stepStatus[s.id] === "done" || state.stepStatus[s.id] === "skipped");
}

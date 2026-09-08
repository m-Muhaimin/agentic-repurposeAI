// VervAI Orchestrator v1 — approvals.
//
// The human gate. An approval is bound to { runId, planId, planVersion, userId }.
// v1 rule: ALL consequential actions — any publish/schedule, or any generate
// when the plan says so — require explicit approval. Because plans are
// immutable once approved, an approval is only valid for its exact plan version;
// bumping a plan invalidates a prior approval automatically (the caller must
// re-approve).
//
// PURE: describes legality; the server persists approvals to the run row /
// plan-approval record using the existing approval surface.

import type { OrchestrationPlan, PlanApproval } from "./types";

/**
 * True when the given approval is valid for the (run, plan, user) it claims.
 * An approval is invalid when: plan id differs, plan version differs, user
 * differs, run differs, or the decision isn't a grant.
 */
export function isApprovalValidFor(
  runId: string,
  plan: OrchestrationPlan,
  userId: string,
  approval: PlanApproval | null
): boolean {
  if (!approval) return false;
  if (approval.decision !== "approved") return false;
  if (approval.runId !== runId) return false;
  if (approval.userId !== userId) return false;
  if (approval.planId !== plan.id) return false;
  if (approval.planVersion !== plan.version) return false;
  return true;
}

/**
 * The production gate used when transitioning a plan into execution: the plan
 * may execute without approval only when it declares approval not required;
 * otherwise a valid (version-bound) approval is mandatory.
 */
export function requiresApproval(plan: OrchestrationPlan): boolean {
  return plan.approvalRequired;
}

export function isExecutable(
  runId: string,
  plan: OrchestrationPlan,
  userId: string,
  approval: PlanApproval | null,
  forceApprove = false
): boolean {
  if (!plan.approvalRequired) return true;
  if (forceApprove) return true;
  return isApprovalValidFor(runId, plan, userId, approval);
}

/**
 * Record a decision and return the immutably-bound approval object. Rejection
 * also binds to the same plan version (so a rejection can't be "replayed" in a
 * newer plan).
 */
export function decide(
  runId: string,
  plan: OrchestrationPlan,
  userId: string,
  decision: "approved" | "rejected"
): PlanApproval {
  return {
    runId,
    planId: plan.id,
    planVersion: plan.version,
    userId,
    decision,
    at: new Date().toISOString()
  };
}

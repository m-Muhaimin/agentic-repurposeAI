// VervAI Orchestrator v1 — planner.
//
// Converts an ordered list of recommendations into a STRUCTURED plan (not free
// text): typed steps with dependency edges, an explicit approval requirement,
// and immutable versioning. Plan versioning rule: approved plans are immutable;
// any change produces a NEW version (and thus requires re-approval).
//
// PURE. Takes recommendations (from lib/recommendations) and returns a plan.

import type { EnrichedRecommendation } from "@/lib/recommendations";
import type {
  OrchestrationPlan,
  OrchestrationObjective,
  PlanStep
} from "./types";

export interface PlannerInput {
  recommendations: Array<EnrichedRecommendation>;
  objective: OrchestrationObjective;
  sourceIds: string[];
  maxOutputs: number;
  approveGenerate: boolean; // generate steps need human approval (assist default)
  approvePublish: boolean; // publish/schedule ALWAYS require approval in v1
}

const NOT_RECOMMENDED: ReadonlyArray<EnrichedRecommendation["fitLabel"]> = ["Not recommended"];

/**
 * Builds a structured plan. Outputs not recommended are left out (the plan does
 * not fabricate work). For every kept recommendation we emit a generate step
 * plus a trailing review step; review depends on its generate step. Publishing
 * stays entirely manual in v1 (external to the plan), so no publication step is
 * auto-scheduled.
 *
 * @returns the plan, or an Error when no recommendation can form a plan.
 */
export function buildPlan(input: PlannerInput): OrchestrationPlan | Error {
  const { recommendations, objective } = input;

  if (recommendations.length === 0) {
    return new Error("NO_RECOMMENDATION: no recommended outputs to plan");
  }

  // Deterministic order: keep recommendations in their provided (ranked) order,
  // capped at maxOutputs, dropping explicit non-recommendations.
  const selected = recommendations
    .filter((r) => !NOT_RECOMMENDED.includes(r.fitLabel))
    .slice(0, Math.max(1, input.maxOutputs));

  if (selected.length === 0) {
    return new Error("INSUFFICIENT_EVIDENCE: no strong-enough recommendation");
  }

  const steps: PlanStep[] = [];
  const outputIds: string[] = [];
  const recommendationIds: string[] = [];
  let publishGate = false;

  for (const r of selected) {
    const outId = r.definition.id;
    outputIds.push(outId);
    recommendationIds.push(outId); // recommended output keyed by registry id

    const genStep: PlanStep = {
      id: `gen-${outId}`,
      type: "generate",
      outputId: outId,
      sourceIds: input.sourceIds,
      opportunityIds: [...r.opportunityIds],
      dependsOn: [],
      requiresApproval: input.approveGenerate,
      status: "pending"
    };
    steps.push(genStep);

    // Deterministic evaluator gate after every generate step.
    const reviewStep: PlanStep = {
      id: `review-${outId}`,
      type: "review",
      outputId: outId,
      sourceIds: input.sourceIds,
      opportunityIds: [...r.opportunityIds],
      dependsOn: [genStep.id],
      requiresApproval: false,
      status: "pending"
    };
    steps.push(reviewStep);

    if (input.approvePublish) publishGate = true;
  }

  const approvalRequired = steps.some((s) => s.requiresApproval) || publishGate;

  return {
    id: `plan-${objective.normalized ?? "default"}-1`,
    version: 1,
    objective,
    outputIds,
    recommendationIds,
    rationale:
      `Planned ${outputIds.length} output${outputIds.length === 1 ? "" : "s"} from your strongest ` +
      `recommendation${outputIds.length === 1 ? "" : "s"}.`,
    approvalRequired,
    steps,
    status: approvalRequired ? "draft" : "approved"
  };
}

/**
 * Bump a plan to a new version. Approved plans are immutable: any change goes
 * through this, which increments the version and resets approval status so it
 * must be re-approved.
 */
export function newPlanVersion(
  plan: OrchestrationPlan,
  mutate?: (draft: OrchestrationPlan) => void
): OrchestrationPlan {
  const next: OrchestrationPlan = {
    ...plan,
    version: plan.version + 1,
    status: "draft",
    steps: plan.steps.map((s) => ({ ...s }))
  };
  if (mutate) mutate(next);
  return next;
}

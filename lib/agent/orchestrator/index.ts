// VervAI Orchestrator v1 — public API.
//
// Coordination layer on top of the existing agent runtime. Import from this
// index; everything is pure and unit-testable without a DB.
//
// What this layer is NOT: it does not reimplement the durable worker
// (lib/agent/orchestrator.ts: claim/resume/budget/cancel), the tool registry,
// provider abstraction, publishing, billing, or the recommendation engine. It
// only *coordinates*: lifecycle policy, plan/approval model, executor tick,
// retry classification, idempotency keys, error taxonomies and progress copy.

export * from "./types";
export {
  canTransition,
  canPause,
  canCancel,
  transitionPath
} from "./state-machine";
export { buildContext, resolveContext } from "./context";
export { buildPlan, newPlanVersion } from "./planner";
export {
  isApprovalValidFor,
  requiresApproval,
  isExecutable,
  decide
} from "./approvals";
export {
  nextStep,
  markStepDone,
  markStepFailed,
  markStepSkipped,
  markStepRunning,
  allStepsDone
} from "./executor";
export {
  decideRetry,
  backoff,
  DEFAULT_RETRY_POLICY,
  maxRetries
} from "./retry";
export {
  stableKey,
  alreadyRan,
  persistKeySafely
} from "./idempotency";
export {
  riskForTool,
  mayActAutonomously,
  stepRequiresApproval
} from "./policies";
export { orchestrationError, userMessageFor } from "./errors";
export { statusLabel, runEventFor } from "./events";

// Convenience: build a full ORCHESTRATION run object from the policy pieces.
import type {
  OrchestrationContext,
  OrchestrationObjective,
  VervAIOrchestrationRun
} from "./types";

export function createRun(opts: {
  id: string;
  objective: OrchestrationObjective;
  context: OrchestrationContext;
}): VervAIOrchestrationRun {
  return {
    id: opts.id,
    objective: opts.objective,
    mode: opts.context.mode,
    context: opts.context,
    recommendationIds: [],
    plan: null,
    approval: null,
    execution: {
      status: "not_started",
      stepByStepId: {}
    },
    outputIds: [],
    errors: [],
    timestamps: { created: new Date().toISOString() }
  };
}

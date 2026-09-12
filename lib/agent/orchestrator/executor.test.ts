import { describe, it, expect } from "vitest";
import { nextStep, markStepDone, markStepFailed, markStepSkipped, allStepsDone } from "./index";
import type { OrchestrationPlan } from "./types";
import type { RunState } from "./executor";

function makePlan(): OrchestrationPlan {
  return {
    id: "plan-test-1",
    version: 1,
    objective: { text: "" },
    outputIds: ["linkedin_post"],
    recommendationIds: [],
    rationale: "test fixture",
    approvalRequired: false,
    status: "approved",
    steps: [
      {
        id: "gen-x",
        type: "generate",
        outputId: "linkedin_post",
        sourceIds: [],
        opportunityIds: [],
        dependsOn: [],
        requiresApproval: false,
        status: "pending"
      },
      {
        id: "review-x",
        type: "review",
        outputId: "linkedin_post",
        sourceIds: [],
        opportunityIds: [],
        dependsOn: ["gen-x"],
        requiresApproval: false,
        status: "pending"
      }
    ]
  };
}

function makeState(): RunState {
  return { runId: "r1", userId: "u1", stepStatus: {}, planApproved: true };
}

describe("markStepSkipped", () => {
  it("marks the step skipped and returns a new state without mutating the input", () => {
    const plan = makePlan();
    const state = makeState();
    const next = markStepSkipped(plan, state, "gen-x");
    expect(next.stepStatus["gen-x"]).toBe("skipped");
    expect(next).not.toBe(state); // immutable
    expect(state.stepStatus["gen-x"]).toBeUndefined(); // input untouched
  });

  it("nextStep does not re-offer a skipped step (filter skips done/skipped)", () => {
    const plan = makePlan();
    let state = makeState();
    state = markStepSkipped(plan, state, "gen-x");
    // review-x depends on gen-x being done; a skipped dep means nothing is actionable.
    expect(nextStep(plan, state)).toBeNull();
  });

  it("allStepsDone counts skipped as finished", () => {
    const plan = makePlan();
    let state = makeState();
    state = markStepSkipped(plan, state, "gen-x");
    state = markStepSkipped(plan, state, "review-x");
    expect(allStepsDone(plan, state)).toBe(true);
  });

  it("documents the executor gap the bridge works around: nextStep re-offers failed steps", () => {
    const plan = makePlan();
    const state = markStepFailed(plan, makeState(), "gen-x");
    expect(nextStep(plan, state)).toBe("gen-x"); // failed is not excluded — bridge must skip exhausted-failed
  });

  it("a done step's dependent review becomes actionable", () => {
    const plan = makePlan();
    let state = makeState();
    state = markStepDone(plan, state, "gen-x");
    expect(nextStep(plan, state)).toBe("review-x");
  });
});
// VervAI Orchestrator v1 — coordination-layer tests.
//
// Pure policy tests. No DB / network: every module under test is side-effect
// free, so assertions are deterministic. Uses real recommendation/error types
// so the policy truly interoperates with the rest of the app.

import { describe, it, expect } from "vitest";
import {
  canTransition,
  canPause,
  canCancel,
  transitionPath,
  buildContext,
  resolveContext,
  buildPlan,
  newPlanVersion,
  requiresApproval,
  isExecutable,
  decide,
  nextStep,
  markStepDone,
  markStepRunning,
  allStepsDone,
  decideRetry,
  backoff,
  stableKey,
  riskForTool,
  mayActAutonomously,
  stepRequiresApproval,
  createRun,
  orchestrationError,
  userMessageFor,
  statusLabel
} from "./index";
import { outputRegistry } from "@/lib/output-registry";
import type { EnrichedRecommendation } from "@/lib/recommendations";
import type { OutputDefinition } from "@/lib/output-registry/types";
import type { OrchestrationPlan, OrchestrationMode, OrchestrationRunStatus, StepStatus } from "./types";

// ── fixtures ────────────────────────────────────────────────────────────────

function outputDef(id: string): OutputDefinition {
  const def = outputRegistry.get(id);
  if (!def) throw new Error(`missing fixture output id ${id}`);
  return def;
}

function recommendation(outputId: string, fitLabel: EnrichedRecommendation["fitLabel"]): EnrichedRecommendation {
  return {
    definition: outputDef(outputId),
    score: 0.9,
    evidenceScore: 0.8,
    objectiveFit: 0.9,
    opportunityStrength: 0.7,
    confidence: 0.85,
    fitLabel,
    reasons: ["Because your audience would engage"],
    opportunityIds: ["grow_linkedin"]
  };
}

const OBJECTIVE = { text: "Grow my LinkedIn", normalized: "grow_linkedin" };
const SOURCE_IDS = ["src-1"];

function ownedContext(mode: OrchestrationMode = "assisted") {
  return buildContext({
    userId: "u-1",
    runId: "r-1",
    objective: OBJECTIVE,
    mode,
    sourceIds: SOURCE_IDS,
    intelligenceIds: [],
    opportunityIds: ["opp-1"],
    recommendationIds: [],
    constraints: { maxOutputs: 2, budget: 1000, allowedPlatforms: ["linkedin"], requireApproval: true },
    owned: { sources: { "src-1": true }, intelligence: {}, opportunities: { "opp-1": true } }
  });
}

// ── state machine ───────────────────────────────────────────────────────────

describe("state machine", () => {
  it("follows the forward happy path", () => {
    const path: OrchestrationRunStatus[] = ["idle", "understanding", "context_loaded", "opportunities_identified", "recommendations_ready", "planning", "awaiting_approval", "approved", "executing", "validating", "review", "completed"];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i], path[i + 1]).ok, `${path[i]}→${path[i + 1]}`).toBe(true);
    }
  });

  it("rejects jumping straight from awaiting_approval to executing", () => {
    expect(canTransition("awaiting_approval", "executing").ok).toBe(false);
  });

  it("rejects execution after a completed run", () => {
    expect(canTransition("completed", "executing").ok).toBe(false);
    expect(canTransition("cancelled", "executing").ok).toBe(false);
    expect(canTransition("failed", "executing").ok).toBe(false);
  });

  it("rejects unknown forward jumps", () => {
    expect(canTransition("idle", "executing").ok).toBe(false);
    expect(canTransition("planning", "completed").ok).toBe(false);
  });

  it("treats pausing/resuming symmetrically", () => {
    expect(canPause("executing").ok).toBe(true);
    expect(canTransition("executing", "paused").ok).toBe(true);
    expect(canTransition("paused", "executing").ok).toBe(true);
    expect(canPause("completed").ok).toBe(false);
  });

  it("assembles the approval path via transitionPath", () => {
    expect(transitionPath("awaiting_approval", "executing")).toEqual(["approved", "executing"]);
  });
});

// ── context ─────────────────────────────────────────────────────────────────

describe("context", () => {
  it("builds with all ownership asserted", () => {
    const ctx = ownedContext();
    expect(ctx).not.toBeInstanceOf(Error);
    expect((ctx as { userId: string }).userId).toBe("u-1");
  });

  it("refuses an unowned source", () => {
    const ctx = buildContext({
      userId: "u-1",
      runId: "r-1",
      objective: OBJECTIVE,
      mode: "assisted",
      sourceIds: ["src-1"],
      intelligenceIds: [],
      opportunityIds: [],
      recommendationIds: [],
      constraints: { maxOutputs: 2, budget: 1000, allowedPlatforms: [], requireApproval: true },
      owned: { sources: { "src-1": false }, intelligence: {}, opportunities: {} }
    });
    expect(ctx).toBeInstanceOf(Error);
    expect(String(ctx)).toContain("PERMISSION_DENIED");
  });

  it("resolveContext runs the seam and refuses when not owned", async () => {
    const err = await resolveContext(
      { sourceOwnedByUser: async () => false },
      {
        userId: "u-1",
        runId: "r-1",
        objective: OBJECTIVE,
        mode: "assisted",
        sourceIds: ["src-1"],
        intelligenceIds: [],
        opportunityIds: [],
        recommendationIds: [],
        constraints: { maxOutputs: 2, budget: 1000, allowedPlatforms: [], requireApproval: true }
      }
    );
    expect(err).toBeInstanceOf(Error);
  });
});

// ── planner + approvals ─────────────────────────────────────────────────────

describe("planner + approvals", () => {
  it("builds generate + review steps per strong recommendation", () => {
    const plan = buildPlan({
      recommendations: [recommendation("linkedin_post", "Strong fit"), recommendation("newsletter", "Good fit")],
      objective: OBJECTIVE,
      sourceIds: SOURCE_IDS,
      maxOutputs: 2,
      approveGenerate: true,
      approvePublish: true
    }) as OrchestrationPlan;

    expect(plan.outputIds).toEqual(["linkedin_post", "newsletter"]);
    expect(plan.steps.filter((s) => s.type === "generate")).toHaveLength(2);
    expect(plan.steps.filter((s) => s.type === "review")).toHaveLength(2);
    expect(plan.approvalRequired).toBe(true);
    expect(plan.status).toBe("draft");
  });

  it("drops Not recommended outputs", () => {
    const plan = buildPlan({
      recommendations: [
        recommendation("linkedin_post", "Strong fit"),
        recommendation("shortform_script", "Not recommended")
      ],
      objective: OBJECTIVE,
      sourceIds: SOURCE_IDS,
      maxOutputs: 2,
      approveGenerate: false,
      approvePublish: false
    }) as OrchestrationPlan;
    expect(plan.outputIds).toEqual(["linkedin_post"]);
  });

  it("errors when nothing is recommended", () => {
    const plan = buildPlan({
      recommendations: [recommendation("shortform_script", "Not recommended")],
      objective: OBJECTIVE,
      sourceIds: SOURCE_IDS,
      maxOutputs: 2,
      approveGenerate: false,
      approvePublish: false
    });
    expect(plan).toBeInstanceOf(Error);
  });

  it("versioning invalidates an approval", () => {
    const plan = buildPlan({
      recommendations: [recommendation("linkedin_post", "Strong fit")],
      objective: OBJECTIVE,
      sourceIds: SOURCE_IDS,
      maxOutputs: 2,
      approveGenerate: true,
      approvePublish: false
    }) as OrchestrationPlan;

    expect(requiresApproval(plan)).toBe(true);
    const approval = decide("r-1", plan, "u-1", "approved");
    expect(isExecutable("r-1", plan, "u-1", approval)).toBe(true);

    // Editing the plan bumps the version → the old approval no longer applies.
    const v2 = newPlanVersion(plan);
    expect(v2.version).toBe(2);
    expect(isExecutable("r-1", v2, "u-1", approval)).toBe(false);
  });

  it("approval binds to run, user, plan id and version", () => {
    const plan = buildPlan({
      recommendations: [recommendation("linkedin_post", "Strong fit")],
      objective: OBJECTIVE,
      sourceIds: SOURCE_IDS,
      maxOutputs: 2,
      approveGenerate: true,
      approvePublish: false
    }) as OrchestrationPlan;

    const approval = decide("r-1", plan, "u-1", "approved");
    expect(isExecutable("r-2", plan, "u-1", approval)).toBe(false);
    expect(isExecutable("r-1", plan, "u-2", approval)).toBe(false);
  });
});

// ── executor tick ───────────────────────────────────────────────────────────

function makeState(stepStatus: StepStatus | Record<string, StepStatus> = {}) {
  const status = typeof stepStatus === "string" ? { [stepStatus]: stepStatus } : stepStatus;
  return { runId: "r-1", userId: "u-1", stepStatus: { ...status }, planApproved: false };
}

describe("executor tick", () => {
  it("returns the first ready step and respects dependencies", () => {
    const plan = buildPlan({
      recommendations: [recommendation("linkedin_post", "Strong fit"), recommendation("newsletter", "Good fit")],
      objective: OBJECTIVE,
      sourceIds: SOURCE_IDS,
      maxOutputs: 2,
      approveGenerate: false,
      approvePublish: false
    }) as OrchestrationPlan;

    expect(nextStep(plan, makeState() as never)).toBe("gen-linkedin_post");

    // A review step must wait for its generate step.
    const withGenDone = makeState({ "gen-linkedin_post": "done" });
    expect(nextStep(plan, withGenDone as never)).toBe("review-linkedin_post");
  });

  it("holds all steps when the plan requires approval and it's not granted", () => {
    const plan = buildPlan({
      recommendations: [recommendation("linkedin_post", "Strong fit")],
      objective: OBJECTIVE,
      sourceIds: SOURCE_IDS,
      maxOutputs: 2,
      approveGenerate: true,
      approvePublish: false
    }) as OrchestrationPlan;

    const denied = makeState();
    expect(nextStep(plan, denied as never)).toBeNull();

    const granted = { ...denied, planApproved: true };
    expect(nextStep(plan, granted as never)).toBe("gen-linkedin_post");
  });

  it("can mark steps done and report completion", () => {
    const plan = buildPlan({
      recommendations: [recommendation("linkedin_post", "Strong fit")],
      objective: OBJECTIVE,
      sourceIds: SOURCE_IDS,
      maxOutputs: 2,
      approveGenerate: false,
      approvePublish: false
    }) as OrchestrationPlan;

    let state = makeState();
    state = markStepRunning(plan, state, "gen-linkedin_post");
    expect(state.stepStatus["gen-linkedin_post"]).toBe("running");
    state = markStepDone(plan, state, "gen-linkedin_post");
    state = markStepDone(plan, state, "review-linkedin_post");
    expect(allStepsDone(plan, state)).toBe(true);
  });
});

// ── retry + idempotency ─────────────────────────────────────────────────────

describe("retry + idempotency", () => {
  it("retries transient errors within budget, then fails", () => {
    // attempt 1 failed, transient → retry
    const r1 = decideRetry(new Error("429 rate limit"), 1, undefined, () => 0.5);
    expect(r1.action).toBe("retry");

    // attempt 4 failed, transient, but budget (default 4) exhausted → fail
    const r4 = decideRetry(new Error("429 rate limit"), 5, undefined, () => 0.5);
    expect(r4.action).toBe("fail");
  });

  it("fails fast on permanent errors", () => {
    const r = decideRetry(new Error("missing table"), 1, undefined, () => 0.5);
    expect(r.action).toBe("fail");
  });

  it("backoff is bounded and deterministic", () => {
    const d1 = backoff(1, undefined, () => 0.5);
    const d5 = backoff(5, undefined, () => 0.5);
    expect(d1).toBeGreaterThan(0);
    expect(d5).toBeLessThanOrEqual(30_000);
    expect(d5).toBeGreaterThan(d1);
  });

  it("derives a stable idempotency key", () => {
    const k1 = stableKey({ userId: "u-1", runId: "r-1", objective: "grow_linkedin", sourceIds: ["a", "b"], outputId: "linkedin_post" });
    const k2 = stableKey({ userId: "u-1", runId: "r-1", objective: "grow_linkedin", sourceIds: ["b", "a"], outputId: "linkedin_post" });
    expect(k1).toBe(k2); // source order insensitive
    const k3 = stableKey({ userId: "u-1", runId: "r-1", objective: "grow_email", sourceIds: ["a", "b"], outputId: "linkedin_post" });
    expect(k1).not.toBe(k3);
  });
});

// ── policies ────────────────────────────────────────────────────────────────

describe("policies", () => {
  it("never lets any mode publish autonomously", () => {
    for (const m of ["manual", "assisted", "agent"] as const) {
      expect(mayActAutonomously(m, "consequential")).toBe(false);
    }
  });

  it("classifies publish as consequential and others correctly", () => {
    expect(riskForTool("publishLinkedIn")).toBe("consequential");
    expect(riskForTool("generatePost")).toBe("write");
    expect(riskForTool("readSource")).toBe("read");
  });

  it("gates generate approval in assisted mode, publish always", () => {
    expect(stepRequiresApproval("assisted", "generate")).toBe(true);
    expect(stepRequiresApproval("manual", "generate")).toBe(false);
    expect(stepRequiresApproval("assisted", "publish")).toBe(true);
  });
});

// ── errors + progress ───────────────────────────────────────────────────────

describe("errors + progress", () => {
  it("maps error codes to user-safe copy", () => {
    const err = orchestrationError("APPROVAL_REQUIRED");
    expect(err.userMessage.length).toBeGreaterThan(0);
    expect(JSON.stringify(err)).not.toContain("undefined");
    expect(userMessageFor("PUBLISH_FAILED")).toContain("Nothing was posted");
  });

  it("provides friendly status labels", () => {
    expect(statusLabel("awaiting_approval")).toBe("Needs your approval");
    expect(statusLabel("completed")).toBe("Done");
  });

  it("builds a run via createRun", () => {
    const ctx = ownedContext();
    const run = createRun({ id: "r-1", objective: OBJECTIVE, context: ctx as never });
    expect(run.mode).toBe("assisted");
    expect(run.execution.status).toBe("not_started");
    expect(run.timestamps.created).toBeTruthy();
  });
});

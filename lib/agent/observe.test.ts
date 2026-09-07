// P11: Tests for the observe funnel / summary — pure reductions of real server
// data with honest empty states.

import { describe, expect, it } from "vitest";
import {
  computeFunnel,
  buildObserveSummary,
  observeDollarEstimate,
  type RunFunnelRow
} from "@/lib/agent/observe";

function run(status: string, steps = 0, draftCount = 0, id = "r"): RunFunnelRow {
  return { runId: id, status, steps, stepsDone: steps, draftCount, approvedDraftCount: draftCount };
}

describe("computeFunnel", () => {
  it("counts runs, steps, drafts from real rows", () => {
    const f = computeFunnel(
      [
        run("done", 5, 3, "a"),
        run("done", 4, 2, "b"),
        run("awaiting_approval", 2, 0, "c")
      ],
      { a: 3, b: 1 }
    );
    expect(f.runs).toBe(3);
    expect(f.runsCompleted).toBe(2);
    expect(f.runsAwaitingApproval).toBe(1);
    expect(f.steps).toBe(11);
    expect(f.stepsDone).toBe(11);
    expect(f.drafts).toBe(5);
    // approvedDrafts caps per-run approved-idea count at the draft count.
    expect(f.approvedDrafts).toBe(4); // 3 + min(1,2)
    expect(f.atLeastOneDraft).toBe(2);
  });

  it("returns all zeros for no data (honest empty)", () => {
    const f = computeFunnel([], {});
    expect(f).toMatchObject({
      runs: 0,
      runsCompleted: 0,
      steps: 0,
      stepsDone: 0,
      drafts: 0,
      approvedDrafts: 0,
      atLeastOneDraft: 0
    });
  });
});

describe("buildObserveSummary", () => {
  it("flags engagement as unavailable (no channel) and never fabricates numbers", () => {
    const s = buildObserveSummary({
      runs: [run("done", 5, 3, "a")],
      approvalCounts: { a: 3 },
      monthlyRuns: [{ input_tokens: 1000, output_tokens: 500, cost_units: 0.15, status: "done" }],
      strategyDocs: 1,
      lastStrategyAt: "2026-09-01T00:00:00Z"
    });
    expect(s.publishingConnected).toBe(false);
    expect(s.engagementAvailable).toBe(false);
    expect(s.hasAnyData).toBe(true);
    expect(s.strategyDocs).toBe(1);
    expect(s.spend.runsThisMonth).toBe(1);
  });

  it("reports hasAnyData=false and unavailable engagement when empty", () => {
    const s = buildObserveSummary({
      runs: [],
      approvalCounts: {},
      monthlyRuns: [],
      strategyDocs: 0,
      lastStrategyAt: null
    });
    expect(s.hasAnyData).toBe(false);
    expect(s.engagementAvailable).toBe(false);
    expect(s.funnel.runs).toBe(0);
    expect(s.spend.runsThisMonth).toBe(0);
  });

  it("computes a dollar estimate from real token counts (never invented)", () => {
    const s = buildObserveSummary({
      runs: [],
      approvalCounts: {},
      monthlyRuns: [{ input_tokens: 1000, output_tokens: 500, cost_units: 0.15, status: "done" }],
      strategyDocs: 0,
      lastStrategyAt: null
    });
    expect(observeDollarEstimate(s.spend)).toBeCloseTo(0.225, 6); // gemini rates
  });
});

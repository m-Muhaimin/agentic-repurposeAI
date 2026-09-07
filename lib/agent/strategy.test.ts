import { describe, it, expect } from "vitest";
import { buildCandidates, computeBudgetHeadroom } from "@/lib/agent/strategy";
import type { StrategyInput, StrategySource, StrategyIdea } from "@/lib/agent/strategy";
import type { EditSignal } from "@/types/agent";

function src(id: string, hasTranscript: boolean): StrategySource {
  return { id, title: `Source ${id}`, hasTranscript };
}

function idea(sourceId: string, title: string, score: number | null, formats = ["linkedin_post", "newsletter"]): StrategyIdea {
  return {
    sourceId,
    runId: `run-${sourceId}`,
    title,
    suggestedFormats: formats as StrategyIdea["suggestedFormats"],
    score,
    evaluation: score == null ? null : { score, grounding: 0.8, distinctness: 0.7, specificity: 0.6, flags: [], weakness: null, notes: [] }
  };
}

function input(overrides: Partial<StrategyInput> = {}): StrategyInput {
  return {
    sources: [src("s1", true)],
    ideas: [],
    signals: [],
    recentFormats: [],
    budget: { jobsLimit: 5, jobsUsed: 0, agent: { maxSteps: 50, maxCostUnits: 2500, maxRuntimeSeconds: 1800 } },
    ...overrides
  };
}

describe("computeBudgetHeadroom", () => {
  it("computes remaining jobs and atLimit", () => {
    const h = computeBudgetHeadroom({ jobsLimit: 5, jobsUsed: 2, agent: { maxSteps: 1, maxCostUnits: 1, maxRuntimeSeconds: 1 } });
    expect(h.jobsRemaining).toBe(3);
    expect(h.atLimit).toBe(false);
  });

  it("flags atLimit when jobs are exhausted", () => {
    const h = computeBudgetHeadroom({ jobsLimit: 5, jobsUsed: 5, agent: { maxSteps: 1, maxCostUnits: 1, maxRuntimeSeconds: 1 } });
    expect(h.atLimit).toBe(true);
    expect(h.jobsRemaining).toBe(0);
  });

  it("treats a null limit as unlimited (no ceiling)", () => {
    const h = computeBudgetHeadroom({ jobsLimit: null, jobsUsed: 99, agent: { maxSteps: 1, maxCostUnits: 1, maxRuntimeSeconds: 1 } });
    expect(h.jobsRemaining).toBeNull();
    expect(h.atLimit).toBe(false);
  });
});

describe("buildCandidates — the V1→V2 gate (no source preselected)", () => {
  it("derives a recommendation from the user's own data with no preselected source", () => {
    const result = buildCandidates(
      input({
        sources: [src("a", true), src("b", true), src("c", false)],
        ideas: [idea("a", "Angle A", 0.9), idea("b", "Angle B", 0.6)],
        recentFormats: ["linkedin_post"]
      })
    );
    // Both ready sources are candidates, ranked; c excluded for no transcript.
    expect(result.ranked.map((c) => c.sourceId)).toEqual(["a", "b"]);
    expect(result.recommended?.sourceId).toBe("a");
    expect(Number(result.recommended?.score)).toBeGreaterThan(Number(result.ranked[1].score));
    expect(result.exclusions.some((e) => e.sourceId === "c" && e.code === "NO_READY_TRANSCRIPT")).toBe(true);
  });

  it("excludes every source when the monthly budget is exhausted", () => {
    const result = buildCandidates(
      input({
        sources: [src("a", true), src("b", true)],
        budget: { jobsLimit: 1, jobsUsed: 1, agent: { maxSteps: 50, maxCostUnits: 2500, maxRuntimeSeconds: 1800 } }
      })
    );
    expect(result.recommended).toBeNull();
    expect(result.ranked).toHaveLength(0);
    expect(result.exclusions.filter((e) => e.code === "BUDGET_CEILING").length).toBe(2);
  });

  it("ranks a fresh source (no ideas) neutrally and below a scored one", () => {
    const result = buildCandidates(input({ sources: [src("a", true), src("b", true)], ideas: [idea("b", "B", 0.8)] }));
    expect(result.ranked[0].sourceId).toBe("b");
    expect(result.ranked[1].angleTitle).toBeNull();
  });

  it("demotes a source whose angles the user rejected", () => {
    const sign: EditSignal = { kind: "angle_decision", outputId: "Angle B", whatChanged: "rejected", at: "2026-09-07T00:00:00Z" };
    const result = buildCandidates(
      input({
        sources: [src("a", true), src("b", true)],
        ideas: [idea("a", "Angle A", 0.6), idea("b", "Angle B", 0.85)],
        signals: [sign],
        recentFormats: []
      })
    );
    // B scored higher but was explicitly rejected → A wins the recommendation.
    expect(result.recommended?.sourceId).toBe("a");
  });

  it("prefers an under-produced format over an over-produced one at equal idea quality", () => {
    const result = buildCandidates(
      input({
        sources: [src("a", true), src("b", true)],
        ideas: [idea("a", "A", 0.8, ["linkedin_post"]), idea("b", "B", 0.8, ["newsletter"])],
        recentFormats: ["linkedin_post"]
      })
    );
    expect(result.ranked[0].sourceId).toBe("b");
  });

  it("returns no recommendation when there are no ready sources", () => {
    const result = buildCandidates(input({ sources: [src("a", false), src("b", false)] }));
    expect(result.recommended).toBeNull();
    expect(result.exclusions.every((e) => e.code === "NO_READY_TRANSCRIPT")).toBe(true);
  });
});

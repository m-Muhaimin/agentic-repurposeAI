// Unit tests for the plan-presentation helpers — pure formatters.

import { describe, expect, it } from "vitest";
import { budgetSummaryLine, formatIdeaCount, opportunityTag } from "@/lib/agent/plan-presentation";

describe("opportunityTag", () => {
  it("labels high-scoring angles as high opportunity", () => {
    expect(opportunityTag(0.9)).toEqual({ label: "High opportunity", tone: "high" });
    expect(opportunityTag(0.8).label).toBe("High opportunity");
  });

  it("labels mid scores as strong opportunity", () => {
    expect(opportunityTag(0.67)).toEqual({ label: "Strong opportunity", tone: "strong" });
  });

  it("labels lower scores as consider", () => {
    expect(opportunityTag(0.3)).toEqual({ label: "Consider", tone: "consider" });
  });

  it("falls back to a neutral tag when there is no score yet", () => {
    expect(opportunityTag(null)).toEqual({ label: "Fresh angle", tone: "consider" });
    expect(opportunityTag(undefined)).toEqual({ label: "Fresh angle", tone: "consider" });
  });
});

describe("formatIdeaCount", () => {
  it("pluralizes correctly", () => {
    expect(formatIdeaCount(1)).toBe("1 angle");
    expect(formatIdeaCount(4)).toBe("4 angles");
  });

  it("handles none gracefully", () => {
    expect(formatIdeaCount(0)).toBe("No angles yet");
    expect(formatIdeaCount(-1)).toBe("No angles yet");
  });
});

describe("budgetSummaryLine", () => {
  it("reports percent-of-allowance when the plan limit is known", () => {
    expect(budgetSummaryLine({ costUsd: 1.25, maxCostUnits: 2500 })).toBe(
      "Used about 0.05% of its allowance this run"
    );
  });

  it("falls back to raw credits without a plan limit", () => {
    expect(budgetSummaryLine({ costUsd: 0.5, maxCostUnits: null })).toBe("Estimated 0.5000 credits");
  });

  it("reports no spend when nothing was recorded", () => {
    expect(budgetSummaryLine({ costUsd: 0, maxCostUnits: null })).toBe("No spend recorded yet");
    expect(budgetSummaryLine({ costUsd: 0, maxCostUnits: 2500 })).toBe("No spend recorded yet");
  });
});
import { describe, it, expect } from "vitest";
import { formatScore, formatHeadroom, formatExclusionCode } from "@/lib/agent/strategy-panel-helpers";
import type { BudgetHeadroom } from "@/lib/agent/strategy-panel-helpers";

// Tests for the pure formatters exported from the strategy panel component.
// These verify the formatting logic is correct without any DOM or fetch.

function headroom(overrides: Partial<BudgetHeadroom> = {}): BudgetHeadroom {
  return {
    jobsLimit: 5,
    jobsUsed: 2,
    jobsRemaining: 3,
    atLimit: false,
    perRunAgent: { maxSteps: 50, maxCostUnits: 2500, maxRuntimeSeconds: 1800 },
    ...overrides
  };
}

describe("formatScore", () => {
  it("rounds to whole percent", () => {
    expect(formatScore(0.734)).toBe("73%");
  });

  it("handles 0 and 1", () => {
    expect(formatScore(0)).toBe("0%");
    expect(formatScore(1)).toBe("100%");
  });

  it("rounds 0.5 exactly to 50%", () => {
    expect(formatScore(0.5)).toBe("50%");
  });
});

describe("formatHeadroom", () => {
  it("shows remaining jobs with limit", () => {
    const h = headroom({ jobsLimit: 5, jobsUsed: 2, jobsRemaining: 3 });
    expect(formatHeadroom(h)).toBe("3 jobs left this month of 5 · 50 steps per run");
  });

  it("shows singular for 1 remaining", () => {
    const h = headroom({ jobsLimit: 5, jobsUsed: 4, jobsRemaining: 1 });
    expect(formatHeadroom(h)).toBe("1 job left this month of 5 · 50 steps per run");
  });

  it("shows no cap when limit is null", () => {
    const h = headroom({ jobsLimit: null, jobsRemaining: null });
    expect(formatHeadroom(h)).toBe("No monthly cap · 50 steps per run");
  });

  it("shows 0 remaining when exhausted", () => {
    const h = headroom({ jobsLimit: 5, jobsUsed: 5, jobsRemaining: 0, atLimit: true });
    expect(formatHeadroom(h)).toBe("0 jobs left this month of 5 · 50 steps per run");
  });
});

describe("formatExclusionCode", () => {
  it("formats NO_READY_TRANSCRIPT", () => {
    expect(formatExclusionCode("NO_READY_TRANSCRIPT")).toBe("No transcript");
  });

  it("formats BUDGET_CEILING", () => {
    expect(formatExclusionCode("BUDGET_CEILING")).toBe("Budget exhausted");
  });

  it("falls back to raw code for unknown", () => {
    expect(formatExclusionCode("SOMETHING_ELSE")).toBe("SOMETHING_ELSE");
  });
});

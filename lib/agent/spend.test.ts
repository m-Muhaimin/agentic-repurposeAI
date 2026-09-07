// P9: Unit tests for the agent spend computation — pure functions, no I/O.
// Tests cover token-to-cost conversion, aggregation, labeling, and the
// deterministic relationship between token counts and cost units.

import { describe, expect, it } from "vitest";
import {
  tokenCost,
  tokensToCostUnits,
  buildSpendEvent,
  stepSpendFromOutput,
  aggregateRunSpend,
  aggregateMonthlySpend,
  spendSourceLabel,
  formatCostUsd,
  formatCostUnits
} from "@/lib/agent/spend";
import type { StepSpend } from "@/lib/agent/spend";

describe("tokenCost", () => {
  it("computes Gemini cost from real token counts (published rates)", () => {
    // Gemini: $0.075/1k input, $0.30/1k output
    // 1000 input + 500 output = $0.075 + $0.15 = $0.225
    const cost = tokenCost({ inputTokens: 1000, outputTokens: 500 }, "gemini");
    expect(cost).toBeCloseTo(0.225, 6);
  });

  it("computes OpenRouter cost from real token counts", () => {
    // OpenRouter: $0.10/1k input, $0.10/1k output
    // 2000 input + 1000 output = $0.20 + $0.10 = $0.30
    const cost = tokenCost({ inputTokens: 2000, outputTokens: 1000 }, "openrouter");
    expect(cost).toBeCloseTo(0.30, 6);
  });

  it("returns 0 for zero tokens", () => {
    expect(tokenCost({ inputTokens: 0, outputTokens: 0 }, "gemini")).toBe(0);
  });

  it("handles very small token counts", () => {
    const cost = tokenCost({ inputTokens: 1, outputTokens: 1 }, "gemini");
    // (1/1000)*0.075 + (1/1000)*0.30 = 0.000375
    expect(cost).toBeCloseTo(0.000375, 6);
  });

  it("handles large token counts without overflow", () => {
    const cost = tokenCost({ inputTokens: 1_000_000, outputTokens: 500_000 }, "gemini");
    // $75 + $150 = $225
    expect(cost).toBeCloseTo(225, 2);
  });
});

describe("tokensToCostUnits", () => {
  it("preserves the existing formula exactly", () => {
    // cost_units = (inputTokens + outputTokens) / 100 / 100
    // 1000 input + 500 output = 1500 / 100 / 100 = 0.15
    expect(tokensToCostUnits(1000, 500)).toBe(0.15);
  });

  it("returns 0 for zero tokens", () => {
    expect(tokensToCostUnits(0, 0)).toBe(0);
  });

  it("rounds to 2dp", () => {
    // 333 + 667 = 1000 → 1000/100 = 10 → 10/100 = 0.10
    expect(tokensToCostUnits(333, 667)).toBe(0.10);
  });

  it("handles large token counts", () => {
    // 100000 + 50000 = 150000 → 150000/100 = 1500 → 1500/100 = 15.0
    expect(tokensToCostUnits(100_000, 50_000)).toBe(15.0);
  });
});

describe("buildSpendEvent", () => {
  it("creates a spend event from real token counts", () => {
    const event = buildSpendEvent({ inputTokens: 1000, outputTokens: 500 }, "gemini");
    expect(event).toEqual({
      provider: "gemini",
      inputTokens: 1000,
      outputTokens: 500,
      costUnits: 0.15,
      source: "actual"
    });
  });

  it("defaults source to 'actual'", () => {
    const event = buildSpendEvent({ inputTokens: 100, outputTokens: 100 }, "gemini");
    expect(event.source).toBe("actual");
  });

  it("accepts estimated source", () => {
    const event = buildSpendEvent({ inputTokens: 100, outputTokens: 100 }, "gemini", "estimated");
    expect(event.source).toBe("estimated");
  });
});

describe("stepSpendFromOutput", () => {
  it("extracts spend data from step output", () => {
    const output = {
      outputId: "abc",
      spend: { provider: "gemini", inputTokens: 500, outputTokens: 200, costUnits: 0.07, source: "actual" }
    };
    const result = stepSpendFromOutput("step-1", "generation", "Generate LinkedIn post", output);
    expect(result).toEqual({
      stepId: "step-1",
      kind: "generation",
      label: "Generate LinkedIn post",
      inputTokens: 500,
      outputTokens: 200,
      costUnits: 0.07,
      source: "actual"
    });
  });

  it("returns null when no spend data", () => {
    expect(stepSpendFromOutput("s", "planning", "Plan", { outputId: "abc" })).toBeNull();
  });

  it("returns null when output is null", () => {
    expect(stepSpendFromOutput("s", "planning", "Plan", null)).toBeNull();
  });

  it("returns null when output is not an object", () => {
    expect(stepSpendFromOutput("s", "planning", "Plan", "string")).toBeNull();
  });

  it("computes costUnits from tokens when not in spend", () => {
    const output = {
      spend: { provider: "gemini", inputTokens: 1000, outputTokens: 500, source: "actual" }
    };
    const result = stepSpendFromOutput("s", "planning", "Plan", output);
    expect(result?.costUnits).toBe(0.15); // tokensToCostUnits(1000, 500)
  });
});

describe("aggregateRunSpend", () => {
  it("computes full aggregation with actual tokens", () => {
    const steps: StepSpend[] = [
      { stepId: "s1", kind: "planning", label: "Plan", inputTokens: 500, outputTokens: 200, costUnits: 0.07, source: "actual" },
      { stepId: "s2", kind: "generation", label: "Generate", inputTokens: 1000, outputTokens: 400, costUnits: 0.14, source: "actual" }
    ];
    const summary = aggregateRunSpend(1500, 600, 0.21, 2500, steps);
    expect(summary.totalInputTokens).toBe(1500);
    expect(summary.totalOutputTokens).toBe(600);
    expect(summary.totalCostUnits).toBe(0.21);
    expect(summary.hasActualTokens).toBe(true);
    expect(summary.steps).toHaveLength(2);
    expect(summary.budgetPercentUsed).toBe(0); // 0.21/2500 < 1%
    expect(summary.estimatedCostUsd).toBeGreaterThan(0);
  });

  it("returns hasActualTokens=false when no tokens", () => {
    const summary = aggregateRunSpend(0, 0, 0, 2500, []);
    expect(summary.hasActualTokens).toBe(false);
    expect(summary.estimatedCostUsd).toBe(0);
  });

  it("computes budgetPercentUsed correctly", () => {
    const summary = aggregateRunSpend(0, 0, 1250, 2500, []);
    expect(summary.budgetPercentUsed).toBe(50);
  });

  it("caps budgetPercentUsed at 100", () => {
    const summary = aggregateRunSpend(0, 0, 3000, 2500, []);
    expect(summary.budgetPercentUsed).toBe(100);
  });
});

describe("aggregateMonthlySpend", () => {
  it("aggregates across multiple runs", () => {
    const runs = [
      { input_tokens: 500, output_tokens: 200, cost_units: 0.07, status: "done" },
      { input_tokens: 800, output_tokens: 300, cost_units: 0.11, status: "done" },
      { input_tokens: 400, output_tokens: 100, cost_units: 0.05, status: "cancelled" }
    ];
    const spend = aggregateMonthlySpend(runs);
    expect(spend.runsThisMonth).toBe(3);
    expect(spend.completedRuns).toBe(2);
    expect(spend.totalInputTokens).toBe(1700);
    expect(spend.totalOutputTokens).toBe(600);
    expect(spend.totalCostUnits).toBeCloseTo(0.23, 2);
    expect(spend.estimatedCostUsd).toBeGreaterThan(0);
  });

  it("returns zeros for empty runs", () => {
    const spend = aggregateMonthlySpend([]);
    expect(spend.runsThisMonth).toBe(0);
    expect(spend.totalInputTokens).toBe(0);
    expect(spend.estimatedCostUsd).toBe(0);
  });

  it("handles runs with null token counts gracefully", () => {
    const runs = [
      { input_tokens: null as unknown as number, output_tokens: null as unknown as number, cost_units: 0.05, status: "done" }
    ];
    const spend = aggregateMonthlySpend(runs);
    expect(spend.totalInputTokens).toBe(0);
    expect(spend.runsThisMonth).toBe(1);
  });
});

describe("spendSourceLabel", () => {
  it("returns 'actual' for actual source", () => {
    expect(spendSourceLabel("actual")).toBe("actual");
  });

  it("returns 'estimated' for estimated source", () => {
    expect(spendSourceLabel("estimated")).toBe("estimated");
  });
});

describe("formatCostUsd", () => {
  it("formats $0.00", () => {
    expect(formatCostUsd(0)).toBe("$0.00");
  });

  it("formats amounts below $0.01", () => {
    expect(formatCostUsd(0.005)).toBe("<$0.01");
  });

  it("formats normal amounts", () => {
    expect(formatCostUsd(0.42)).toBe("$0.42");
    expect(formatCostUsd(12.5)).toBe("$12.50");
  });

  it("formats large amounts", () => {
    expect(formatCostUsd(1234.56)).toBe("$1234.56");
  });
});

describe("formatCostUnits", () => {
  it("formats 0", () => {
    expect(formatCostUnits(0)).toBe("0");
  });

  it("formats small values with 2dp", () => {
    expect(formatCostUnits(0.15)).toBe("0.15");
    expect(formatCostUnits(0.07)).toBe("0.07");
  });

  it("formats medium values with 1dp", () => {
    expect(formatCostUnits(12.5)).toBe("12.5");
    expect(formatCostUnits(99.9)).toBe("99.9");
  });

  it("formats large values as integers", () => {
    expect(formatCostUnits(150)).toBe("150");
    expect(formatCostUnits(2500)).toBe("2500");
  });
});

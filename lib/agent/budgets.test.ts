// Unit tests for the P2 budget guards — the orchestrator's enforcement logic
// in isolation. These prove a run can never blow past its plan-snapshotted
// ceilings regardless of idea count, format count or retries.

import { describe, expect, it } from "vitest";
import { budgetViolation, stepsRemaining } from "@/lib/agent/budgets";

const budget = { maxSteps: 10, maxCostUnits: 100, maxRuntimeSeconds: 60 };

const base = { steps: 0, costUnits: 0, startedAtMs: 1_000_000 };

describe("budgetViolation", () => {
  it("returns null while every budget is in bounds", () => {
    expect(
      budgetViolation(budget, { ...base, steps: 5, costUnits: 50, startedAtMs: 1_000_000 }, 1_000_010)
    ).toBeNull();
  });

  it("trips on steps BEFORE the next in-flight step (no loop can exceed maxSteps)", () => {
    // 9 done; the worker is about to do one more → 10 total hits the ceiling.
    expect(budgetViolation(budget, { ...base, steps: 9 }, 1_000_010, { steps: 1, costUnits: 0 })).toBe(
      "steps"
    );
    // Even with zero in flight, 10 done trips.
    expect(budgetViolation(budget, { ...base, steps: 10 }, 1_000_010)).toBe("steps");
  });

  it("trips on cost before the next expensive call", () => {
    expect(
      budgetViolation(budget, { ...base, steps: 0, costUnits: 95 }, 1_000_010, { steps: 0, costUnits: 10 })
    ).toBe("cost");
    expect(budgetViolation(budget, { ...base, steps: 0, costUnits: 100 }, 1_000_010)).toBe("cost");
  });

  it("trips on runtime when started_at is set and the window lapses", () => {
    const startedAtMs = 1_000_000;
    expect(budgetViolation(budget, { ...base, steps: 0, costUnits: 0, startedAtMs }, startedAtMs + 59_000)).toBeNull();
    expect(budgetViolation(budget, { ...base, steps: 0, costUnits: 0, startedAtMs }, startedAtMs + 60_000)).toBe(
      "runtime"
    );
    expect(budgetViolation(budget, { ...base, steps: 0, costUnits: 0, startedAtMs }, startedAtMs + 120_000)).toBe(
      "runtime"
    );
  });

  it("does not trip on runtime when started_at is unknown", () => {
    expect(
      budgetViolation(budget, { ...base, startedAtMs: null }, 99_999_999)
    ).toBeNull();
  });

  it("prefers steps/cost over runtime when several are hit together (deterministic)", () => {
    const counters = {
      steps: budget.maxSteps,
      costUnits: budget.maxCostUnits,
      startedAtMs: 0
    };
    expect(budgetViolation(budget, counters, 999_999_999)).toBe("steps");
  });
});

describe("stepsRemaining", () => {
  it("reports the true headroom for the next step", () => {
    expect(stepsRemaining(budget, { ...base, steps: 3 })).toBe(7);
    expect(stepsRemaining(budget, { ...base, steps: 12 })).toBe(0);
  });
});
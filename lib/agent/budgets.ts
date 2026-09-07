// P2 budget guards for agent runs — pure functions, no I/O, so the orchestrator's
// enforcement is unit-testable without Supabase. The limits themselves are
// snapshotted columns on the v4_agent_runs row (from the user's plan at
// creation); these helpers turn current counters into a stop decision.

import type { StopReason } from "@/types/agent";

export interface BudgetSnapshot {
  maxSteps: number;
  maxCostUnits: number;
  maxRuntimeSeconds: number;
}

export interface BudgetCounters {
  // Durable step rows recorded for this run so far (across claims/resumes).
  steps: number;
  // Accumulated cost units (run.cost_units + in-progress estimate).
  costUnits: number;
  // Runtime field base: the run's current execution started_at, ms epoch.
  startedAtMs: number | null;
}

// Returns the limiting reason, or null when all budgets are still in bounds.
// `inFlight` (steps/cost this worker is about to perform) is included so a
// guard trips BEFORE the next expensive step, not after it.
export function budgetViolation(
  budget: BudgetSnapshot,
  counters: BudgetCounters,
  nowMs: number,
  inFlight: { steps: number; costUnits: number } = { steps: 0, costUnits: 0 }
): StopReason {
  if (counters.steps + inFlight.steps >= budget.maxSteps) return "steps";
  if (counters.costUnits + inFlight.costUnits >= budget.maxCostUnits) return "cost";
  if (
    counters.startedAtMs != null &&
    nowMs - counters.startedAtMs >= budget.maxRuntimeSeconds * 1000
  ) {
    return "runtime";
  }
  return null;
}

export function stepsRemaining(budget: BudgetSnapshot, counters: BudgetCounters): number {
  return Math.max(0, budget.maxSteps - counters.steps);
}
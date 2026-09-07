// Presentation helpers for the plan approval surface (P0): opportunity tags
// come from the real per-idea evaluation score recorded at planning time, so
// the "why" a user should invest in an angle is score-driven, not invented.

export type OpportunityTone = "high" | "strong" | "consider";

export interface OpportunityTag {
  label: string;
  tone: OpportunityTone;
}

export function opportunityTag(score: number | null | undefined): OpportunityTag {
  if (score == null) {
    return { label: "Fresh angle", tone: "consider" };
  }
  if (score >= 0.8) return { label: "High opportunity", tone: "high" };
  if (score >= 0.6) return { label: "Strong opportunity", tone: "strong" };
  return { label: "Consider", tone: "consider" };
}

export function formatIdeaCount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "No angles yet";
  return n === 1 ? "1 angle" : `${n} angles`;
}

// Budget wording used on the collapsed run line — honest per-run framing that
// falls back gracefully when plan limits aren't resolvable yet.
export function budgetSummaryLine(opts: {
  costUsd: number;
  maxCostUnits: number | null;
}): string {
  if (opts.maxCostUnits == null) {
    return opts.costUsd > 0 ? `Estimated ${opts.costUsd.toFixed(4)} credits` : "No spend recorded yet";
  }
  return opts.costUsd > 0
    ? `Used about ${(opts.costUsd / opts.maxCostUnits) * 100}% of its allowance this run`
    : "No spend recorded yet";
}
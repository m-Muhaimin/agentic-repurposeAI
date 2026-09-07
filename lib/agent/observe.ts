// P11: Observe / insights — pure funnel + spend aggregation from REAL server
// data, with honest EMPTY states. No fabricated analytics. This module only
// reduces rows the server already owns (v4_agent_runs, v4_agent_steps,
// v4_content_ideas, v4_content_strategies); it never invents engagement or
// performance numbers. Those categories are represented by an explicit
// `available: false` flag the UI renders as "No data yet — connect a channel".

import { aggregateMonthlySpend, tokenCost, type MonthlyAgentSpend } from "@/lib/agent/spend";

// A single run's contribution to the funnel.
export interface RunFunnelRow {
  runId: string;
  status: string;
  steps: number;
  stepsDone: number; // durable steps recorded as `done` for this run
  draftCount: number;
  approvedDraftCount: number;
}

// Aggregate funnel counts across the user's runs, computed from actual rows.
export interface FunnelCounts {
  runs: number;
  runsCompleted: number;
  runsAwaitingApproval: number;
  steps: number;
  stepsDone: number;
  drafts: number; // outputs produced by agent runs
  approvedDrafts: number; // drafts that an approved angle produced (best signal available)
  atLeastOneDraft: number; // runs that produced >=1 draft
}

// Compute the funnel from a list of runs (each with its own step/draft counts).
// `approvalCounts` maps runId → number of approved ideas, so the
// "drafts from approved ideas" signal is honest: it counts the run's approved
// ideas, not fabricated clicks.
export function computeFunnel(runs: RunFunnelRow[], approvalCounts: Record<string, number>): FunnelCounts {
  let runsCompleted = 0;
  let runsAwaitingApproval = 0;
  let steps = 0;
  let stepsDone = 0;
  let drafts = 0;
  let approvedDrafts = 0;
  let atLeastOneDraft = 0;

  for (const r of runs) {
    if (r.status === "done") runsCompleted += 1;
    if (r.status === "awaiting_approval") runsAwaitingApproval += 1;
    steps += r.steps;
    stepsDone += r.stepsDone;
    drafts += r.draftCount;
    const approved = approvalCounts[r.runId] ?? 0;
    approvedDrafts += Math.min(approved, r.draftCount);
    if (r.draftCount > 0) atLeastOneDraft += 1;
  }

  return {
    runs: runs.length,
    runsCompleted,
    runsAwaitingApproval,
    steps,
    stepsDone,
    drafts,
    approvedDrafts,
    atLeastOneDraft
  };
}

// The final Observe summary handed to the UI. Engagement/performance are ALWAYS
// present as bools, never fake numbers; the UI renders those as empty states.
export interface ObserveSummary {
  funnel: FunnelCounts;
  spend: MonthlyAgentSpend;
  strategyDocs: number;
  lastStrategyAt: string | null;
  // Honest capability flags — no publishing channel, so no analytics exist yet.
  publishingConnected: boolean;
  engagementAvailable: boolean;
  // True when there is literally nothing to show (used for the master empty state).
  hasAnyData: boolean;
}

interface ObserveInput {
  runs: RunFunnelRow[];
  approvalCounts: Record<string, number>;
  monthlyRuns: Array<{
    input_tokens: number;
    output_tokens: number;
    cost_units: number;
    status: string;
  }>;
  strategyDocs: number;
  lastStrategyAt: string | null;
}

export function buildObserveSummary(input: ObserveInput): ObserveSummary {
  const funnel = computeFunnel(input.runs, input.approvalCounts);
  const spend = aggregateMonthlySpend(input.monthlyRuns);

  // Engagement/performance analytics require a connected publishing channel,
  // which this build deliberately does not have. Always false, never fabricated.
  const publishingConnected = false;

  const hasAnyData =
    funnel.runs > 0 ||
    funnel.steps > 0 ||
    funnel.drafts > 0 ||
    spend.runsThisMonth > 0 ||
    (input.strategyDocs ?? 0) > 0;

  return {
    funnel,
    spend,
    strategyDocs: input.strategyDocs ?? 0,
    lastStrategyAt: input.lastStrategyAt ?? null,
    publishingConnected,
    engagementAvailable: publishingConnected,
    hasAnyData
  };
}

// Re-export the dollar estimate so the observe route/UI don't reimplement it.
export function observeDollarEstimate(spend: MonthlyAgentSpend): number {
  return tokenCost(
    { inputTokens: spend.totalInputTokens, outputTokens: spend.totalOutputTokens },
    "gemini"
  );
}

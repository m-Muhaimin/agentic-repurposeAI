import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { retentionWindow, capAt, RETENTION_DEFAULTS } from "@/lib/agent/retention";
import { buildObserveSummary, observeDollarEstimate } from "@/lib/agent/observe";
import { formatCostUsd } from "@/lib/agent/spend";
import { log } from "@/lib/logger";

// GET /api/agent/observe — the P11 read-mostly insights surface.
//
// COMPUTED FROM REAL SERVER DATA ONLY:
//   - run funnel counts (runs → steps → drafts → approved) from
//     v4_agent_runs / v4_agent_steps / v4_content_ideas;
//   - monthly spend from v4_agent_runs tokens/cost (P9 aggregate);
//   - strategy document count/time from v4_content_strategies.
// Engagement / performance analytics are ALWAYS flagged unavailable here (no
// publishing channel is connected in this build), and the UI renders those as
// honest "No data yet — connect a channel" empty states, never fabricated
// numbers. The response is bounded by the P12 retention window.

export async function GET() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const service = createServiceClient();
  const now = new Date();
  const window = retentionWindow({ now });

  const [runsResult, stepsResult, ideasResult, strategiesResult, monthResult] = await Promise.all([
    service
      .from("v4_agent_runs")
      .select("id, status, step_count, output_ids, created_at")
      .eq("user_id", user.id)
      .gte("created_at", window.from)
      .order("created_at", { ascending: false })
      .limit(capAt(RETENTION_DEFAULTS.MAX_RUNS, RETENTION_DEFAULTS.MAX_RUNS)),
    service
      .from("v4_agent_steps")
      .select("id, run_id, status, created_at")
      .eq("user_id", user.id)
      .gte("created_at", window.from)
      .limit(capAt(RETENTION_DEFAULTS.MAX_RUNS * RETENTION_DEFAULTS.MAX_STEPS_PER_RUN, 1000)),
    service
      .from("v4_content_ideas")
      .select("run_id, approved, created_at")
      .eq("user_id", user.id)
      .gte("created_at", window.from)
      .limit(capAt(RETENTION_DEFAULTS.MAX_RUNS * 7, 1000)),
    service
      .from("v4_content_strategies")
      .select("id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    service
      .from("v4_agent_runs")
      .select("input_tokens, output_tokens, cost_units, status, created_at")
      .eq("user_id", user.id)
      .gte("created_at", new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString())
  ]);

  const runs = runsResult.data ?? [];
  const steps = stepsResult.data ?? [];
  const ideas = ideasResult.data ?? [];
  const strategies = strategiesResult.data ?? [];
  const monthRuns = monthResult.data ?? [];

  // Funnel reduction (real data). drafts = outputs the runs produced (from
  // output_ids); approvedDrafts is the honest "drafts from approved ideas" proxy.
  const draftsByRun: Record<string, number> = {};
  const stepsDoneByRun: Record<string, number> = {};
  for (const r of runs as Array<{ id: string; output_ids: string[] | null }>) {
    draftsByRun[r.id] = (r.output_ids ?? []).length;
    stepsDoneByRun[r.id] = 0;
  }
  for (const s of steps as Array<{ run_id: string; status: string }>) {
    if (s.status === "done" && s.run_id in stepsDoneByRun) {
      stepsDoneByRun[s.run_id] += 1;
    }
  }

  const approvalCounts: Record<string, number> = {};
  for (const i of ideas as Array<{ run_id: string; approved: boolean | null }>) {
    if (i.approved) approvalCounts[i.run_id] = (approvalCounts[i.run_id] ?? 0) + 1;
  }

  const funnelRows = (runs as Array<{ id: string; status: string; step_count: number | null; output_ids: string[] | null }>).map((r) => ({
    runId: r.id,
    status: r.status,
    steps: r.step_count ?? 0,
    stepsDone: stepsDoneByRun[r.id] ?? 0,
    draftCount: draftsByRun[r.id] ?? 0,
    approvedDraftCount: 0
  }));

  const summary = buildObserveSummary({
    runs: funnelRows,
    approvalCounts,
    monthlyRuns: monthRuns as Array<{ input_tokens: number; output_tokens: number; cost_units: number; status: string }>,
    strategyDocs: strategies.length,
    lastStrategyAt: (strategies[0] as { created_at?: string } | undefined)?.created_at ?? null
  });

  log.info("agent.observe_fetched", {
    user_id: user.id,
    runs: summary.funnel.runs,
    steps: summary.funnel.steps,
    drafts: summary.funnel.drafts,
    strategies: summary.strategyDocs
  });

  return NextResponse.json({
    ok: true,
    funnel: summary.funnel,
    spend: summary.spend,
    estimatedCostUsd: summary.spend.runsThisMonth > 0 ? formatCostUsd(observeDollarEstimate(summary.spend)) : null,
    strategyDocs: summary.strategyDocs,
    lastStrategyAt: summary.lastStrategyAt,
    publishingConnected: summary.publishingConnected,
    engagementAvailable: summary.engagementAvailable,
    hasAnyData: summary.hasAnyData,
    historyWindowMs: RETENTION_DEFAULTS.RUN_HISTORY_MS,
    note: "Insights are computed from your real run/step/spend data, bounded to a recent window. Underlying history is fully retained. Engagement and performance analytics are not available until a publishing channel is connected."
  });
}
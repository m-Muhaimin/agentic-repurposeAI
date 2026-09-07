"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/card";
import EmptyState from "@/components/empty-state";

// Observe / insights surface (P11). READ-MOSTLY, REAL DATA ONLY. Shows run
// funnel counts, honest monthly spend, and strategy history computed from
// server rows (v4_agent_runs / steps / ideas / strategies). Engagement and
// performance analytics are ALWAYS rendered as honest empty states with a
// clear "connect a publishing channel" note — never fabricated numbers.

interface FunnelCounts {
  runs: number;
  runsCompleted: number;
  runsAwaitingApproval: number;
  steps: number;
  stepsDone: number;
  drafts: number;
  approvedDrafts: number;
  atLeastOneDraft: number;
}

interface MonthlySpend {
  runsThisMonth: number;
  completedRuns: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUnits: number;
  estimatedCostUsd: number;
}

interface ObserveData {
  ok: boolean;
  funnel: FunnelCounts;
  spend: MonthlySpend;
  estimatedCostUsd: string | null;
  strategyDocs: number;
  lastStrategyAt: string | null;
  publishingConnected: boolean;
  engagementAvailable: boolean;
  hasAnyData: boolean;
  historyWindowMs: number;
  note: string;
}

function FunnelStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-2xl font-semibold">{value.toLocaleString()}</p>
      <p className="mt-0.5 text-xs text-theme-text-secondary">{label}</p>
    </div>
  );
}

export default function ObservePanel() {
  const [data, setData] = useState<ObserveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchObserve = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/observe");
      if (res.ok) {
        const body = (await res.json()) as ObserveData;
        if (body.ok) setData(body);
      } else {
        setError("Could not load insights.");
      }
    } catch {
      setError("Could not load insights.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchObserve(false);
  }, [fetchObserve]);

  return (
    <Card>
      <CardHeader
        title="Observe"
        description={refreshing ? "Refreshing…" : "Real run, step and spend data from your agent workspace."}
        action={
          <button
            type="button"
            onClick={() => fetchObserve(true)}
            disabled={refreshing || loading}
            className="btn text-xs disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        }
      />

      {loading && (
        <div className="space-y-3 px-5 py-6">
          <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-100" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-neutral-100" />
        </div>
      )}

      {!loading && error && <p className="px-5 py-4 text-sm text-red-600">{error}</p>}

      {!loading && !error && data && !data.hasAnyData && (
        <EmptyState
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5" aria-hidden="true">
              <path d="M3 3v18h18" />
              <path d="M7 14l3-3 3 3 5-6" />
            </svg>
          }
          title="No data yet"
          description="Run your first agent run to start the funnel. Engagement analytics unlock once a publishing channel is connected."
        />
      )}

      {!loading && !error && data && data.hasAnyData && (
        <>
          {/* ── Funnel (real run → steps → drafts → approved) ─────────── */}
          <div className="px-5 py-4">
            <p className="text-xs font-medium text-theme-text-secondary">Run funnel</p>
            <div className="mt-3 grid grid-cols-3 gap-4 sm:grid-cols-6">
              <FunnelStat label="Runs" value={data.funnel.runs} />
              <FunnelStat label="Steps" value={data.funnel.steps} />
              <FunnelStat label="Steps done" value={data.funnel.stepsDone} />
              <FunnelStat label="Drafts" value={data.funnel.drafts} />
              <FunnelStat label="From approved angles" value={data.funnel.approvedDrafts} />
              <FunnelStat label="Runs with a draft" value={data.funnel.atLeastOneDraft} />
            </div>
            <p className="mt-2 text-xs text-theme-text-secondary">
              {data.funnel.runsCompleted} completed · {data.funnel.runsAwaitingApproval} awaiting your approval.
            </p>
          </div>

          {/* ── Spend (honest, real tokens → published-rate estimate) ──── */}
          <div className="border-t border-theme-divider px-5 py-3">
            <p className="text-xs font-medium text-theme-text-secondary">Monthly agent spend</p>
            {data.spend.runsThisMonth > 0 ? (
              <>
                <p className="mt-1 text-xs text-theme-text-secondary">
                  {data.spend.runsThisMonth} run{data.spend.runsThisMonth === 1 ? "" : "s"} this month ·{" "}
                  {data.spend.totalInputTokens.toLocaleString()} input + {data.spend.totalOutputTokens.toLocaleString()} output tokens
                </p>
                <p className="mt-0.5 text-xs text-theme-text-secondary">
                  {data.estimatedCostUsd ?? "$0.00"} est. · <span className="italic">published-rate estimate from real token counts</span>
                </p>
              </>
            ) : (
              <p className="mt-1 text-xs text-theme-text-secondary">No agent spend this month yet.</p>
            )}
          </div>

          {/* ── Strategy history ──────────────────────────────────────── */}
          <div className="border-t border-theme-divider px-5 py-3">
            <p className="text-xs font-medium text-theme-text-secondary">Strategy docs</p>
            <p className="mt-1 text-xs text-theme-text-secondary">
              {data.strategyDocs > 0
                ? `${data.strategyDocs} doc${data.strategyDocs === 1 ? "" : "s"} · last ${data.lastStrategyAt ? new Date(data.lastStrategyAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"}`
                : "No strategy docs yet — generate one from the strategy panel."}
            </p>
          </div>

          {/* ── Engagement / performance: HONEST EMPTY STATE ──────────── */}
          <div className="border-t border-theme-divider px-5 py-4">
            <p className="text-xs font-medium text-theme-text-secondary">Engagement &amp; performance</p>
            {!data.engagementAvailable ? (
              <p className="mt-2 rounded-lg border border-dashed border-theme-divider px-4 py-4 text-center text-xs text-theme-text-secondary">
                No data yet — connect a publishing channel to unlock engagement analytics.
                <br />
                <span className="italic">No channel is connected in this build, so no performance numbers are shown.</span>
              </p>
            ) : (
              <p className="mt-1 text-xs text-theme-text-secondary">Real engagement data will appear here once a channel is connected.</p>
            )}
          </div>

          <div className="border-t border-theme-divider px-5 py-3">
            <p className="text-xs text-theme-text-secondary">{data.note}</p>
          </div>
        </>
      )}
    </Card>
  );
}
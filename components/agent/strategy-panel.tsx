"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/card";
import type { AgentMode, OutputFormat } from "@/types/agent";
import { AGENT_MODES, AGENT_MODE_LABEL } from "@/types/agent";
import { formatScore, formatHeadroom, formatExclusionCode, FORMAT_LABEL, type BudgetHeadroom } from "@/lib/agent/strategy-panel-helpers";
import { formatCostUsd, spendSourceLabel, type MonthlyAgentSpend } from "@/lib/agent/spend";

// ── Types matching GET/POST /api/agent/strategy/next ──────────────────────

interface Candidate {
  sourceId: string;
  sourceTitle: string;
  score: number;
  angleTitle: string | null;
  formats: OutputFormat[];
  reasons: string[];
}

interface StrategyRecommendation extends Candidate {
  headroom: BudgetHeadroom;
}

interface Exclusion {
  sourceId: string;
  sourceTitle: string;
  code: string;
  detail: string;
}

interface StrategyData {
  ok: boolean;
  strategyId: string | null;
  recommended: StrategyRecommendation | null;
  ranked: Candidate[];
  exclusions: Exclusion[];
  headroom: BudgetHeadroom;
  rationale: string | null;
  monthlySpend: MonthlyAgentSpend | null;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function StrategyPanel({
  onStartRun
}: {
  onStartRun: (sourceId: string, mode: AgentMode) => void;
}) {
  const [data, setData] = useState<StrategyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<AgentMode>("assist");
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const fetchStrategy = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/strategy/next");
      if (res.ok) {
        const body = (await res.json()) as StrategyData;
        if (body.ok) setData(body);
      } else {
        setError("Could not load strategy data.");
      }
    } catch {
      setError("Could not load strategy data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStrategy(false);
  }, [fetchStrategy]);

  async function publishNext() {
    if (!data?.recommended || publishing) return;
    setPublishing(true);
    setError(null);
    try {
      // Refresh strategy first to ensure headroom is current
      const res = await fetch("/api/agent/strategy/next");
      if (res.ok) {
        const body = (await res.json()) as StrategyData;
        if (body.ok) setData(body);
      }
      // Start the run — onStartRun calls the existing POST /api/agent/runs
      onStartRun(data.recommended.sourceId, mode);
    } catch {
      setError("Failed to start run.");
    } finally {
      setPublishing(false);
    }
  }

  const rec = data?.recommended;
  const headroom = data?.headroom;

  return (
    <Card>
      <CardHeader
        title="What should I publish next?"
        description={refreshing ? "Refreshing…" : "Based on your sources, scores, and budget."}
        action={
          <button
            type="button"
            onClick={() => fetchStrategy(true)}
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
          <div className="h-3 w-2/3 animate-pulse rounded bg-neutral-50" />
        </div>
      )}

      {!loading && error && (
        <p className="px-5 py-4 text-sm text-red-600">{error}</p>
      )}

      {!loading && !error && data && (
        <>
          {/* ── Recommendation ────────────────────────────────────────── */}
          {rec ? (
            <div className="px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{rec.sourceTitle}</p>
                  {rec.angleTitle && (
                    <p className="mt-0.5 text-xs text-theme-text-secondary">
                      Angle: {rec.angleTitle}
                    </p>
                  )}
                </div>
                <span className="badge bg-neutral-900 text-white">{formatScore(rec.score)}</span>
              </div>

              {rec.formats.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {rec.formats.map((fmt) => (
                    <span key={fmt} className="badge bg-primary-100 text-primary-500">
                      {FORMAT_LABEL[fmt] ?? fmt}
                    </span>
                  ))}
                </div>
              )}

              {rec.reasons.length > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {rec.reasons.map((r, i) => (
                    <li key={i} className="text-xs text-theme-text-secondary">· {r}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="px-5 py-4 text-sm text-theme-text-secondary">
              {headroom?.atLimit
                ? "Monthly budget exhausted — no recommendation."
                : "No sources with a ready transcript — repurpose something first."}
            </p>
          )}

          {/* ── Rationale ──────────────────────────────────────────────── */}
          {data.rationale && (
            <div className="border-t border-theme-divider px-5 py-3">
              <p className="text-xs text-theme-text-secondary">{data.rationale}</p>
            </div>
          )}

          {/* ── Headroom ───────────────────────────────────────────────── */}
          {headroom && (
            <div className="border-t border-theme-divider px-5 py-3">
              <p className="text-xs font-medium text-theme-text-secondary">Budget</p>
              <p className="mt-0.5 text-xs text-theme-text-secondary">{formatHeadroom(headroom)}</p>
            </div>
          )}

          {/* ── P9: Monthly agent spend ────────────────────────────────── */}
          {data.monthlySpend && data.monthlySpend.runsThisMonth > 0 && (
            <div className="border-t border-theme-divider px-5 py-3">
              <p className="text-xs font-medium text-theme-text-secondary">Monthly agent spend</p>
              <p className="mt-0.5 text-xs text-theme-text-secondary">
                {data.monthlySpend.runsThisMonth} run{data.monthlySpend.runsThisMonth === 1 ? "" : "s"} this month ·{" "}
                {data.monthlySpend.totalInputTokens.toLocaleString()} input +{" "}
                {data.monthlySpend.totalOutputTokens.toLocaleString()} output tokens
              </p>
              <p className="mt-0.5 text-xs text-theme-text-secondary">
                Est. cost: {formatCostUsd(data.monthlySpend.estimatedCostUsd)} ·{" "}
                <span className="italic">published-rate estimate ({spendSourceLabel("actual")} token counts)</span>
              </p>
            </div>
          )}

          {/* ── Ranked alternatives (collapsible) ──────────────────────── */}
          {data.ranked.length > 1 && (
            <div className="border-t border-theme-divider px-5 py-3">
              <button
                type="button"
                onClick={() => setShowAlternatives(!showAlternatives)}
                className="text-xs font-medium text-theme-text-secondary hover:text-theme-text-primary"
              >
                {showAlternatives ? "Hide" : "Show"} {data.ranked.length - 1} alternative{data.ranked.length > 2 ? "s" : ""}
              </button>
              {showAlternatives && (
                <ul className="mt-2 space-y-2">
                  {data.ranked.slice(1).map((c) => (
                    <li key={c.sourceId} className="flex items-start justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <span className="font-medium">{c.sourceTitle}</span>
                        {c.angleTitle && (
                          <span className="text-theme-text-secondary"> — {c.angleTitle}</span>
                        )}
                      </div>
                      <span className="badge bg-neutral-100 text-neutral-500 shrink-0">{formatScore(c.score)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* ── Exclusions (why-not) ──────────────────────────────────── */}
          {data.exclusions.length > 0 && (
            <div className="border-t border-theme-divider px-5 py-3">
              <p className="text-xs font-medium text-theme-text-secondary">Why not these sources?</p>
              <ul className="mt-1 space-y-1">
                {data.exclusions.map((e) => (
                  <li key={e.sourceId} className="text-xs text-theme-text-secondary">
                    <span className="font-medium">{e.sourceTitle}</span>
                    {" — "}
                    <span className="text-theme-text-secondary">{formatExclusionCode(e.code)}: {e.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Publish next action ────────────────────────────────────── */}
          {rec && !headroom?.atLimit && (
            <div className="border-t border-theme-divider px-5 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as AgentMode)}
                  className="rounded-lg border border-theme-divider bg-theme-bg-paper px-3 py-1.5 text-xs"
                  aria-label="Autonomy mode for publish next"
                >
                  {AGENT_MODES.map((m) => (
                    <option key={m} value={m}>{AGENT_MODE_LABEL[m]}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={publishNext}
                  disabled={publishing || headroom?.atLimit}
                  className="btn btn-primary text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {publishing ? "Starting…" : "Publish next"}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

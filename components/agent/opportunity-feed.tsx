"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardHeader } from "@/components/card";
import type { AgentMode, OutputFormat } from "@/types/agent";
import { AGENT_MODES, AGENT_MODE_LABEL } from "@/types/agent";
import { formatScore, formatHeadroom, formatExclusionCode, FORMAT_LABEL, type BudgetHeadroom } from "@/lib/agent/strategy-panel-helpers";
import { formatCostUsd, spendSourceLabel, type MonthlyAgentSpend } from "@/lib/agent/spend";

// ── Types matching GET /api/agent/strategy/next ─────────────────────────────

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

// The passive "what should I work on next?" surface. Loads the deterministic
// strategy next snapshot (real source/idea/budget data — no LLM on GET) and
// turns each candidate into a human-scale opportunity the user can act on.
// Nothing here claims outcomes that don't exist yet; empty states stay honest.

export default function OpportunityFeed({
  onStartRun,
  focusKey
}: {
  onStartRun: (sourceId: string, mode: AgentMode) => void;
  focusKey: number;
}) {
  const [data, setData] = useState<StrategyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<AgentMode>("assist");
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

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
        setError("VervAI couldn't complete this action. Your content is safe. [Try again]");
      }
    } catch {
      setError("VervAI couldn't complete this action. Your content is safe. [Try again]");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStrategy(false);
  }, [fetchStrategy]);

  // Bring the feed into focus when the composer's "Find opportunities" intent
  // asks for it (e.g. user toggled the intent or a text mention).
  useEffect(() => {
    if (focusKey > 0) {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [focusKey]);

  async function runFrom(sourceId: string) {
    if (startingId) return;
    setStartingId(sourceId);
    setError(null);
    try {
      onStartRun(sourceId, mode);
    } catch {
      setError("VervAI couldn't complete this action. Your content is safe. [Try again]");
    } finally {
      setStartingId(null);
    }
  }

  const rec = data?.recommended;
  const headroom = data?.headroom;

  return (
    <div ref={cardRef}>
      <Card>
      <CardHeader
        title="What should VervAI work on next?"
        description={refreshing ? "Refreshing…" : "VervAI recommendations from your real content, scores, and budget."}
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

      {!loading && error && <p className="px-5 py-4 text-sm text-red-600">{error}</p>}

      {!loading && !error && data && (
        <>
          {/* ── Top recommendation as an opportunity card ─────────────────── */}
          {rec ? (
            <div className="px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="badge bg-amber-50 text-amber-700">Reuse opportunity</span>
                  <p className="mt-2 text-sm font-medium">{rec.sourceTitle}</p>
                  {rec.angleTitle && (
                    <p className="mt-0.5 text-xs text-theme-text-secondary">
                      Angle: {rec.angleTitle}
                    </p>
                  )}
                </div>
                <span className="badge bg-neutral-900 text-white shrink-0">{formatScore(rec.score)}</span>
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

          {/* ── Rationale ────────────────────────────────────────────────── */}
          {data.rationale && (
            <div className="border-t border-theme-divider px-5 py-3">
              <p className="text-xs font-medium text-theme-text-secondary">Why this next</p>
              <p className="mt-0.5 text-xs text-theme-text-secondary">{data.rationale}</p>
            </div>
          )}

          {/* ── Budget (plain-language) ─────────────────────────────────── */}
          {headroom && (
            <div className="border-t border-theme-divider px-5 py-3">
              <p className="text-xs font-medium text-theme-text-secondary">Budget</p>
              <p className="mt-0.5 text-xs text-theme-text-secondary">{formatHeadroom(headroom)}</p>
            </div>
          )}

          {/* ── Monthly agent spend ─────────────────────────────────────── */}
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

          {/* ── Ranked alternatives (each actionable) ────────────────────── */}
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
                        {c.reasons.length > 0 && (
                          <span className="block text-theme-text-secondary">· {c.reasons[0]}</span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="badge bg-neutral-100 text-neutral-500">{formatScore(c.score)}</span>
                        <button
                          type="button"
                          onClick={() => runFrom(c.sourceId)}
                          disabled={startingId === c.sourceId || headroom?.atLimit}
                          className="btn px-2 py-1 text-xs disabled:opacity-50"
                        >
                          {startingId === c.sourceId ? "Starting…" : "Create"}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* ── Why-not (exclusions) ────────────────────────────────────── */}
          {data.exclusions.length > 0 && (
            <div className="border-t border-theme-divider px-5 py-3">
              <p className="text-xs font-medium text-theme-text-secondary">Sources not recommended?</p>
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

          {/* ── Act on the recommendation ────────────────────────────────── */}
          {rec && !headroom?.atLimit && (
            <div className="border-t border-theme-divider px-5 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as AgentMode)}
                  className="rounded-lg border border-theme-divider bg-theme-bg-paper px-3 py-1.5 text-xs"
                  aria-label="Autonomy mode for the recommended run"
                >
                  {AGENT_MODES.map((m) => (
                    <option key={m} value={m}>{AGENT_MODE_LABEL[m]}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => runFrom(rec.sourceId)}
                  disabled={startingId === rec.sourceId || headroom?.atLimit}
                  className="btn btn-primary text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {startingId === rec.sourceId ? "Starting…" : "Create from this recommendation"}
                </button>
              </div>
            </div>
          )}
        </>
      )}
      </Card>
    </div>
  );
}
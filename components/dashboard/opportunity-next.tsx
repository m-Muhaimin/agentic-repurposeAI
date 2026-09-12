"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/card";
import { formatScore, FORMAT_LABEL } from "@/lib/agent/strategy-panel-helpers";

// "Suggested next" — the single best reuse opportunity from the REAL strategy
// engine (/api/agent/strategy/next). Every outcome leads to the agent via
// /agent?source=<id>, and every empty/limit state says exactly why, honestly.

interface Candidate {
  sourceId: string;
  sourceTitle: string;
  score: number;
  angleTitle: string | null;
  formats: string[];
  reasons: string[];
}

interface StrategyData {
  ok: boolean;
  recommended: Candidate | null;
  exclusions: { sourceId: string; sourceTitle: string; code: string; detail: string }[];
  headroom: { jobsLimit: number | null; jobsUsed: number; jobsRemaining: number | null; atLimit: boolean };
  rationale: string | null;
}

export default function OpportunityNext() {
  const [data, setData] = useState<StrategyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNext = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch("/api/agent/strategy/next");
      if (res.ok) {
        const body = (await res.json()) as StrategyData;
        if (body.ok) setData(body);
      }
    } catch {
      // transient — keep the last good render
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchNext(false);
  }, [fetchNext]);

  const rec = data?.recommended;
  const atLimit = data?.headroom?.atLimit;

  return (
    <Card>
      <CardHeader
        title="Suggested next"
        description={
          refreshing
            ? "Refreshing…"
            : "VervAI's top recommendation from your real content."
        }
        action={
          <button
            type="button"
            onClick={() => fetchNext(true)}
            disabled={loading || refreshing}
            className="text-xs disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        }
      />
      {loading ? (
        <div className="space-y-3 px-5 py-6">
          <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-100" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-neutral-50" />
        </div>
      ) : (
        data &&
        (atLimit ? (
          <div className="px-5 py-5 text-sm text-theme-text-secondary">
            Monthly budget exhausted — no recommendation yet. It resets at the start of next month.{" "}
            <Link href="/settings/usage" className="text-primary-500 hover:text-primary-700">
              Plan &amp; usage →
            </Link>
          </div>
        ) : rec ? (
          <div className="px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="badge bg-amber-50 text-amber-700">Reuse opportunity</span>
                <p className="mt-2 text-sm font-medium">{rec.sourceTitle}</p>
                {rec.angleTitle && (
                  <p className="mt-0.5 text-xs text-theme-text-secondary">Angle: {rec.angleTitle}</p>
                )}
              </div>
              <span className="badge shrink-0 bg-neutral-900 text-white">{formatScore(rec.score)}</span>
            </div>
            {rec.formats.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {rec.formats.map((fmt) => (
                  <span key={fmt} className="badge bg-primary-100 text-primary-500">
                    {FORMAT_LABEL[fmt as keyof typeof FORMAT_LABEL] ?? fmt}
                  </span>
                ))}
              </div>
            )}
            {rec.reasons.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {rec.reasons.slice(0, 2).map((r) => (
                  <li key={r} className="text-xs text-theme-text-secondary">
                    · {r}
                  </li>
                ))}
              </ul>
            )}
            {data.rationale && <p className="mt-2 text-xs text-theme-text-secondary">{data.rationale}</p>}
            <Link href={`/agent?source=${rec.sourceId}`} className="btn btn-primary mt-4 text-sm">
              Create from this recommendation
            </Link>
          </div>
        ) : (
          <div className="px-5 py-5">
            <p className="text-sm text-theme-text-secondary">
              VervAI hasn&apos;t found strong opportunities yet — once a source has a ready transcript, VervAI will suggest what to
              make next.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/upload" className="btn btn-outline-primary btn-sm">
                Create content
              </Link>
              <Link href="/agent" className="btn btn-outline-primary btn-sm">
                Open the agent
              </Link>
            </div>
          </div>
        ))
      )}
    </Card>
  );
}
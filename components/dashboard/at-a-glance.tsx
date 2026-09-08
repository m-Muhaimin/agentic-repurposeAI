"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/card";
import StatusBadge from "@/components/status-badge";
import { PENDING_STATUS } from "@/lib/status";
import type { AgentRunSummary } from "@/types/agent";

// Live queue for the dashboard: everything that needs the human or is still
// working. Data is REAL — /api/sources and /api/agent/runs — and every action
// is a real route or the same retry flow the upload page uses.

type Source = {
  id: string;
  title: string;
  status: string;
  error_message: string | null;
  source_type: string;
  created_at: string;
};

type Job = { id: string; source_id: string; status: string; started_at: string | null };

const RUN_LABEL: Record<string, string> = {
  created: "Preparing",
  planning: "Planning",
  awaiting_approval: "Needs your review",
  executing: "Generating",
  evaluating: "Reviewing quality",
  done: "Ready",
  failed: "Failed",
  cancelled: "Cancelled"
};

const RUN_STYLE: Record<string, string> = {
  created: "bg-neutral-100 text-neutral-700",
  planning: "bg-primary-100 text-primary-500",
  awaiting_approval: "bg-amber-100 text-amber-700",
  executing: "bg-primary-100 text-primary-500",
  evaluating: "bg-primary-100 text-primary-500",
  done: "bg-neutral-900 text-white",
  failed: "bg-red-50 text-red-600",
  cancelled: "bg-neutral-100 text-neutral-500"
};

const RUN_IN_FLIGHT = ["created", "planning", "executing", "evaluating"];

export default function AtAGlance() {
  const [sources, setSources] = useState<Source[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [runs, setRuns] = useState<AgentRunSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const shouldPoll = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const [srcRes, runRes] = await Promise.all([
        fetch("/api/sources"),
        fetch("/api/agent/runs")
      ]);
      if (srcRes.ok) {
        const body = (await srcRes.json()) as { sources: Source[]; jobs: Job[] };
        setSources(body.sources ?? []);
        setJobs(body.jobs ?? []);
      }
      if (runRes.ok) {
        const body = (await runRes.json()) as { runs?: AgentRunSummary[] };
        setRuns(body.runs ?? []);
      }
    } catch {
      // transient — keep the last good render
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Stay live only while there is something in flight; otherwise stop polling.
  shouldPoll.current =
    sources.some((s) => PENDING_STATUS.includes(s.status)) ||
    runs.some((r) => RUN_IN_FLIGHT.includes(r.status));

  useEffect(() => {
    const id = setInterval(() => {
      if (shouldPoll.current) void refresh();
    }, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  async function startProcessing(sourceId: string) {
    setBusyId(sourceId);
    setError(null);
    try {
      const res = await fetch("/api/repurpose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId })
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Could not start processing.");
      }
      const data = (await res.json()) as { jobId?: string };
      if (!data.jobId) throw new Error("Could not start processing.");
      fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: data.jobId }),
        keepalive: true
      }).catch(() => {});
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  const awaiting = runs.filter((r) => r.status === "awaiting_approval");
  const failed = sources.filter((s) => s.status === "failed");
  const staged = sources.filter(
    (s) => s.status === "uploaded" && !jobs.some((j) => j.source_id === s.id)
  );
  const pending = sources.filter(
    (s) =>
      PENDING_STATUS.includes(s.status) &&
      !(s.status === "uploaded" && !jobs.some((j) => j.source_id === s.id))
  );
  const inFlightRuns = runs.filter((r) => RUN_IN_FLIGHT.includes(r.status));

  const hasAttention = awaiting.length + failed.length + staged.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <Card>
        <CardHeader
          title="Needs attention"
          description="Things that are waiting on you — the top of the queue."
          action={
            <Link href="/library" className="caption text-primary-500 transition-colors hover:text-primary-700">
              Open library →
            </Link>
          }
        />
        {!hasAttention ? (
          <div className="px-5 py-6">
            <p className="text-sm text-theme-text-secondary">
              Nothing needs your attention — you&apos;re all caught up.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-theme-divider">
            {awaiting.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.sourceTitle}</p>
                  <p className="text-xs text-theme-text-secondary">
                    Agent plan ready · {new Date(r.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </p>
                </div>
                <Link href={`/agent?run=${r.id}`} className="btn btn-outline-primary btn-sm shrink-0">
                  Review
                </Link>
              </li>
            ))}
            {failed.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{s.title}</p>
                  <p className="truncate text-xs text-red-600">{s.error_message ?? "Processing failed."}</p>
                </div>
                <button
                  type="button"
                  onClick={() => startProcessing(s.id)}
                  disabled={busyId !== null}
                  className="btn btn-outline-primary btn-sm shrink-0 disabled:opacity-50"
                >
                  {busyId === s.id ? "Retrying…" : "Try again"}
                </button>
              </li>
            ))}
            {staged.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{s.title}</p>
                  <p className="text-xs text-theme-text-secondary">Saved — processing never started.</p>
                </div>
                <button
                  type="button"
                  onClick={() => startProcessing(s.id)}
                  disabled={busyId !== null}
                  className="btn btn-outline-primary btn-sm shrink-0 disabled:opacity-50"
                >
                  {busyId === s.id ? "Starting…" : "Start processing"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="In progress" description="Sources and agent runs still working." />
        {pending.length + inFlightRuns.length === 0 ? (
          <div className="px-5 py-6">
            <p className="text-sm text-theme-text-secondary">Nothing is processing right now.</p>
          </div>
        ) : (
          <ul className="divide-y divide-theme-divider">
            {pending.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <p className="min-w-0 truncate text-sm font-medium">{s.title}</p>
                <StatusBadge status={s.status} />
              </li>
            ))}
            {inFlightRuns.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <p className="min-w-0 truncate text-sm font-medium">{r.sourceTitle}</p>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`badge ${RUN_STYLE[r.status] ?? RUN_STYLE.created}`}>
                    {RUN_LABEL[r.status] ?? "Working"}
                  </span>
                  <Link href={`/agent?run=${r.id}`} className="caption text-primary-500 hover:text-primary-700">
                    Open
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
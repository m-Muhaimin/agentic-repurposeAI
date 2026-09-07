"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/card";
import type { AgentRunSummary, RunStatus } from "@/types/agent";

const RUN_LABEL: Record<RunStatus, string> = {
  created: "Preparing",
  planning: "Planning",
  awaiting_approval: "Needs your review",
  executing: "Generating",
  evaluating: "Reviewing quality",
  done: "Ready",
  failed: "Failed",
  cancelled: "Cancelled"
};

const RUN_STYLE: Record<RunStatus, string> = {
  created: "bg-neutral-100 text-neutral-700",
  planning: "bg-primary-100 text-primary-500",
  awaiting_approval: "bg-amber-100 text-amber-700",
  executing: "bg-primary-100 text-primary-500",
  evaluating: "bg-primary-100 text-primary-500",
  done: "bg-neutral-900 text-white",
  failed: "bg-red-50 text-red-600",
  cancelled: "bg-neutral-100 text-neutral-500"
};

function inFlight(status: RunStatus): boolean {
  return status === "created" || status === "planning" || status === "executing" || status === "evaluating";
}

// Polls /api/agent/runs and lets the user pick a run. Light polling keeps the
// list fresh while a worker advances the durable run state. The list reads as a
// series of pieces of work, not operations: source + session goal + plain state.
export default function RunList({
  runId,
  goals,
  onSelect,
  onKick
}: {
  runId: string | null;
  goals: Record<string, string>;
  onSelect: (id: string) => void;
  onKick: (id: string) => void;
}) {
  const [runs, setRuns] = useState<AgentRunSummary[]>([]);

  async function refresh() {
    try {
      const res = await fetch("/api/agent/runs");
      if (!res.ok) return;
      const body = (await res.json()) as { runs?: AgentRunSummary[] };
      setRuns(body.runs ?? []);
    } catch {
      // transient
    }
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(() => refresh(), 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Card>
      <CardHeader title="History" description="Durable runs — resume picks up where one parked." />
      {runs.length === 0 ? (
        <p className="px-5 py-6 text-sm text-theme-text-secondary">No runs yet.</p>
      ) : (
        <ul className="divide-y divide-theme-divider">
          {runs.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onSelect(r.id)}
                className={`flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors hover:bg-neutral-50 ${
                  runId === r.id ? "bg-primary-50" : ""
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{r.sourceTitle}</span>
                  {goals[r.id] && (
                    <span className="block truncate text-xs italic text-theme-text-secondary">“{goals[r.id]}”</span>
                  )}
                  <span className="block text-xs text-theme-text-secondary">
                    {new Date(r.created_at).toLocaleString(undefined, { month: "short", day: "numeric" })} · {r.mode}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {inFlight(r.status) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onKick(r.id);
                      }}
                      className="btn btn-primary px-2 py-1 text-xs"
                    >
                      Resume
                    </button>
                  )}
                  <span className={`badge ${RUN_STYLE[r.status]}`}>{RUN_LABEL[r.status]}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
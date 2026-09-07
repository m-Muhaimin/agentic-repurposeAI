"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/card";
import EmptyState from "@/components/empty-state";
import SegmentedControl from "@/components/segmented-control";
import { AGENT_MODES, AGENT_MODE_LABEL, type AgentMode, type AgentRunSummary } from "@/types/agent";
import RunList from "./run-list";
import RunDetail from "./run-detail";

export interface AgentSource {
  id: string;
  title: string;
  status: string;
  created_at: string;
}

const RUN_STATUSES = [
  "created",
  "planning",
  "awaiting_approval",
  "executing",
  "evaluating",
  "done",
  "failed",
  "cancelled"
] as const;
export type RunStatusView = (typeof RUN_STATUSES)[number];

// The workspace owns the run lifecycle against the durable /api/agent/* routes.
// No in-memory state that matters: every transition is recoverable from
// v4_agent_runs + v4_agent_steps.

export default function AgentWorkspace({ initialSources }: { initialSources: AgentSource[] }) {
  const [sources] = useState<AgentSource[]>(initialSources);
  const [runId, setRunId] = useState<string | null>(null);
  const [mode, setMode] = useState<AgentMode>("assist");
  const [sourceId, setSourceId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startRun() {
    if (!sourceId || busy) return;
    setBusy(true);
    setError(null);

    const res = await fetch("/api/agent/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sourceId, mode })
    });
    const body = (await res.json()) as { ok?: boolean; run?: { id: string }; error?: string };

    if (!res.ok || !body.ok || !body.run) {
      setError(body.error ?? "Failed to start the run.");
      setBusy(false);
      return;
    }

    setRunId(body.run.id);
    setBusy(false);
  }

  // Kick the parked run forward (planning at first, execution after approval).
  async function kickRun(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runId: id })
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setError(body.error ?? "Worker error.");
      }
      // The durable state is re-read by RunDetail on the next poll — the SSE
      // is just a live progress stream for the current session.
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Left: new run + history */}
      <div className="space-y-6">
        <Card>
          <CardHeader title="New run" description="Plan angles from a finished source, approve, generate." />
          <div className="space-y-4 px-5 py-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-theme-text-secondary">Source</label>
              <select
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                className="w-full rounded-lg border border-theme-divider bg-theme-bg-paper px-3 py-2 text-sm"
              >
                <option value="">Choose a source…</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title || s.id.slice(0, 8)}
                  </option>
                ))}
              </select>
              {sources.length === 0 && (
                <p className="mt-1 text-xs text-theme-text-secondary">No finished sources yet — repurpose something first.</p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-theme-text-secondary">Mode</label>
              <SegmentedControl<AgentMode>
                options={AGENT_MODES.map((m) => ({ id: m, label: AGENT_MODE_LABEL[m] }))}
                value={mode}
                onChange={setMode}
                ariaLabel="Autonomy mode"
              />
              <p className="mt-2 text-xs text-theme-text-secondary">
                Assist approves every angle. Execute adds one bounded auto-revision. Automate is reserved for
                distribution (stubbed today).
              </p>
            </div>

            <button
              type="button"
              onClick={startRun}
              disabled={busy || !sourceId}
              className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Starting…" : "Start agent run"}
            </button>

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </Card>

        <RunList
          runId={runId}
          onSelect={setRunId}
          onKick={kickRun}
        />
      </div>

      {/* Right: the selected run's plan / timeline / outputs */}
      <div className="lg:col-span-2">
        {runId ? (
          <RunDetail runId={runId} onChange={() => {}} />
        ) : (
          <EmptyState
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5" aria-hidden="true">
                <path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
                <path d="M19 11a7 7 0 0 1-14 0" />
                <path d="M12 18v3" />
                <path d="M8 21h8" />
              </svg>
            }
            title="No run loaded"
            description="Start an agent run, or pick one from history to inspect its plan, timeline and drafts."
          />
        )}
      </div>
    </div>
  );
}
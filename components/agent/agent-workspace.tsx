"use client";

import { useState } from "react";
import EmptyState from "@/components/empty-state";
import type { AgentMode } from "@/types/agent";
import AgentContextStrip, { type AgentContextData } from "./agent-context-strip";
import OutcomeComposer from "./outcome-composer";
import OpportunityFeed from "./opportunity-feed";
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
// v4_agent_runs + v4_agent_steps. The session's `goals` map is display-only —
// the durable run row keeps its source-linked identity.

export default function AgentWorkspace({
  initialSources,
  defaultSourceId,
  context
}: {
  initialSources: AgentSource[];
  defaultSourceId: string | null;
  context: AgentContextData;
}) {
  const [sources] = useState<AgentSource[]>(initialSources);
  const [runId, setRunId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [goals, setGoals] = useState<Record<string, string>>({});
  const [focusKey, setFocusKey] = useState(0);

  async function startRun(srcId?: string, runMode?: AgentMode, goal = "") {
    const effectiveSourceId = srcId ?? "";
    const effectiveMode = runMode ?? "assist";
    if (!effectiveSourceId || busy) return;
    setBusy(true);
    setError(null);

    const res = await fetch("/api/agent/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sourceId: effectiveSourceId, mode: effectiveMode })
    });
    const body = (await res.json()) as { ok?: boolean; run?: { id: string }; error?: string };

    if (!res.ok || !body.ok || !body.run) {
      setError(body.error ?? "Failed to start the run.");
      setBusy(false);
      return;
    }

    if (goal) {
      setGoals((prev) => ({ ...prev, [body.run!.id]: goal }));
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
      {/* Left: what the agent knows + outcome-first composer + opportunities + history */}
      <div className="space-y-6">
        <OutcomeComposer
          sources={sources}
          defaultSourceId={defaultSourceId}
          busy={busy}
          error={error}
          onStart={(goal, _intent, sourceId, mode) => startRun(sourceId, mode, goal)}
          onExploreOpportunities={() => setFocusKey((k) => k + 1)}
        />

        <AgentContextStrip context={context} />

        <OpportunityFeed onStartRun={(src, m) => startRun(src, m)} focusKey={focusKey} />

        <RunList runId={runId} goals={goals} onSelect={setRunId} onKick={kickRun} />
      </div>

      {/* Right: the selected run's plan / progress / drafts */}
      <div className="lg:col-span-2">
        {runId ? (
          <RunDetail runId={runId} goal={goals[runId]} onChange={() => {}} />
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
            description="Start an agent run, or pick one from history — its plan, progress and drafts appear here."
          />
        )}
      </div>
    </div>
  );
}
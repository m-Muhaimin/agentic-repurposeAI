"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import EmptyState from "@/components/empty-state";
import type { AgentMode } from "@/types/agent";
import OutcomeComposer from "./outcome-composer";
import RunDetail from "./run-detail";

export interface AgentSource {
  id: string;
  title: string;
  status: string;
  created_at: string;
}

// The workspace owns the run lifecycle against the durable /api/agent/* routes.
// No in-memory state that matters: every transition is recoverable from
// v4_agent_runs + v4_agent_steps. The session's `goals` map is display-only —
// the durable run row keeps its source-linked identity.
//
// Layout is a 2-column grid. Empty state: the composer spans the full width.
// With a run loaded (created here or deep-linked via ?run=): composer top-left,
// the Progress panel appears on the right, and the row below shows the decision
// trail (left) beside the budget (right). There is no history rail — past runs
// are re-opened by their deep link. Starting a run also starts the worker, so
// the run advances to its plan without a manual "Resume" kick.

export default function AgentWorkspace({
  initialSources,
  defaultSourceId,
  initialGoal,
  initialSourceId,
  initialRunId,
  initialMode
}: {
  initialSources: AgentSource[];
  defaultSourceId: string | null;
  initialGoal?: string;
  initialSourceId?: string;
  initialRunId?: string;
  initialMode?: AgentMode;
}) {
  const router = useRouter();
  const [sources] = useState<AgentSource[]>(initialSources);
  const [runId, setRunId] = useState<string | null>(initialRunId ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [goals, setGoals] = useState<Record<string, string>>({});

  // Stable identity: RunDetail keeps the latest via a ref, but giving this a
  // constant reference means parent re-renders never churn its poll effect.
  const handleDetailChange = useCallback(() => {}, []);

  async function startRun(srcId?: string, runMode?: AgentMode, goal = "") {
    const effectiveSourceId = srcId ?? "";
    const effectiveMode = runMode ?? "assist";
    if (!effectiveSourceId || busy) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/agent/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceId: effectiveSourceId, mode: effectiveMode })
      });
      const body = (await res.json()) as { ok?: boolean; run?: { id: string }; error?: string };

      if (!res.ok || !body.ok || !body.run) {
        setError(body.error ?? "VervAI couldn't start this run. Your content is safe. [Try again]");
        return;
      }

      if (goal) {
        setGoals((prev) => ({ ...prev, [body.run!.id]: goal }));
      }
      setRunId(body.run!.id);

      // Auto-advance: starting the run also starts the worker, so it plans
      // without a manual "Resume" kick. If the kick fails the run stays
      // parked at its durable state, visible in history, and can be resumed.
      await kickRun(body.run!.id);
    } catch {
      setError("VervAI couldn't start this run. Your content is safe. [Try again]");
    } finally {
      setBusy(false);
    }
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
        setError(body.error ?? "VervAI couldn't complete this action. Your content is safe. [Try again]");
      }
      // The durable state is re-read by RunDetail on the next poll — the SSE
      // is just a live progress stream for the current session.
    } finally {
      setBusy(false);
    }
  }

  // A deep-linked source is honoured only when it's actually a ready source
  // (done/failed); otherwise fall back to the newest ready source.
  const effectiveDefaultSourceId =
    initialSourceId &&
    sources.some((s) => s.id === initialSourceId && (s.status === "done" || s.status === "failed"))
      ? initialSourceId
      : defaultSourceId;

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      {runId ? (
        <>
          {/* Composer — entry point, top-left while a run is loaded */}
          <section className="lg:col-start-1 lg:row-start-1">
            <OutcomeComposer
              sources={sources}
              defaultSourceId={effectiveDefaultSourceId}
              initialGoal={initialGoal}
              initialMode={initialMode}
              busy={busy}
              error={error}
              onStart={(goal, _intent, sourceId, mode) => startRun(sourceId, mode, goal)}
              onExploreOpportunities={() => router.push("/agent/observe")}
            />
          </section>

          {/* The selected run's panels: RunDetail places itself in the left
              (decision trail — row 2) and right (Progress + Budget rail) cells. */}
          <RunDetail runId={runId} goal={goals[runId]} onChange={handleDetailChange} onSelectRun={setRunId} />
        </>
      ) : (
        <>
          {/* Empty state: composer full width, no right-hand progress panel */}
          <section className="lg:col-span-2">
            <OutcomeComposer
              sources={sources}
              defaultSourceId={effectiveDefaultSourceId}
              initialGoal={initialGoal}
              initialMode={initialMode}
              busy={busy}
              error={error}
              onStart={(goal, _intent, sourceId, mode) => startRun(sourceId, mode, goal)}
              onExploreOpportunities={() => router.push("/agent/observe")}
            />
          </section>
          <section className="lg:col-span-2" aria-live="polite">
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
              description="Start a VervAI run — its progress, decision trail and drafts appear here."
            />
          </section>
        </>
      )}
    </div>
  );
}
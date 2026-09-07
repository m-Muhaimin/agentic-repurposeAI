"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/card";
import type { AgentRunRow, ContentIdea, RunStatus } from "@/types/agent";
import PlanView from "./plan-view";
import Timeline from "./timeline";

// Pulls the full durable snapshot for one run and drives the stage machine
// from the UI: reads the plan → approve/reject → kick the execution worker →
// show timeline + generated drafts.

interface RunDetailData {
  run: AgentRunRow;
  ideas: Array<{
    id: string;
    title: string;
    description: string | null;
    suggested_formats: string[];
    quotes: string[] | null;
    rationale: string | null;
    approved: boolean;
    evaluation: unknown;
  }>;
  steps: Array<{
    id: string;
    kind: string;
    status: string;
    label: string | null;
    output: {
      outputId?: string;
      evaluation?: { score?: number; weak?: boolean; flags?: string[]; notes?: string[] };
      error?: string;
    } | null;
    error?: string | null;
    created_at: string;
    started_at: string | null;
    finished_at: string | null;
  }>;
  outputs: Array<{ id: string; format: string; content: string; created_at: string }>;
}

const IN_FLIGHT: RunStatus[] = ["created", "planning", "executing", "evaluating"];
const FORMAT_LABEL: Record<string, string> = {
  linkedin_post: "LinkedIn post",
  newsletter: "Newsletter",
  shortform_script: "Short-form script"
};

export default function RunDetail({ runId, onChange }: { runId: string; onChange: () => void }) {
  const [data, setData] = useState<RunDetailData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/agent/runs/${runId}`);
      if (res.ok) {
        const body = (await res.json()) as RunDetailData;
        setData(body);
        onChange();
      }
    } catch {
      // transient
    }
  }, [runId, onChange]);

  // Poll while the worker is still advancing.
  useEffect(() => {
    refresh();
    const timer = setInterval(() => {
      setData((prev) => {
        if (prev && IN_FLIGHT.includes(prev.run.status)) return prev;
        return null;
      });
      refresh();
    }, 3000);
    return () => clearInterval(timer);
  }, [runId, refresh]);

  async function kick() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runId })
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setError(body.error ?? "Worker error.");
      }
      await refresh();
    } catch {
      setError("Failed to reach the worker.");
    } finally {
      setBusy(false);
    }
  }

  async function approve(decisions: { id: string; approved: boolean }[]) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/agent/runs/${runId}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ approval: "approved", ideas: decisions })
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        setError(body.error ?? "Approval failed.");
        return;
      }
      await kick();
    } finally {
      setBusy(false);
    }
  }

  async function rejectAll() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/agent/runs/${runId}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ approval: "rejected", ideas: [] })
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        setError(body.error ?? "Rejection failed.");
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return <Card><p className="px-5 py-8 text-sm text-theme-text-secondary">Loading run…</p></Card>;
  }

  const { run, ideas, steps, outputs } = data;
  const waiting = run.status === "awaiting_approval";

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {busy && <p className="text-sm text-theme-text-secondary">Working… the run survives restarts; this screen catches up from the DB.</p>}

      {waiting ? (
        <>
          <PlanView
            plan={run.plan}
            ideas={ideas}
            submitting={busy}
            onApprove={approve}
            onReject={rejectAll}
          />
          <Timeline steps={steps} />
        </>
      ) : (
        <>
          {run.plan && ideas.length > 0 && (
            <Card>
              <CardHeader title="Planned angles" description={run.plan.summary} />
              <ul className="divide-y divide-theme-divider">
                {ideas.map((idea) => (
                  <li key={idea.id} className="flex items-start justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="text-sm font-medium">{idea.title}</p>
                      {idea.description && <p className="text-xs text-theme-text-secondary">{idea.description}</p>}
                    </div>
                    <span className={`badge ${idea.approved ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-500"}`}>
                      {idea.approved ? "approved" : "rejected"}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Timeline steps={steps} />

          {outputs.length > 0 && (
            <Card>
              <CardHeader title="Generated drafts" description="Written to your content library — open them in the editor to refine." />
              <ul className="divide-y divide-theme-divider">
                {outputs.map((o) => (
                  <li key={o.id} className="px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="badge bg-primary-100 text-primary-500">{FORMAT_LABEL[o.format] ?? o.format}</span>
                      <a href={`/repurpose/${o.id}`} className="text-xs text-primary-500 hover:text-primary-700">
                        Open in editor →
                      </a>
                    </div>
                    <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-theme-text-secondary">{o.content}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {IN_FLIGHT.includes(run.status) && (
            <button type="button" onClick={kick} disabled={busy} className="btn btn-primary disabled:opacity-50">
              {run.status === "planning" ? "Kick planning worker" : "Resume run"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
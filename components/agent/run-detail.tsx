"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/card";
import type { AgentRunRow, ContentIdea, EditSignal, RunStatus } from "@/types/agent";
import { stepSpendFromOutput, aggregateRunSpend, formatCostUsd, formatCostUnits, spendSourceLabel, type StepSpend } from "@/lib/agent/spend";
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
    evaluation: {
      score?: number;
      grounding?: number;
      distinctness?: number;
      specificity?: number;
      flags?: string[];
      weakness?: string | null;
    } | null;
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
  signals: EditSignal[];
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

  const { run, ideas, steps, outputs, signals } = data;
  const waiting = run.status === "awaiting_approval";

  // P9: Extract per-step spend data from step outputs (spend events recorded
  // by the orchestrator at generation/planning time).
  const stepSpends: StepSpend[] = steps
    .map((s) => stepSpendFromOutput(s.id, s.kind, s.label, s.output))
    .filter((s): s is StepSpend => s !== null);

  const spendSummary = aggregateRunSpend(
    run.input_tokens,
    run.output_tokens,
    run.cost_units,
    run.max_cost_units,
    stepSpends
  );

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
          {/* ── Decision trail: planned angles with scores + decisions ─── */}
          {run.plan && ideas.length > 0 && (
            <Card>
              <CardHeader
                title="Decision trail"
                description={run.plan.summary}
              />
              <ul className="divide-y divide-theme-divider">
                {ideas.map((idea, index) => (
                  <li key={idea.id} className="flex gap-4 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-xs font-medium text-theme-text-secondary">#{index + 1}</span>
                        <h3 className="font-display text-sm font-semibold">{idea.title}</h3>
                        <span className={`badge ${idea.approved ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-500"}`}>
                          {idea.approved ? "approved" : "rejected"}
                        </span>
                      </div>
                      {idea.description && <p className="mt-1 text-sm text-theme-text-secondary">{idea.description}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {idea.suggested_formats.map((fmt) => (
                          <span key={fmt} className="badge bg-primary-100 text-primary-500">
                            {fmt.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                      {idea.rationale && (
                        <p className="mt-2 text-xs text-theme-text-secondary">Why: {idea.rationale}</p>
                      )}
                      {/* P3 idea scores */}
                      {idea.evaluation && typeof idea.evaluation.score === "number" && (
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-theme-text-secondary">
                          <span>Score {Math.round(idea.evaluation.score * 100)}%</span>
                          {typeof idea.evaluation.grounding === "number" && (
                            <span>Grounding {Math.round(idea.evaluation.grounding * 100)}%</span>
                          )}
                          {typeof idea.evaluation.distinctness === "number" && (
                            <span>Distinctness {Math.round(idea.evaluation.distinctness * 100)}%</span>
                          )}
                          {typeof idea.evaluation.specificity === "number" && (
                            <span>Specificity {Math.round(idea.evaluation.specificity * 100)}%</span>
                          )}
                          {idea.evaluation.weakness && (
                            <span className="text-amber-600">{idea.evaluation.weakness}</span>
                          )}
                        </div>
                      )}
                    </div>
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

          {/* ── P7: Edit-learning readout (what the agent remembers) ──── */}
          {signals.length > 0 && (
            <Card>
              <CardHeader
                title="What the agent remembers"
                description="Recent signals from your edits and angle decisions."
              />
              <ul className="divide-y divide-theme-divider">
                {signals.slice(-6).reverse().map((s, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 px-5 py-3 text-xs">
                    <div className="min-w-0">
                      <span className="font-medium">
                        {s.kind === "edit" && "Edit"}
                        {s.kind === "angle_decision" && s.whatChanged === "approved" && "Kept angle"}
                        {s.kind === "angle_decision" && s.whatChanged === "rejected" && "Rejected angle"}
                        {s.kind === "preference" && "Preference change"}
                      </span>
                      <span className="text-theme-text-secondary">
                        {" "}— {s.outputId}
                        {s.whatChanged !== "approved" && s.whatChanged !== "rejected" && `: ${s.whatChanged}`}
                      </span>
                    </div>
                    <span className="shrink-0 text-theme-text-secondary">
                      {new Date(s.at).toLocaleString(undefined, { month: "short", day: "numeric" })}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* ── P8+P9: Per-run budget + spend ────────────────────────────── */}
          <Card>
            <CardHeader
              title="Run budget"
              description="Snapshotted from your plan at run creation — enforced by the orchestrator."
            />
            <div className="grid grid-cols-3 gap-4 px-5 py-4 text-xs">
              <div>
                <p className="text-theme-text-secondary">Steps</p>
                <p className="mt-0.5 font-medium">{run.step_count} / {run.max_steps}</p>
              </div>
              <div>
                <p className="text-theme-text-secondary">Cost units</p>
                <p className="mt-0.5 font-medium">{formatCostUnits(run.cost_units)} / {run.max_cost_units}</p>
              </div>
              <div>
                <p className="text-theme-text-secondary">Runtime</p>
                <p className="mt-0.5 font-medium">
                  {run.max_runtime_s}s max
                </p>
              </div>
            </div>

            {/* P9: Estimated spend (token-derived — never claimed as real $) */}
            {spendSummary.hasActualTokens && (
              <div className="border-t border-theme-divider px-5 py-3">
                <p className="text-xs font-medium text-theme-text-secondary">Estimated spend</p>
                <p className="mt-0.5 text-xs text-theme-text-secondary">
                  {formatCostUsd(spendSummary.estimatedCostUsd)} est. · {spendSummary.totalInputTokens.toLocaleString()} input + {spendSummary.totalOutputTokens.toLocaleString()} output tokens · <span className="italic">published-rate estimate</span>
                </p>
              </div>
            )}

            {run.cost_units > 0 && run.max_cost_units > 0 && (
              <div className="border-t border-theme-divider px-5 py-3">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className="h-full rounded-full bg-primary-500"
                    style={{ width: `${spendSummary.budgetPercentUsed}%` }}
                  />
                </div>
              </div>
            )}

            {/* P9: Per-step breakdown (cheapest path) */}
            {stepSpends.length > 0 && (
              <div className="border-t border-theme-divider px-5 py-3">
                <p className="text-xs font-medium text-theme-text-secondary">Per-step token usage</p>
                <ul className="mt-1.5 space-y-1">
                  {stepSpends.map((s) => (
                    <li key={s.stepId} className="flex items-center justify-between text-xs text-theme-text-secondary">
                      <span className="truncate">{s.label ?? s.kind}</span>
                      <span className="shrink-0 ml-2">
                        {s.inputTokens.toLocaleString()}+{s.outputTokens.toLocaleString()} tokens
                        <span className="ml-1 italic">({spendSourceLabel(s.source)})</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

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
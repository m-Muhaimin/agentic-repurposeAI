"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/card";
import type { AgentRunRow, ContentIdea, EditSignal, RunStatus } from "@/types/agent";
import { stepSpendFromOutput, aggregateRunSpend, formatCostUsd, formatCostUnits, spendSourceLabel, type MonthlyAgentSpend, type StepSpend } from "@/lib/agent/spend";
import { budgetSummaryLine } from "@/lib/agent/plan-presentation";
import { AGENT_STATUS_LABEL, AGENT_STATUS_STYLE } from "@/lib/status";
import PlanView from "./plan-view";
import Timeline from "./timeline";
import AgentProgressDots from "./progress-dots";
import BufferPostPicker from "./buffer-post-picker";

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
  distributionJobs: Array<{
    id: string;
    platform: string;
    status: string;
    statusLabel: string;
    scheduled_at: string | null;
    published_at: string | null;
    external_id: string | null;
    error_message: string | null;
    metrics: Record<string, unknown> | null;
    metrics_refreshed_at: string | null;
    created_at: string;
    updated_at: string;
  }>;
  hasApiKey: boolean;
  signals: EditSignal[];
  monthlySpend: MonthlyAgentSpend | null;
}

// Render Buffer post metrics honestly: pick out stable top-level numbers and
// flatten nested counters into a readable row. Never asserts engagement quality.
function metricChips(metrics: Record<string, unknown> | null): Array<{ key: string; value: string }> {
  if (!metrics) return [];
  const out: Array<{ key: string; value: string }> = [];
  for (const [key, value] of Object.entries(metrics)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "number") {
      out.push({ key, value: value.toLocaleString() });
    } else if (typeof value === "boolean") {
      out.push({ key, value: value ? "yes" : "no" });
    } else if (typeof value === "string") {
      out.push({ key, value });
    }
  }
  return out.slice(0, 6);
}

const IN_FLIGHT: RunStatus[] = ["created", "planning", "executing", "evaluating"];

// Poll cadence adapts to how much the run can still change: fast while the
// worker is advancing, a gentle beat while parked waiting on review, idle
// otherwise. Always keeps the last good snapshot on screen (stale-while-validate).
const POLL_ADVANCING_MS = 2000;
const POLL_PARKED_MS = 5000;
const POLL_IDLE_MS = 8000;

const FORMAT_LABEL: Record<string, string> = {
  linkedin_post: "LinkedIn post",
  newsletter: "Newsletter",
  shortform_script: "Short-form script"
};

export default function RunDetail({
  runId,
  onChange,
  goal,
  onSelectRun
}: {
  runId: string;
  onChange: () => void;
  goal?: string;
  onSelectRun?: (runId: string) => void;
}) {
  const [data, setData] = useState<RunDetailData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshingMetrics, setRefreshingMetrics] = useState(false);
  const router = useRouter();

  // Hold the latest props/state in refs so `refresh` keeps a stable identity
  // for a given runId. The parent passes an inline onChange, so depending on
  // it directly would re-run this poll effect (and flash the loading card)
  // on every parent render.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const dataRef = useRef<RunDetailData | null>(data);
  dataRef.current = data;
  const fetchingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    // Skip a poll that's still in flight — overlapping fetches can resolve out
    // of order and make the view jump. The next scheduled tick picks up.
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch(`/api/agent/runs/${runId}`, { signal: controller.signal });
      if (res.ok) {
        const body = (await res.json()) as RunDetailData;
        setData(body);
        onChangeRef.current();
      }
    } catch {
      // transient or superseded — keep the last good snapshot on screen
    } finally {
      fetchingRef.current = false;
    }
  }, [runId]);

  // Poll while the run can still move, adaptively. The current snapshot never
  // leaves the screen while the next one loads — no "Loading run…" flash on
  // every tick. The loading card only appears on a genuine run switch, when
  // there is nothing on screen to keep.
  useEffect(() => {
    setData(null);
    refresh();

    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const status = dataRef.current?.run.status;
      const delay =
        status && IN_FLIGHT.includes(status)
          ? POLL_ADVANCING_MS
          : status === "awaiting_approval"
            ? POLL_PARKED_MS
            : POLL_IDLE_MS;
      timer = setTimeout(() => {
        refresh();
        schedule();
      }, delay);
    };
    schedule();

    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
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
      setError("VervAI couldn't complete this action. Your content is safe. [Try again]");
    } finally {
      setBusy(false);
    }
  }

  async function approve(decisions: { id: string; approved: boolean; title?: string; description?: string }[]) {
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
        setError(body.error ?? "VervAI couldn't complete this action. Your content is safe. [Try again]");
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
        setError(body.error ?? "VervAI couldn't complete this action. Your content is safe. [Try again]");
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function refreshMetrics() {
    setRefreshingMetrics(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/metrics/refresh", { method: "POST" });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        setError(body.error ?? "VervAI couldn't refresh post metrics. Your content is safe. [Try again]");
        return;
      }
      await refresh();
    } finally {
      setRefreshingMetrics(false);
    }
  }

  async function handleRepurposed(info: { runId: string; sourceId: string }) {
    // Start the new run's worker (same call the composer makes), then select it.
    try {
      await fetch("/api/agent/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runId: info.runId })
      });
    } catch {
      // The run is durable; selecting it still works even if the kick failed.
    }
    if (onSelectRun) {
      onSelectRun(info.runId);
    } else {
      router.push(`/agent?run=${info.runId}`);
    }
  }

  if (!data) {
    return (
      <section className="animate-fade-in lg:col-start-1 lg:row-start-2">
        <Card><p className="px-5 py-8 text-sm text-theme-text-secondary">Loading run…</p></Card>
      </section>
    );
  }

  const { run, ideas, steps, outputs, distributionJobs, hasApiKey, signals, monthlySpend } = data;
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

  const approvedIdeas = ideas.filter((i) => i.approved).length;

  // Two grid cells into the workspace's 2-column grid: the main column holds
  // the run state + approval gate + decision trail + drafts; the right rail
  // holds the Progress panel and Budget for as long as a run is loaded.
  return (
    <>
      <section
        key={run.id}
        className="space-y-6 animate-fade-in lg:col-start-1 lg:row-start-2"
        aria-live="polite"
      >
        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <AgentProgressDots status={run.status} />
          <span className={`badge ${AGENT_STATUS_STYLE[run.status] ?? "bg-neutral-100 text-neutral-700"}`}>
            {AGENT_STATUS_LABEL[run.status] ?? run.status}
          </span>
          {IN_FLIGHT.includes(run.status) && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-500" aria-hidden="true">
              <span className="size-1.5 rounded-full bg-primary-500 animate-pulse-soft" />
              live
            </span>
          )}
        </div>

        {goal && (
          <p className="text-xs text-theme-text-secondary">
            Objective: <span className="text-theme-text-primary">“{goal}”</span>
          </p>
        )}

        {busy && <p className="text-sm text-theme-text-secondary">Working… the run survives restarts; this screen catches up from the DB.</p>}

        {waiting ? (
          <PlanView
            plan={run.plan}
            ideas={ideas}
            submitting={busy}
            onApprove={approve}
            onReject={rejectAll}
          />
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

            {outputs.length > 0 && (
              <Card>
                <CardHeader title="Generated drafts" description="Written to your content library — open them in the editor to refine your VervAI drafts." />
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

            {/* ── Performance: real Buffer post metrics for what this run scheduled ── */}
            {distributionJobs.length > 0 && (
              <Card>
                <CardHeader
                  title="Performance"
                  description="Live Buffer post metrics for the posts this run placed — pulled from Buffer, never estimated."
                />
                <ul className="divide-y divide-theme-divider">
                  {distributionJobs.map((job) => (
                    <li key={job.id} className="px-5 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="badge bg-primary-100 text-primary-500">{job.platform}</span>
                        <span className="text-xs text-theme-text-secondary">
                          {job.statusLabel}
                          {job.scheduled_at ? ` · ${new Date(job.scheduled_at).toLocaleString(undefined, { month: "short", day: "numeric" })}` : ""}
                          {job.external_id ? ` · Buffer #${job.external_id.slice(0, 8)}` : ""}
                        </span>
                      </div>
                      {job.error_message && (
                        <p className="mt-1.5 text-xs text-red-600">{job.error_message}</p>
                      )}
                      {job.metrics && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {metricChips(job.metrics).map((chip) => (
                            <span key={chip.key} className="badge bg-neutral-100 text-neutral-600">
                              {chip.key}: {chip.value}
                            </span>
                          ))}
                          {job.metrics_refreshed_at && (
                            <span className="text-xs text-theme-text-secondary">
                              refreshed {new Date(job.metrics_refreshed_at).toLocaleString(undefined, { month: "short", day: "numeric" })}
                            </span>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="border-t border-theme-divider px-5 py-3">
                  <button
                    type="button"
                    onClick={() => void refreshMetrics()}
                    disabled={refreshingMetrics || !hasApiKey}
                    className="btn btn-outline-primary btn-sm disabled:opacity-50"
                  >
                    {refreshingMetrics
                      ? "Refreshing…"
                      : hasApiKey
                        ? "Refresh metrics"
                        : "Add a Buffer API key to refresh metrics"}
                  </button>
                </div>
              </Card>
            )}

            {/* ── Repurpose an existing Buffer post back through the pipeline ── */}
            {run.status === "done" && (
              <Card>
                <CardHeader
                  title="Repurpose a Buffer post"
                  description="Pick a post you already posted — VervAI turns its text into a fresh source and plans new angles from it."
                />
                <BufferPostPicker mode={run.mode} onRepurposed={handleRepurposed} onError={setError} />
              </Card>
            )}

            {/* ── P7: Edit-learning readout (what VervAI remembers) ──── */}
            {signals.length > 0 && (
              <Card>
                <CardHeader
                  title="What VervAI remembers"
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

            {IN_FLIGHT.includes(run.status) && (
              <button type="button" onClick={kick} disabled={busy} className="btn btn-primary disabled:opacity-50">
                {run.status === "planning" ? "Kick planning worker" : "Resume run"}
              </button>
            )}
          </>
        )}
      </section>

      {/* Right rail: Progress (shown whenever a run is loaded) + Budget */}
      <aside
        key={run.id}
        className="space-y-6 animate-fade-in lg:col-start-2 lg:row-start-1 lg:row-span-2"
      >
        <Timeline
          steps={steps}
          status={run.status}
          totalIdeas={ideas.length}
          approvedIdeas={approvedIdeas}
          mode={run.mode}
        />

        {/* ── P8+P9: Run budget (collapsed; full metrics behind "View details") ── */}
        <Card>
          <CardHeader
            title="Budget"
            description="This run's allowance in plain terms."
          />
          <div className="px-5 py-4">
            <p className="text-sm text-theme-text-secondary">
              {run.cost_units > 0
                ? budgetSummaryLine({
                    costUsd: spendSummary.estimatedCostUsd,
                    maxCostUnits: run.max_cost_units || null
                  })
                : "No spend recorded yet"}
            </p>

            {monthlySpend && monthlySpend.runsThisMonth > 0 && (
              <p className="mt-1 text-xs text-theme-text-secondary">
                {monthlySpend.runsThisMonth} run{monthlySpend.runsThisMonth === 1 ? "" : "s"} this month ·{" "}
                est. {formatCostUsd(monthlySpend.estimatedCostUsd)} ·{" "}
                {monthlySpend.totalInputTokens.toLocaleString()} input +{" "}
                {monthlySpend.totalOutputTokens.toLocaleString()} output tokens
              </p>
            )}

            <details className="group mt-3 border-t border-theme-divider pt-3">
              <summary className="cursor-pointer list-none text-xs font-medium text-theme-text-secondary hover:text-theme-text-primary">
                <span className="underline">View details</span>
              </summary>
              <div className="mt-3 grid grid-cols-3 gap-4 text-xs">
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

              {run.cost_units > 0 && run.max_cost_units > 0 && (
                <div className="mt-3">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className="h-full rounded-full bg-primary-500"
                      style={{ width: `${spendSummary.budgetPercentUsed}%` }}
                    />
                  </div>
                </div>
              )}

              {/* P9: Estimated spend (token-derived — never claimed as real $) */}
              {spendSummary.hasActualTokens && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-theme-text-secondary">Estimated spend</p>
                  <p className="mt-0.5 text-xs text-theme-text-secondary">
                    {formatCostUsd(spendSummary.estimatedCostUsd)} est. · {spendSummary.totalInputTokens.toLocaleString()} input + {spendSummary.totalOutputTokens.toLocaleString()} output tokens · <span className="italic">published-rate estimate</span>
                  </p>
                </div>
              )}

              {/* P9: Per-step breakdown (cheapest path) */}
              {stepSpends.length > 0 && (
                <div className="mt-3">
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
            </details>
          </div>
        </Card>
      </aside>
    </>
  );
}
import { Fragment, useEffect, useRef } from "react";
import { Card, CardHeader } from "@/components/card";
import type { RunStatus } from "@/types/agent";
import { AGENT_STATUS_LABEL, AGENT_STATUS_STYLE } from "@/lib/status";
import { humanizeTimeline, type HumanStage, type HumanStageState } from "@/lib/agent/timeline-copy";

// The run's progress, in plain language (P0). An AI-native readout in layers,
// all derived from durable data — never reconstructed client-side:
//   1. Status — what is live right now (Elements: agent-status).
//   2. Pipeline — the stage machine with connectors + progress (multi-agent pipeline).
//   3. Reasoning — the human narrative of what happened (chain-of-thought).
//   4. Agent activity — the durable step rows as collapsible tool-call style
//      entries with their inputs/outputs (task-list + tool-call).

interface StepRow {
  id: string;
  kind: string;
  status: string;
  label: string | null;
  input?: unknown;
  error?: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  output?: { outputId?: string; evaluation?: { score?: number; weak?: boolean } } | null;
}

const KIND_LABEL: Record<string, string> = {
  planning: "Planning",
  source: "Source",
  generation: "Generation",
  review: "Review",
  distribution: "Distribution",
  strategy: "Strategy"
};

const STEP_STYLE: Record<string, string> = {
  done: "bg-neutral-900 text-white",
  failed: "bg-red-50 text-red-600",
  running: "bg-primary-100 text-primary-500",
  pending: "bg-neutral-100 text-neutral-500",
  skipped: "bg-neutral-100 text-neutral-500"
};

const DOT_STYLE: Record<HumanStageState, string> = {
  done: "bg-primary-500",
  active: "animate-pulse-soft bg-primary-500",
  pending: "bg-neutral-300"
};

// ── Pipeline stages (Elements multi-agent pipeline) ──────────────────────────
type PipelineState = "done" | "active" | "pending";

interface PipelineStage {
  id: string;
  label: string;
  state: PipelineState;
}

const STAGE_CHIP: Record<PipelineState, string> = {
  done: "bg-primary-500 text-white",
  active: "bg-primary-100 text-primary-500",
  pending: "bg-neutral-100 text-neutral-400"
};

// Derive the stage machine from the run + its durable steps. The publish stage
// only exists when the run actually has distribution steps — never an
// always-gray "upcoming" promise.
function pipelineFor(status: RunStatus, steps: StepRow[]): PipelineStage[] {
  const drafted = steps.some((s) => s.kind === "generation" && s.status === "done");
  const reviewed = steps.some((s) => s.kind === "review" && s.status === "done");
  const distributed = steps.some((s) => s.kind === "distribution" && s.status === "done");
  const distributing = steps.some((s) => s.kind === "distribution" && s.status !== "done");

  const stages: PipelineStage[] = [
    { id: "plan", label: "Plan", state: "pending" },
    { id: "review", label: "Review", state: "pending" },
    { id: "draft", label: "Draft", state: "pending" },
    { id: "quality", label: "Quality", state: "pending" }
  ];
  if (distributed || distributing) stages.push({ id: "publish", label: "Publish", state: "pending" });
  stages.push({ id: "ready", label: "Ready", state: "pending" });

  if (status === "created" || status === "planning") stages[0].state = "active";
  else stages[0].state = "done";

  if (status === "awaiting_approval") stages[1].state = "active";
  else if (status === "executing" || status === "evaluating" || status === "done") stages[1].state = "done";

  if (drafted || status === "evaluating" || status === "done") stages[2].state = "done";
  else if (status === "executing") stages[2].state = "active";

  if (reviewed || status === "done") stages[3].state = "done";
  else if (status === "evaluating") stages[3].state = "active";

  const publish = stages.find((s) => s.id === "publish");
  if (publish) publish.state = distributed || status === "done" ? "done" : "active";

  if (status === "done") stages[stages.length - 1].state = "done";

  // A dead run never shows a stage pretending to be live.
  if (status === "failed" || status === "cancelled") {
    for (const stage of stages) if (stage.state !== "done") stage.state = "pending";
  }

  return stages;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function durationSec(started: string | null, finished: string | null): string | null {
  if (!started || !finished) return null;
  const s = Math.round((new Date(finished).getTime() - new Date(started).getTime()) / 1000);
  if (s <= 0) return null;
  return `${s}s`;
}

// Keep recorded inputs/outputs readable: trim long strings (transcripts!)
// before stringifying, then cap the whole body.
function elideBigStrings(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(elideBigStrings);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = typeof v === "string" && v.length > 120 ? `${v.slice(0, 90)}…` : elideBigStrings(v);
    }
    return out;
  }
  return value;
}

function previewJson(value: unknown, max = 500): string {
  const text = JSON.stringify(value, null, 2);
  return text.length > max ? `${text.replace(/\s+$/, "").slice(0, max)} …` : text;
}

function StepStatusIcon({ status }: { status: string }) {
  if (status === "done") {
    return (
      <svg className="size-3.5 shrink-0 text-primary-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  }
  if (status === "failed") {
    return (
      <svg className="size-3.5 shrink-0 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
    );
  }
  if (status === "skipped") {
    return <span className="size-3.5 shrink-0 rounded-full border border-neutral-300" aria-hidden="true" />;
  }
  return <span className="size-3.5 shrink-0 animate-pulse-soft rounded-full bg-neutral-300" aria-hidden="true" />;
}

// One durable step as a collapsible tool-call entry: name, status, duration,
// and below the fold its recorded input/output/error.
function StepItem({ step, last }: { step: StepRow; last: boolean }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const duration = durationSec(step.started_at, step.finished_at);
  const hasError = !!step.error;
  const evaluation = step.output?.evaluation;

  // Surface a failed step's detail without locking the disclosure open (React
  // has no defaultOpen for <details> — set the attribute once on mount).
  useEffect(() => {
    if (hasError && detailsRef.current) detailsRef.current.open = true;
  }, [hasError]);

  return (
    <li className={last ? "" : "border-b border-theme-divider"}>
      <details ref={detailsRef} className="group/step">
        <summary className="flex cursor-pointer list-none items-center gap-2 py-2.5">
          <StepStatusIcon status={step.status} />
          <span className="min-w-0 truncate text-sm font-medium">
            {step.label ?? KIND_LABEL[step.kind] ?? step.kind}
          </span>
          <span className={`badge hidden sm:inline-flex ${STEP_STYLE[step.status] ?? STEP_STYLE.pending}`}>{step.status}</span>
          {duration && <span className="shrink-0 text-xs text-theme-text-secondary">{duration}</span>}
          <svg
            className="ml-auto size-3 shrink-0 text-theme-text-secondary transition-transform group-open/step:rotate-90"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </summary>

        {step.input !== undefined && step.input !== null && (
          <pre className="mb-2 overflow-x-auto rounded-md bg-neutral-50 p-2 text-[11px] leading-relaxed text-theme-text-secondary">
            <span className="text-[10px] font-medium uppercase tracking-widest">input</span>
            {"\n"}
            {previewJson(elideBigStrings(step.input))}
          </pre>
        )}

        {step.output !== undefined && step.output !== null && (
          <pre className="mb-2 overflow-x-auto rounded-md bg-neutral-50 p-2 text-[11px] leading-relaxed text-theme-text-secondary">
            <span className="text-[10px] font-medium uppercase tracking-widest">output</span>
            {"\n"}
            {previewJson(elideBigStrings({ ...step.output, evaluation: undefined }))}
          </pre>
        )}

        {evaluation && typeof evaluation.score === "number" && (
          <p className="mb-2 text-xs text-theme-text-secondary">
            Score {Math.round(evaluation.score * 100)}%{evaluation.weak ? " · flagged for review" : ""}
          </p>
        )}

        {hasError && (
          <pre className="mb-1 overflow-x-auto rounded-md bg-red-50 p-2 text-[11px] leading-relaxed text-red-600">
            <span className="text-[10px] font-medium uppercase tracking-widest">error</span>
            {"\n"}
            {step.error}
          </pre>
        )}

        {step.input === undefined && step.output === undefined && !hasError && (
          <p className="mb-1 text-xs text-theme-text-secondary">Recorded by the worker — no detail captured.</p>
        )}
      </details>
    </li>
  );
}

// ── Card entry ───────────────────────────────────────────────────────────────
export default function Timeline({
  steps,
  status,
  totalIdeas,
  approvedIdeas,
  mode
}: {
  steps: StepRow[];
  status: RunStatus;
  totalIdeas: number;
  approvedIdeas: number;
  mode?: "assist" | "execute" | "automate";
}) {
  if (steps.length === 0 && status === "created") {
    return (
      <Card>
        <CardHeader title="Progress" />
        <p className="px-5 py-6 text-sm text-theme-text-secondary">Preparing your first analysis…</p>
      </Card>
    );
  }

  const lines = humanizeTimeline(
    steps.map((s) => ({ kind: s.kind, status: s.status })),
    { status, totalIdeas, approvedIdeas, mode }
  );
  const stages = pipelineFor(status, steps);
  const doneCount = stages.filter((s) => s.state === "done").length;
  const live = status === "created" || status === "planning" || status === "executing" || status === "evaluating";
  const statusLabel = AGENT_STATUS_LABEL[status] ?? status;
  const complete = steps.filter((s) => s.status === "done").length;

  return (
    <Card>
      <CardHeader
        title="Progress"
        description="Stage machine, reasoning and the durable activity trail — all from the run's own records."
      />

      {/* Status — Elements agent-status */}
      <div className="flex items-center justify-between gap-3 border-t border-theme-divider px-5 py-3">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-theme-text-primary">
          {live ? (
            <span className="relative flex size-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-primary-500" />
            </span>
          ) : (
            <span className="size-2 rounded-full bg-neutral-300" aria-hidden="true" />
          )}
          VervAI run
        </span>
        <span className={`badge ${AGENT_STATUS_STYLE[status] ?? "bg-neutral-100 text-neutral-700"}`}>{statusLabel}</span>
      </div>

      {/* Pipeline — Elements multi-agent pipeline */}
      <div className="px-5 pt-3">
        <div className="flex items-center">
          {stages.map((stage, i) => (
            <Fragment key={stage.id}>
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className={`h-px flex-1 ${
                    stages[i - 1].state === "done" && (stage.state === "done" || stage.state === "active")
                      ? "bg-primary-300"
                      : "bg-theme-divider"
                  }`}
                />
              )}
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STAGE_CHIP[stage.state]}`}>
                {stage.state === "done" ? "✓ " : ""}
                {stage.label}
              </span>
            </Fragment>
          ))}
        </div>
        <p className="mt-2 text-[10px] font-medium uppercase tracking-widest text-theme-text-secondary">
          {doneCount} of {stages.length} stages complete
        </p>
      </div>

      {/* Reasoning — the plain-language narrative */}
      {lines.length > 0 && (
        <div className="px-5 pb-1">
          <p className="pt-3 text-[10px] font-medium uppercase tracking-widest text-theme-text-secondary">Reasoning</p>
          <ol className="mt-1">
            {lines.map((line, i) => (
              <li key={line.id} className="relative flex gap-3 pb-2 last:pb-0">
                {i < lines.length - 1 && (
                  <span className="absolute left-[5px] top-4 bottom-0 w-px bg-theme-divider" aria-hidden="true" />
                )}
                <span
                  className={`relative mt-1 size-2.5 shrink-0 rounded-full ${DOT_STYLE[line.state]}`}
                  aria-hidden="true"
                />
                <span className={`text-sm ${line.state === "pending" ? "text-theme-text-secondary" : "font-medium"}`}>
                  {line.text}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Agent activity — durable step chain (Elements task-list + tool-call) */}
      {steps.length > 0 && (
        <details className="group border-t border-theme-divider px-5 py-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <span className="text-[10px] font-medium uppercase tracking-widest text-theme-text-secondary">
              Agent activity — {complete} of {steps.length} complete
            </span>
            <svg
              className="size-3 shrink-0 text-theme-text-secondary transition-transform group-open:rotate-90"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </summary>
          <ol className="mt-1">
            {steps.map((step, i) => (
              <StepItem key={step.id} step={step} last={i === steps.length - 1} />
            ))}
          </ol>
        </details>
      )}
    </Card>
  );
}
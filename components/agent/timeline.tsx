import { Card, CardHeader } from "@/components/card";
import type { RunStatus } from "@/types/agent";
import { humanizeTimeline, type HumanStage, type HumanStageState } from "@/lib/agent/timeline-copy";

// The run's progress, in plain language (P0). The technical step chain below
// the fold stays exactly as recorded in v4_agent_steps — the human narrative
// is derived from the same durable data, never reconstructed client-side.

interface StepRow {
  id: string;
  kind: string;
  status: string;
  label: string | null;
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

const STATUS_STYLE: Record<string, string> = {
  done: "bg-neutral-900 text-white",
  failed: "bg-red-50 text-red-600",
  running: "bg-primary-100 text-primary-500",
  pending: "bg-neutral-100 text-neutral-500",
  skipped: "bg-neutral-100 text-neutral-500"
};

const DOT_STYLE: Record<HumanStageState, string> = {
  done: "bg-primary-500",
  active: "animate-pulse bg-primary-500",
  pending: "bg-neutral-300"
};

function durationSec(started: string | null, finished: string | null): string | null {
  if (!started || !finished) return null;
  const s = Math.round((new Date(finished).getTime() - new Date(started).getTime()) / 1000);
  if (s <= 0) return null;
  return `${s}s`;
}

function StageLine({ line, last }: { line: HumanStage; last: boolean }) {
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {!last && (
        <span className="absolute left-[5px] top-4 bottom-0 w-px bg-theme-divider" aria-hidden="true" />
      )}
      <span
        className={`relative mt-1 size-2.5 shrink-0 rounded-full ${DOT_STYLE[line.state]}`}
        aria-hidden="true"
      />
      <span
        className={`text-sm ${
          line.state === "pending" ? "text-theme-text-secondary" : "font-medium"
        }`}
      >
        {line.text}
      </span>
    </li>
  );
}

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

  return (
    <Card>
      <CardHeader
        title="Progress"
        description="Your VervAI run in plain language — the detail behind each line is below."
      />
      <ol className="px-5 py-4">
        {lines.map((line, i) => (
          <StageLine key={line.id} line={line} last={i === lines.length - 1} />
        ))}
      </ol>

      {steps.length > 0 && (
        <details className="group border-t border-theme-divider px-5 py-3">
          <summary className="cursor-pointer list-none text-xs font-medium text-theme-text-secondary hover:text-theme-text-primary">
            <span className="underline">View VervAI activity</span> — {steps.length} durable step
            {steps.length === 1 ? "" : "s"}
          </summary>
          <ol className="mt-3 space-y-0">
            {steps.map((step, index) => (
              <li key={step.id} className="relative flex gap-4 pb-4 last:pb-0">
                {index < steps.length - 1 && (
                  <span className="absolute left-[5px] top-4 bottom-0 w-px bg-theme-divider" aria-hidden="true" />
                )}
                <span
                  className={`relative mt-1 size-2.5 shrink-0 rounded-full ${
                    step.status === "done" ? "bg-primary-500" : step.status === "failed" ? "bg-red-500" : "bg-neutral-300"
                  }`}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{step.label ?? KIND_LABEL[step.kind] ?? step.kind}</span>
                    <span className={`badge ${STATUS_STYLE[step.status] ?? STATUS_STYLE.pending}`}>{step.status}</span>
                    {durationSec(step.started_at, step.finished_at) && (
                      <span className="text-xs text-theme-text-secondary">{durationSec(step.started_at!, step.finished_at!)}</span>
                    )}
                  </div>
                  {step.output?.evaluation && typeof step.output.evaluation.score === "number" && (
                    <p className="mt-1 text-xs text-theme-text-secondary">
                      Score {Math.round(step.output.evaluation.score * 100)}%{step.output.evaluation.weak ? " · flagged for review" : ""}
                    </p>
                  )}
                  {(step.output?.outputId || step.error) && (
                    <p className="mt-0.5 text-xs text-theme-text-secondary">{step.error ?? `output ${step.output?.outputId?.slice(0, 8)}`}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </details>
      )}
    </Card>
  );
}
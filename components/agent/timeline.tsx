import { Card, CardHeader } from "@/components/card";

// The durable step timeline. Every row came from v4_agent_steps — this is the
// append-only history of what the worker actually did, rendered exactly as
// recorded (no client-side reconstruction).

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

function durationSec(started: string | null, finished: string | null): string | null {
  if (!started || !finished) return null;
  const s = Math.round((new Date(finished).getTime() - new Date(started).getTime()) / 1000);
  if (s <= 0) return null;
  return `${s}s`;
}

export default function Timeline({ steps }: { steps: StepRow[] }) {
  if (steps.length === 0) {
    return (
      <Card>
        <CardHeader title="Step timeline" />
        <p className="px-5 py-6 text-sm text-theme-text-secondary">No steps recorded yet.</p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Step timeline"
        description={`${steps.length} durable step${steps.length === 1 ? "" : "s"} — resume continues from the DB, never from memory.`}
      />
      <ol className="space-y-0 px-5 py-4">
        {steps.map((step, index) => (
          <li key={step.id} className="relative flex gap-4 pb-5 last:pb-0">
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
    </Card>
  );
}
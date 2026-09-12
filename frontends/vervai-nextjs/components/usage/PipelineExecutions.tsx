import type { AgentRunRow, SourceRow } from "@/lib/data";
import { SOURCE_TYPE_META, timeAgo } from "@/lib/data";

type Props = {
  runs: AgentRunRow[];
  sources: SourceRow[];
  totalRunCount: number;
};

const STATUS_TONE: Record<
  string,
  { bg: string; dot: string; label: string }
> = {
  completed: {
    bg: "bg-tertiary-fixed text-on-tertiary-fixed",
    dot: "bg-tertiary",
    label: "Completed",
  },
  running: {
    bg: "bg-primary-fixed text-on-primary-fixed",
    dot: "bg-primary",
    label: "Running",
  },
  failed: {
    bg: "bg-error-container text-on-error",
    dot: "bg-error",
    label: "Failed",
  },
  pending: {
    bg: "bg-surface-container-high text-secondary",
    dot: "bg-outline",
    label: "Pending",
  },
};

export default function PipelineExecutions({
  runs,
  sources,
  totalRunCount,
}: Props) {
  const sourceMap = new Map(sources.map((s) => [s.id, s]));

  return (
    <div className="rounded-xl bg-surface-container-lowest shadow-sm p-space-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pb-space-sm mb-space-sm">
        <div className="flex items-center gap-3">
          <h2 className="font-headline-md text-headline-md text-on-surface">
            Recent Agent Pipeline Executions
          </h2>
          {runs.length > 0 ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed text-[11px] font-caption-bold">
              <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
              <span>Live</span>
            </div>
          ) : null}
        </div>
      </div>
      {runs.length === 0 ? (
        <div className="py-12 text-center">
          <span className="material-symbols-outlined text-[32px] text-outline mb-2 block">
            inbox
          </span>
          <p className="font-body-sm text-body-sm text-secondary">
            No agent runs yet. Ingest a source to start processing.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left font-body-sm text-body-sm">
            <thead>
              <tr className="bg-surface-container-low text-secondary font-label-caps text-label-caps uppercase">
                <th className="py-2.5 px-4 rounded-l">Run ID</th>
                <th className="py-2.5 px-4">Source</th>
                <th className="py-2.5 px-4">Mode</th>
                <th className="py-2.5 px-4">Created</th>
                <th className="py-2.5 px-4 rounded-r text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y-0 space-y-1">
              {runs.map((run) => {
                const source = run.source_id
                  ? sourceMap.get(run.source_id)
                  : null;
                const statusKey = (run.status ?? "pending").toLowerCase();
                const tone = STATUS_TONE[statusKey] ?? STATUS_TONE.pending;
                const sourceIcon = source
                  ? SOURCE_TYPE_META[source.source_type]?.icon ?? "description"
                  : "help";
                return (
                  <tr
                    key={run.id}
                    className="hover:bg-surface-container-low transition-colors group"
                  >
                    <td className="py-3 px-4 font-caption-bold text-caption-bold text-on-surface">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-primary">
                          account_tree
                        </span>
                        <span className="font-mono text-on-surface">
                          {run.id.slice(0, 12)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-on-surface flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-secondary">
                        {sourceIcon}
                      </span>
                      <span>{source?.title ?? "Unknown source"}</span>
                    </td>
                    <td className="py-3 px-4 text-on-surface">
                      {run.mode ?? "—"}
                    </td>
                    <td className="py-3 px-4 text-secondary">
                      {timeAgo(run.created_at)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-caption-bold ${tone.bg}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${tone.dot}`}
                        ></span>
                        {tone.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-4 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <span className="font-body-sm text-body-sm text-secondary">
          Showing {runs.length} of {totalRunCount} total runs
        </span>
      </div>
    </div>
  );
}
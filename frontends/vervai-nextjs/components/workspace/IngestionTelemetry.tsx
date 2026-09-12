import {
  SOURCE_TYPE_META,
  SOURCE_STATUS_LABEL,
  timeAgo,
  formatDuration,
  type SourceRow,
  type SourceStatus,
  type AgentRunRow,
  type DistributionJobRow,
} from "@/lib/data";

export default function IngestionTelemetry({
  sources,
  runs,
  jobs,
}: {
  sources: SourceRow[];
  runs: AgentRunRow[];
  jobs: DistributionJobRow[];
}) {
  const latest = sources[0] ?? null;
  const latestRun = runs[0] ?? null;
  const doneCount = sources.filter((s) => s.status === "done").length;
  const readyPct = sources.length > 0 ? Math.round((doneCount / sources.length) * 100) : 0;
  const totalSeconds = sources.reduce((n, s) => n + (s.duration_seconds ?? 0), 0);
  const outputCount = sources.reduce((n, s) => n + (s.outputs?.length ?? 0), 0);
  const queuedCount = jobs.filter(
    (j) => j.status === "draft" || j.status === "scheduled",
  ).length;
  const statusCounts = sources.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-space-md pb-space-sm bg-surface-container-low -mx-space-lg -mt-space-lg px-space-lg py-space-sm rounded-t-xl">
          <div className="flex items-center gap-space-sm">
            <span className="material-symbols-outlined text-[20px] text-tertiary">analytics</span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">
              Source Ingestion Telemetry
            </h2>
          </div>
          <span className="font-label-caps text-label-caps text-secondary font-mono">
            {latest ? `src_${latest.id.slice(0, 8)}` : "no sources"}
          </span>
        </div>
        <div className="flex items-center gap-space-md p-space-sm rounded-lg bg-surface-container-low mb-space-md">
          <div className="w-16 h-16 rounded-lg bg-surface-container-high flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[28px] text-secondary">
              {latest ? SOURCE_TYPE_META[latest.source_type].icon : "inbox"}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-caption-bold text-caption-bold text-on-surface truncate">
              {latest ? latest.title : "No sources yet"}
            </p>
            <p className="font-body-sm text-[12px] text-secondary">
              {latest
                ? `${SOURCE_TYPE_META[latest.source_type].label} • ${
                    latest.duration_seconds ? formatDuration(latest.duration_seconds) : "Unknown duration"
                  }`
                : "Ingest a source to begin"}
            </p>
            {latest ? (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-2 h-2 rounded-full bg-tertiary"></span>
                <span className="font-label-caps text-[10px] text-tertiary font-bold uppercase">
                  {SOURCE_STATUS_LABEL[latest.status]}
                </span>
              </div>
            ) : null}
          </div>
        </div>
        <div className="p-space-sm rounded-lg bg-surface-container-low mb-space-md">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-caption-bold text-caption-bold text-on-surface">
              Sources Ready
            </span>
            <span className="font-headline-sm text-headline-sm text-primary">
              {doneCount}/{sources.length}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-surface-container-highest overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${readyPct}%` }}></div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-secondary mt-1.5">
            <span>
              {sources.length} source{sources.length === 1 ? "" : "s"} ingested
            </span>
            <span className="text-tertiary font-bold">{readyPct}% ready</span>
          </div>
        </div>
        <div className="space-y-space-xs mb-space-md">
          <span className="font-label-caps text-label-caps text-secondary uppercase tracking-wider block">
            Sources by status
          </span>
          <div className="flex flex-wrap gap-1.5">
            {Object.keys(statusCounts).length > 0 ? (
              Object.entries(statusCounts).map(([status, count]) => (
                <span
                  key={status}
                  className="font-caption-bold text-[11px] px-2.5 py-1 rounded bg-surface-container text-on-surface"
                >
                  {SOURCE_STATUS_LABEL[status as SourceStatus] ?? status} × {count}
                </span>
              ))
            ) : (
              <span className="font-caption-bold text-[11px] px-2.5 py-1 rounded bg-surface-container text-secondary">
                No sources ingested yet
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-space-sm mb-space-sm">
          <div className="p-space-sm rounded bg-surface-container-low">
            <span className="font-label-caps text-[10px] uppercase text-secondary">
              Total Duration
            </span>
            <p className="font-headline-sm text-headline-sm text-on-surface mt-0.5">
              {formatDuration(totalSeconds) || "—"}
            </p>
            <p className="font-body-sm text-[11px] text-secondary">
              across {sources.length} source{sources.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="p-space-sm rounded bg-surface-container-low">
            <span className="font-label-caps text-[10px] uppercase text-secondary">
              Latest Agent Run
            </span>
            <p className="font-headline-sm text-headline-sm text-primary mt-0.5">
              {latestRun?.status ?? "—"}
            </p>
            <p className="font-body-sm text-[11px] text-secondary">
              {latestRun
                ? `${latestRun.mode ?? "auto"} • ${timeAgo(latestRun.created_at)}`
                : "no runs yet"}
            </p>
          </div>
        </div>
      </div>
      <div className="pt-space-sm border-t border-surface-variant flex items-center justify-between text-secondary font-label-caps text-label-caps">
        <span>Distribution queue</span>
        <span>
          {queuedCount} {queuedCount === 1 ? "job" : "jobs"} awaiting review
        </span>
      </div>
    </div>
  );
}
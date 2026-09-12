import { timeAgo, type SourceRow, type AgentRunRow } from "@/lib/data";

export default function WorkspaceHeader({
  sources,
  runs,
}: {
  sources: SourceRow[];
  runs: AgentRunRow[];
}) {
  const latestSource = sources[0] ?? null;
  const latestRun = runs[0] ?? null;
  const runId = latestRun ? latestRun.id.slice(0, 8) : null;

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md mb-space-lg">
      <div className="flex flex-col gap-space-xs">
        <div className="flex items-center gap-2">
          <span className="font-label-caps text-label-caps uppercase text-secondary tracking-widest">
            Latest Run
          </span>
          <span className="font-label-caps text-label-caps bg-surface-container-high px-2 py-0.5 rounded text-on-surface-variant">
            {runId ?? "no runs yet"}
          </span>
          <span className="text-outline-variant font-label-caps text-label-caps">/</span>
          <span className="font-caption-bold text-caption-bold text-secondary">
            {latestSource ? latestSource.title : "no sources ingested"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-space-md mt-0.5">
          <h1 className="font-display-xl text-display-xl text-on-surface tracking-tight">
            {latestSource ? `Source: ${latestSource.title}` : "No source selected"}
          </h1>
          {latestRun ? (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-caption-bold text-caption-bold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-tertiary"></span>
              </span>
              <span>
                {latestRun.status ?? "run recorded"} • {timeAgo(latestRun.created_at)}
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-high text-on-surface-variant font-caption-bold text-caption-bold">
              <span className="material-symbols-outlined text-[14px]">schedule</span>
              <span>No active agent run</span>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-space-sm shrink-0 self-start md:self-auto">
        <button
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-surface-container-high text-on-surface-variant font-caption-bold text-caption-bold hover:bg-surface-container-highest hover:text-on-surface transition-colors shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
          disabled
          title="Coming soon"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
          <span>Cancel Run</span>
        </button>
        <button
          className="inline-flex items-center gap-2 px-4 py-2 rounded bg-primary text-on-primary font-caption-bold text-caption-bold hover:bg-primary-container transition-all shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
          disabled
          title="Coming soon"
        >
          <span className="material-symbols-outlined text-[18px]">verified</span>
          <span>Approve &amp; Generate All</span>
          <span className="font-label-caps text-[10px] text-on-surface-variant uppercase ml-1">Coming soon</span>
        </button>
      </div>
    </div>
  );
}
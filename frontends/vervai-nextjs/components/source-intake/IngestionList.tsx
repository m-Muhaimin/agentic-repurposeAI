import {
  SOURCE_TYPE_META,
  SOURCE_STATUS_LABEL,
  timeAgo,
  formatDuration,
  type SourceRow,
} from "@/lib/data";

const ACTIVE_STATUSES: SourceRow["status"][] = [
  "uploaded",
  "transcribing",
  "transcribed",
  "generating",
];

function InFlightRow({ source }: { source: SourceRow }) {
  const meta = `${SOURCE_TYPE_META[source.source_type].label}${
    source.duration_seconds ? ` • ${formatDuration(source.duration_seconds)}` : ""
  }`;
  return (
    <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
      <div className="flex items-center gap-space-md min-w-0">
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-primary text-[24px]">
            {SOURCE_TYPE_META[source.source_type].icon}
          </span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-headline-sm text-headline-sm text-on-surface truncate">
              {source.title}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-caption-bold text-caption-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              {SOURCE_STATUS_LABEL[source.status]}
            </span>
          </div>
          <p className="font-body-sm text-body-sm text-secondary mt-0.5">{meta}</p>
        </div>
      </div>
      <div className="flex flex-col md:items-end w-full md:w-auto gap-2 shrink-0">
        <div className="flex items-center justify-between md:justify-end gap-space-md w-full md:w-auto">
          <div className="flex items-center gap-3">
            <span className="font-label-caps text-label-caps text-secondary uppercase">
              Started {timeAgo(source.created_at)}
            </span>
            <span className="font-caption-bold text-caption-bold text-primary">In progress</span>
          </div>
          <button
            className="px-3 py-1.5 rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-caption-bold text-caption-bold transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
            disabled
            title="Coming soon"
          >
            Inspect Agent Log
          </button>
        </div>
        <div className="w-full md:w-64 h-2 rounded-full bg-surface-container overflow-hidden">
          <div className="h-full bg-primary/40 rounded-full animate-pulse"></div>
        </div>
      </div>
    </div>
  );
}

function ProcessedRow({ source }: { source: SourceRow }) {
  const outputCount = (source.outputs ?? []).length;
  const failed = source.status === "failed";
  const outputsLabel = failed
    ? "Failed to synthesize"
    : outputCount > 0
      ? `${outputCount} ${outputCount === 1 ? "output" : "outputs"} synthesized`
      : "No outputs yet";
  return (
    <div className="p-space-md rounded-xl bg-surface-container-lowest shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md hover:bg-surface-container-lowest/80 transition-colors">
      <div className="flex items-center gap-space-md min-w-0">
        <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-secondary text-[22px]">
            {SOURCE_TYPE_META[source.source_type].icon}
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-headline-sm text-headline-sm text-on-surface truncate">
            {source.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-body-sm text-body-sm text-secondary">
              {SOURCE_TYPE_META[source.source_type].label} • Ingested {timeAgo(source.created_at)}
            </span>
            <span className="text-outline-variant font-body-sm">•</span>
            <span className="font-caption-bold text-caption-bold text-tertiary bg-tertiary/10 px-2 py-0.5 rounded">
              {outputsLabel}
            </span>
          </div>
        </div>
      </div>
      <a
        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-surface-container-low hover:bg-primary hover:text-on-primary text-on-surface font-caption-bold text-caption-bold transition-all shadow-xs self-end md:self-auto"
        href="/workspace"
      >
        <span>Open Agent Workspace</span>
        <span className="material-symbols-outlined text-[15px]">arrow_outward</span>
      </a>
    </div>
  );
}

export default function IngestionList({ sources }: { sources: SourceRow[] }) {
  const inFlight = sources.filter((s) => ACTIVE_STATUSES.includes(s.status));
  const processed = sources.filter((s) => !ACTIVE_STATUSES.includes(s.status));
  return (
    <section className="space-y-space-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-headline-lg text-headline-lg text-on-surface">
            Recent Source Ingestions &amp; Active Queue
          </h2>
          <span className="px-2 py-0.5 rounded-full bg-surface-container font-label-caps text-label-caps text-secondary">
            {sources.length} Total
          </span>
        </div>
        <a
          className="font-caption-bold text-caption-bold text-primary hover:text-primary-container transition-colors flex items-center gap-1"
          href="/library"
        >
          <span>View full intake archive</span>
          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
        </a>
      </div>
      <div className="space-y-space-sm">
        {sources.length === 0 ? (
          <div className="rounded-lg bg-surface-container-lowest p-space-lg text-center text-secondary font-body-sm text-body-sm shadow-sm">
            No sources ingested yet. Upload an audio, video, or document to get started.
          </div>
        ) : (
          <>
            {inFlight.map((source) => (
              <InFlightRow key={source.id} source={source} />
            ))}
            {processed.map((source) => (
              <ProcessedRow key={source.id} source={source} />
            ))}
          </>
        )}
      </div>
    </section>
  );
}
type DagStage = {
  number: string;
  label: string;
  markerClass: string;
};

const DAG_STAGES: DagStage[] = [
  { number: "1", label: "Ingest", markerClass: "bg-primary text-on-primary shadow-sm" },
  { number: "2", label: "Understand", markerClass: "bg-surface-container-high text-on-surface" },
  { number: "3", label: "Intelligence", markerClass: "bg-surface-container-high text-on-surface" },
  { number: "4", label: "Opportunities", markerClass: "bg-secondary-container text-on-secondary-container" },
  { number: "5", label: "Recommend", markerClass: "bg-surface-container-high text-on-surface" },
  { number: "6", label: "Plan", markerClass: "bg-surface-container-high text-on-surface" },
  { number: "7", label: "Approval", markerClass: "bg-tertiary-container text-on-tertiary" },
];

export default function DagPipeline() {
  return (
    <div className="md:col-span-7 rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between overflow-hidden">
      <div>
        <div className="px-space-lg py-4 bg-surface-container-low flex items-center justify-between">
          <div className="flex items-center gap-space-sm">
            <div className="w-8 h-8 rounded-lg bg-secondary-container text-on-secondary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">alt_route</span>
            </div>
            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface">
                Autonomous Agent Architecture
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                The 7-stage directed acyclic graph (DAG) pipeline
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-caption-bold text-caption-bold">
            DAG Spec
          </span>
        </div>
        <div className="p-space-lg flex flex-col gap-space-md">
          <div className="p-space-md rounded-lg bg-surface-container-low overflow-x-auto">
            <div className="flex items-center justify-between min-w-[560px] gap-2">
              {DAG_STAGES.map((stage, index) => (
                <div key={stage.number} className="flex items-center gap-2 flex-1 last:flex-none">
                  <div className="flex flex-col items-center">
                    <span
                      className={`w-7 h-7 rounded-full font-caption-bold text-caption-bold flex items-center justify-center ${stage.markerClass}`}
                    >
                      {stage.number}
                    </span>
                    <span className="mt-1 font-caption-bold text-[10px] text-on-surface uppercase">
                      {stage.label}
                    </span>
                  </div>
                  {index < DAG_STAGES.length - 1 ? (
                    <div className="h-0.5 flex-1 bg-surface-container-high"></div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-caption-bold text-caption-bold text-on-surface-variant uppercase">
                Graph Rebuild Execution Endpoint
              </span>
              <span className="font-caption-bold text-caption-bold text-tertiary">
                Read endpoint
              </span>
            </div>
            <div className="p-space-sm rounded-lg bg-surface-container-low font-mono text-body-sm text-on-surface flex items-center justify-between shadow-inner">
              <div className="flex items-center gap-2 truncate">
                <span className="px-2 py-0.5 rounded bg-primary text-on-primary font-caption-bold text-[10px]">
                  GET
                </span>
                <span className="text-on-surface truncate">
                  /api/agent/runs/<span className="text-primary">{'{'}run_id{'}'}</span>/graph
                </span>
              </div>
              <button
                className="p-1 rounded hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Coming soon"
                type="button"
                disabled
              >
                <span className="material-symbols-outlined text-[16px]">content_copy</span>
              </button>
            </div>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Each graph state is checkpointed to localized Redis buckets. If an API exception or
            rate-limit triggers during Stage 4, VervAI automatically fallbacks to precomputed
            embeddings without rerunning ingestion.
          </p>
        </div>
      </div>
      <div className="px-space-lg py-3 bg-surface-container-low flex items-center justify-between">
        <span className="font-body-medium text-body-medium text-primary flex items-center gap-1 cursor-default">
          <span>Read complete DAG specification</span>
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </span>
      </div>
    </div>
  );
}
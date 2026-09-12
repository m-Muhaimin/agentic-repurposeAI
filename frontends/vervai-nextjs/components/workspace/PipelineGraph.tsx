export type PipelineStageState = "complete" | "selected" | "pending" | "queued";

export type PipelineStage = {
  state: PipelineStageState;
  icon: string;
  label: string;
  meta: string;
};

function NodeMarker({ node }: { node: PipelineStage }) {
  if (node.state === "selected") {
    return (
      <div className="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-lg mb-2 relative">
        <span className="material-symbols-outlined text-[24px]">{node.icon}</span>
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-tertiary"></span>
      </div>
    );
  }
  if (node.state === "pending") {
    return (
      <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center shadow-sm transition-transform group-hover:scale-110 mb-2">
        <span className="material-symbols-outlined text-[20px]">{node.icon}</span>
      </div>
    );
  }
  if (node.state === "queued") {
    return (
      <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-outline shadow-sm mb-2">
        <span className="material-symbols-outlined text-[20px]">{node.icon}</span>
      </div>
    );
  }
  return (
    <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-tertiary shadow-sm transition-transform group-hover:scale-110 mb-2">
      <span className="material-symbols-outlined text-[20px]">{node.icon}</span>
    </div>
  );
}

function NodeCard({ node, index }: { node: PipelineStage; index: number }) {
  const selected = node.state === "selected";
  return (
    <div
      className={`relative z-10 flex flex-col items-center cursor-pointer ${selected ? "scale-105" : "group"} ${node.state === "queued" ? "opacity-60" : ""}`}
    >
      <NodeMarker node={node} />
      <div
        className={`w-36 ${selected ? "bg-surface-container-highest rounded-lg p-2.5 text-center shadow-md" : "bg-surface-container-low rounded p-2 text-center shadow-sm"} ${node.state === "pending" ? "opacity-90" : ""}`}
      >
        <span
          className={`font-label-caps text-[10px] uppercase tracking-wider block font-bold ${
            selected
              ? "text-primary"
              : node.state === "complete"
                ? "text-tertiary"
                : node.state === "pending"
                  ? "text-secondary"
                  : "text-outline"
          }`}
        >
          {selected ? `Stage ${index + 1} • Current` : `Stage ${index + 1}`}
        </span>
        <p className="font-caption-bold text-caption-bold text-on-surface truncate">{node.label}</p>
        <p
          className={`font-body-sm text-[11px] truncate mt-0.5 ${selected ? "text-on-surface-variant" : node.state === "queued" ? "text-outline" : "text-secondary"}`}
        >
          {node.meta || "—"}
        </p>
      </div>
    </div>
  );
}

export default function PipelineGraph({
  stages,
  runStatus,
}: {
  stages: PipelineStage[];
  runStatus: string | null;
}) {
  const advancedCount = stages.filter(
    (s) => s.state === "complete" || s.state === "selected",
  ).length;
  const progressX =
    stages.length > 0 ? 60 + (880 * advancedCount) / stages.length : 60;
  const rightLabel = runStatus ? `Latest run: ${runStatus}` : "No active agent run";

  return (
    <section className="relative w-full rounded-xl bg-surface-container-lowest p-space-lg shadow-sm mb-space-lg overflow-hidden">
      <div className="flex items-center justify-between mb-space-md pb-space-sm bg-surface-container-low/40 -mx-space-lg -mt-space-lg px-space-lg py-space-sm">
        <div className="flex items-center gap-space-sm">
          <div className="w-2 h-2 rounded-full bg-primary"></div>
          <span className="font-headline-sm text-headline-sm text-on-surface">
            Interactive Synthesis Graph
          </span>
          <span className="font-label-caps text-label-caps text-secondary uppercase tracking-wider ml-2 bg-surface-container px-2 py-0.5 rounded">
            {stages.length} {stages.length === 1 ? "stage" : "stages"}
          </span>
        </div>
        <div className="flex items-center gap-space-xs text-secondary font-label-caps text-label-caps">
          <span className="material-symbols-outlined text-[16px] text-tertiary">lock_reset</span>
          <span>{rightLabel}</span>
        </div>
      </div>
      <div className="relative w-full overflow-x-auto py-space-md select-none">
        {stages.length > 0 ? (
          <div className="min-w-[1080px] flex items-center justify-between relative px-2">
            <svg
              className="absolute top-1/2 left-0 right-0 w-full h-8 -translate-y-1/2 pointer-events-none z-0"
              fill="none"
              preserveAspectRatio="none"
              viewBox="0 0 1000 32"
            >
              <line
                className="text-surface-variant"
                stroke="currentColor"
                strokeDasharray="4 4"
                strokeWidth={2}
                x1={60}
                x2={940}
                y1={16}
                y2={16}
              />
              <line
                className="text-primary"
                stroke="currentColor"
                strokeWidth={2}
                x1={60}
                x2={progressX}
                y1={16}
                y2={16}
              />
              <polygon
                className="fill-primary"
                points={`${progressX},16 ${progressX - 8},12 ${progressX - 8},20`}
              />
            </svg>
            {stages.map((node, i) => (
              <NodeCard key={`${node.label}-${i}`} node={node} index={i} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg bg-surface-container-low p-space-lg text-center text-secondary font-body-sm text-body-sm">
            No pipeline stages yet. Ingest a source or run the agent to populate the synthesis
            graph.
          </div>
        )}
      </div>
    </section>
  );
}
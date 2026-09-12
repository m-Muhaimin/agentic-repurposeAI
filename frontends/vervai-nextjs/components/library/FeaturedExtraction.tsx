import ApproveQueueButton from "@/components/library/ApproveQueueButton";

export type FeaturedSource = {
  title: string;
  sourceTypeLabel: string;
  formats: string[];
  wordCount: number;
  minutes: number;
  outputCount: number;
  needsReview: boolean;
  featuredIdeaId: string | null;
};

export default function FeaturedExtraction({
  source = null,
}: {
  source?: FeaturedSource | null;
}) {
  if (!source) {
    return (
      <div className="lg:col-span-8 flex flex-col justify-between rounded-xl bg-surface-container-lowest p-space-lg shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="space-y-space-md relative z-10">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-surface-container text-[11px] font-caption-bold text-on-surface-variant">
            <span className="material-symbols-outlined text-[14px] text-primary">psychology</span>
            <span>FEATURED EXTRACTION</span>
          </div>
          <h2 className="font-headline-lg text-headline-lg lg:text-display-xl lg:font-display-xl text-on-surface tracking-tight leading-snug">
            Nothing extracted yet
          </h2>
          <p className="font-body-base text-body-base text-on-surface-variant max-w-2xl">
            Once a source finishes transcription and generation, its headline asset appears here.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="lg:col-span-8 flex flex-col justify-between rounded-xl bg-surface-container-lowest p-space-lg shadow-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
      <div className="space-y-space-md relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-space-xs">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-surface-container text-[11px] font-caption-bold text-on-surface-variant">
            <span className="material-symbols-outlined text-[14px] text-primary">psychology</span>
            <span>SYNTHESIZED FROM {source.title.toUpperCase()}</span>
          </div>
          {source.needsReview && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[11px] font-caption-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
              <span>Needs Human Review</span>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-primary-fixed text-on-primary-fixed font-label-caps text-[10px] uppercase font-bold tracking-wider">
              {source.formats.join(" • ")}
            </span>
            <span className="text-secondary font-body-sm text-body-sm">
              • {source.sourceTypeLabel}
            </span>
          </div>
          <h2 className="font-headline-lg text-headline-lg lg:text-display-xl lg:font-display-xl text-on-surface tracking-tight leading-snug">
            {source.title}
          </h2>
          <p className="font-body-base text-body-base text-on-surface-variant line-clamp-2 max-w-2xl">
            {source.outputCount} synthesized{" "}
            {source.outputCount === 1 ? "deliverable" : "deliverables"} generated from this source
            node, ready for editing and distribution.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-space-sm py-space-xs bg-surface-container-low/60 rounded-lg px-space-md">
          <div>
            <p className="font-label-caps text-label-caps uppercase text-secondary">Length</p>
            <p className="font-headline-sm text-headline-sm text-on-surface">
              {source.wordCount} <span className="text-secondary font-normal text-xs">words</span>
            </p>
          </div>
          <div>
            <p className="font-label-caps text-label-caps uppercase text-secondary">
              Formats Generated
            </p>
            <p className="font-headline-sm text-headline-sm text-tertiary">{source.formats.length}</p>
          </div>
          <div>
            <p className="font-label-caps text-label-caps uppercase text-secondary">
              Key Takeaways
            </p>
            <p className="font-headline-sm text-headline-sm text-on-surface">
              {source.outputCount}{" "}
              {source.minutes ? (
                <span className="text-secondary font-normal text-xs">• {source.minutes} min</span>
              ) : null}
            </p>
          </div>
        </div>
      </div>
      <div className="pt-space-md mt-space-md flex flex-wrap items-center justify-between gap-space-sm bg-surface-container-lowest relative z-10">
        <div className="flex items-center gap-space-xs">
          <button
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-on-primary font-caption-bold text-caption-bold shadow-xs hover:bg-primary-container active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
            disabled
            title="Coming soon"
          >
            <span className="material-symbols-outlined text-[16px]">edit_note</span>
            <span>Open in Editor</span>
            <span className="font-label-caps text-[10px] text-on-surface-variant uppercase ml-1">Coming soon</span>
          </button>
          <ApproveQueueButton ideaId={source.featuredIdeaId} />
        </div>
        <button
          className="inline-flex items-center gap-1 text-secondary hover:text-on-surface font-caption-bold text-caption-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
          disabled
          title="Coming soon"
        >
          <span className="material-symbols-outlined text-[16px]">account_tree</span>
          <span>Compare with Source Node</span>
        </button>
      </div>
    </div>
  );
}
import SearchInput from "@/components/ui/SearchInput";
import LibraryFilterBar from "./LibraryFilterBar";

export default function LibraryHeader({
  counts,
}: {
  counts?: Partial<Record<string, number>>;
}) {
  return (
    <section className="flex flex-col gap-y-space-md">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-md">
        <div>
          <div className="inline-flex items-center gap-2 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-tertiary"></span>
            <span className="font-label-caps text-label-caps uppercase text-secondary tracking-widest">
              Autonomous Pipeline • Repository
            </span>
          </div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
            Content Library
          </h1>
          <p className="font-body-base text-body-base text-secondary mt-1">
            Everything VervAI has synthesized, refined, and packaged from your source nodes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-space-sm shrink-0">
          <div className="relative flex items-center">
            <SearchInput
              placeholder="Filter by hook, topic, or source..."
              className="w-64 [&_input]:h-9 [&_input]:pl-9 [&_input]:pr-10 [&_input]:rounded-lg [&_input]:bg-surface-container-lowest"
            />
            <span className="absolute right-2.5 font-label-caps text-[10px] text-secondary bg-surface-container-high px-1 py-0.5 rounded pointer-events-none">
              ⌘F
            </span>
          </div>
          <button
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-primary text-on-primary font-caption-bold text-caption-bold shadow-xs hover:bg-primary-container active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
            disabled
            title="Coming soon"
          >
            <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
            <span>+ New Extraction</span>
            <span className="font-label-caps text-[10px] text-on-surface-variant uppercase ml-1">Coming soon</span>
          </button>
        </div>
      </div>
      <LibraryFilterBar counts={counts} />
    </section>
  );
}
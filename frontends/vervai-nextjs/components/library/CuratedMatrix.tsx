import ContentCard, { type ContentCardItem } from "./ContentCard";

export default function CuratedMatrix({
  items = [],
}: {
  items?: ContentCardItem[];
}) {
  return (
    <section className="space-y-space-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-headline-md text-headline-md text-on-surface">Curated Matrix</span>
          <span className="text-secondary text-body-sm font-medium">(Selected Extracts)</span>
        </div>
        <div className="flex items-center gap-2 text-secondary font-caption-bold text-caption-bold">
          <span>Sort by:</span>
          <button className="text-on-surface inline-flex items-center gap-0.5 hover:underline" type="button">
            Confidence Index
            <span className="material-symbols-outlined text-[14px]">unfold_more</span>
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-lg">
        {items.length > 0 ? (
          items.map((item) => (
            <ContentCard key={item.title} item={item} />
          ))
        ) : (
          <div className="lg:col-span-3 rounded-xl bg-surface-container-lowest p-space-lg text-center text-secondary font-body-sm text-body-sm">
            No curated extracts yet — generated outputs will appear here.
          </div>
        )}
      </div>
    </section>
  );
}
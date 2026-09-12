type ChangelogEntry = {
  dotClass: string;
  title: string;
  time: string;
  description: string;
};

const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    dotClass: "bg-primary",
    title: "Speaker Diarization",
    time: "Core",
    description:
      "Overlapping speaker isolation and noise reduction for multi-guest recordings.",
  },
  {
    dotClass: "bg-secondary",
    title: "Blueprint Clustering",
    time: "Core",
    description:
      "Auto-groups key topics across long episodes into singular editorial arches.",
  },
  {
    dotClass: "bg-tertiary",
    title: "Zero-Egress Vector Vault",
    time: "Core",
    description:
      "Isolated storage ensuring no model training on your input transcripts.",
  },
];

export default function ChangelogPanel() {
  return (
    <div className="md:col-span-4 rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between overflow-hidden">
      <div>
        <div className="px-space-lg py-4 bg-surface-container-low flex items-center justify-between">
          <div className="flex items-center gap-space-sm">
            <div className="w-8 h-8 rounded-lg bg-surface-container-high text-on-surface flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">history</span>
            </div>
            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface">Product Highlights</h2>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded bg-tertiary-container text-on-tertiary font-caption-bold text-caption-bold">
            NEW
          </span>
        </div>
        <div className="p-space-lg flex flex-col gap-space-md">
          {CHANGELOG_ENTRIES.map((entry) => (
            <div key={entry.title} className="relative pl-4 flex flex-col gap-1">
              <div className={`absolute left-0 top-1.5 w-2 h-2 rounded-full ${entry.dotClass}`}></div>
              <div className="flex items-center justify-between">
                <span className="font-caption-bold text-caption-bold text-on-surface">
                  {entry.title}
                </span>
                <span className="text-on-surface-variant font-caption-bold text-[10px]">
                  {entry.time}
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">{entry.description}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="px-space-lg py-3 bg-surface-container-low flex items-center justify-between">
        <span className="font-body-medium text-body-medium text-primary flex items-center gap-1 cursor-default">
          <span>Read All Release Notes</span>
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </span>
      </div>
    </div>
  );
}
type NegativeVocabularyProps = {
  phrases: string[];
};

export default function NegativeVocabulary({ phrases }: NegativeVocabularyProps) {
  return (
    <div className="lg:col-span-4 bg-surface-container-lowest rounded-xl shadow-sm p-space-lg flex flex-col justify-between space-y-space-md">
      <div className="space-y-space-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-error text-[20px]">block</span>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">
              Negative Vocabulary
            </h3>
          </div>
          <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-caption-bold text-caption-bold">
            {phrases.length} {phrases.length === 1 ? "block" : "blocks"}
          </span>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Phrases excluded from generated copy, based on your saved agent preferences.
        </p>
        {phrases.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-space-xs">
            {phrases.map((phrase) => (
              <span
                key={phrase}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-surface-container-high text-on-surface font-caption-bold text-caption-bold"
              >
                {phrase}
              </span>
            ))}
          </div>
        ) : (
          <p className="font-body-sm text-body-sm text-on-surface-variant pt-space-xs">
            No forbidden phrases configured.
          </p>
        )}
      </div>
      <div className="p-space-md rounded-xl bg-surface-container-low flex items-start gap-space-sm">
        <span className="material-symbols-outlined text-primary text-[18px] mt-0.5">info</span>
        <p className="font-body-sm text-[12px] text-on-surface-variant leading-tight">
          Manage forbidden phrases from your Agent Preferences screen.
        </p>
      </div>
    </div>
  );
}
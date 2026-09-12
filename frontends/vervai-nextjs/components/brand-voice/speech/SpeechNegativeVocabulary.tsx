type SpeechNegativeVocabularyProps = {
  phrases: string[];
};

export default function SpeechNegativeVocabulary({ phrases }: SpeechNegativeVocabularyProps) {
  return (
    <div className="lg:col-span-4 flex flex-col bg-surface-container-lowest rounded-xl p-space-lg shadow-sm">
      <div className="flex items-center justify-between pb-space-sm">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-error">block</span>
          <h2 className="font-headline-md text-headline-md text-on-surface">
            Negative Vocabulary
          </h2>
        </div>
        <span className="font-caption-bold text-caption-bold px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
          {phrases.length} {phrases.length === 1 ? "block" : "blocks"}
        </span>
      </div>
      <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-md">
        Phrases excluded from generated copy, based on your saved agent preferences.
      </p>
      {phrases.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 flex-1 content-start mb-space-md">
          {phrases.map((word) => (
            <span
              key={word}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container font-caption-bold text-caption-bold text-on-surface"
            >
              {word}
            </span>
          ))}
        </div>
      ) : (
        <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-md">
          No forbidden phrases configured.
        </p>
      )}
      <div className="mt-auto p-3.5 rounded-xl bg-surface-container-low flex items-start gap-3">
        <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">
          info
        </span>
        <p className="font-body-sm text-[12px] text-on-surface-variant leading-snug block">
          Manage forbidden phrases from your Agent Preferences screen.
        </p>
      </div>
    </div>
  );
}
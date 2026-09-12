export default function SpeechHeader() {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md pb-space-lg">
      <div className="space-y-1.5 max-w-3xl">
        <div className="flex items-center gap-2">
          <span className="font-label-caps text-label-caps uppercase text-outline tracking-wider">
            Workspace
          </span>
          <span className="text-outline-variant font-caption-bold text-caption-bold">/</span>
          <span className="font-label-caps text-label-caps uppercase text-primary font-bold tracking-wider">
            Brand Architecture &amp; Identity
          </span>
        </div>
        <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
          Brand Voice &amp; Tone Engine
        </h1>
        <p className="font-body-base text-body-medium text-on-surface-variant leading-relaxed">
          Teach VervAI how you sound. Calibrate cadence, tonal boundaries, vocabulary constraints,
          and reference samples so synthesized outputs reliably preserve authentic founder
          conviction.
        </p>
      </div>
      <div className="flex items-center gap-space-sm shrink-0">
        <button
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-body-medium text-body-medium transition-colors shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
          disabled
          title="Coming soon"
        >
          <span className="material-symbols-outlined text-[18px] text-primary">model_training</span>
          <span>Test Cadence</span>
        </button>
        <button
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-container hover:bg-primary text-on-primary font-body-medium text-body-medium transition-all shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
          disabled
          title="Coming soon"
        >
          <span className="material-symbols-outlined text-[18px]">save</span>
          <span>Save Parameters</span>
          <span className="font-label-caps text-[10px] text-on-surface-variant uppercase ml-1">Coming soon</span>
        </button>
      </div>
    </div>
  );
}
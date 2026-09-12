export default function BrandVoiceHeader() {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md mb-space-lg">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-label-caps text-label-caps text-outline tracking-wider uppercase">
            Workspace
          </span>
          <span className="text-outline-variant font-caption-bold text-caption-bold">/</span>
          <span className="font-label-caps text-label-caps text-primary tracking-wider uppercase">
            Brand Architecture &amp; Identity
          </span>
        </div>
        <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
          Brand Voice &amp; Tone Engine
        </h1>
        <p className="font-body-medium text-body-medium text-on-surface-variant max-w-2xl">
          Teach VervAI how you sound. Define your cadence, tonal boundaries, vocabulary
          constraints, and reference samples so synthesized outputs match founder conviction.
        </p>
      </div>
      <div className="flex items-center gap-space-sm self-start md:self-auto shrink-0">
        <button
          className="flex items-center gap-2 px-space-md py-2.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-body-medium text-body-medium shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
          disabled
          title="Coming soon"
        >
          <span className="material-symbols-outlined text-[18px] text-primary">model_training</span>
          <span>Test Cadence with AI Evaluator</span>
        </button>
        <button
          className="flex items-center gap-2 px-space-md py-2.5 rounded-lg bg-primary-container hover:bg-primary text-on-primary font-body-medium text-body-medium shadow-[0_2px_8px_rgba(42,77,255,0.25)] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
          disabled
          title="Coming soon"
        >
          <span className="material-symbols-outlined text-[18px]">check</span>
          <span>Save Parameters</span>
          <span className="font-label-caps text-[10px] text-on-surface-variant uppercase ml-1">Coming soon</span>
        </button>
      </div>
    </div>
  );
}
export default function IntakeHeader() {
  return (
    <section className="flex flex-col md:flex-row md:items-end justify-between gap-space-md mb-space-xl pb-space-md">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-label-caps text-label-caps uppercase text-secondary tracking-wider">
            Platform
          </span>
          <span className="text-outline-variant font-label-caps text-label-caps">/</span>
          <span className="font-label-caps text-label-caps uppercase text-primary tracking-wider">
            Source Intake
          </span>
        </div>
        <h1 className="font-display-xl text-display-xl text-on-surface tracking-tight">
          Source Intake
        </h1>
        <p className="font-body-medium text-body-medium text-secondary max-w-2xl">
          Bring your raw audio, video, document, or URL. VervAI analyzes the material and extracts
          high-leverage content opportunities.
        </p>
      </div>
      <div className="flex items-center gap-space-sm self-start md:self-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-surface-container-low shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-tertiary"></span>
          </span>
          <span className="font-caption-bold text-caption-bold text-on-surface">
            Autonomous Pipeline Active
          </span>
          <span className="font-label-caps text-label-caps text-outline bg-surface-container px-1.5 py-0.5 rounded">
            v3.4-LLM
          </span>
        </div>
      </div>
    </section>
  );
}
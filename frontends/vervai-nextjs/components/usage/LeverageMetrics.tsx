type Props = {
  sourceCount: number;
  outputCount: number;
  jobCount: number;
  ideaCount: number;
  approvedIdeas: number;
};

export default function LeverageMetrics({
  sourceCount,
  outputCount,
  jobCount,
  ideaCount,
  approvedIdeas,
}: Props) {
  const outputPerSource =
    sourceCount > 0 ? (outputCount / sourceCount).toFixed(1) : "0";
  const approvalRate =
    ideaCount > 0 ? Math.round((approvedIdeas / ideaCount) * 100) : 0;
  const totalActivity = sourceCount + outputCount + jobCount;

  return (
    <div className="lg:col-span-5 rounded-xl bg-surface-container-lowest shadow-sm p-space-md flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-space-sm">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">
              Operational Leverage &amp; Yield
            </h2>
            <p className="font-body-sm text-body-sm text-secondary">
              Efficiency metrics across your content pipeline
            </p>
          </div>
          <div className="w-7 h-7 rounded bg-tertiary-fixed flex items-center justify-center text-on-tertiary-fixed">
            <span className="material-symbols-outlined text-[18px]">
              trending_up
            </span>
          </div>
        </div>
        <div className="space-y-space-md mt-4">
          <div className="p-space-sm rounded-lg bg-surface-container-low transition-colors hover:bg-surface-container">
            <div className="flex items-baseline justify-between">
              <span className="font-display-xl text-display-xl font-bold text-primary">
                {outputPerSource}x
              </span>
              <span className="font-label-caps text-[10px] px-2 py-0.5 rounded font-semibold bg-primary-fixed text-on-primary-fixed">
                Output Ratio
              </span>
            </div>
            <h3 className="font-caption-bold text-caption-bold text-on-surface mt-1">
              Outputs per Source
            </h3>
            <p className="font-body-sm text-body-sm text-secondary mt-0.5 leading-snug">
              Average deliverables produced per ingested source.
            </p>
          </div>
          <div className="p-space-sm rounded-lg bg-surface-container-low transition-colors hover:bg-surface-container">
            <div className="flex items-baseline justify-between">
              <span
                className={`font-display-xl text-display-xl font-bold ${ideaCount > 0 ? "text-tertiary" : "text-outline"}`}
              >
                {ideaCount > 0 ? `${approvalRate}%` : "—"}
              </span>
              <span className="font-label-caps text-[10px] px-2 py-0.5 rounded font-semibold bg-tertiary-fixed text-on-tertiary-fixed">
                Approval
              </span>
            </div>
            <h3 className="font-caption-bold text-caption-bold text-on-surface mt-1">
              First-Pass Approval Rate
            </h3>
            <p className="font-body-sm text-body-sm text-secondary mt-0.5 leading-snug">
              {ideaCount > 0
                ? `${approvedIdeas} of ${ideaCount} ideas approved.`
                : "No ideas submitted yet."}
            </p>
          </div>
          <div className="p-space-sm rounded-lg bg-surface-container-low transition-colors hover:bg-surface-container">
            <div className="flex items-baseline justify-between">
              <span className="font-display-xl text-display-xl font-bold text-on-surface">
                {totalActivity}
              </span>
              <span className="font-label-caps text-[10px] px-2 py-0.5 rounded font-semibold bg-surface-container-highest text-secondary">
                Total Events
              </span>
            </div>
            <h3 className="font-caption-bold text-caption-bold text-on-surface mt-1">
              Pipeline Activity
            </h3>
            <p className="font-body-sm text-body-sm text-secondary mt-0.5 leading-snug">
              Combined sources, outputs, and distribution jobs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
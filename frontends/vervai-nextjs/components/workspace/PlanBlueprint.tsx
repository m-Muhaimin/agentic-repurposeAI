export type BlueprintStep = {
  monogram: string;
  title: string;
  audience: string | null;
  length: string | null;
  excerpt: string | null;
  tags: { icon: string; label: string }[];
};

const MONOGRAM_TONES = [
  "bg-primary text-on-primary",
  "bg-tertiary text-on-tertiary",
  "bg-secondary text-on-secondary",
];

export default function PlanBlueprint({
  steps,
  runStatus,
}: {
  steps: BlueprintStep[];
  runStatus: string | null;
}) {
  const count = steps.length;
  return (
    <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between flex-1">
      <div>
        <div className="flex items-start justify-between mb-space-md pb-space-sm bg-surface-container-low -mx-space-lg -mt-space-lg px-space-lg py-space-sm rounded-t-xl">
          <div className="flex items-center gap-space-sm">
            <span className="material-symbols-outlined text-[20px] text-primary">splitscreen</span>
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface">
                Active Plan Blueprint: {count} {count === 1 ? "Output" : "Outputs"}
              </h2>
              <p className="font-body-sm text-body-sm text-secondary">
                Target output architecture from the latest agent run plan
              </p>
            </div>
          </div>
          <span className="font-label-caps text-label-caps bg-primary-fixed text-on-primary-fixed px-2 py-0.5 rounded uppercase">
            {runStatus ?? "No plan"}
          </span>
        </div>
        {steps.length > 0 ? (
          <div className="space-y-space-sm">
            {steps.map((output, i) => (
              <div
                key={`${output.title}-${i}`}
                className="p-space-md rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-5 h-5 rounded flex items-center justify-center text-[11px] font-bold ${MONOGRAM_TONES[i % MONOGRAM_TONES.length]}`}
                    >
                      {output.monogram}
                    </span>
                    <span className="font-caption-bold text-caption-bold text-on-surface">
                      {output.title}
                    </span>
                    {output.audience ? (
                      <span className="font-label-caps text-label-caps px-2 py-0.5 rounded bg-surface-container-high text-secondary">
                        {output.audience}
                      </span>
                    ) : null}
                  </div>
                  {output.length ? (
                    <span className="font-label-caps text-label-caps text-secondary">
                      {output.length}
                    </span>
                  ) : null}
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">
                  {output.excerpt ?? "No description provided for this step."}
                </p>
                {output.tags.length > 0 ? (
                  <div className="flex items-center gap-space-md mt-2 pt-2 text-[11px] font-caption-bold text-secondary">
                    {output.tags.map((tag) => (
                      <span key={tag.label} className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">{tag.icon}</span>
                        {tag.label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg bg-surface-container-low p-space-lg text-center text-secondary font-body-sm text-body-sm">
            No plan generated yet. Run the agent on an ingested source to produce a target-output
            blueprint.
          </div>
        )}
      </div>
      <div className="flex items-center justify-between pt-space-md mt-space-md bg-surface-container-low -mx-space-lg -mb-space-lg px-space-lg py-space-sm rounded-b-xl">
        <button
          className="inline-flex items-center gap-1.5 text-secondary hover:text-on-surface font-caption-bold text-caption-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
          disabled
          title="Coming soon"
        >
          <span className="material-symbols-outlined text-[16px]">tune</span>
          <span>Modify Plan Prompts</span>
        </button>
        <div className="flex items-center gap-space-sm">
          <button
            className="px-3 py-1.5 rounded bg-surface-container-high text-on-surface font-caption-bold text-caption-bold hover:bg-surface-container-highest transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
            disabled
            title="Coming soon"
          >
            Regenerate Plan
          </button>
          <button
            className="px-4 py-1.5 rounded bg-primary text-on-primary font-caption-bold text-caption-bold hover:bg-primary-container transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
            disabled
            title="Coming soon"
          >
            Approve Plan
            <span className="font-label-caps text-[10px] text-on-surface-variant uppercase ml-1">Coming soon</span>
          </button>
        </div>
      </div>
    </div>
  );
}
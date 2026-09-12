type QuickstartStep = {
  number: string;
  icon: string;
  title: string;
  description: string;
  docs: string;
};

const QUICKSTART_STEPS: QuickstartStep[] = [
  {
    number: "01",
    icon: "upload_file",
    title: "Source Intake",
    description:
      "Connect Zoom records, YouTube feeds, or RAW WAV files. Supports automatic speaker separation.",
    docs: "Docs: /ingest/v3",
  },
  {
    number: "02",
    icon: "account_tree",
    title: "Agent Graph Execution",
    description:
      "LangGraph pipelines extract thematic clusters, structural hooks, and high-impact soundbites.",
    docs: "Docs: /pipeline/graph",
  },
  {
    number: "03",
    icon: "verified_user",
    title: "Human Guardrails",
    description:
      "Deterministic checks, tone-deviation alerts, and high-touch approval review gates.",
    docs: "Docs: /safety/gates",
  },
  {
    number: "04",
    icon: "send_and_archive",
    title: "Multi-Platform Dispatch",
    description:
      "Autonomous scheduled publishing to Substack, X threads, LinkedIn, and internal Slack memos.",
    docs: "Docs: /dispatch/relays",
  },
];

export default function QuickstartWorkflows() {
  return (
    <div className="md:col-span-12 rounded-xl bg-surface-container-lowest shadow-sm overflow-hidden flex flex-col">
      <div className="px-space-lg py-4 bg-surface-container-low flex flex-wrap items-center justify-between gap-space-sm">
        <div className="flex items-center gap-space-sm">
          <div className="w-8 h-8 rounded-lg bg-primary-container text-on-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px]">play_arrow</span>
          </div>
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">
              Quickstart & Core Workflows
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Step-by-step lifecycle from raw multimedia ingestion to omnichannel propagation
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-caption-bold text-caption-bold text-on-surface-variant uppercase">
            Estimated onboarding: 6 mins
          </span>
          <span className="px-2 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed font-caption-bold text-caption-bold">
            Production Ready
          </span>
        </div>
      </div>
      <div className="p-space-lg grid grid-cols-1 md:grid-cols-4 gap-space-md">
        {QUICKSTART_STEPS.map((step) => (
          <div
            key={step.number}
            className="p-space-md rounded-lg bg-surface-container-low flex flex-col justify-between hover:bg-surface-container transition-all group cursor-pointer shadow-sm"
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-headline-sm text-headline-sm text-primary">{step.number}</span>
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant group-hover:text-primary transition-colors">
                  {step.icon}
                </span>
              </div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">{step.title}</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {step.description}
              </p>
            </div>
            <div className="mt-4 pt-3 flex items-center justify-between text-on-surface-variant font-caption-bold text-caption-bold">
              <span>{step.docs}</span>
              <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform text-primary">
                arrow_forward
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
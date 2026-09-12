type ProtocolStep = {
  number: string;
  title: string;
  description: string;
  active?: boolean;
};

const PROTOCOL_STEPS: ProtocolStep[] = [
  {
    number: "01",
    title: "Deep Ingestion & Transcription",
    description:
      "Multi-pass phonetic alignment, automatic timestamping, and exact speaker diarization isolate contextual shifts.",
  },
  {
    number: "02",
    title: "Semantic Graph Embedding",
    description:
      "Entities, theses, and technical arguments convert directly into localized high-dimensional vector memory.",
  },
  {
    number: "03",
    title: "Opportunity Matrix Formulation",
    description:
      "VervAI identifies target narratives, hook variations, and channel-native structures automatically.",
    active: true,
  },
];

export default function IntakeProtocol() {
  return (
    <div className="lg:col-span-4 flex flex-col justify-between p-space-xl bg-surface-container-lowest rounded-xl shadow-sm relative">
      <div>
        <div className="flex items-center justify-between mb-space-lg pb-space-sm">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary"></span>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">
              Autonomous Intake Protocol
            </h3>
          </div>
          <span className="font-label-caps text-label-caps uppercase text-secondary">
            Zero-Config
          </span>
        </div>
        <div className="space-y-space-lg relative">
          {PROTOCOL_STEPS.map((step) => (
            <div key={step.number} className="flex items-start gap-space-md">
              <div
                className={
                  step.active
                    ? "w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0 font-label-caps text-label-caps mt-0.5 shadow-xs"
                    : "w-7 h-7 rounded-full bg-surface-container-high flex items-center justify-center shrink-0 font-label-caps text-label-caps text-on-surface mt-0.5"
                }
              >
                {step.number}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-headline-sm text-[14px] text-on-surface">{step.title}</p>
                <p className="font-body-sm text-body-sm text-secondary mt-0.5">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-space-xl p-space-md rounded-lg bg-surface-container-low shadow-xs space-y-2">
        <div className="flex items-center gap-1.5 text-primary">
          <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
          <span className="font-caption-bold text-caption-bold">Direct Synthesis Path</span>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
          No output setup needed here. Once ingestion finishes, VervAI opens the specialized
          synthesis space with ranked content proposals ready for validation.
        </p>
      </div>
    </div>
  );
}
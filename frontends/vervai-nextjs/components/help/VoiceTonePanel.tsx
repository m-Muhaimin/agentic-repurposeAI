type VoiceMetric = {
  title: string;
  value: string;
  valueClass: string;
  description?: string;
  barWidth?: string;
};

const VOICE_METRICS: VoiceMetric[] = [
  {
    title: "Founder Conviction Vector",
    value: "0.942 Cosine",
    valueClass: "text-primary font-mono",
    barWidth: "94%",
  },
  {
    title: "Negative Vocabulary Interception",
    value: "142 Rules Active",
    valueClass: "text-tertiary font-mono",
    description:
      'Filters buzzwords ("synergy", "paradigm shift", "game-changer") via regex lookup before generation commit.',
  },
  {
    title: "LoRA Adapter Weights",
    value: "r=16, alpha=32",
    valueClass: "text-secondary font-mono",
    description:
      "Trained on verified previous newsletters, podcast scripts, and executive memo samples.",
  },
];

export default function VoiceTonePanel() {
  return (
    <div className="md:col-span-5 rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between overflow-hidden">
      <div>
        <div className="px-space-lg py-4 bg-surface-container-low flex items-center justify-between">
          <div className="flex items-center gap-space-sm">
            <div className="w-8 h-8 rounded-lg bg-tertiary-fixed text-on-tertiary-fixed flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">record_voice_over</span>
            </div>
            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface">
                Voice & Tone Engineering
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                LoRA fine-tuning & token guardrails
              </p>
            </div>
          </div>
        </div>
        <div className="p-space-lg flex flex-col gap-space-md">
          <div className="space-y-3">
            {VOICE_METRICS.map((metric) => (
              <div key={metric.title} className="p-3 rounded-lg bg-surface-container-low flex flex-col gap-1">
                <div className="flex items-center justify-between font-caption-bold text-caption-bold">
                  <span className="text-on-surface">{metric.title}</span>
                  <span className={metric.valueClass}>{metric.value}</span>
                </div>
                {metric.barWidth ? (
                  <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
                    <div className="bg-primary h-full rounded-full" style={{ width: metric.barWidth }}></div>
                  </div>
                ) : null}
                {metric.description ? (
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    {metric.description}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="px-space-lg py-3 bg-surface-container-low flex items-center justify-between">
        <span className="font-body-medium text-body-medium text-primary flex items-center gap-1 cursor-default">
          <span>Tune Voice Calibration Vector</span>
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </span>
      </div>
    </div>
  );
}
import ToneSliders from "./ToneSliders";

type VoiceProfilePanelProps = {
  brandTone: string | null;
  examples: string[];
};

export default function VoiceProfilePanel({ brandTone, examples }: VoiceProfilePanelProps) {
  const configured = Boolean(brandTone?.trim());

  return (
    <div className="lg:col-span-8 bg-surface-container-lowest rounded-xl shadow-sm p-space-lg space-y-space-lg">
      <div className="flex flex-wrap items-center justify-between gap-space-sm pb-space-sm">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-headline-md text-headline-md text-on-surface">
              Brand Voice Profile
            </span>
            <span
              className={`px-2 py-0.5 rounded-full font-caption-bold text-caption-bold ${
                configured
                  ? "bg-secondary-container text-on-secondary-fixed"
                  : "bg-surface-container text-on-surface-variant"
              }`}
            >
              {configured ? "Configured" : "Not configured"}
            </span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Tone profile loaded from your saved agent preferences.
          </p>
        </div>
      </div>
      <div className="p-space-md bg-surface-container-low rounded-xl">
        <span className="font-label-caps text-label-caps text-outline uppercase tracking-wider">
          Brand Tone
        </span>
        {configured ? (
          <p className="font-body-medium text-body-medium text-on-surface whitespace-pre-wrap mt-1">
            {brandTone}
          </p>
        ) : (
          <p className="font-body-medium text-body-medium text-on-surface-variant mt-1">
            No brand tone configured.
          </p>
        )}
      </div>
      <ToneSliders />
      <div className="space-y-space-sm">
        <div className="flex items-center justify-between">
          <span className="font-headline-sm text-headline-sm text-on-surface">Brand Examples</span>
          <span className="font-caption-bold text-caption-bold text-primary font-semibold">
            {examples.length}
          </span>
        </div>
        {examples.length > 0 ? (
          <div className="space-y-2">
            {examples.map((example, i) => (
              <p
                key={i}
                className="p-space-md rounded-xl bg-surface-container-low font-body-sm text-body-sm text-on-surface"
              >
                {example}
              </p>
            ))}
          </div>
        ) : (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            No brand examples configured.
          </p>
        )}
      </div>
    </div>
  );
}
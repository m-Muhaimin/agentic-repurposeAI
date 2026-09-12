import SpeechToneSliders from "./SpeechToneSliders";

type SpeechProfilePanelProps = {
  brandTone: string | null;
};

export default function SpeechProfilePanel({ brandTone }: SpeechProfilePanelProps) {
  const configured = Boolean(brandTone?.trim());

  return (
    <div className="lg:col-span-8 flex flex-col bg-surface-container-lowest rounded-xl p-space-lg shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-space-sm pb-space-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[24px]">graphic_eq</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-headline-md text-headline-md text-on-surface">
                Brand Speech Voice
              </h2>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-caption-bold text-caption-bold ${
                  configured
                    ? "bg-tertiary-fixed/60 text-tertiary"
                    : "bg-surface-container text-on-surface-variant"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${configured ? "bg-tertiary" : "bg-outline"}`}
                ></span>
                {configured ? "Configured" : "Not configured"}
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Tone profile loaded from your saved agent preferences.
            </p>
          </div>
        </div>
      </div>
      <SpeechToneSliders />
      <div className="mt-space-lg pt-space-md bg-surface-container-low rounded-xl p-space-md flex flex-col gap-space-md">
        <span className="font-label-caps text-label-caps text-outline uppercase tracking-wider">
          Brand Tone
        </span>
        {configured ? (
          <p className="font-body-medium text-body-medium text-on-surface whitespace-pre-wrap">
            {brandTone}
          </p>
        ) : (
          <p className="font-body-medium text-body-medium text-on-surface-variant">
            No brand tone configured.
          </p>
        )}
      </div>
    </div>
  );
}
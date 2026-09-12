import Icon from "@/components/ui/Icon";

type SpeechVoiceSamplesProps = {
  samples: string[];
};

export default function SpeechVoiceSamples({ samples }: SpeechVoiceSamplesProps) {
  return (
    <div className="lg:col-span-7 flex flex-col bg-surface-container-lowest rounded-xl p-space-lg shadow-sm">
      <div className="flex items-center justify-between pb-space-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-headline-md text-headline-md text-on-surface">
              Approved Voice Samples
            </h2>
            <span className="font-caption-bold text-caption-bold px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container">
              {samples.length} {samples.length === 1 ? "sample" : "samples"}
            </span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
            Brand sample text from your saved agent preferences.
          </p>
        </div>
      </div>
      {samples.length > 0 ? (
        <div className="space-y-space-sm my-space-md">
          {samples.map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-3.5 p-3.5 rounded-xl bg-surface-container-low"
            >
              <div className="w-9 h-9 rounded-lg bg-surface-container-lowest flex items-center justify-center text-primary shrink-0 shadow-sm">
                <Icon name="description" size={20} />
              </div>
              <p className="font-body-sm text-body-sm text-on-surface min-w-0 flex-1 whitespace-pre-wrap">
                {s}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="my-space-md p-3.5 rounded-xl bg-surface-container-low flex items-center gap-3.5">
          <Icon name="description" size={20} className="text-outline shrink-0" />
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            No voice samples saved yet.
          </p>
        </div>
      )}
      <div className="mt-auto pt-space-sm flex items-center justify-between text-on-surface-variant">
        <span className="font-body-sm text-body-sm font-medium">
          {samples.length} {samples.length === 1 ? "sample" : "samples"} from your saved brand
          settings
        </span>
      </div>
    </div>
  );
}
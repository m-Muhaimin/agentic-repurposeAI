import Icon from "@/components/ui/Icon";

type VoiceSamplesProps = {
  samples: string[];
};

export default function VoiceSamples({ samples }: VoiceSamplesProps) {
  return (
    <div className="lg:col-span-7 bg-surface-container-lowest rounded-xl shadow-sm p-space-lg space-y-space-md">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h2 className="font-headline-md text-headline-md text-on-surface">
            Approved Voice Samples
          </h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Brand sample text from your saved agent preferences.
          </p>
        </div>
        <span className="px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container font-caption-bold text-caption-bold">
          {samples.length} saved
        </span>
      </div>
      {samples.length > 0 ? (
        <div className="space-y-space-sm">
          {samples.map((sample, i) => (
            <div
              key={i}
              className="flex items-center gap-space-md p-space-md rounded-xl bg-surface-container-low"
            >
              <div className="w-10 h-10 rounded-lg bg-primary-fixed text-primary flex items-center justify-center shrink-0">
                <Icon name="description" size={20} />
              </div>
              <p className="font-body-sm text-body-sm text-on-surface min-w-0 flex-1 whitespace-pre-wrap">
                {sample}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-space-md rounded-xl bg-surface-container-low flex items-center gap-space-md">
          <Icon name="description" size={20} className="text-outline shrink-0" />
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            No voice samples saved yet.
          </p>
        </div>
      )}
      <div className="flex items-center justify-between pt-space-xs text-on-surface-variant font-caption-bold text-caption-bold">
        <span>
          {samples.length} {samples.length === 1 ? "sample" : "samples"} from your saved brand
          settings
        </span>
      </div>
    </div>
  );
}
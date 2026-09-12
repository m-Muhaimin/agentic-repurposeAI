import Panel from "@/components/ui/Panel";
import Icon from "@/components/ui/Icon";
import { Button, ButtonLink } from "@/components/ui/Button";
import Tag from "@/components/ui/Tag";

const FORMATS = ["MP4", "MP3", "PDF", "DOCX", "YOUTUBE / WEB"] as const;

export type RecentSource = {
  icon: string;
  iconTone: string;
  name: string;
};

export default function IntakePanel({
  recentSources = [],
}: {
  recentSources?: RecentSource[];
}) {
  return (
    <Panel className="lg:col-span-7 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary-fixed/20 rounded-full blur-3xl pointer-events-none -mr-24 -mt-24" />
      <div className="relative z-10 space-y-space-sm mb-space-lg">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-surface-container text-on-surface">
            <Icon name="auto_awesome" size={15} className="text-primary" />
            <span className="font-label-caps text-label-caps uppercase text-secondary">
              Omni-Channel Engine
            </span>
          </div>
          <span className="font-caption-bold text-caption-bold text-outline">Intake Node #01</span>
        </div>
        <h2 className="font-headline-lg text-headline-lg text-on-surface">Create Something</h2>
        <p className="font-body-medium text-body-medium text-secondary max-w-xl">
          Drop or paste a source — podcast episode, video recording, PDF guide, or article. VervAI
          agent figures out what to repurpose.
        </p>
      </div>

      <div className="relative z-10 bg-surface-container-low rounded-xl p-space-lg flex flex-col items-center justify-center text-center transition-all hover:bg-surface-container cursor-pointer group mb-space-md">
        <div className="w-12 h-12 rounded-full bg-surface-container-lowest flex items-center justify-center text-primary mb-space-sm shadow-sm group-hover:scale-105 transition-transform">
          <Icon name="cloud_upload" size={24} />
        </div>
        <p className="font-headline-sm text-headline-sm text-on-surface mb-1">
          Drag and drop raw media or paste a link
        </p>
        <p className="font-body-sm text-body-sm text-secondary mb-space-md max-w-md">
          Audio lectures, interview MP4s, whitepapers, or long-form documentation.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-1.5 mb-space-md">
          {FORMATS.map((f) => (
            <Tag key={f} tone="neutral" size="md">
              {f}
            </Tag>
          ))}
        </div>
        <Button variant="secondary" size="sm" className="bg-surface-container-lowest text-primary hover:bg-surface hover:text-on-surface shadow-sm">
          <Icon name="add_link" size={16} />
          Drop source or paste URL
        </Button>
      </div>

<div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pt-space-sm">
          <span className="font-caption-bold text-caption-bold text-secondary">Recent intake:</span>
          <div className="flex flex-wrap items-center gap-space-xs">
            {recentSources.length > 0 ? (
              recentSources.map((item) => (
                <div
                  key={item.name}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container text-on-surface font-caption-bold text-caption-bold text-xs hover:bg-surface-container-high cursor-pointer transition-colors"
                >
                  <Icon name={item.icon} size={14} className={item.iconTone} />
                  <span className="truncate max-w-[140px]">{item.name}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
                </div>
              ))
            ) : (
              <span className="font-body-sm text-body-sm text-secondary text-xs">
                No sources ingested yet.
              </span>
            )}
          </div>
        </div>
    </Panel>
  );
}
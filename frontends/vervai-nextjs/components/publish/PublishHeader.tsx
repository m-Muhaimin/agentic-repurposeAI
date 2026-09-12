import QuickScheduleModal from "./QuickScheduleModal";

export default function PublishHeader({
  queueCount,
  bufferLabel,
}: {
  queueCount: number;
  bufferLabel?: string;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
      <div className="space-y-1">
        <div className="flex items-center gap-space-xs text-secondary font-label-caps text-label-caps uppercase tracking-wider">
          <span>Autonomous Suite</span>
          <span>/</span>
          <span className="text-primary font-bold">Orchestration &amp; Relays</span>
        </div>
        <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
          Distribution &amp; Publishing
        </h1>
        <p className="font-body-medium text-body-medium text-on-surface-variant max-w-2xl">
          Turn approved agent outputs into scheduled multi-channel distribution. Human-verified
          and orchestrated across social, newsletter, and video pipes.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-space-sm self-start md:self-auto shrink-0">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container text-on-surface font-caption-bold text-caption-bold shadow-sm">
          <span className="material-symbols-outlined text-[16px] text-secondary">
            calendar_month
          </span>
          <span>
            Queue: <strong className="text-primary font-bold">{queueCount} Posts</strong>
          </span>
        </div>
        {bufferLabel && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container text-on-surface font-caption-bold text-caption-bold shadow-sm">
            <span className="w-2 h-2 rounded-full bg-tertiary"></span>
            <span>
              Buffer: <span className="text-secondary font-medium">{bufferLabel}</span>
            </span>
          </div>
        )}
        <QuickScheduleModal />
      </div>
    </div>
  );
}
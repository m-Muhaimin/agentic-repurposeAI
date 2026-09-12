export default function DispatchTelemetry({
  published = 0,
  failed = 0,
  scheduled = 0,
  draft = 0,
}: {
  published: number;
  failed: number;
  scheduled: number;
  draft: number;
}) {
  const done = published + failed;
  const successRate = done > 0 ? Math.round((published / done) * 100) : 100;
  const queuePct = scheduled + draft > 0 ? 100 : 0;
  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-lg space-y-space-md">
      <div className="flex items-center justify-between">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Dispatch Telemetry</h2>
        <span className="font-label-caps text-label-caps text-secondary">
          {done} Dispatches Tracked
        </span>
      </div>
      <div className="grid grid-cols-2 gap-space-sm">
        <div className="p-3 rounded-lg bg-surface-container-low">
          <div className="font-label-caps text-label-caps text-secondary uppercase">Success Rate</div>
          <div className="font-display-xl text-display-xl text-on-surface mt-1">
            {successRate}%
          </div>
          <div className="text-[11px] font-caption-bold text-tertiary mt-0.5">
            {failed} failed {failed === 1 ? "dispatch" : "dispatches"}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-surface-container-low">
          <div className="font-label-caps text-label-caps text-secondary uppercase">In Queue</div>
          <div className="font-display-xl text-display-xl text-on-surface mt-1">
            {scheduled + draft}
          </div>
          <div className="text-[11px] font-caption-bold text-secondary mt-0.5">
            {scheduled} scheduled • {draft} drafts
          </div>
        </div>
      </div>
      <div className="space-y-1.5 pt-1">
        <div className="flex justify-between font-label-caps text-label-caps text-secondary">
          <span>Queue Saturation</span>
          <span className="font-caption-bold text-on-surface">
            {scheduled} scheduled posts
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden">
          <div
            className="h-full bg-primary rounded-full"
            style={{ width: `${queuePct}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}
export type VelocityBar = {
  day: string;
  sources: number;
  outputs: number;
};

type Props = {
  bars: VelocityBar[];
};

export default function VelocityChart({ bars }: Props) {
  const maxCount = Math.max(
    ...bars.map((b) => b.sources + b.outputs),
    1,
  );
  const totalSources = bars.reduce((sum, b) => sum + b.sources, 0);
  const totalOutputs = bars.reduce((sum, b) => sum + b.outputs, 0);
  const hasData = totalSources + totalOutputs > 0;

  const peakIdx = bars.reduce(
    (pi, b, i, arr) =>
      b.sources + b.outputs >
      arr[pi].sources + arr[pi].outputs
        ? i
        : pi,
    0,
  );
  const peakBar = bars[peakIdx];
  const isCurrentPeak = hasData && peakBar.sources + peakBar.outputs > 0;

  return (
    <div className="lg:col-span-7 rounded-xl bg-surface-container-lowest shadow-sm p-space-md flex flex-col justify-between">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-space-sm">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-headline-md text-headline-md text-on-surface">
                Daily Ingestion &amp; Output Velocity
              </h2>
              <span className="font-label-caps text-[10px] px-1.5 py-0.5 rounded bg-surface-container text-secondary font-bold">
                14 DAYS
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-secondary">
              Sources ingested and outputs generated per day
            </p>
          </div>
          <div className="flex items-center gap-3 font-caption-bold text-[11px] text-secondary">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-primary"></span>
              Sources
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-secondary-container"></span>
              Outputs
            </span>
          </div>
        </div>
        <div className="w-full mt-6">
          {hasData ? (
            <div className="h-44 flex items-end justify-between gap-1 pt-4 pb-2 px-1 bg-surface-container-low rounded-lg">
              {bars.map((bar, i) => {
                const total = bar.sources + bar.outputs;
                const isPeak = isCurrentPeak && i === peakIdx;
                const srcH = total > 0 ? (bar.sources / maxCount) * 100 : 0;
                const outH = total > 0 ? (bar.outputs / maxCount) * 100 : 0;
                return (
                  <div
                    key={bar.day}
                    className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
                    title={`Sources: ${bar.sources}, Outputs: ${bar.outputs}`}
                  >
                    {isPeak ? (
                      <span className="absolute -top-3 w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>
                    ) : null}
                    <div className="w-full flex flex-col justify-end h-full gap-px rounded-t overflow-hidden">
                      {bar.outputs > 0 ? (
                        <div
                          className="w-full bg-secondary-container"
                          style={{ height: `${outH}%` }}
                        ></div>
                      ) : null}
                      {bar.sources > 0 ? (
                        <div
                          className="w-full bg-primary"
                          style={{ height: `${srcH}%` }}
                        ></div>
                      ) : null}
                    </div>
                    <span
                      className={`font-label-caps text-[9px] mt-1 ${isPeak ? "font-bold text-primary" : "text-outline group-hover:text-primary"}`}
                    >
                      {bar.day}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-44 flex items-center justify-center bg-surface-container-low rounded-lg">
              <p className="font-body-sm text-body-sm text-secondary">
                No activity in the last 14 days
              </p>
            </div>
          )}
        </div>
      </div>
      {hasData ? (
        <div className="mt-4 p-3 rounded-lg bg-surface-container-high/60 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary shrink-0">
              insights
            </span>
            <span className="font-body-sm text-body-sm text-on-surface">
              <strong className="font-semibold text-primary">
                Peak Day: Day {peakBar.day}
              </strong>{" "}
              — {peakBar.sources} sources, {peakBar.outputs} outputs.
            </span>
          </div>
          <span className="font-label-caps text-label-caps text-secondary whitespace-nowrap hidden sm:inline-block">
            Total:{" "}
            <strong className="text-on-surface font-semibold">
              {totalSources} sources
            </strong>
            , {totalOutputs} outputs
          </span>
        </div>
      ) : null}
    </div>
  );
}
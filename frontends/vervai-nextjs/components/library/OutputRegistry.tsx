type RegistryRow = {
  icon: string;
  iconTone: "primary" | "secondary";
  label: string;
  count: string;
};

export default function OutputRegistry({
  rows,
  total,
  sourceCount,
  latestLabel,
}: {
  rows: RegistryRow[];
  total: number;
  sourceCount: number;
  latestLabel: string;
}) {
  return (
    <div className="lg:col-span-4 flex flex-col justify-between rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
      <div className="space-y-space-md">
        <div className="flex items-center justify-between">
          <span className="font-label-caps text-label-caps uppercase text-secondary tracking-wider">
            Output Registry
          </span>
          <span className="px-2 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed font-caption-bold text-[11px]">
            Live Engine
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <div>
            <h3 className="font-display-xl text-display-xl text-on-surface">{total} Total</h3>
            <p className="font-body-sm text-body-sm text-secondary">
              Asset artifacts across {sourceCount} {sourceCount === 1 ? "source" : "sources"}
            </p>
          </div>
          <div className="text-right">
            <span className="font-headline-lg text-headline-lg text-tertiary">{latestLabel}</span>
            <p className="font-label-caps text-[10px] text-secondary uppercase">Latest Output</p>
          </div>
        </div>
        <div className="space-y-space-xs pt-1">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`material-symbols-outlined text-[18px] ${
                    row.iconTone === "primary" ? "text-primary" : "text-secondary"
                  }`}
                >
                  {row.icon}
                </span>
                <span className="font-body-medium text-body-medium text-on-surface">
                  {row.label}
                </span>
              </div>
              <span className="font-caption-bold text-caption-bold text-on-surface px-2 py-0.5 bg-surface-container-lowest rounded">
                {row.count}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="pt-space-md mt-space-sm flex items-center gap-3 bg-surface-container-lowest">
        <svg className="w-10 h-10 shrink-0 transform -rotate-90" viewBox="0 0 36 36">
          <path
            className="text-surface-container-high"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
          ></path>
          <path
            className="text-tertiary"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="currentColor"
            strokeDasharray="94.8, 100"
            strokeLinecap="round"
            strokeWidth="3.5"
          ></path>
        </svg>
        <div className="min-w-0">
          <p className="font-caption-bold text-caption-bold text-on-surface leading-tight">
            Live from <span className="text-primary">sources</span> + <span className="text-primary">outputs</span>
          </p>
          <p className="font-body-sm text-[12px] text-secondary truncate">
            Queried directly from your workspace database
          </p>
        </div>
      </div>
    </div>
  );
}
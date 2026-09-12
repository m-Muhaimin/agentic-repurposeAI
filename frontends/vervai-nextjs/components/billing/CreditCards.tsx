type Props = {
  sourceCount: number;
  outputCount: number;
  jobCount: number;
  publishedCount: number;
};

type StatCard = {
  label: string;
  title: string;
  icon: string;
  iconClass: string;
  value: string;
  total: string;
  totalClass: string;
  badge: string;
  badgeClass: string;
  barClass: string;
  barWidth: string;
  footerLeft: string;
};

export default function CreditCards({
  sourceCount,
  outputCount,
  jobCount,
  publishedCount,
}: Props) {
  const cards: StatCard[] = [
    {
      label: "Content Pipeline",
      title: "Sources Ingested",
      icon: "database",
      iconClass: "bg-primary-fixed text-on-primary-fixed",
      value: String(sourceCount),
      total: "total",
      totalClass: "font-headline-lg text-headline-lg text-on-surface-variant",
      badge: `${outputCount} outputs`,
      badgeClass: "bg-primary-fixed text-primary",
      barClass: "bg-primary-container",
      barWidth:
        sourceCount > 0
          ? `${Math.min(100, (outputCount / Math.max(sourceCount, 1)) * 100)}%`
          : "0%",
      footerLeft: "Active content sources",
    },
    {
      label: "Distribution",
      title: "Posts Published",
      icon: "send",
      iconClass: "bg-secondary-fixed text-on-secondary-fixed",
      value: String(publishedCount),
      total: `of ${jobCount} jobs`,
      totalClass: "font-headline-lg text-headline-lg text-on-surface-variant",
      badge:
        jobCount > 0
          ? `${Math.round((publishedCount / jobCount) * 100)}% live`
          : "No jobs",
      badgeClass: "bg-secondary-fixed text-secondary",
      barClass: "bg-secondary",
      barWidth: jobCount > 0 ? `${(publishedCount / jobCount) * 100}%` : "0%",
      footerLeft: "Across all platforms",
    },
    {
      label: "Outputs",
      title: "Generated Content",
      icon: "speed",
      iconClass: "bg-tertiary-fixed text-on-tertiary-fixed",
      value: String(outputCount),
      total: "outputs",
      totalClass: "font-headline-sm text-headline-sm text-on-surface-variant",
      badge:
        sourceCount > 0
          ? `${(outputCount / sourceCount).toFixed(1)} per source`
          : "No data",
      badgeClass: "bg-tertiary-fixed text-tertiary",
      barClass: "bg-tertiary-container",
      barWidth:
        sourceCount > 0
          ? `${Math.min(100, (outputCount / sourceCount) * 25)}%`
          : "0%",
      footerLeft: "Deliverables across all formats",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
      {cards.map((card) => (
        <div
          key={card.title}
          className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between relative overflow-hidden group"
        >
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider">
                {card.label}
              </span>
              <h3 className="font-headline-md text-headline-md text-on-surface mt-0.5">
                {card.title}
              </h3>
            </div>
            <span
              className={`material-symbols-outlined p-2 rounded-lg text-[20px] ${card.iconClass}`}
            >
              {card.icon}
            </span>
          </div>
          <div className="my-space-md flex items-baseline gap-space-xs">
            <span className="font-display-2xl text-display-2xl text-on-surface tracking-tight font-bold">
              {card.value}
            </span>
            <span className={card.totalClass}>{card.total}</span>
            <span
              className={`font-caption-bold text-caption-bold ml-auto px-2 py-1 rounded ${card.badgeClass}`}
            >
              {card.badge}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <div className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden">
              <div
                className={`h-full ${card.barClass} rounded-full transition-all duration-700`}
                style={{ width: card.barWidth }}
              ></div>
            </div>
          </div>
          <div className="mt-space-md pt-space-sm bg-surface-container-low -mx-space-lg -mb-space-lg px-space-lg py-2.5 flex items-center justify-between text-on-surface-variant">
            <span className="font-body-sm text-body-sm flex items-center gap-1 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
              {card.footerLeft}
            </span>
            <span
              className="material-symbols-outlined text-tertiary text-[18px]"
              title="Healthy"
            >
              check_circle
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
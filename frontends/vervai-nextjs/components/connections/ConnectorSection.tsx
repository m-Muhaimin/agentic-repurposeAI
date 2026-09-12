import ConnectorCard, { type ConnectorCardItem } from "./ConnectorCard";

export default function ConnectorSection({
  colorBar,
  title,
  badge,
  meta,
  items,
  variant = "standard",
}: {
  colorBar: string;
  title: string;
  badge: string;
  meta: string;
  items: ConnectorCardItem[];
  variant?: "standard" | "compact";
}) {
  const compact = variant === "compact";
  return (
    <section className="space-y-space-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-space-sm">
          <span className={`${compact ? "w-2 h-5" : "w-1.5 h-4"} rounded-full ${colorBar}`}></span>
          <h2
            className={`${compact ? "font-headline-lg text-headline-lg" : "font-headline-md text-headline-md"} text-on-surface tracking-tight`}
          >
            {title}
          </h2>
          <span
            className={`font-label-caps text-[10px] uppercase px-2 py-0.5 rounded font-semibold ${compact ? "bg-surface-container-high text-on-surface-variant" : "bg-surface-container-high text-secondary"}`}
          >
            {badge}
          </span>
        </div>
        <span
          className={`font-caption-bold text-caption-bold ${compact ? "text-outline uppercase tracking-wider" : "text-secondary"}`}
        >
          {meta}
        </span>
      </div>
      <div
        className={`grid grid-cols-1 md:grid-cols-2 ${compact ? "xl:grid-cols-4 gap-gutter" : "lg:grid-cols-4 gap-space-md"}`}
      >
        {items.map((item) => (
          <ConnectorCard key={item.title} item={item} variant={variant} />
        ))}
      </div>
    </section>
  );
}
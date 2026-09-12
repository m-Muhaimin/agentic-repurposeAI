import type { ReactNode } from "react";

export default function PageHeading({
  eyebrow,
  eyebrowTone = "tertiary",
  title,
  subtitle,
  actions,
}: {
  eyebrow?: ReactNode;
  eyebrowTone?: "tertiary" | "neutral";
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md mb-space-xl">
      <div className="space-y-1">
        {eyebrow && (
          <div className="flex items-center gap-2 mb-1">
            <span className="font-label-caps text-label-caps uppercase text-secondary">{eyebrow}</span>
            <span className="w-1 h-1 rounded-full bg-outline-variant" />
            {eyebrowTone === "tertiary" ? (
              <span className="font-label-caps text-label-caps text-tertiary flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
                <span>Engine Active</span>
              </span>
            ) : null}
          </div>
        )}
        <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">{title}</h1>
        {subtitle && <p className="font-body-base text-body-base text-secondary">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-space-sm self-start md:self-end">{actions}</div>}
    </div>
  );
}
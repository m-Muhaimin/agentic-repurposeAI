import type { ReactNode } from "react";
import { clsx } from "clsx";

// Standard page header used across the app: title, optional description,
// and aligned page actions. Matching every current page's grammar
// (h1 text-2xl font-bold + text-sm description).
export default function PageHeader({
  title,
  description,
  actions,
  className
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("mb-6 flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && (
          <p className="mt-1 max-w-lg text-sm text-theme-text-secondary">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}
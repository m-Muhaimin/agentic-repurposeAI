import type { ReactNode } from "react";
import { clsx } from "clsx";

// Shared empty/blank-slate state used by the dashboard and the library.
export default function EmptyState({
  icon,
  title,
  description,
  action,
  className
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center gap-4 rounded-lg border border-theme-divider bg-theme-bg-paper px-6 py-16 text-center",
        className
      )}
    >
      {icon && (
        <span className="flex size-12 items-center justify-center rounded-full bg-primary-100 text-primary-500">
          {icon}
        </span>
      )}
      <div>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-theme-text-secondary">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
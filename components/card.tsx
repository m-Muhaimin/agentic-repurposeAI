import type { ReactNode } from "react";
import { clsx } from "clsx";

// Card shell matching the repo's standard card grammar
// (rounded-lg / border-theme-divider / bg-theme-bg-paper).
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={clsx("rounded-lg border border-theme-divider bg-theme-bg-paper", className)}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("border-b border-theme-divider px-5 py-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold">{title}</h2>
          {description && (
            <p className="mt-0.5 text-xs text-theme-text-secondary">{description}</p>
          )}
        </div>
        {action}
      </div>
    </div>
  );
}

export function CardFooter({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={clsx("border-t border-theme-divider px-5 py-4", className)}>{children}</div>;
}
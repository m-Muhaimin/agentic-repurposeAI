import type { ReactNode } from "react";

export default function Panel({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between ${className}`}
    >
      {children}
    </section>
  );
}
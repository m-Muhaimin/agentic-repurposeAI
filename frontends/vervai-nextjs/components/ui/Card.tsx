import type { ReactNode, HTMLAttributes } from "react";

export default function Card({
  children,
  className = "",
  ...rest
}: { children?: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-surface-container-lowest border border-outline-variant/40 rounded ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
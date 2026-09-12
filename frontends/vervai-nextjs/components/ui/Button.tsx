import Link from "next/link";
import type { ReactNode, ButtonHTMLAttributes, AnchorHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "tertiary";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-primary text-on-primary shadow-sm hover:bg-primary-container active:scale-[0.98]",
  secondary:
    "bg-surface-container-high border border-outline-variant/50 text-on-surface hover:bg-surface-container",
  outline:
    "border border-outline-variant/60 text-on-surface-variant hover:text-on-surface hover:border-outline bg-transparent",
  ghost: "text-secondary hover:text-on-surface hover:bg-surface-container",
  danger: "text-error hover:bg-error-container",
  tertiary:
    "bg-tertiary-container text-on-tertiary-container hover:brightness-95 active:scale-[0.98]",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-caption-bold gap-1.5",
  md: "h-9 px-4 text-caption-bold gap-1.5",
  lg: "h-11 px-5 text-caption-bold gap-2",
};

const BASE =
  "inline-flex items-center justify-center rounded transition-colors select-none disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";

type Common = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children?: ReactNode;
  loading?: boolean;
};

// Two component forms: Button (real <button>) and ButtonLink (<a>).
export function Button({
  variant = "primary",
  size = "md",
  className = "",
  loading = false,
  children,
  disabled,
  ...rest
}: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      disabled={disabled || loading}
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {loading ? (
        <span className="inline-flex items-center justify-center">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </span>
      ) : (
        children
      )}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  loading: _loading,
  children,
  href,
  ...rest
}: Common & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <Link href={href} className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`} {...rest}>
      {children}
    </Link>
  );
}
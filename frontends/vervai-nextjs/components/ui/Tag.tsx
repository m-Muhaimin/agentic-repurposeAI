import type { ReactNode } from "react";

export type TagTone = "primary" | "secondary" | "tertiary" | "neutral" | "brand" | "surface";

const TONES: Record<TagTone, string> = {
  primary: "text-primary bg-primary-fixed",
  secondary: "text-secondary bg-surface-container-high",
  tertiary: "text-tertiary bg-tertiary-fixed/30",
  neutral: "text-on-surface bg-surface-container-high",
  brand: "text-on-tertiary-container bg-tertiary-container",
  surface: "text-on-surface-variant bg-surface-variant",
};

export type TagSize = "sm" | "md";

const SIZES: Record<TagSize, string> = {
  sm: "text-[10px] px-1.5 py-0.5 rounded",
  md: "text-label-caps px-2 py-0.5 rounded",
};

export default function Tag({
  tone = "neutral",
  size = "sm",
  children,
  className = "",
}: {
  tone?: TagTone;
  size?: TagSize;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 font-label-caps font-bold uppercase tracking-wide ${TONES[tone]} ${SIZES[size]} ${className}`}
    >
      {children}
    </span>
  );
}
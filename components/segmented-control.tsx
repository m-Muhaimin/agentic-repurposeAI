"use client";

import type { ReactNode } from "react";
import { clsx } from "clsx";

// Segmented control replacing the four near-identical implementations
// (login mode switch, upload source mode, library filter, editor preview/edit).
//
// - variant "paper": active segment is a white/paper pill (login, library, editor).
// - variant "solid": active segment is filled primary (upload source mode).
// - Pass containerClassName/segmentClassName for one-off spacing or sizing.
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  variant = "paper",
  containerClassName,
  segmentClassName,
  className,
  ariaLabel
}: {
  options: { id: T; label: ReactNode }[];
  value: T;
  onChange: (id: T) => void;
  variant?: "paper" | "solid";
  containerClassName?: string;
  segmentClassName?: string;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={clsx(
        "flex gap-1 rounded-lg bg-neutral-100 p-1.5",
        containerClassName
      )}
    >
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            aria-pressed={active}
            className={clsx(
              "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
              variant === "solid"
                ? active
                  ? "bg-primary-500 font-semibold text-white"
                  : "text-theme-text-secondary hover:text-theme-text-primary"
                : active
                  ? "bg-theme-bg-paper font-semibold text-theme-text-primary shadow-sm"
                  : "text-theme-text-secondary hover:text-theme-text-primary",
              className,
              segmentClassName
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
"use client";

import type { InputHTMLAttributes } from "react";

type SliderProps = {
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  showValue?: boolean;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "type" | "min" | "max" | "step">;

export default function Slider({
  min = 0,
  max = 100,
  step = 1,
  label,
  showValue = true,
  className = "",
  disabled,
  ...rest
}: SliderProps) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {(label || showValue) && (
        <div className="flex items-center justify-between">
          {label && (
            <span className="font-caption-bold text-caption-bold text-on-surface">
              {label}
            </span>
          )}
          {showValue && rest.value !== undefined && (
            <span className="font-caption-bold text-caption-bold text-primary">
              {rest.value}
            </span>
          )}
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className={`w-full h-2 rounded-full appearance-none cursor-pointer bg-surface-container-highest accent-primary ${
          disabled ? "opacity-40 pointer-events-none" : ""
        }`}
        style={{
          background: `linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) ${
            ((Number(rest.value) - min) / (max - min)) * 100
          }%, var(--color-surface-container-highest) ${
            ((Number(rest.value) - min) / (max - min)) * 100
          }%, var(--color-surface-container-highest) 100%)`,
        }}
        {...rest}
      />
    </div>
  );
}
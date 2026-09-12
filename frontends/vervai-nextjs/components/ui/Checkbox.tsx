"use client";

import type { InputHTMLAttributes, ReactNode } from "react";

type CheckboxProps = {
  label?: ReactNode;
  description?: string;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "type">;

export default function Checkbox({
  label,
  description,
  className = "",
  disabled,
  ...rest
}: CheckboxProps) {
  const id = rest.id ?? rest.name;
  return (
    <label
      className={`flex items-start gap-3 cursor-pointer select-none ${
        disabled ? "opacity-40 pointer-events-none" : ""
      } ${className}`}
      htmlFor={id}
    >
      <div className="relative flex items-center justify-center mt-0.5">
        <input
          type="checkbox"
          id={id}
          disabled={disabled}
          className="sr-only peer"
          {...rest}
        />
        <div className="w-5 h-5 rounded border-2 border-outline-variant bg-surface-container-lowest peer-checked:bg-primary peer-checked:border-primary transition-colors flex items-center justify-center">
          <svg
            className="w-3 h-3 text-on-primary opacity-0 peer-checked:opacity-100 transition-opacity"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      </div>
      {(label || description) && (
        <div className="flex flex-col">
          {label && (
            <span className="font-body-medium text-body-medium text-on-surface">
              {label}
            </span>
          )}
          {description && (
            <span className="font-body-sm text-body-sm text-secondary">
              {description}
            </span>
          )}
        </div>
      )}
    </label>
  );
}
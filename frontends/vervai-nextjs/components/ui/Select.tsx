"use client";

import type { SelectHTMLAttributes } from "react";
import Icon from "./Icon";

type SelectOption = { value: string; label: string };

type SelectProps = {
  options: SelectOption[];
  placeholder?: string;
  className?: string;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "className" | "children">;

export default function Select({
  options,
  placeholder,
  className = "",
  disabled,
  ...rest
}: SelectProps) {
  return (
    <div className={`relative ${className}`}>
      <select
        disabled={disabled}
        className={`w-full h-9 pl-3 pr-9 rounded bg-surface-container-lowest border border-outline-variant/50 text-on-surface font-body-sm text-body-sm appearance-none focus:outline-none focus:border-primary transition-colors ${
          disabled ? "opacity-40 pointer-events-none" : ""
        }`}
        {...rest}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <Icon
        name="expand_more"
        size={16}
        className="text-secondary absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
      />
    </div>
  );
}
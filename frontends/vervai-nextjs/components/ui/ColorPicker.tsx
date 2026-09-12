"use client";

import Icon from "./Icon";

type Swatch = { value: string; label?: string };

type ColorPickerProps = {
  swatches: Swatch[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export default function ColorPicker({
  swatches,
  value,
  onChange,
  className = "",
}: ColorPickerProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {swatches.map((swatch) => {
        const active = swatch.value === value;
        return (
          <button
            key={swatch.value}
            type="button"
            title={swatch.label ?? swatch.value}
            aria-label={swatch.label ?? swatch.value}
            aria-pressed={active}
            onClick={() => onChange(swatch.value)}
            className={`relative w-8 h-8 rounded-full ring-offset-2 transition-transform hover:scale-105 ${
              active ? "ring-2 ring-primary scale-105" : "ring-1 ring-outline-variant/40"
            }`}
            style={{ backgroundColor: swatch.value }}
          >
            {active && (
              <Icon
                name="check"
                size={14}
                className="absolute inset-0 m-auto w-3.5 h-3.5 text-white drop-shadow"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
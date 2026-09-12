"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";

type ToneSlider = {
  id: string;
  label: string;
  default: number;
  valueLabel: (v: number) => string;
  descriptionIcon: string;
  description: string;
};

const TONE_SLIDERS: ToneSlider[] = [
  {
    id: "analytical",
    label: "Analytical vs. Emotional",
    default: 50,
    valueLabel: (v) => (v === 50 ? "Not calibrated" : `${v}% of 100`),
    descriptionIcon: "check_circle",
    description: "Preference between empirical, data-led writing and emotional tone.",
  },
  {
    id: "punchiness",
    label: "Punchiness vs. Exposition",
    default: 50,
    valueLabel: (v) => (v === 50 ? "Not calibrated" : `${v}% of 100`),
    descriptionIcon: "speed",
    description: "Preference for short, compressed sentences over longer narrative flow.",
  },
  {
    id: "formality",
    label: "Formality Matrix",
    default: 50,
    valueLabel: (v) => (v === 50 ? "Not calibrated" : `${v}% of 100`),
    descriptionIcon: "record_voice_over",
    description: "Distance between casual, personal writing and formal publication style.",
  },
  {
    id: "contrarian",
    label: "Contrarian Index",
    default: 50,
    valueLabel: (v) => (v === 50 ? "Not calibrated" : `${v}% of 100`),
    descriptionIcon: "trending_up",
    description: "Willingness to challenge conventional thinking with evidence.",
  },
];

export default function ToneSliders() {
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(TONE_SLIDERS.map((s) => [s.id, s.default])),
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-space-xl gap-y-space-lg bg-surface-container-low p-space-lg rounded-xl">
      <div className="md:col-span-2">
        <p className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1.5">
          <Icon name="info" size={15} className="text-outline" />
          Tone sliders are a preview only — they are not saved to your preferences.
        </p>
      </div>
      {TONE_SLIDERS.map((slider) => (
        <div key={slider.id} className="space-y-2">
          <div className="flex justify-between items-baseline">
            <label className="font-headline-sm text-headline-sm text-on-surface" htmlFor={`tone-${slider.id}`}>
              {slider.label}
            </label>
            <span className="font-caption-bold text-caption-bold text-primary px-2 py-0.5 rounded bg-primary-fixed">
              {slider.valueLabel(values[slider.id])}
            </span>
          </div>
          <input
            id={`tone-${slider.id}`}
            className="w-full accent-primary-container h-1.5 bg-surface-container-highest rounded-lg cursor-pointer transition-all"
            max="100"
            min="0"
            type="range"
            value={values[slider.id]}
            onChange={(e) =>
              setValues((v) => ({ ...v, [slider.id]: Number(e.target.value) }))
            }
          />
          <p className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1.5">
            <Icon name={slider.descriptionIcon} size={15} className="text-tertiary" />
            {slider.description}
          </p>
        </div>
      ))}
    </div>
  );
}
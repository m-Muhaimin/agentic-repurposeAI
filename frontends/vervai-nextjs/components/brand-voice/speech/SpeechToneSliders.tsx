"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";

type SpeechSlider = {
  id: string;
  label: string;
  infoTitle: string;
  default: number;
  valueLabel: (v: number) => string;
  left: string;
  center: string;
  right: string;
};

const SLIDERS: SpeechSlider[] = [
  {
    id: "analytical",
    label: "Analytical vs. Emotional",
    infoTitle: "Balance between numerical citation and empirical evidence versus sentimental phrasing.",
    default: 50,
    valueLabel: (v) => (v === 50 ? "Not calibrated" : `${v}% of 100`),
    left: "Affective & Empathetic",
    center: "Evidence & Proof",
    right: "Mathematical Axiom",
  },
  {
    id: "punchiness",
    label: "Punchiness vs. Exposition",
    infoTitle: "Preferred average sentence length, compression, and clause trimming.",
    default: 50,
    valueLabel: (v) => (v === 50 ? "Not calibrated" : `${v}% of 100`),
    left: "Detailed Narrative Flow",
    center: "Balanced Sentences",
    right: "Telegraphic Bulleted",
  },
  {
    id: "formality",
    label: "Formality Matrix",
    infoTitle: "Distance from colloquial ease to academic publication style.",
    default: 50,
    valueLabel: (v) => (v === 50 ? "Not calibrated" : `${v}% of 100`),
    left: "Casual Raw Post",
    center: "Executive Authority",
    right: "Rigid Enterprise Whitepaper",
  },
  {
    id: "contrarian",
    label: "Contrarian Index",
    infoTitle: "Encourages challenging conventional wisdom with actionable proof.",
    default: 50,
    valueLabel: (v) => (v === 50 ? "Not calibrated" : `${v}% of 100`),
    left: "Consensus-Aligned",
    center: "Operational Thesis",
    right: "Extreme Paradigm Shift",
  },
];

export default function SpeechToneSliders() {
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(SLIDERS.map((s) => [s.id, s.default])),
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 pt-space-md">
      <div className="md:col-span-2">
        <p className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1.5">
          <Icon name="info" size={15} className="text-outline" />
          Tone sliders are a preview only — they are not saved to your preferences.
        </p>
      </div>
      {SLIDERS.map((s) => (
        <div key={s.id} className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-1.5" htmlFor={`speech-tone-${s.id}`}>
              <span>{s.label}</span>
              <Icon
                name="info"
                size={15}
                className="text-outline"
                {...{ title: s.infoTitle }}
              />
            </label>
            <span className="font-caption-bold text-caption-bold px-2 py-0.5 rounded bg-surface-container-high text-primary font-mono">
              {s.valueLabel(values[s.id])}
            </span>
          </div>
          <div className="relative w-full py-1">
            <input
              id={`speech-tone-${s.id}`}
              className="w-full accent-primary-container h-1.5 bg-surface-container-highest rounded-lg appearance-none cursor-pointer"
              max="100"
              min="0"
              type="range"
              value={values[s.id]}
              onChange={(e) =>
                setValues((v) => ({ ...v, [s.id]: Number(e.target.value) }))
              }
            />
          </div>
          <div className="flex justify-between font-caption-bold text-[11px] text-outline">
            <span>{s.left}</span>
            <span className="text-on-surface-variant font-medium">{s.center}</span>
            <span>{s.right}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
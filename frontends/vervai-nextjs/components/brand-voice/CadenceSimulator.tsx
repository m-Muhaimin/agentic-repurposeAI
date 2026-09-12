"use client";

import { useMemo, useState } from "react";
import Icon from "@/components/ui/Icon";

type SimulatorMetric = {
  label: string;
  value: string;
  verdict: string;
  tone: "tertiary" | "neutral" | "primary";
};

export default function CadenceSimulator() {
  const [text, setText] = useState("");
  const words = useMemo(
    () => (text.trim() ? text.trim().split(/\s+/).length : 0),
    [text],
  );
  const sentences = useMemo(() => {
    const matches = text.match(/[.!?]+(?:["')}\]]*)/g);
    if (matches) return matches.length;
    return text.trim() ? 1 : 0;
  }, [text]);
  const avgPerSentence = useMemo(
    () => (words && sentences ? Math.round((words / sentences) * 10) / 10 : 0),
    [words, sentences],
  );
  const clauses = useMemo(
    () => (text.match(/[.,;:!?]/g) ?? []).length + (text.trim() ? 1 : 0),
    [text],
  );

  const metrics: SimulatorMetric[] = [
    { label: "Words", value: String(words), verdict: "Counted live", tone: "tertiary" },
    { label: "Sentences", value: String(sentences), verdict: "Detected live", tone: "primary" },
    { label: "Avg. Words / Sentence", value: String(avgPerSentence), verdict: "Readability proxy", tone: "neutral" },
  ];

  return (
    <div className="lg:col-span-5 bg-surface-container-lowest rounded-xl shadow-sm p-space-lg flex flex-col justify-between space-y-space-md">
      <div className="space-y-space-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="bolt" size={20} className="text-primary" />
            <h2 className="font-headline-sm text-headline-sm text-on-surface">
              Cadence Simulator & Lint
            </h2>
          </div>
          <span className="font-caption-bold text-caption-bold px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">
            Local Analysis
          </span>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Paste a draft hook to measure basic text structure.
        </p>
        <div className="space-y-2">
          <textarea
            className="w-full p-space-md rounded-xl bg-surface-container-low text-on-surface font-body-sm text-body-sm resize-none focus:outline-none focus:shadow-md transition-shadow placeholder:text-outline"
            placeholder="Draft hook or paragraph to evaluate..."
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex justify-between items-center px-1">
            <span className="font-caption-bold text-[11px] text-outline">
              Word count: {words} • Clauses: {clauses}
            </span>
            <button
              className="text-primary font-caption-bold text-caption-bold hover:underline"
              type="button"
              onClick={() => setText("")}
            >
              Clear
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-space-xs">
          {metrics.map((metric) => (
            <div key={metric.label} className="p-space-sm rounded-lg bg-surface-container-low text-center space-y-0.5">
              <span className="font-label-caps text-[10px] text-outline uppercase block">
                {metric.label}
              </span>
              <span
                className={`font-headline-lg text-headline-lg block font-bold ${
                  metric.tone === "tertiary"
                    ? "text-tertiary"
                    : metric.tone === "primary"
                      ? "text-primary"
                      : "text-on-surface"
                }`}
              >
                {metric.value}
              </span>
              <span
                className={`font-caption-bold text-[10px] block ${
                  metric.tone === "tertiary" ? "text-tertiary" : "text-primary"
                }`}
              >
                {metric.verdict}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="p-space-md rounded-xl bg-surface-container-high flex items-start gap-space-sm">
        <Icon name="tips_and_updates" size={20} className="text-primary mt-0.5 shrink-0" />
        <div className="space-y-0.5">
          <span className="font-caption-bold text-caption-bold text-on-surface block">
            About this tool
          </span>
          <p className="font-body-sm text-[12px] text-on-surface-variant leading-relaxed">
            All metrics are computed in your browser from the pasted text. No AI evaluation is
            running.
          </p>
        </div>
      </div>
    </div>
  );
}
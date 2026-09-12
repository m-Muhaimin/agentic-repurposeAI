"use client";

import { useMemo, useState } from "react";

type Metric = {
  label: string;
  value: string;
  verdict: string;
  tone: "primary" | "tertiary" | "neutral";
};

export default function SpeechCadenceSimulator() {
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

  const metrics: Metric[] = [
    { label: "Words", value: String(words), verdict: "Counted live", tone: "primary" },
    { label: "Sentences", value: String(sentences), verdict: "Detected live", tone: "tertiary" },
    { label: "Avg. Words / Sentence", value: String(avgPerSentence), verdict: "Readability proxy", tone: "neutral" },
  ];

  return (
    <div className="lg:col-span-5 flex flex-col bg-surface-container-lowest rounded-xl p-space-lg shadow-sm">
      <div className="flex items-center justify-between pb-space-xs">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-primary">speed</span>
          <h2 className="font-headline-md text-headline-md text-on-surface">
            Cadence Simulator & Lint
          </h2>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-caption-bold text-caption-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-outline"></span>
          Local Analysis
        </span>
      </div>
      <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-sm">
        Paste a draft hook to measure basic text structure.
      </p>
      <div className="relative bg-surface-container-low rounded-xl p-3 mb-space-md shadow-inner">
        <textarea
          className="w-full bg-transparent font-body-base text-body-medium text-on-surface resize-none focus:outline-none leading-relaxed placeholder:text-outline"
          placeholder="Draft hook or paragraph to evaluate..."
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex items-center justify-between pt-2 text-outline">
          <span className="font-caption-bold text-[11px] uppercase tracking-wider">
            Words: {words} • Clauses: {clauses}
          </span>
          <button
            className="font-caption-bold text-[11px] text-primary uppercase tracking-wider hover:underline"
            type="button"
            onClick={() => setText("")}
          >
            Clear
          </button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-space-md">
        {metrics.map((m) => (
          <div key={m.label} className="p-3 bg-surface-container rounded-lg text-center">
            <span className="font-caption-bold text-[11px] uppercase text-outline block mb-1">
              {m.label}
            </span>
            <span
              className={`font-display-xl text-headline-lg font-bold ${
                m.tone === "primary"
                  ? "text-primary"
                  : m.tone === "tertiary"
                    ? "text-tertiary-container"
                    : "text-on-surface"
              }`}
            >
              {m.value}
            </span>
            <span
              className={`font-caption-bold text-[10px] block mt-0.5 ${
                m.tone === "primary"
                  ? "text-tertiary"
                  : m.tone === "tertiary"
                    ? "text-tertiary-container"
                    : "text-on-surface-variant"
              }`}
            >
              {m.verdict}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-auto p-3.5 rounded-xl bg-secondary-container/40 flex items-start gap-3">
        <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">
          auto_fix_high
        </span>
        <div className="min-w-0">
          <span className="font-headline-sm text-body-sm text-on-surface block">
            About this tool
          </span>
          <p className="font-body-sm text-[12px] text-on-surface-variant leading-normal mt-0.5">
            All metrics are computed in your browser from the pasted text. No AI evaluation is
            running.
          </p>
        </div>
      </div>
    </div>
  );
}
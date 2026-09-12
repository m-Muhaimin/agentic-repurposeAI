"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";

type FilterTab = {
  id: string;
  label: string;
  count: number;
  dot?: string;
  icon?: string;
};

export const FILTER_TABS: FilterTab[] = [
  { id: "all", label: "All Assets", count: 48 },
  { id: "review", label: "Needs Review", count: 3, dot: "bg-error" },
  { id: "ready", label: "Ready to Publish", count: 12, dot: "bg-tertiary" },
  { id: "scheduled", label: "Scheduled", count: 4, icon: "schedule" },
  { id: "published", label: "Published", count: 29 },
];

const FORMATS = [
  "LinkedIn Longform",
  "Executive Newsletter",
  "Shorts • Reels (9:16)",
  "X / Twitter Threads",
  "Infographics & Carousels",
];

export default function LibraryFilterBar({
  counts,
}: {
  counts?: Partial<Record<string, number>>;
}) {
  const [activeTab, setActiveTab] = useState("all");
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());

  const tabs = FILTER_TABS.map((tab) => ({
    ...tab,
    count: counts?.[tab.id] ?? tab.count,
  }));

  const toggleFormat = (format: string) =>
    setActiveFormats((prev) => {
      const next = new Set(prev);
      if (next.has(format)) next.delete(format);
      else next.add(format);
      return next;
    });

  return (
    <div className="flex flex-col gap-y-space-xs pt-space-xs">
      <div className="flex items-center gap-1 overflow-x-auto py-1 text-nowrap">
        {tabs.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              className={
                active
                  ? "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-on-background text-surface-container-lowest font-caption-bold text-caption-bold shadow-xs"
                  : "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-lowest text-on-surface-variant font-caption-bold text-caption-bold hover:bg-surface-container shadow-xs transition-colors"
              }
              type="button"
              aria-pressed={active}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.dot ? <span className={`w-1.5 h-1.5 rounded-full ${tab.dot}`}></span> : null}
              {tab.icon ? (
                <Icon name={tab.icon} size={14} className="text-secondary" />
              ) : null}
              <span>{tab.label}</span>
              <span
                className={
                  active
                    ? "px-1.5 py-0.2 rounded-full bg-surface-container-lowest/20 text-[10px]"
                    : tab.dot
                      ? "px-1.5 py-0.2 rounded-full bg-error-container text-on-error-container text-[10px]"
                      : "px-1.5 py-0.2 rounded-full bg-surface-container-high text-secondary text-[10px]"
                }
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2 overflow-x-auto text-nowrap pb-1">
        <span className="font-label-caps text-label-caps text-secondary uppercase tracking-wider pl-1">
          Target Format:
        </span>
        {FORMATS.map((format) => {
          const active = activeFormats.has(format);
          return (
            <button
              key={format}
              className={`px-2.5 py-1 rounded-full font-body-sm text-body-sm transition-colors ${
                active
                  ? "bg-primary text-on-primary shadow-sm"
                  : "bg-surface-container-low text-on-surface hover:bg-surface-container-high"
              }`}
              type="button"
              aria-pressed={active}
              onClick={() => toggleFormat(format)}
            >
              {format}
            </button>
          );
        })}
        {activeFormats.size > 0 && (
          <button
            className="px-2 py-1 text-[11px] font-caption-bold text-secondary hover:text-error transition-colors"
            type="button"
            onClick={() => setActiveFormats(new Set())}
          >
            Clear ({activeFormats.size})
          </button>
        )}
      </div>
    </div>
  );
}
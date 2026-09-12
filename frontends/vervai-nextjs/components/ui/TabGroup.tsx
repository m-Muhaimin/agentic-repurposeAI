"use client";

import { useRef } from "react";
import type { KeyboardEvent, ReactNode } from "react";

type Tab = { id: string; label: string };

type TabGroupProps = {
  tabs: Tab[];
  activeId: string;
  onChange: (id: string) => void;
  children?: ReactNode;
  className?: string;
};

export default function TabGroup({
  tabs,
  activeId,
  onChange,
  children,
  className = "",
}: TabGroupProps) {
  const tabListRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (e: KeyboardEvent) => {
    const idx = tabs.findIndex((t) => t.id === activeId);
    let next = idx;
    if (e.key === "ArrowRight") next = Math.min(idx + 1, tabs.length - 1);
    if (e.key === "ArrowLeft") next = Math.max(idx - 1, 0);
    if (next !== idx) {
      e.preventDefault();
      onChange(tabs[next].id);
    }
  };

  return (
    <div className={className}>
      <div
        ref={tabListRef}
        role="tablist"
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
        className="flex items-center gap-1 rounded-lg bg-surface-container p-1"
      >
        {tabs.map((tab) => {
          const active = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={active}
              aria-controls={`panel-${tab.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(tab.id)}
              className={`px-3 py-1.5 rounded-md font-caption-bold text-caption-bold transition-colors ${
                active
                  ? "bg-surface-container-lowest text-primary shadow-sm"
                  : "text-secondary hover:text-on-surface"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
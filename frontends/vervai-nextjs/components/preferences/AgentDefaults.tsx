"use client";

import { useState } from "react";
import Toggle from "@/components/ui/Toggle";

type Patch = {
  autoMode?: boolean;
  tone?: string;
  forbidden?: string[];
  examples?: string[];
  samples?: string[];
};

// Props are typed optional (with bare-render defaults) because the
// preferences page is a server component and cannot hold client state to pass
// them. PreferencesManager always injects the full controlled prop set into
// this component via cloneElement at runtime; the defaults below only keep the
// bare-render path safe (e.g. Storybook/isolated previews).
type AgentDefaultsProps = {
  autoMode?: boolean;
  tone?: string;
  forbidden?: string[];
  examples?: string[];
  samples?: string[];
  onChange?: (patch: Patch) => void;
  onReset?: () => void;
};

type ListMode = "phrases" | "examples" | "samples";

type ListSectionProps = {
  mode: ListMode;
  items: string[];
  onChange?: (patch: Patch) => void;
};

function ListSection({ mode, items, onChange }: ListSectionProps) {
  const [draft, setDraft] = useState("");

  const title =
    mode === "phrases"
      ? "Forbidden Phrases"
      : mode === "examples"
        ? "Brand Examples"
        : "Brand Samples";
  const singular = mode === "phrases" ? "phrase" : mode === "examples" ? "example" : "sample";

  const emit = (next: string[]) => {
    if (mode === "phrases") onChange?.({ forbidden: next });
    else if (mode === "examples") onChange?.({ examples: next });
    else onChange?.({ samples: next });
  };

  const removeItem = (item: string) => {
    emit(items.filter((i) => i !== item));
  };

  const addItem = () => {
    const value = draft.trim();
    if (!value) return;
    emit([...items, value]);
    setDraft("");
  };

  return (
    <div className="flex flex-col p-space-md bg-surface-container-low rounded-xl gap-2">
      <div className="flex items-center justify-between">
        <span className="font-headline-sm text-headline-sm text-on-surface">{title}</span>
        <span className="font-caption-bold text-caption-bold text-primary font-semibold">
          {items.length}
        </span>
      </div>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-surface-container-highest text-on-surface font-caption-bold text-caption-bold"
            >
              {item}
              <button
                className="text-outline hover:text-error transition-colors"
                type="button"
                aria-label={`Remove ${item}`}
                onClick={() => removeItem(item)}
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          No {singular}s configured.
        </p>
      )}
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          addItem();
        }}
      >
        <input
          className="flex-1 min-w-0 px-3 py-2 bg-surface-container-lowest text-on-surface font-body-sm text-body-sm rounded-lg outline-none focus:shadow-sm focus:bg-surface-container-highest transition-all placeholder:text-outline"
          type="text"
          value={draft}
          aria-label={`Add ${singular}`}
          placeholder={`Add a ${singular}…`}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          className="shrink-0 px-3 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-body-medium text-body-medium transition-colors"
          type="submit"
        >
          Add
        </button>
      </form>
    </div>
  );
}

export default function AgentDefaults({
  autoMode = false,
  tone = "",
  forbidden = [],
  examples = [],
  samples = [],
  onChange,
  onReset,
}: AgentDefaultsProps) {
  return (
    <section
      id="agent-defaults"
      className="lg:col-span-7 bg-surface-container-lowest rounded-xl p-space-xl shadow-sm flex flex-col justify-between gap-space-lg scroll-mt-8"
    >
      <div className="flex flex-col gap-space-md">
        <div className="flex items-center justify-between pb-space-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary-container text-on-secondary-fixed">
              <span className="material-symbols-outlined text-[20px]">psychology</span>
            </div>
            <div>
              <h2 className="font-headline-lg text-headline-lg text-on-surface">
                Autonomous Agent Default Behaviors
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Defaults the agent uses when processing new source content.
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-space-md">
          <div className="flex items-start justify-between p-space-md bg-surface-container-low rounded-xl gap-space-md">
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm text-on-surface">
                Autonomous mode
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                Start processing automatically when new source content arrives.
              </span>
            </div>
            <div className="shrink-0 mt-1">
              <Toggle checked={autoMode} onChange={(v) => onChange?.({ autoMode: v })} />
            </div>
          </div>
          <div className="flex flex-col p-space-md bg-surface-container-low rounded-xl gap-2">
            <label
              className="font-headline-sm text-headline-sm text-on-surface"
              htmlFor="agent-brand-tone"
            >
              Brand Tone
            </label>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Free-text description of your brand voice used by the agent.
            </p>
            <textarea
              id="agent-brand-tone"
              className="p-3 bg-surface-container-lowest text-on-surface font-body-sm text-body-sm rounded-lg outline-none focus:shadow-sm focus:bg-surface-container-highest transition-all resize-none placeholder:text-outline"
              rows={3}
              placeholder="No brand tone configured"
              value={tone}
              onChange={(e) => onChange?.({ tone: e.target.value })}
            />
          </div>
          <ListSection mode="phrases" items={forbidden} onChange={onChange} />
          <ListSection mode="examples" items={examples} onChange={onChange} />
          <ListSection mode="samples" items={samples} onChange={onChange} />
        </div>
      </div>
      <div className="pt-2 flex flex-wrap items-center justify-end gap-space-sm">
        <span className="font-body-sm text-[12px] text-on-surface-variant mr-auto">
          Saved to your workspace when you apply.
        </span>
        <button
          className="px-space-md py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-body-medium text-body-medium transition-all"
          type="button"
          onClick={onReset}
        >
          Revert to System Defaults
        </button>
      </div>
    </section>
  );
}
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/card";
import SegmentedControl from "@/components/segmented-control";
import type { AgentMode } from "@/types/agent";
import { AGENT_MODES, AGENT_MODE_LABEL } from "@/types/agent";
import {
  AGENT_INTENTS,
  AGENT_INTENT_DEFS,
  defaultModeFor,
  detectIntent,
  intentStartsRun,
  isValidGoal,
  summarizeGoal,
  userChoosesSourceFor,
  type AgentIntent
} from "@/lib/agent/outcomes";

export interface ComposerSource {
  id: string;
  title: string;
  status: string;
  created_at: string;
}

// The outcome-first entry point (P0). Instead of "pick a source, pick a mode",
// the user says what they want to accomplish. Intent + goal set sensible
// defaults; the source becomes an optional refinement that the agent can
// auto-fill from the best ready transcript. The machine contract on top
// (POST /api/agent/runs with { sourceId, mode }) is unchanged.

export default function OutcomeComposer({
  sources,
  defaultSourceId,
  initialGoal,
  busy,
  error,
  onStart,
  onExploreOpportunities
}: {
  sources: ComposerSource[];
  defaultSourceId: string | null;
  initialGoal?: string;
  busy: boolean;
  error: string | null;
  onStart: (goal: string, intent: AgentIntent, sourceId: string, mode: AgentMode) => void;
  onExploreOpportunities: () => void;
}) {
  const [goal, setGoal] = useState(initialGoal ?? "");
  // A prefilled goal (dashboard deep link) also pre-selects its intent and the
  // matching autonomy default, so the composer reflects what the user asked.
  const initialIntent = useMemo(
    () => (initialGoal?.trim() ? detectIntent(initialGoal) : null),
    [initialGoal]
  );
  const [intent, setIntent] = useState<AgentIntent>(initialIntent ?? "create");
  const [intentTouched, setIntentTouched] = useState(Boolean(initialIntent));
  const [sourceId, setSourceId] = useState<string>(defaultSourceId ?? sources[0]?.id ?? "");
  const [mode, setMode] = useState<AgentMode>(initialIntent ? defaultModeFor(initialIntent) : "assist");
  const [modeTouched, setModeTouched] = useState(Boolean(initialIntent));

  // Gentle intent auto-detection from the goal text — only until the user
  // touches the chips, and it never fights a manual selection.
  const detected = useMemo(() => (intentTouched ? null : detectIntent(goal)), [goal, intentTouched]);

  function chooseIntent(next: AgentIntent) {
    setIntent(next);
    setIntentTouched(true);
    if (!modeTouched) setMode(defaultModeFor(next));
  }

  const def = AGENT_INTENT_DEFS[intent];
  const startsRun = intentStartsRun(intent);
  const needsSourceChoice = userChoosesSourceFor(intent);
  const readySources = sources.filter((s) => s.status === "done" || s.status === "failed");
  const noReadySources = readySources.length === 0;
  const selectedTitle = readySources.find((s) => s.id === sourceId)?.title ?? "";
  const startable = startsRun && !busy && !noReadySources && Boolean(sourceId) && isValidGoal(goal);

  function submit() {
    if (startsRun) {
      onStart(summarizeGoal(goal), intent, sourceId, mode);
    } else {
      onExploreOpportunities();
    }
  }

  return (
    <Card>
      <CardHeader
        title="What are you trying to accomplish?"
        description="Start with the outcome — not the source. The agent plans, you approve, it drafts."
      />

      <div className="space-y-4 px-5 py-4">
        <div>
          <label htmlFor="agent-goal" className="mb-1 block text-xs font-medium text-theme-text-secondary">
            Your goal
          </label>
          <textarea
            id="agent-goal"
            rows={2}
            value={goal}
            onChange={(e) => {
              setGoal(e.target.value);
              const hit = detectIntent(e.target.value);
              if (hit && hit !== intent && !intentTouched) {
                setIntent(hit);
                if (!modeTouched) setMode(defaultModeFor(hit));
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="e.g. Build a week of LinkedIn posts about AI automation for founders."
            className="w-full rounded-lg border border-theme-divider bg-theme-bg-paper px-3 py-2 text-sm placeholder:text-theme-text-secondary"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium text-theme-text-secondary">What do you want to do?</label>
          <div className="flex flex-wrap gap-2">
            {AGENT_INTENTS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => chooseIntent(id)}
                aria-pressed={intent === id}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  intent === id
                    ? "bg-neutral-900 text-white"
                    : "border border-theme-divider bg-theme-bg-paper text-theme-text-secondary hover:text-theme-text-primary"
                }`}
              >
                {AGENT_INTENT_DEFS[id].chip}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-theme-text-secondary">
            {def.headline} — {def.detail}
            {detected && detected !== intent && (
              <span className="text-primary-500"> Suggestion: {AGENT_INTENT_DEFS[detected].chip}.</span>
            )}
          </p>
        </div>

        {startsRun && (
          <div>
            {needsSourceChoice ? (
              <div>
                <label htmlFor="composer-source" className="mb-1 block text-xs font-medium text-theme-text-secondary">
                  Source
                </label>
                <select
                  id="composer-source"
                  value={sourceId}
                  onChange={(e) => setSourceId(e.target.value)}
                  className="w-full rounded-lg border border-theme-divider bg-theme-bg-paper px-3 py-2 text-sm"
                >
                  <option value="">Choose a source…</option>
                  {readySources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title || s.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </div>
            ) : noReadySources ? (
              <p className="text-xs text-theme-text-secondary">
                No ready sources yet — repurpose something first.
              </p>
            ) : (
              <details className="group text-xs text-theme-text-secondary">
                <summary className="cursor-pointer list-none">
                  Working on{" "}
                  <span className="font-medium text-theme-text-primary">
                    {selectedTitle || "your best ready source"}
                  </span>{" "}
                  — <span className="underline">change what it runs on</span>
                </summary>
                <select
                  value={sourceId}
                  onChange={(e) => setSourceId(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-theme-divider bg-theme-bg-paper px-3 py-2 text-sm"
                  aria-label="Override the source the agent starts from"
                >
                  {readySources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title || s.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </details>
            )}
          </div>
        )}

        {startsRun && (
          <div>
            <label className="mb-2 block text-xs font-medium text-theme-text-secondary">Autonomy</label>
            <SegmentedControl<AgentMode>
              options={AGENT_MODES.map((m) => ({ id: m, label: AGENT_MODE_LABEL[m] }))}
              value={mode}
              onChange={(m) => {
                setMode(m);
                setModeTouched(true);
              }}
              ariaLabel="Autonomy mode"
            />
            <p className="mt-2 text-xs text-theme-text-secondary">
              “Guide me” plans and drafts — you approve every angle first. “Do it with my approval”
              adds one bounded auto-revision of a flagged draft. “Run automatically” is reserved for
              publishing and behaves with approvals today.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={!startable}
          className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
        >
          {!startsRun
            ? "Open recommendations"
            : noReadySources
              ? "No ready source yet"
              : busy
                ? "Starting…"
                : "Start agent run"}
        </button>

        {noReadySources && startsRun && (
          <p className="text-xs text-theme-text-secondary">
            The agent plans from a transcript. Upload a source to get one{" "}
            <Link href="/upload" className="text-primary-500 hover:text-primary-700">
              here
            </Link>
            .
          </p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Card>
  );
}
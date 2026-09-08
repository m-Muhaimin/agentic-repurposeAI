"use client";

import { clsx } from "clsx";
import { AGENT_STATUS_LABEL } from "@/lib/status";

// Mirrors the brand mark: a row of 5 solid circles ascending in size, filled
// in primary-500 as the run's stages complete. The active (in-progress) stage
// pulses via the existing animate-pulse-soft; stages not yet reached render
// neutral and faded. Stage names come from AGENT_STATUS_LABEL so the voice
// stays consistent with the rest of the system. The textual stage is always
// kept next to/beside the dots so screen readers get a labelled stage.

const STAGES = ["created", "planning", "executing", "evaluating", "done"] as const;

// Circle diameters (px), ascending left → right, echoing the icon's
// ~4.5 → 11 → 10 → 15 → 11 progression.
const SIZES = [6, 8, 10, 12, 12];

// How many dots are "reached" (completed + the current one) for each run
// status. awaiting_approval sits between planning and executing — a human
// gate, not a progress stage — so it reports planning as reached and stops
// pulsing. failed/cancelled report nothing reached; the retained badge
// conveys that state.
const REACHED: Record<string, number> = {
  created: 1,
  planning: 2,
  awaiting_approval: 2,
  executing: 3,
  evaluating: 4,
  done: 5
};

// Statuses that keep advancing on their own (the current stage pulses).
const RUNNING = new Set(["created", "planning", "executing", "evaluating"]);

export default function AgentProgressDots({
  status,
  className
}: {
  status: string;
  className?: string;
}) {
  const reached = REACHED[status] ?? 0;
  const running = RUNNING.has(status);
  const label = AGENT_STATUS_LABEL[status] ?? status;

  return (
    <span
      role="img"
      aria-label={`${label} — stage ${reached} of ${STAGES.length}`}
      className={clsx("inline-flex items-end gap-1 align-middle", className)}
    >
      {STAGES.map((stage, i) => {
        const completed = i < reached - 1;
        const active = running && i === reached - 1;
        return (
          <span
            key={stage}
            aria-hidden="true"
            style={{ width: SIZES[i], height: SIZES[i] }}
            className={clsx(
              "rounded-full",
              active
                ? "bg-primary-500 animate-pulse-soft"
                : completed
                  ? "bg-primary-500"
                  : "bg-neutral-200 opacity-25"
            )}
          />
        );
      })}
    </span>
  );
}

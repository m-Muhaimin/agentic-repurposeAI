// P12: Retention trimming groundwork — bounded query windows, pure logic, no I/O.
//
// This phase does NOT delete any data and makes NO schema change. It simply
// enforces configurable caps on how far back observe/queue/run queries look,
// with an honest note that the underlying history is fully retained. The caps
// are constants here so the route layer stays trivial and the math is testable.

// Default lookback windows (recency bias: the agent leans on recent work, not
// a growing journal — mirrors the capped edit-signals memory).
export const RETENTION_DEFAULTS = {
  // How far back runs/steps/ideas feed the observe funnel, in milliseconds.
  RUN_HISTORY_MS: 90 * 24 * 60 * 60 * 1000, // 90 days
  // How far back the publish queue surfaces done runs' outputs.
  QUEUE_HISTORY_MS: 90 * 24 * 60 * 60 * 1000, // 90 days
  // Hard cap on list length regardless of window (keeps responses bounded).
  MAX_RUNS: 200,
  MAX_STEPS_PER_RUN: 500,
  MAX_QUEUE_ITEMS: 100
} as const;

export interface RetentionWindow {
  // The ISO timestamp a query should use as its lower bound (after).
  from: string;
  // Whether the caller opted out of the window (returns all history honestly).
  unlimited: boolean;
}

// Compute the bounded query window. `since` is optional; when omitted the
// default retention window applies. Pass `unlimited: true` to see all history
// (read-mostly — used by functions that must reflect the full truth, e.g. the
// strategy snapshot's monthly spend which is month-bounded anyway).
export function retentionWindow(opts?: {
  since?: string;
  unlimited?: boolean;
  now?: Date;
  lookbackMs?: number;
}): RetentionWindow {
  if (opts?.unlimited) {
    return { from: "", unlimited: true };
  }
  const nowMs = (opts?.now ?? new Date()).getTime();
  const capMs = opts?.lookbackMs ?? RETENTION_DEFAULTS.RUN_HISTORY_MS;
  if (opts?.since) {
    // Honor an explicit client/server `since` but still bound it to the cap so
    // a misbehaving "since" can't scan unbounded history.
    const since = Date.parse(opts.since);
    const lower = isNaN(since) ? nowMs - capMs : since;
    return {
      from: new Date(Math.max(lower, nowMs - capMs)).toISOString(),
      unlimited: false
    };
  }
  return {
    from: new Date(nowMs - capMs).toISOString(),
    unlimited: false
  };
}

// Whether a row's createdAt falls inside the bounded window (helper for
// pure tests / client-side prefilter; the server still enforces the window in
// SQL).
export function withinWindow(createdAt: string, window: RetentionWindow): boolean {
  if (window.unlimited) return true;
  return Date.parse(createdAt) >= Date.parse(window.from);
}

// Cap a running count/list length at the configured maximum (bounded output).
export function capAt(value: number, max: number): number {
  return Math.max(0, Math.min(value, max));
}

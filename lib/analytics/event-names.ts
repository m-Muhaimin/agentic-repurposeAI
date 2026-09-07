// Analytics event names live in this PURE module (no imports) so that both the
// server-side `events.ts` trackers and client components can reference them
// without dragging the service-role Supabase client into the browser bundle.

export const EVENTS = {
  SIGNUP_COMPLETED: "signup_completed",
  FIRST_JOB_STARTED: "first_job_started",
  FIRST_JOB_COMPLETED: "first_job_completed",
  JOB_FAILED: "job_failed",
  JOB_RETRIED: "job_retried",
  LIMIT_REACHED: "limit_reached",
  USAGE_50: "usage_50_percent",
  USAGE_80: "usage_80_percent",
  USAGE_100: "usage_100_percent",
  REGENERATION_USED: "regeneration_used",
  DRAFT_OPENED: "draft_opened",
  DRAFT_COPIED: "draft_copied",
  WAITLIST_CLICKED: "waitlist_clicked",
  SAVE_BUTTON_CLICKED: "save_button_clicked"
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
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
  SAVE_BUTTON_CLICKED: "save_button_clicked",
  RECOMMENDATIONS_VIEWED: "recommendations_viewed",
  RECOMMENDATION_SELECTED: "recommendation_selected",
  AGENT_DECISION_REQUESTED: "agent_decision_requested",
  AGENT_PLAN_APPROVED: "agent_plan_approved",
  GENERATION_STARTED: "generation_started",
  GENERATION_COMPLETED: "generation_completed",
  PUBLISH_STARTED: "publish_started",
  PUBLISH_COMPLETED: "publish_completed",
  ORCH_RUN_CREATED: "orch_run_created",
  ORCH_CONTEXT_LOADED: "orch_context_loaded",
  ORCH_RECOMMENDATIONS_READY: "orch_recommendations_ready",
  ORCH_PLAN_CREATED: "orch_plan_created",
  ORCH_APPROVAL_REQUESTED: "orch_approval_requested",
  ORCH_PLAN_APPROVED: "orch_plan_approved",
  ORCH_PLAN_REJECTED: "orch_plan_rejected",
  ORCH_EXECUTION_STARTED: "orch_execution_started",
  ORCH_STEP_COMPLETED: "orch_step_completed",
  ORCH_RUN_COMPLETED: "orch_run_completed",
  ORCH_RUN_FAILED: "orch_run_failed",
  ORCH_RUN_CANCELLED: "orch_run_cancelled"
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
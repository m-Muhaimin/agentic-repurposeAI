// VervAI Orchestrator v1 — progress + event vocabulary.
//
// Maps lifecycle statuses to user-facing progress strings and to analytics
// event names (from the pure lib/analytics/event-names.ts). Keeps all user copy
// in one place and guarantees the analytics side never sees raw status codes.
//
// PURE.

import { EVENTS } from "@/lib/analytics/event-names";
import type { OrchestrationRunStatus } from "./types";

export const STATUS_LABEL: Record<OrchestrationRunStatus, string> = {
  idle: "Ready to start",
  understanding: "Understanding your goal…",
  context_loaded: "Loading your content…",
  opportunities_identified: "Spotting opportunities…",
  recommendations_ready: "Your recommendations are ready",
  planning: "Planning your steps…",
  awaiting_approval: "Needs your approval",
  approved: "Approved — ready to go",
  executing: "Creating your outputs…",
  validating: "Reviewing quality…",
  review: "Ready for your review",
  completed: "Done",
  failed: "Something went wrong",
  cancelled: "Cancelled",
  paused: "Paused"
};

export function statusLabel(status: OrchestrationRunStatus): string {
  return STATUS_LABEL[status];
}

// (EVENTS import keeps us linked to the canonical event names; we never invent
// new strings here.)
export function runEventFor(status: OrchestrationRunStatus): string | null {
  switch (status) {
    case "understanding":
      return EVENTS.ORCH_RUN_CREATED;
    case "context_loaded":
      return EVENTS.ORCH_CONTEXT_LOADED;
    case "recommendations_ready":
      return EVENTS.ORCH_RECOMMENDATIONS_READY;
    case "planning":
      return EVENTS.ORCH_PLAN_CREATED;
    case "awaiting_approval":
      return EVENTS.ORCH_APPROVAL_REQUESTED;
    case "approved":
      return EVENTS.ORCH_PLAN_APPROVED;
    case "executing":
      return EVENTS.ORCH_EXECUTION_STARTED;
    case "completed":
      return EVENTS.ORCH_RUN_COMPLETED;
    case "failed":
      return EVENTS.ORCH_RUN_FAILED;
    case "cancelled":
      return EVENTS.ORCH_RUN_CANCELLED;
    default:
      return null;
  }
}

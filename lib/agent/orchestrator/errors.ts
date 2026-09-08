// VervAI Orchestrator v1 — error model.
//
// Structured error codes with user-safe messages. Internals (detail) are for
// logs only and ALWAYS separated from what a user sees. This module is pure and
// provides a mapping from code → friendly copy, plus a factory.

import type { OrchestrationError, OrchestrationErrorCode } from "./types";

const USER_MESSAGES: Record<OrchestrationErrorCode, string> = {
  INVALID_OBJECTIVE: "That doesn't look like a goal I can plan from yet. Try something like “turn this into a LinkedIn post and a newsletter.”",
  INSUFFICIENT_EVIDENCE: "I don't have enough strong content yet to plan confidently. Share more source material and try again.",
  NO_RECOMMENDATION: "I couldn't find a strong recommendation to work from. Check your source and try again.",
  APPROVAL_REQUIRED: "This needs your approval before I continue.",
  APPROVAL_INVALID: "The plan changed since it was approved — please review and approve the updated plan.",
  PERMISSION_DENIED: "You don't have access to that. Only the owner can do this.",
  USAGE_LIMIT: "You've hit a limit on your current plan. Upgrade to keep going.",
  TOOL_FAILED: "Something went wrong while doing that step. I'll note it and we can retry.",
  VALIDATION_FAILED: "The output didn't pass review. I'll keep it out of your library.",
  PUBLISH_FAILED: "Publishing didn't complete. Nothing was posted. Try again.",
  RUN_CANCELLED: "This run was cancelled. Completed work stays in your library.",
  RUN_TIMEOUT: "This run took too long and was stopped. You can start again."
};

export function userMessageFor(code: OrchestrationErrorCode): string {
  return USER_MESSAGES[code];
}

export function orchestrationError(
  code: OrchestrationErrorCode,
  detail?: string
): OrchestrationError {
  return {
    code,
    userMessage: USER_MESSAGES[code],
    ...(detail ? { detail } : {})
  };
}

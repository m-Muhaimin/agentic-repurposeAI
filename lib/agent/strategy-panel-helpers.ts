// Pure formatters shared by the agent strategy surfaces — no JSX, no I/O,
// fully testable. Imported by opportunity-feed.tsx and plan-view.tsx; vitest
// can import them without needing the JSX transform.

import type { OutputFormat } from "@/types/agent";

export const FORMAT_LABEL: Record<OutputFormat, string> = {
  linkedin_post: "LinkedIn post",
  newsletter: "Newsletter",
  shortform_script: "Short-form script",
  thread: "Thread",
  carousel: "Carousel"
};

export function formatScore(score: number): string {
  return `${Math.round(score * 100)}%`;
}

export interface BudgetHeadroom {
  jobsLimit: number | null;
  jobsUsed: number;
  jobsRemaining: number | null;
  atLimit: boolean;
  perRunAgent: { maxSteps: number; maxCostUnits: number; maxRuntimeSeconds: number };
}

export function formatHeadroom(headroom: BudgetHeadroom): string {
  if (headroom.jobsLimit === null) {
    return `No monthly cap · ${headroom.perRunAgent.maxSteps} steps per run`;
  }
  const remaining = headroom.jobsRemaining ?? 0;
  return `${remaining} job${remaining === 1 ? "" : "s"} left this month of ${headroom.jobsLimit} · ${headroom.perRunAgent.maxSteps} steps per run`;
}

export function formatExclusionCode(code: string): string {
  switch (code) {
    case "NO_READY_TRANSCRIPT": return "No transcript";
    case "BUDGET_CEILING": return "Budget exhausted";
    default: return code;
  }
}

// Outcome-centric run creation (P0): the agent entry point asks what the user
// wants to accomplish — not which source to process. Intents are pure mappings
// onto the existing durable run machine: they only set defaults (autonomy mode,
// whether a source must be chosen up-front) and honest UI copy. The runtime
// (planning → approval → execution → evaluation) is untouched.

import type { AgentMode } from "@/types/agent";

export type AgentIntent =
  | "create"
  | "plan"
  | "repurpose"
  | "improve"
  | "find_opportunities"
  | "build_week";

export const AGENT_INTENTS: readonly AgentIntent[] = [
  "create",
  "plan",
  "repurpose",
  "improve",
  "find_opportunities",
  "build_week"
];

export interface AgentIntentDef {
  id: AgentIntent;
  // Quick-action chip the user clicks, e.g. "Create".
  chip: string;
  // Human headline for the selected intent.
  headline: string;
  // One-line honest description of what the machine will actually do.
  detail: string;
  // The run machine always needs a source transcript to plan from; this flag is
  // the UX gate — false means the agent auto-picks the best ready source so the
  // user is never forced to choose one.
  requiresSource: boolean;
  // Whether the user must actively pick the source (vs an optional refinement).
  choosesSource: boolean;
  // Autonomy mode the intent defaults to (user can still override).
  defaultMode: AgentMode;
  // Starts a durable run. False for actions that open a surface instead.
  startsRun: boolean;
}

export const AGENT_INTENT_DEFS: Record<AgentIntent, AgentIntentDef> = {
  repurpose: {
    id: "repurpose",
    chip: "Repurpose",
    headline: "Turn one recording into posts",
    detail: "Pick the strongest angles from a source and draft them for you to review.",
    requiresSource: true,
    choosesSource: true,
    defaultMode: "assist",
    startsRun: true
  },
  create: {
    id: "create",
    chip: "Create",
    headline: "Create fresh content",
    detail: "Plan and draft new posts from your most useful ready source — you approve before anything is written.",
    requiresSource: true,
    choosesSource: false,
    defaultMode: "assist",
    startsRun: true
  },
  plan: {
    id: "plan",
    chip: "Plan",
    headline: "Plan what's worth saying",
    detail: "See what angles your content can produce and decide which to keep — no drafts until you approve.",
    requiresSource: true,
    choosesSource: false,
    defaultMode: "assist",
    startsRun: true
  },
  improve: {
    id: "improve",
    chip: "Improve",
    headline: "Improve what you have",
    detail: "Re-work an existing recording into sharper drafts, with one bounded revision for anything weak.",
    requiresSource: true,
    choosesSource: true,
    defaultMode: "execute",
    startsRun: true
  },
  find_opportunities: {
    id: "find_opportunities",
    chip: "Find opportunities",
    headline: "Find your next opportunity",
    detail: "Show the agent's recommendations — what to publish next, based on your real content and budget.",
    requiresSource: false,
    choosesSource: false,
    defaultMode: "assist",
    startsRun: false
  },
  build_week: {
    id: "build_week",
    chip: "Build a week",
    headline: "Build a week of content",
    detail: "Plan a week's worth of posts from your best ready source; approve the angles you want to publish.",
    requiresSource: true,
    choosesSource: false,
    defaultMode: "assist",
    startsRun: true
  }
};

export function isAgentIntent(v: unknown): v is AgentIntent {
  return typeof v === "string" && (AGENT_INTENTS as string[]).includes(v);
}

export function sourceRequiredFor(intent: AgentIntent): boolean {
  return AGENT_INTENT_DEFS[intent].requiresSource;
}

export function userChoosesSourceFor(intent: AgentIntent): boolean {
  return AGENT_INTENT_DEFS[intent].choosesSource;
}

export function intentStartsRun(intent: AgentIntent): boolean {
  return AGENT_INTENT_DEFS[intent].startsRun;
}

export function defaultModeFor(intent: AgentIntent): AgentMode {
  return AGENT_INTENT_DEFS[intent].defaultMode;
}

// Heuristic intent detection from a free-text goal. Fuzzy by design: keyword
// hits only suggest a default chip — the user's explicit selection always wins.
export function detectIntent(text: string): AgentIntent | null {
  const t = text.toLowerCase();
  if (/(build|plan|schedule|make).*\bweek\b|\bweekly\b/.test(t)) return "build_week";
  if (/\bopportunit|\bwhat should i (do|publish|work on)\b/.test(t)) return "find_opportunities";
  if (/\bimprov|\bsharpen|\brework\b/.test(t)) return "improve";
  if (/\bplan\b|\bangl(e|es)\b|\bwhat.*worth saying\b/.test(t)) return "plan";
  if (/\brepurpos|\bfrom (a |the )?(recording|podcast|video|source)\b/.test(t)) return "repurpose";
  if (/\bcreat|\bwrite\b|\bpost(s)?\b|\bcontent\b/.test(t)) return "create";
  return null;
}

// Summarize a free-text goal into a short run label (session display only —
// the durable run row keeps its source-linked identity).
export function summarizeGoal(text: string, maxChars = 80): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.length <= maxChars ? cleaned : `${cleaned.slice(0, maxChars - 1)}…`;
}

export function isValidGoal(text: string): boolean {
  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned.split(/\s+/).some((w) => w.length >= 3);
}
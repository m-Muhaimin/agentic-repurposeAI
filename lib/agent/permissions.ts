// Fixed capability sets per autonomy mode. Permissions are decided HERE, once,
// not inferred mid-run — a run in "assist" can never silently escalate to
// "automate" because a tool decided to. Every tool in the registry declares the
// minimum mode(s) it requires; this module maps a mode to the tools that run.

import type { AgentMode, AgentStepKind } from "@/types/agent";

// The asset dimensions of the Agentic product:
//  - plan: can the agent generate a content plan for a source?
//  - generate: can it run deterministic generation (write drafts)?
//  - review: can it evaluate + flag weak drafts?
//  - evaluate: can it score drafts against a rubric?
//  - revise: may it auto-revise a flagged draft (V1: bounded to one revision)?
//  - distribute: may it schedule / publish (Stage 4 — gated off today)?
//  - strategize: may it write/update the content strategy doc (Stage 3 seed)?
export interface CapabilitySet {
  plan: boolean;
  generate: boolean;
  review: boolean;
  evaluate: boolean;
  revise: boolean;
  distribute: boolean;
  strategize: boolean;
}

// Mode semantics (from the grounded roadmap):
//  - assist:   plan + user approval gate + deterministic generation + eval
//              flags. No auto-revision, no distribution, no strategy writes.
//  - execute:  everything in assist, plus one bounded auto-revision pass on
//              flagged drafts. Still no distribution/strategy writes.
//  - automate: reserved for Stage 4 (schedule/publish + performance loop).
//              Today it maps to the same tool surface as execute except the
//              distribute/strategize tools are exposed as STRUCTURED CAPABILITY
//              STUBS that deliberately throw NotImplementedError.
export const CAPABILITIES: Record<AgentMode, CapabilitySet> = {
  assist: {
    plan: true,
    generate: true,
    review: true,
    evaluate: true,
    revise: false,
    distribute: false,
    strategize: false
  },
  execute: {
    plan: true,
    generate: true,
    review: true,
    evaluate: true,
    revise: true,
    distribute: false,
    strategize: false
  },
  automate: {
    plan: true,
    generate: true,
    review: true,
    evaluate: true,
    revise: true,
    distribute: true,
    strategize: true
  }
};

// The step kinds a mode may actually execute. Tools register a `kind`; a run's
// mode filters the registry before anything runs.
const STEP_KIND_BY_CAPABILITY: Record<keyof CapabilitySet, AgentStepKind[]> = {
  plan: ["planning"],
  generate: ["source", "generation"],
  review: ["review"],
  evaluate: ["review"],
  revise: ["review"],
  distribute: ["distribution"],
  strategize: ["strategy"]
};

export function allowedStepKinds(mode: AgentMode): Set<AgentStepKind> {
  const caps = CAPABILITIES[mode];
  const kinds = new Set<AgentStepKind>();
  for (const [cap, k] of Object.entries(STEP_KIND_BY_CAPABILITY)) {
    if (caps[cap as keyof CapabilitySet]) {
      for (const kind of k) kinds.add(kind);
    }
  }
  return kinds;
}

export function toolAllowedForMode(toolKinds: AgentStepKind[], mode: AgentMode): boolean {
  const allowed = allowedStepKinds(mode);
  return toolKinds.some((k) => allowed.has(k));
}

// Default mode for a new run. Users pick explicitly on the /agent page, but
// this is the safe fallback (Assist = human in the loop).
export const DEFAULT_MODE: AgentMode = "assist";